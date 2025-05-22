/**
 * Chat System for Voeux Pro 
 * Permet la communication en temps réel entre enseignants et administrateurs
 */

// Variables globales
let socket;
let currentUserId;
let currentChatUserId;
let conversations = [];
let unreadMessages = 0;
let chatContainer;
let newChatButton;
let messagesListElement;
let lastMessageTimestamp = null;
let typingTimeout;
let isTyping = false;
let userStatus = 'online';

// État du chat
const chatState = {
    minimized: true,
    expanded: false, // Si le chat est développé (conversations vs messages)
    maximized: false, // Si le chat est en plein écran
    currentConversation: null
};

// Initialisation du chat
function initChat() {
    // S'assurer que l'utilisateur est connecté
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Chat: L\'utilisateur n\'est pas connecté');
        return;
    }

    // Récupérer l'ID de l'utilisateur actuel
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    currentUserId = userData.id;

    if (!currentUserId) {
        console.error('Chat: ID utilisateur non disponible');
        return;
    }

    // Initialiser l'état du chat comme minimisé
    chatState.minimized = true;
    chatState.expanded = false;
    chatState.maximized = false;

    // Ajouter les styles du chat
    addChatStyles();

    // Créer le bouton de chat
    createChatButton();

    // Initialiser la connexion Socket.io
    initializeSocketConnection(token);

    // NE PAS créer le conteneur du chat ici !
    setupEventListeners();
    
    // Gestionnaire pour détecter la fermeture du navigateur
    window.addEventListener('beforeunload', function() {
        if (socket && socket.connected) {
            socket.emit('user_logout');
            socket.emit('update_status', { status: 'offline' });
        }
    });
}

// Ajouter les styles du chat
function addChatStyles() {
    // Vérifier si les styles sont déjà chargés
    if (!document.getElementById('chat-styles')) {
        const link = document.createElement('link');
        link.id = 'chat-styles';
        link.rel = 'stylesheet';
        link.href = '/css/chat.css';
        document.head.appendChild(link);
    }
}

// Initialiser la connexion Socket.io
function initializeSocketConnection(token) {
    // Initialiser Socket.io
    socket = io({
        auth: {
            token: token
        }
    });

    // Gérer les événements de connexion
    socket.on('connect', () => {
        console.log('Chat: Connecté au serveur');
        
        // Charger les conversations
        loadConversations();
    });

    socket.on('connect_error', (error) => {
        console.error('Chat: Erreur de connexion', error);
    });

    socket.on('disconnect', () => {
        console.log('Chat: Déconnecté du serveur');
    });

    // Écouter les nouveaux messages
    socket.on('receive_message', (message) => {
        handleNewMessage(message);
    });

    // Écouter les notifications de nouveaux messages
    socket.on('new_message_notification', (data) => {
        showMessageNotification(data);
    });

    // Écouter les changements de statut des utilisateurs
    socket.on('user_status_change', (data) => {
        updateUserStatusUI(data.userId, data.status);
    });
}

// Créer le bouton de chat
function createChatButton() {
    // Vérifier si le bouton existe déjà
    if (document.getElementById('new-chat-button')) {
        return;
    }

    newChatButton = document.createElement('div');
    newChatButton.id = 'new-chat-button';
    newChatButton.className = 'new-chat-button';
    newChatButton.innerHTML = '<i class="bi bi-chat-dots-fill"></i>';
    newChatButton.setAttribute('title', 'Messages');
    document.body.appendChild(newChatButton);

    // Ajouter l'événement de clic
    newChatButton.addEventListener('click', toggleChat);
}

// Créer le conteneur du chat
function createChatContainer() {
    console.log('Chat: Création du conteneur');
    // Vérifier si le conteneur existe déjà
    if (document.getElementById('chat-container')) {
        console.log('Chat: Le conteneur existe déjà');
        chatContainer = document.getElementById('chat-container');
        messagesListElement = document.getElementById('messages-list');
        return;
    }

    chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';
    chatContainer.className = 'chat-container minimized';
    chatState.minimized = true; // S'assurer que l'état est bien minimisé
    
    // Structure HTML du chat
    chatContainer.innerHTML = `
        <div class="chat-header">
            <div class="chat-header-title">
                <i class="bi bi-chat-dots-fill"></i>
                <h4>Messages</h4>
            </div>
            <div class="chat-header-actions">
                <button class="chat-header-button" id="chat-maximize-button" title="Agrandir la fenêtre">
                    <i class="bi bi-fullscreen"></i>
                </button>
                <button class="chat-header-button" id="chat-close-button" title="Fermer">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        </div>
        
        <div class="chat-conversations" id="chat-conversations">
            <!-- Ajout du champ de recherche -->
            <div class="search-container mb-2">
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                    <input type="text" class="form-control" id="search-conversation" placeholder="Rechercher un utilisateur...">
                </div>
            </div>
            <!-- Les conversations seront ajoutées ici dynamiquement -->
            <div class="chat-placeholder" id="conversations-placeholder">
                <i class="bi bi-chat-dots chat-placeholder-icon"></i>
                <h5 class="chat-placeholder-title">Aucune conversation</h5>
                <p class="chat-placeholder-text">Commencez une conversation avec un enseignant ou un administrateur.</p>
            </div>
        </div>
        
        <div class="chat-messages" id="chat-messages">
            <div class="messages-header">
                <div class="messages-header-info">
                    <button class="messages-header-button" id="back-to-conversations-button" title="Retour">
                        <i class="bi bi-arrow-left"></i>
                    </button>
                    <div class="chat-user-info">
                        <h5 class="messages-header-name" id="chat-user-name"></h5>
                        <p class="messages-header-status" id="chat-user-status"></p>
                    </div>
                </div>
                <div class="messages-header-actions">
                    <button class="messages-header-button" title="Options">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                </div>
            </div>
            
            <div class="messages-list" id="messages-list">
                <div class="chat-placeholder" id="messages-placeholder">
                    <i class="bi bi-chat-dots chat-placeholder-icon"></i>
                    <h5 class="chat-placeholder-title">Aucun message</h5>
                    <p class="chat-placeholder-text">Commencez à discuter en envoyant un message.</p>
                </div>
                <!-- Les messages seront ajoutés ici dynamiquement -->
            </div>
            
            <div class="message-input-container">
                <input type="text" class="message-input" id="message-input" placeholder="Écrivez votre message...">
                <div class="message-input-actions">
                    <button class="message-input-button" title="Envoyer un fichier">
                        <i class="bi bi-paperclip"></i>
                    </button>
                    <button class="message-input-button send" id="send-message-button" title="Envoyer">
                        <i class="bi bi-send-fill"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="chat-loading" id="chat-loading" style="display: none;">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    document.body.appendChild(chatContainer);
}

// Toggle l'état du chat (afficher/fermer complètement)
function toggleChat() {
    const existingChat = document.getElementById('chat-container');
    if (!existingChat) {
        // Créer et afficher le chat
        createChatContainer();
        chatContainer = document.getElementById('chat-container');
        chatContainer.classList.remove('minimized');
        chatContainer.classList.add('expanded');
        chatState.minimized = false;
        chatState.expanded = true;
        loadConversations();
        resetUnreadCount();

        // Ajouter les gestionnaires d'événements après création
        setupEventListeners();
    } else {
        // Supprimer le chat du DOM
        existingChat.remove();
        chatContainer = null; // Réinitialiser la variable globale
        chatState.minimized = true;
        chatState.expanded = false;
        chatState.maximized = false;
    }
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    // Écouteur pour maximiser le chat
    document.addEventListener('click', function(e) {
        const maximizeButton = e.target.closest('#chat-maximize-button');
        if (maximizeButton) {
            e.stopPropagation();
            e.preventDefault();
            
            // S'assurer que chatContainer est bien la variable globale
            if (!chatContainer) {
                chatContainer = document.getElementById('chat-container');
            }
            
            if (!chatContainer) {
                console.error('Chat: Container non trouvé');
                return;
            }
            
            const iconElement = maximizeButton.querySelector('i');
            
            if (chatState.maximized) {
                // Réduire le chat
                chatContainer.classList.remove('maximized');
                chatState.maximized = false;
                // Changer l'icône en plein écran
                iconElement.className = 'bi bi-fullscreen';
                maximizeButton.setAttribute('title', 'Agrandir la fenêtre');
                console.log('Chat: Fenêtre réduite');
            } else {
                // Maximiser le chat
                chatContainer.classList.add('maximized');
                chatState.maximized = true;
                // Changer l'icône en sortie de plein écran
                iconElement.className = 'bi bi-fullscreen-exit';
                maximizeButton.setAttribute('title', 'Réduire la fenêtre');
                console.log('Chat: Fenêtre agrandie');
            }
        }
    });
    
    // Écouteur pour fermer le chat
    document.addEventListener('click', function(e) {
        const closeButton = e.target.closest('#chat-close-button');
        if (closeButton) {
            e.stopPropagation();
            e.preventDefault();
            
            // S'assurer que chatContainer est bien la variable globale
            if (!chatContainer) {
                chatContainer = document.getElementById('chat-container');
            }
            
            if (!chatContainer) {
                console.error('Chat: Container non trouvé pour fermeture');
                return;
            }
            
            // Fermer complètement le chat (comme le bouton de message)
            chatContainer.remove();
            chatContainer = null; // Réinitialiser la variable globale
            chatState.minimized = true;
            chatState.expanded = false;
            chatState.maximized = false;
            console.log('Chat: Fenêtre fermée');
        }
    });
    
    // Empêcher l'événement de clic sur l'en-tête de se propager lorsqu'on clique sur les boutons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.chat-header-button')) {
            e.stopPropagation();
        }
    });
    
    // Écouteur pour le bouton de retour aux conversations
    document.addEventListener('click', function(e) {
        if (e.target.closest('#back-to-conversations-button')) {
            showConversations();
        }
    });
    
    // Écouteur pour l'envoi de message
    document.addEventListener('click', function(e) {
        if (e.target.closest('#send-message-button')) {
            sendMessage();
        }
    });
    
    // Écouteur pour l'envoi de message avec Entrée
    document.addEventListener('keypress', function(e) {
        if (e.target && e.target.id === 'message-input' && e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Écouteur pour la recherche de conversations
    document.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'search-conversation') {
            filterConversations(e.target.value);
        }
        });
        
    document.addEventListener('keyup', function(e) {
        if (e.target && e.target.id === 'search-conversation' && e.key === 'Enter') {
                filterConversations(e.target.value);
            }
        });
}

// Fonction de filtrage de conversations et recherche d'utilisateurs
function filterConversations(searchTerm) {
    const conversationItems = document.querySelectorAll('.conversation-item');
    const placeholderElement = document.getElementById('conversations-placeholder');
    const adminSeparator = document.querySelector('.admin-separator');
    
    // Normaliser le terme de recherche (minuscules et sans accents)
    const searchTermNormalized = searchTerm.trim().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    
    console.log('Chat: Recherche avec le terme:', searchTermNormalized);
    
    // Si pas de terme, afficher toutes les conversations existantes
    if (searchTermNormalized === '') {
        // Réinitialiser l'affichage des conversations existantes
        conversationItems.forEach(item => {
            item.style.display = 'flex';
        });
        
        // Afficher le séparateur des administrateurs s'il existe
        if (adminSeparator) {
            adminSeparator.style.display = 'flex';
        }
        
        // Supprimer les résultats de recherche temporaires
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.remove();
        });
        
        // Mettre à jour la visibilité du placeholder
        updatePlaceholderVisibility();
        
        return;
    }
    
    // Rechercher à la fois dans les conversations existantes et sur le serveur
    
    // 1. Filtrer d'abord les conversations existantes
    let hasVisibleConversation = false;
    let hasVisibleAdmin = false;
    
    conversationItems.forEach(item => {
        const username = item.querySelector('.conversation-name').textContent;
        
        // Normaliser le nom d'utilisateur pour la comparaison (minuscules et sans accents)
        const usernameNormalized = username.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        
        // Afficher si le nom contient le terme de recherche
        if (usernameNormalized.includes(searchTermNormalized)) {
            item.style.display = 'flex';
            hasVisibleConversation = true;
            
            // Vérifier si c'est un administrateur
            if (item.classList.contains('admin-item')) {
                hasVisibleAdmin = true;
            }
        } else {
            item.style.display = 'none';
        }
    });
    
    // Gestion de l'affichage du séparateur des administrateurs
    if (adminSeparator) {
        adminSeparator.style.display = hasVisibleAdmin ? 'flex' : 'none';
    }
    
    // 2. Si le terme de recherche a au moins 2 caractères, rechercher également sur le serveur
    if (searchTermNormalized.length >= 2) {
        // Supprimer d'abord les anciens résultats de recherche
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.remove();
        });
        
        // Afficher indicateur de chargement
        placeholderElement.style.display = 'flex';
        placeholderElement.querySelector('.chat-placeholder-title').textContent = 'Recherche en cours...';
        placeholderElement.querySelector('.chat-placeholder-text').textContent = '';
        
        // Effectuer la recherche sur le serveur
        fetch(`/api/chat/search?term=${encodeURIComponent(searchTerm)}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const users = data.users || [];
                
                // Supprimer à nouveau les anciens résultats (au cas où la requête prend du temps)
                document.querySelectorAll('.search-result-item').forEach(item => {
                    item.remove();
                });
                
                if (users.length > 0) {
                    // Ajouter les utilisateurs trouvés comme résultats de recherche
                    const conversationsContainer = document.getElementById('chat-conversations');
                    
                    users.forEach(user => {
                        // Vérifier si cet utilisateur n'est pas déjà dans les conversations visibles
                        const existingConversation = document.querySelector(`.conversation-item[data-user-id="${user._id}"]:not([style*="display: none"])`);
                        if (!existingConversation) {
                            // Déterminer si c'est un admin ou un utilisateur normal
                            const isAdmin = user.role === 'admin' || user.role === 'superadmin';
                            const userItem = isAdmin ? createAdminElement(user) : createSearchResultItem(user);
                            conversationsContainer.appendChild(userItem);
                            hasVisibleConversation = true;
                            
                            // Si c'est le premier admin trouvé, ajouter un séparateur
                            if (isAdmin && !hasVisibleAdmin && !document.querySelector('.admin-separator:not([style*="display: none"])')) {
                                const separator = document.createElement('div');
                                separator.className = 'admin-separator';
                                separator.innerHTML = '<span>Administrateurs</span>';
                                conversationsContainer.insertBefore(separator, userItem);
                                hasVisibleAdmin = true;
                            }
                        }
                    });
                }
                
                // Mettre à jour le placeholder en fonction des résultats combinés
                if (hasVisibleConversation) {
                    placeholderElement.style.display = 'none';
                } else {
                    placeholderElement.style.display = 'flex';
                    placeholderElement.querySelector('.chat-placeholder-title').textContent = 'Aucun résultat';
                    placeholderElement.querySelector('.chat-placeholder-text').textContent = `Aucun utilisateur trouvé pour "${searchTerm}"`;
                }
            } else {
                console.error('Chat: Erreur lors de la recherche', data.message);
                if (!hasVisibleConversation) {
                    placeholderElement.style.display = 'flex';
                    placeholderElement.querySelector('.chat-placeholder-title').textContent = 'Erreur de recherche';
                    placeholderElement.querySelector('.chat-placeholder-text').textContent = 'Impossible de terminer la recherche. Veuillez réessayer.';
                }
            }
        })
        .catch(error => {
            console.error('Chat: Erreur lors de la recherche', error);
            if (!hasVisibleConversation) {
                placeholderElement.style.display = 'flex';
                placeholderElement.querySelector('.chat-placeholder-title').textContent = 'Erreur de recherche';
                placeholderElement.querySelector('.chat-placeholder-text').textContent = 'Impossible de terminer la recherche. Veuillez réessayer.';
            }
        });
    } else {
        // Supprimer les résultats de recherche temporaires pour les termes trop courts
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.remove();
        });
        
        // Afficher le message approprié si aucun résultat
        if (!hasVisibleConversation) {
            placeholderElement.style.display = 'flex';
            if (searchTermNormalized.length < 2) {
                placeholderElement.querySelector('.chat-placeholder-title').textContent = 'Recherche';
                placeholderElement.querySelector('.chat-placeholder-text').textContent = 'Saisissez au moins 2 caractères pour rechercher un utilisateur';
            } else {
                placeholderElement.querySelector('.chat-placeholder-title').textContent = 'Aucun résultat';
                placeholderElement.querySelector('.chat-placeholder-text').textContent = `Aucun utilisateur trouvé pour "${searchTerm}"`;
            }
        }
    }
}

// Créer un élément pour un résultat de recherche
function createSearchResultItem(user) {
    const userItem = document.createElement('div');
    userItem.className = 'conversation-item search-result-item';
    userItem.setAttribute('data-user-id', user._id);
    userItem.setAttribute('data-user-name', user.username);
    
    // Déterminer l'initiale pour l'avatar
    const initial = user.username.charAt(0).toUpperCase();
    
    // Créer le badge de statut
    const statusClass = `status-${user.status || 'offline'}`;
    
    userItem.innerHTML = `
        <div class="conversation-avatar">
            ${user.profilePicture ? `<img src="${user.profilePicture}" alt="${user.username}">` : initial}
            <span class="status-indicator ${statusClass}"></span>
        </div>
        <div class="conversation-details">
            <h5 class="conversation-name">${user.username}</h5>
            <p class="conversation-last-message">Démarrer une conversation</p>
        </div>
        <div class="search-result-badge">
            <i class="bi bi-plus-circle"></i>
        </div>
    `;
    
    // Ajouter l'événement de clic
    userItem.addEventListener('click', () => {
        openConversation(user._id);
    });
    
    return userItem;
}

// Charger les conversations
function loadConversations() {
    // Si le chat est minimisé, ne pas charger les conversations
    if (chatState.minimized) {
        return;
    }
    
    // Afficher le chargement
    showLoading(true);
    
    // Utiliser l'API fetch pour récupérer les conversations
    fetch('/api/chat/conversations', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + localStorage.getItem('token')
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP! Statut: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Mettre à jour les conversations
            conversations = data.conversations || [];
            
            // Réinitialiser le conteneur de conversations
            const conversationsContainer = document.getElementById('chat-conversations');
            
            // Vider complètement le conteneur
            conversationsContainer.innerHTML = '';
            
            // Recréer le placeholder
            const placeholderHTML = `
                <div class="chat-placeholder" id="conversations-placeholder">
                    <i class="bi bi-chat-dots chat-placeholder-icon"></i>
                    <h5 class="chat-placeholder-title">Aucune conversation</h5>
                    <p class="chat-placeholder-text">Commencez une conversation avec un enseignant ou un administrateur.</p>
                </div>
            `;
            conversationsContainer.insertAdjacentHTML('beforeend', placeholderHTML);
            
            // Ajouter d'abord les conversations existantes
            conversations.forEach(conversation => {
                const conversationElement = createConversationElement(conversation);
                conversationsContainer.appendChild(conversationElement);
            });

            // Une fois les conversations chargées, charger la liste des administrateurs
            // Mais seulement si l'utilisateur n'est pas lui-même un admin
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            if (userData.role !== 'admin' && userData.role !== 'superadmin') {
                loadAdministrators(conversationsContainer);
            }
            
            // Masquer le chargement
            showLoading(false);

            // Afficher ou masquer le placeholder selon s'il y a des conversations
            updatePlaceholderVisibility();
        } else {
            console.error('Chat: Erreur lors de la récupération des conversations', data.message);
            showLoading(false);
        }
    })
    .catch(error => {
        console.error('Chat: Erreur lors de la récupération des conversations', error);
        showLoading(false);
    });
}

// Mise à jour de la visibilité du placeholder
function updatePlaceholderVisibility() {
    const conversationItems = document.querySelectorAll('.conversation-item');
    const placeholderElement = document.getElementById('conversations-placeholder');
    
    if (conversationItems.length > 0) {
        if (placeholderElement) placeholderElement.style.display = 'none';
    } else {
        if (placeholderElement) placeholderElement.style.display = 'flex';
    }
}

// Charger la liste des administrateurs
function loadAdministrators(container) {
    console.log('Chat: Chargement des administrateurs');
    
    // Récupérer la liste des administrateurs
    fetch('/api/chat/admins', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.admins && data.admins.length > 0) {
            console.log('Chat: Administrateurs chargés:', data.admins.length);
            
            // Ajouter un séparateur
            const separator = document.createElement('div');
            separator.className = 'admin-separator';
            separator.innerHTML = '<span>Administrateurs</span>';
            container.appendChild(separator);
            
            // Ajouter chaque administrateur
            data.admins.forEach(admin => {
                // Vérifier si cet admin n'est pas déjà dans une conversation existante
                const existingConversation = document.querySelector(`.conversation-item[data-user-id="${admin._id}"]`);
                if (!existingConversation) {
                    const adminElement = createAdminElement(admin);
                    container.appendChild(adminElement);
                }
            });
            
            // Mettre à jour la visibilité du placeholder
            updatePlaceholderVisibility();
        } else {
            console.error('Chat: Erreur lors de la récupération des administrateurs ou aucun administrateur trouvé');
        }
    })
    .catch(error => {
        console.error('Chat: Erreur lors de la récupération des administrateurs', error);
    });
}

// Créer un élément pour un administrateur
function createAdminElement(admin) {
    const adminItem = document.createElement('div');
    adminItem.className = 'conversation-item admin-item';
    adminItem.setAttribute('data-user-id', admin._id);
    adminItem.setAttribute('data-user-name', admin.username);
    
    // Déterminer l'initiale pour l'avatar
    const initial = admin.username.charAt(0).toUpperCase();
    
    // Déterminer le statut de l'administrateur
    const status = admin.status || 'offline';
    const isOnline = status === 'online';
    
    adminItem.innerHTML = `
        <div class="conversation-avatar admin-avatar">
            ${admin.profilePicture ? `<img src="${admin.profilePicture}" alt="${admin.username}">` : initial}
            <span class="status-indicator status-${status}"></span>
        </div>
        <div class="conversation-details">
            <h5 class="conversation-name">
                ${admin.username}
                ${isOnline ? '<i class="bi bi-circle-fill text-success ms-1" style="font-size: 8px; vertical-align: middle;"></i>' : ''}
                <span class="admin-badge">${admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}</span>
            </h5>
            <p class="conversation-last-message">Démarrer une conversation</p>
        </div>
    `;
    
    // Ajouter l'événement de clic
    adminItem.addEventListener('click', () => {
        openConversation(admin._id);
    });
    
    return adminItem;
}

// Créer un élément de conversation
function createConversationElement(conversation) {
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    conversationItem.setAttribute('data-user-id', conversation.otherUser._id);
    
    // Dernier message
    const lastMessage = conversation.lastMessage ? conversation.lastMessage : { content: 'Aucun message' };
    
    // Formater le contenu du message
    let lastMessageContent = lastMessage.content || 'Message vide';
    lastMessageContent = truncateText(lastMessageContent, 30);
    
    // Formater l'heure du message
    const messageTime = lastMessage.timestamp 
        ? formatMessageTime(new Date(lastMessage.timestamp))
        : '';
    
    // Déterminer si le message est non lu
    const hasUnread = conversation.unreadCount > 0;
    
    // Déterminer l'initiale pour l'avatar
    const initial = conversation.otherUser.username.charAt(0).toUpperCase();
    
    // Déterminer le statut de l'utilisateur
    const status = conversation.otherUser.status || 'offline';
    const isOnline = status === 'online';
    
    // Créer l'élément HTML
    conversationItem.innerHTML = `
        <div class="conversation-avatar">
            ${conversation.otherUser.profilePicture ? `<img src="${conversation.otherUser.profilePicture}" alt="${conversation.otherUser.username}">` : initial}
            <span class="status-indicator status-${status}"></span>
        </div>
        <div class="conversation-details">
            <h5 class="conversation-name">
                ${conversation.otherUser.username}
                ${isOnline ? '<i class="bi bi-circle-fill text-success ms-1" style="font-size: 8px; vertical-align: middle;"></i>' : ''}
            </h5>
            <p class="conversation-last-message">${lastMessageContent}</p>
            <span class="conversation-time">${messageTime}</span>
        </div>
        ${hasUnread ? '<span class="conversation-badge">1</span>' : ''}
    `;
    
    // Ajouter l'événement de clic
    conversationItem.addEventListener('click', () => {
        openConversation(conversation.otherUser._id);
    });
    
    return conversationItem;
}

// Ouvrir la conversation avec un utilisateur
function openConversation(userId) {
    // Mettre à jour l'état du chat
    chatState.currentConversation = userId;
    currentChatUserId = userId;
    
    // Afficher le chargement
    showLoading(true);
    
    // Récupérer les messages depuis l'API
    fetch(`/api/chat/messages/${userId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Mettre à jour l'interface
            showMessages();
            
            // Mettre à jour les informations de l'utilisateur
            const userNameElement = document.getElementById('chat-user-name');
            if (userNameElement) {
                // Ajouter un élément pour afficher l'indicateur de statut
                userNameElement.innerHTML = `
                    ${data.otherUser.username}
                    <span class="status-indicator status-${data.otherUser.status}" 
                          style="display: inline-block; margin-left: 5px; width: 8px; height: 8px;"></span>
                `;
            }
            
            // Mettre à jour le statut textuel
            const statusText = getStatusText(data.otherUser.status);
            const userStatusElement = document.getElementById('chat-user-status');
            if (userStatusElement) {
                userStatusElement.textContent = statusText;
            }
            
            // Vider la liste des messages si elle existe
            if (messagesListElement) {
                messagesListElement.innerHTML = '';
                
                // Recréer le placeholder des messages
                const placeholderHTML = `
                    <div class="chat-placeholder" id="messages-placeholder">
                        <i class="bi bi-chat-dots chat-placeholder-icon"></i>
                        <h5 class="chat-placeholder-title">Aucun message</h5>
                        <p class="chat-placeholder-text">Commencez à discuter en envoyant un message.</p>
                    </div>
                `;
                messagesListElement.insertAdjacentHTML('beforeend', placeholderHTML);
                
                // Masquer le placeholder si nécessaire
                const messagesPlaceholder = document.getElementById('messages-placeholder');
                if (messagesPlaceholder) {
                    if (data.messages && data.messages.length > 0) {
                        messagesPlaceholder.style.display = 'none';
                        
                        // Ajouter les messages
                        data.messages.forEach(message => {
                            addMessageToUI(message);
                        });
                        
                        // Scroller vers le bas
                        scrollToBottom();
                    } else {
                        messagesPlaceholder.style.display = 'flex';
                    }
                }
            }
            
            // Masquer le chargement
            showLoading(false);
            
            // Marquer la conversation comme lue
            markConversationAsRead(userId);
        } else {
            console.error('Chat: Erreur lors de la récupération des messages', data.message);
            showLoading(false);
        }
    })
    .catch(error => {
        console.error('Chat: Erreur lors de la récupération des messages', error);
        showLoading(false);
    });
}

// Afficher le panneau de messages (cacher les conversations)
function showMessages() {
    const conversationsContainer = document.getElementById('chat-conversations');
    const messagesContainer = document.getElementById('chat-messages');
    
    // Initialiser la variable messagesListElement si ce n'est pas déjà fait
    messagesListElement = document.getElementById('messages-list');
    
    conversationsContainer.style.display = 'none';
    messagesContainer.style.display = 'flex';
}

// Afficher le panneau de conversations (cacher les messages)
function showConversations() {
    const conversationsContainer = document.getElementById('chat-conversations');
    const messagesContainer = document.getElementById('chat-messages');
    
    conversationsContainer.style.display = 'block';
    messagesContainer.style.display = 'none';
    
    // Nettoyer la conversation actuelle
    chatState.currentConversation = null;
    currentChatUserId = null;
}

// Faire défiler la liste des messages vers le bas
function scrollToBottom() {
    if (messagesListElement) {
        messagesListElement.scrollTop = messagesListElement.scrollHeight;
    }
}

// Formater l'heure d'un message
function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Si c'est aujourd'hui, afficher l'heure
    if (date >= today) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Si c'est hier, afficher "Hier"
    if (date >= yesterday) {
        return 'Hier';
    }
    
    // Sinon, afficher la date
    return date.toLocaleDateString();
}

// Tronquer un texte s'il est trop long
function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Obtenir le texte du statut
function getStatusText(status) {
    switch (status) {
        case 'online':
            return 'En ligne';
        case 'offline':
            return 'Hors ligne';
        case 'away':
            return 'Absent';
        case 'busy':
            return 'Occupé';
        default:
            return 'Hors ligne';
    }
}

// Afficher/masquer l'indicateur de chargement
function showLoading(show) {
    const loadingElement = document.getElementById('chat-loading');
    loadingElement.style.display = show ? 'flex' : 'none';
}

// Marquer une conversation comme lue
function markConversationAsRead(userId) {
    fetch(`/api/chat/conversations/${userId}/read`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Chat: Conversation marquée comme lue');
            
            // Si Socket.io est connecté, émettre l'événement
            if (socket && socket.connected) {
                socket.emit('mark_conversation_read', { userId });
            }
            
            // Mettre à jour l'interface
            updateUnreadCount();
        }
    })
    .catch(error => {
        console.error('Chat: Erreur lors du marquage de la conversation', error);
    });
}

// Ajouter un message à l'interface
function addMessageToUI(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(message.sender._id === currentUserId ? 'sent' : 'received');
    
    // Formater l'heure
    const messageTime = formatMessageTime(new Date(message.timestamp));
    
    // Contenu du message
    messageElement.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${messageTime}</div>
        ${message.sender._id === currentUserId ? `
        <div class="message-status">
            ${message.read ? '<i class="bi bi-check-all"></i>' : '<i class="bi bi-check"></i>'}
        </div>
        ` : ''}
    `;
    
    // Ajouter le message à la liste
    messagesListElement.appendChild(messageElement);
    
    // Faire défiler vers le bas
    scrollToBottom();
}

// Gérer un nouveau message reçu
function handleNewMessage(message) {
    // Si la conversation est ouverte, ajouter le message à l'interface
    if (chatState.currentConversation === message.sender._id || 
        chatState.currentConversation === message.receiver._id) {
        
        addMessageToUI(message);
        
        // Marquer comme lu si c'est un message reçu et que la conversation est ouverte
        if (message.sender._id !== currentUserId) {
            markConversationAsRead(message.sender._id);
        }
    } else {
        // Sinon, afficher une notification
        showMessageNotification({
            from: message.sender.username,
            fromId: message.sender._id,
            content: message.content,
            timestamp: new Date(message.timestamp)
        });
        
        // Mettre à jour le compteur de messages non lus
        updateUnreadCount();
    }
    
    // Recharger les conversations pour mettre à jour la liste
    loadConversations();
}

// Afficher une notification de nouveau message
function showMessageNotification(data) {
    // Vérifier si la notification existe déjà
    let notificationElement = document.getElementById('chat-notification');
    
    if (!notificationElement) {
        // Créer l'élément de notification
        notificationElement = document.createElement('div');
        notificationElement.id = 'chat-notification';
        notificationElement.className = 'chat-notification';
        
        // Contenu de la notification
        notificationElement.innerHTML = `
            <div class="notification-avatar">${data.from.charAt(0).toUpperCase()}</div>
            <div class="notification-content">
                <h5 class="notification-name">${data.from}</h5>
                <p class="notification-message">${truncateText(data.content || 'Nouveau message', 30)}</p>
            </div>
            <div class="notification-close"><i class="bi bi-x"></i></div>
        `;
        
        // Ajouter au document
        document.body.appendChild(notificationElement);
        
        // Événement pour ouvrir la conversation
        notificationElement.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-close')) {
                toggleChat();
                openConversation(data.fromId);
                closeNotification();
            }
        });
        
        // Événement pour fermer la notification
        notificationElement.querySelector('.notification-close').addEventListener('click', (e) => {
            e.stopPropagation();
            closeNotification();
        });
        
        // Fonction pour fermer la notification
        function closeNotification() {
            notificationElement.classList.remove('show');
            setTimeout(() => {
                notificationElement.remove();
            }, 300);
        }
        
        // Afficher la notification
        setTimeout(() => {
            notificationElement.classList.add('show');
        }, 10);
        
        // Fermer automatiquement après 5 secondes
        setTimeout(closeNotification, 5000);
    }
}

// Mettre à jour le statut d'un utilisateur dans l'interface
function updateUserStatusUI(userId, status) {
    // Mettre à jour le statut dans la liste des conversations
    const conversationItems = document.querySelectorAll('.conversation-item');
    
    conversationItems.forEach(item => {
        if (item.getAttribute('data-user-id') === userId) {
            const statusIndicator = item.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator status-${status}`;
            }
        }
    });
    
    // Mettre à jour le statut dans la conversation ouverte
    if (chatState.currentConversation === userId) {
        const statusText = getStatusText(status);
        const userStatusElement = document.getElementById('chat-user-status');
        if (userStatusElement) {
            userStatusElement.textContent = statusText;
        }
        
        // Mettre à jour également l'indicateur visuel de statut dans l'en-tête de la conversation
        const statusIndicator = document.querySelector('.messages-header .status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator status-${status}`;
        } else {
            // Si l'indicateur n'existe pas, l'ajouter
            const userInfoDiv = document.querySelector('.chat-user-info');
            if (userInfoDiv) {
                const indicator = document.createElement('span');
                indicator.className = `status-indicator status-${status}`;
                indicator.style.display = 'inline-block';
                indicator.style.marginLeft = '5px';
                userInfoDiv.querySelector('h5').appendChild(indicator);
            }
        }
    }
}

// Réinitialiser le compteur de messages non lus
function resetUnreadCount() {
    unreadMessages = 0;
    updateUnreadBadge();
}

// Mettre à jour le compteur de messages non lus
function updateUnreadCount() {
    fetch('/api/chat/unread-count', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            unreadMessages = data.count;
            updateUnreadBadge();
        }
    })
    .catch(error => {
        console.error('Chat: Erreur lors de la récupération du nombre de messages non lus', error);
    });
}

// Mettre à jour le badge de messages non lus
function updateUnreadBadge() {
    const chatButton = document.getElementById('new-chat-button');
    
    // Supprimer l'ancien badge s'il existe
    const oldBadge = chatButton.querySelector('.chat-floating-badge');
    if (oldBadge) {
        oldBadge.remove();
    }
    
    // Ajouter un nouveau badge si nécessaire
    if (unreadMessages > 0) {
        const badge = document.createElement('div');
        badge.className = 'chat-floating-badge';
        badge.textContent = unreadMessages > 9 ? '9+' : unreadMessages;
        chatButton.appendChild(badge);
        
        // Ajouter la classe pour l'animation
        chatButton.classList.add('has-notifications');
    } else {
        chatButton.classList.remove('has-notifications');
    }
}

// Le statut est géré automatiquement par le serveur

// Gérer l'indicateur de frappe
function handleTypingIndicator() {
    if (!isTyping && socket && socket.connected && currentChatUserId) {
        // Indiquer que l'utilisateur est en train de taper
        socket.emit('typing', { receiverId: currentChatUserId });
        isTyping = true;
        
        // Réinitialiser après 3 secondes
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            isTyping = false;
            socket.emit('stop_typing', { receiverId: currentChatUserId });
        }, 3000);
    }
}

// Envoyer un message
function sendMessage() {
    // Vérifier qu'une conversation est ouverte
    if (!currentChatUserId) {
        return;
    }
    
    // Récupérer le contenu du message
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    
    // Ne rien faire si le message est vide
    if (!content) {
        return;
    }
    
    // Réinitialiser l'input
    messageInput.value = '';
    
    // Si Socket.io est connecté, utiliser Socket.io pour envoyer le message
    if (socket && socket.connected) {
        // Créer un message temporaire pour l'afficher immédiatement
        const tempMessage = {
            _id: 'temp-' + Date.now(),
            sender: {
                _id: currentUserId
            },
            receiver: {
                _id: currentChatUserId
            },
            content: content,
            timestamp: new Date(),
            read: false
        };
        
        // Afficher le message directement dans l'interface
        addMessageToUI(tempMessage);
        
        // Puis envoyer le message via Socket.io
        socket.emit('send_message', {
            receiverId: currentChatUserId,
            content: content
        });
    } else {
        // Sinon, utiliser l'API REST
        fetch(`/api/chat/messages/${currentChatUserId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ content })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Ajouter le message à l'interface
                addMessageToUI(data.data);
            } else {
                console.error('Chat: Erreur lors de l\'envoi du message', data.message);
            }
        })
        .catch(error => {
            console.error('Chat: Erreur lors de l\'envoi du message', error);
        });
    }
}

// Initialiser le chat lorsque le document est prêt
document.addEventListener('DOMContentLoaded', initChat); 