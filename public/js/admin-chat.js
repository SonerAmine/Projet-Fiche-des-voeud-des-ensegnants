/**
 * Admin Chat - Fonctionnalités de chat spécifiques pour l'administrateur
 */

// Variable pour suivre les utilisateurs actuellement actifs
let availableUsers = [];
// Créer une variable socket spécifique à l'admin chat pour éviter les conflits
let adminSocket;
// Variables pour le chat
let currentChatUserId;
let currentUserId;

// Initialisation des fonctionnalités de chat admin
function initAdminChat() {
    // Récupérer l'ID de l'utilisateur actuel
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    currentUserId = userData.id;

    if (!currentUserId) {
        console.error('Admin Chat: ID utilisateur non disponible');
        return;
    }
    
    // Ajouter un onglet de chat dans la barre latérale
    addChatTab();
    
    // Ajouter un bouton de chat aux profils des enseignants
    addChatButtonsToTeachers();
    
    // Écouter les événements
    setupAdminChatEvents();

    // Initialiser Socket.io si ce n'est pas déjà fait par chat.js
    initAdminSocketConnection();
}

// Initialiser une connexion Socket.io spécifique pour l'admin
function initAdminSocketConnection() {
    // S'assurer que l'utilisateur est connecté
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Admin Chat: L\'utilisateur n\'est pas connecté');
        return;
    }

    // Initialiser Socket.io avec une variable spécifique à l'admin
    adminSocket = io({
        auth: {
            token: token
        }
    });

    // Gérer les événements de connexion
    adminSocket.on('connect', () => {
        console.log('Admin Chat: Connecté au serveur');
    });

    adminSocket.on('connect_error', (error) => {
        console.error('Admin Chat: Erreur de connexion', error);
    });

    adminSocket.on('disconnect', () => {
        console.log('Admin Chat: Déconnecté du serveur');
    });

    // Écouter les nouveaux messages
    adminSocket.on('receive_message', (message) => {
        // Si la conversation est ouverte, ajouter le message
        if (currentChatUserId === message.sender._id) {
            addMessageToAdminUI(message);
            // Scrollez vers le bas
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }
    });
    
    // Écouter les changements de statut des utilisateurs
    adminSocket.on('user_status_change', (data) => {
        console.log('Admin Chat: Changement de statut d\'utilisateur reçu:', data);
        
        // Mettre à jour l'interface avec le nouveau statut
        updateAdminUserStatus(data.userId, data.status);
        
        // Si nous sommes dans la section de chat, mettre à jour la liste des utilisateurs
        const chatSection = document.getElementById('chat-section');
        if (chatSection && !chatSection.classList.contains('d-none')) {
            // Optionnel: recharger la liste des utilisateurs pour une mise à jour complète
            // Commenté car cela provoquerait un rechargement complet qui pourrait être perturbant
            // loadAdminChatUsers();
        }
    });
}

// Ajouter un onglet de chat dans la barre latérale
function addChatTab() {
    // Vérifier si l'onglet existe déjà
    if (document.getElementById('chat-tab-link')) {
        return;
    }
    
    // Créer l'élément de l'onglet
    const chatTab = document.createElement('li');
    chatTab.innerHTML = `
        <a href="#chat" class="nav-link" id="chat-tab-link">
            <i class="bi bi-chat-dots-fill me-2"></i>Messages
            <span class="badge rounded-pill bg-danger ms-2 unread-messages-count" style="display: none;">0</span>
        </a>
    `;
    
    // Ajouter l'onglet avant l'élément de gestion des utilisateurs (au lieu de l'organigramme supprimé)
    const usersNavItem = document.getElementById('users-nav-item');
    const emailsItem = document.querySelector('#emails-link').parentNode;
    
    // Insérer après l'élément emails
    emailsItem.parentNode.insertBefore(chatTab, usersNavItem);
    
    // Créer la section de chat
    const chatSection = document.createElement('div');
    chatSection.id = 'chat-section';
    chatSection.className = 'section d-none';
    chatSection.innerHTML = `
        <h1 class="mb-4">Messagerie</h1>
        
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0"><i class="bi bi-chat-dots me-2"></i>Conversations</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4 border-end">
                        <!-- Liste des utilisateurs -->
                        <div class="mb-3">
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-search"></i></span>
                                <input type="text" class="form-control" id="search-user" placeholder="Rechercher un utilisateur...">
                            </div>
                        </div>
                        <div class="user-list" id="admin-user-list" style="max-height: 500px; overflow-y: auto;">
                            <!-- Les utilisateurs seront ajoutés ici dynamiquement -->
                            <div class="text-center py-5 text-muted" id="users-loading">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">Chargement...</span>
                                </div>
                                <p>Chargement des utilisateurs...</p>
                            </div>
                            <div class="text-center py-5 text-muted" id="no-users" style="display: none;">
                                <i class="bi bi-people text-muted" style="font-size: 2rem;"></i>
                                <p class="mt-3">Aucun utilisateur trouvé</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <!-- Conversation actuelle -->
                        <div id="current-conversation">
                            <div class="text-center py-5 text-muted" id="select-conversation">
                                <i class="bi bi-chat-dots text-muted" style="font-size: 3rem;"></i>
                                <h5 class="mt-3">Sélectionnez une conversation</h5>
                                <p>Choisissez un utilisateur dans la liste pour commencer une conversation.</p>
                            </div>
                            <div id="conversation-content" style="display: none;">
                                <div class="conversation-header bg-light p-3 mb-3 rounded d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center">
                                        <div class="avatar-container position-relative me-3">
                                            <div class="user-avatar rounded-circle bg-primary text-white d-flex justify-content-center align-items-center" style="width: 40px; height: 40px;">
                                                <span id="user-initial"></span>
                                            </div>
                                            <span class="position-absolute bottom-0 end-0 status-indicator" id="user-status-indicator"></span>
                                        </div>
                                        <div>
                                            <h5 class="mb-0" id="conversation-username"></h5>
                                            <small class="text-muted" id="conversation-user-status"></small>
                                        </div>
                                    </div>
                                </div>
                                <div class="messages-container bg-light p-3 rounded" id="messages-container" style="height: 350px; overflow-y: auto;">
                                    <!-- Les messages seront ajoutés ici dynamiquement -->
                                </div>
                                <div class="message-input-container mt-3 d-flex">
                                    <input type="text" class="form-control me-2" id="admin-message-input" placeholder="Écrivez votre message...">
                                    <button class="btn btn-primary" id="admin-send-message">
                                        <i class="bi bi-send-fill"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter la section après l'élément emails-section
    const emailsSection = document.getElementById('emails-section');
    emailsSection.parentNode.insertBefore(chatSection, emailsSection.nextSibling);
    
    // Configurer immédiatement l'écouteur de recherche
    const searchUserInput = document.getElementById('search-user');
    if (searchUserInput) {
        searchUserInput.addEventListener('input', function(e) {
            console.log('Chat Admin: Recherche déclenchée depuis le champ de recherche:', e.target.value);
            filterUsers(e.target.value);
        });
        
        searchUserInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                console.log('Chat Admin: Touche Entrée pressée dans le champ de recherche');
                filterUsers(e.target.value);
            }
        });
    }
    
    // Ajouter l'événement de clic sur l'onglet
    document.getElementById('chat-tab-link').addEventListener('click', function(e) {
        e.preventDefault();
        
        // Retirer la classe active de tous les liens
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Ajouter la classe active au lien cliqué
        this.classList.add('active');
        
        // Masquer toutes les sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('d-none');
        });
        
        // Afficher la section de chat
        document.getElementById('chat-section').classList.remove('d-none');
        
        // Charger les utilisateurs et conversations
        loadAdminChatUsers();
    });
}

// Ajouter des boutons de chat aux profils des enseignants
function addChatButtonsToTeachers() {
    // Cette fonction a été désactivée pour éviter d'ajouter des boutons de chat dans la section enseignants
    // Les fonctionnalités de chat sont uniquement disponibles dans la section "Messages"
    return;
    
    // Le code ci-dessous est conservé mais désactivé
    /*
    // Observer les changements dans le DOM pour ajouter les boutons aux enseignants chargés dynamiquement
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Vérifier si des lignes d'enseignants ont été ajoutées
                const teacherRows = document.querySelectorAll('#enseignants-table tr');
                teacherRows.forEach(row => {
                    // Vérifier si le bouton de chat n'a pas déjà été ajouté
                    if (row.querySelector('.teacher-chat-button')) {
                        return;
                    }
                    
                    // Ajouter une cellule avec un bouton de chat
                    const cell = document.createElement('td');
                    cell.innerHTML = `
                        <button class="btn btn-sm btn-primary teacher-chat-button" title="Discuter">
                            <i class="bi bi-chat-dots-fill"></i>
                        </button>
                    `;
                    
                    row.appendChild(cell);
                    
                    // Ajouter l'événement de clic
                    const chatButton = cell.querySelector('.teacher-chat-button');
                    chatButton.addEventListener('click', () => {
                        // Récupérer les informations de l'enseignant
                        const teacherName = row.cells[0].textContent.trim();
                        const teacherEmail = row.cells[1].textContent.trim();
                        
                        // Trouver l'ID de l'utilisateur à partir de l'email
                        findUserIdByEmail(teacherEmail)
                            .then(userId => {
                                if (userId) {
                                    // Rediriger vers l'onglet Chat et ouvrir la conversation
                                    document.getElementById('chat-tab-link').click();
                                    openAdminConversation(userId, teacherName);
                                } else {
                                    alert('Impossible de trouver cet utilisateur. Veuillez réessayer.');
                                }
                            })
                            .catch(error => {
                                console.error('Chat Admin: Erreur lors de la recherche de l\'utilisateur', error);
                                alert('Une erreur est survenue. Veuillez réessayer.');
                            });
                    });
                });
            }
        });
    });
    
    // Observer les changements dans le tableau des enseignants
    const enseignantsTable = document.getElementById('enseignants-table');
    if (enseignantsTable) {
        observer.observe(enseignantsTable, { childList: true, subtree: true });
    }
    */
}

// Configuration des écouteurs d'événements
function setupAdminChatEvents() {
    // Ajouter une délégation d'événement pour les boutons de chat qui seront ajoutés ultérieurement
    document.addEventListener('click', function(e) {
        // Bouton d'envoi de message
        if (e.target.matches('#admin-send-message') || e.target.closest('#admin-send-message')) {
            sendAdminMessage();
        }
    });
    
    // Écouter l'événement d'entrée pour l'envoi de message
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && document.activeElement === document.getElementById('admin-message-input')) {
            sendAdminMessage();
        }
    });
    
    // Configuration de l'écouteur de recherche
    const searchUserInput = document.getElementById('search-user');
    if (searchUserInput) {
        // Retirer tout écouteur existant pour éviter les doublons
        searchUserInput.removeEventListener('input', filterUsers);
        searchUserInput.removeEventListener('keyup', filterUsers);
        
        // Ajouter de nouveaux écouteurs pour s'assurer que la recherche fonctionne correctement
        searchUserInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value;
            console.log('Chat Admin: Événement input déclenché avec la valeur:', searchTerm);
            filterUsers(searchTerm);
        });
        
        // Ajouter aussi un écouteur keyup pour être sûr
        searchUserInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                const searchTerm = e.target.value;
                console.log('Chat Admin: Recherche déclenchée par touche Entrée:', searchTerm);
                filterUsers(searchTerm);
            }
        });
        
        console.log('Chat Admin: Écouteurs de recherche configurés pour #search-user');
    } else {
        console.warn('Chat Admin: Élément #search-user non trouvé pour configurer les écouteurs');
    }
}

// Charger les utilisateurs pour le chat admin
function loadAdminChatUsers() {
    const usersList = document.getElementById('admin-user-list');
    const loadingElement = document.getElementById('users-loading');
    const noUsersElement = document.getElementById('no-users');
    
    if (!usersList || !loadingElement || !noUsersElement) {
        console.error('Chat Admin: Éléments non trouvés');
        return;
    }
    
    // Afficher le chargement
    loadingElement.style.display = 'block';
    noUsersElement.style.display = 'none';
    
    // Supprimer TOUS les utilisateurs existants pour garantir un état propre
    usersList.innerHTML = '';
    
    // Réajouter les éléments de chargement et d'absence d'utilisateurs
    usersList.appendChild(loadingElement);
    usersList.appendChild(noUsersElement);
    
    console.log('Chat Admin: Chargement des utilisateurs en cours...');
    
    // Vider la liste globale des utilisateurs disponibles
    availableUsers = [];
    
    // Récupérer la liste des utilisateurs avec leur statut en ligne/hors ligne depuis l'API admin
    fetch('/api/admin/users-status', {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.users) {
            // Mettre à jour la liste globale
            availableUsers = data.users;
            
            console.log(`Chat Admin: ${data.users.length} utilisateurs chargés avec leur statut`);
            
            // Masquer le chargement
            loadingElement.style.display = 'none';
            
            if (data.users.length === 0) {
                noUsersElement.style.display = 'block';
                return;
            }
            
            // Ajouter les utilisateurs à la liste
            data.users.forEach(user => {
                const userItem = createUserItem(user);
                usersList.appendChild(userItem);
            });
        } else {
            console.error('Chat Admin: Erreur lors de la récupération des utilisateurs', data.message);
            loadingElement.style.display = 'none';
            noUsersElement.style.display = 'block';
            
            // En cas d'erreur avec l'API admin, essayer l'API chat standard comme fallback
            fetch('/api/chat/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            })
            .then(response => response.json())
            .then(chatData => {
                if (chatData.success && chatData.users && chatData.users.length > 0) {
                    // Masquer le message d'erreur
                    noUsersElement.style.display = 'none';
                    
                    // Mettre à jour la liste globale
                    availableUsers = chatData.users;
                    
                    console.log(`Chat Admin: ${chatData.users.length} utilisateurs chargés via l'API de chat (fallback)`);
                    
                    // Ajouter les utilisateurs à la liste
                    chatData.users.forEach(user => {
                        const userItem = createUserItem(user);
                        usersList.appendChild(userItem);
                    });
                }
            })
            .catch(chatError => {
                console.error('Chat Admin: Erreur lors de la récupération des utilisateurs (fallback)', chatError);
            });
        }
    })
    .catch(error => {
        console.error('Chat Admin: Erreur lors de la récupération des utilisateurs', error);
        loadingElement.style.display = 'none';
        noUsersElement.style.display = 'block';
        
        // En cas d'erreur avec l'API admin, essayer l'API chat standard comme fallback
        fetch('/api/chat/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => response.json())
        .then(chatData => {
            if (chatData.success && chatData.users && chatData.users.length > 0) {
                // Masquer le message d'erreur
                noUsersElement.style.display = 'none';
                
                // Mettre à jour la liste globale
                availableUsers = chatData.users;
                
                console.log(`Chat Admin: ${chatData.users.length} utilisateurs chargés via l'API de chat (fallback)`);
                
                // Ajouter les utilisateurs à la liste
                chatData.users.forEach(user => {
                    const userItem = createUserItem(user);
                    usersList.appendChild(userItem);
                });
            }
        })
        .catch(chatError => {
            console.error('Chat Admin: Erreur lors de la récupération des utilisateurs (fallback)', chatError);
        });
    });
}

// Créer un élément utilisateur pour la liste
function createUserItem(user) {
    const userItem = document.createElement('div');
    userItem.className = 'user-item d-flex align-items-center p-2 border-bottom cursor-pointer';
    userItem.setAttribute('data-user-id', user._id);
    userItem.setAttribute('data-user-name', user.username);
    userItem.setAttribute('data-user-email', user.email);
    userItem.style.cursor = 'pointer';
    
    // Déterminer l'initiale pour l'avatar
    const initial = user.username.charAt(0).toUpperCase();
    
    // Créer le badge de statut
    const statusClass = `status-${user.status || 'offline'}`;
    const isOnline = user.status === 'online';
    
    userItem.innerHTML = `
        <div class="position-relative me-3">
            <div class="rounded-circle bg-light d-flex justify-content-center align-items-center" style="width: 40px; height: 40px;">
                ${user.profilePicture ? `<img src="${user.profilePicture}" alt="${user.username}" class="rounded-circle" width="40" height="40">` : initial}
            </div>
            <span class="position-absolute bottom-0 end-0 status-indicator ${statusClass}" style="width: 12px; height: 12px;"></span>
        </div>
        <div class="flex-grow-1">
            <div class="fw-bold user-name">
                ${user.username}
                ${isOnline ? '<i class="bi bi-circle-fill text-success ms-2 status-icon" style="font-size: 12px; vertical-align: middle;"></i>' : ''}
            </div>
            <div class="text-muted small user-email">${user.email}</div>
        </div>
    `;
    
    // Ajouter l'événement de clic
    userItem.addEventListener('click', () => {
        openAdminConversation(user._id, user.username, user.status);
    });
    
    return userItem;
}

// Filtrer les utilisateurs
function filterUsers(searchTerm) {
    const usersList = document.getElementById('admin-user-list');
    const noUsersElement = document.getElementById('no-users');
    const loadingElement = document.getElementById('users-loading');
    const userItems = usersList.querySelectorAll('.user-item');
    
    // Normaliser le terme de recherche: enlever les accents, convertir en minuscules
    const searchTermNormalized = searchTerm.trim().toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    
    console.log('Chat Admin: Recherche avec le terme:', searchTermNormalized);
    
    // Si le terme de recherche est vide, recharger complètement la liste
    if (searchTermNormalized === '') {
        console.log('Chat Admin: Terme de recherche vide, rechargement complet des utilisateurs');
        // Recharger toute la liste
        loadAdminChatUsers();
        return;
    }
    
    // Si le terme de recherche est trop court, demander plus de caractères
    if (searchTermNormalized.length < 2) {
        userItems.forEach(item => {
            item.style.display = 'none';
        });
        
        noUsersElement.style.display = 'block';
        noUsersElement.querySelector('p').textContent = 'Saisissez au moins 2 caractères pour rechercher';
        return;
    }
    
    // Si nous avons au moins 2 caractères, faisons une recherche côté serveur
    // pour garantir d'avoir des résultats frais et complets
    showLoading(true);
    
    // Appeler l'API de recherche
    fetch(`/api/chat/search?term=${encodeURIComponent(searchTerm)}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Nettoyer complètement la liste pour éviter les doublons
            // Supprimer tout sauf les éléments de chargement et aucun utilisateur
            usersList.innerHTML = '';
            usersList.appendChild(loadingElement);
            usersList.appendChild(noUsersElement);
            
            // Ajouter les utilisateurs trouvés
            if (data.users && data.users.length > 0) {
                // Éliminer les doublons en utilisant un Set basé sur les IDs
                const uniqueUserIds = new Set();
                const uniqueUsers = data.users.filter(user => {
                    // Si l'ID n'a pas encore été vu, garder cet utilisateur
                    if (!uniqueUserIds.has(user._id)) {
                        uniqueUserIds.add(user._id);
                        return true;
                    }
                    // Sinon, c'est un doublon à éliminer
                    console.log(`Chat Admin: Doublon détecté pour l'utilisateur ${user.username} (${user._id})`);
                    return false;
                });
                
                // Ajouter les nouveaux utilisateurs uniques à la liste
                uniqueUsers.forEach(user => {
                    const userItem = createUserItem(user);
                    usersList.appendChild(userItem);
        });
        
        // Mise à jour de l'affichage "aucun utilisateur"
            noUsersElement.style.display = 'none';
                console.log(`Chat Admin: ${uniqueUsers.length} utilisateurs uniques trouvés`);
        } else {
                // Aucun utilisateur trouvé
            noUsersElement.style.display = 'block';
                noUsersElement.querySelector('p').textContent = `Aucun utilisateur trouvé pour "${searchTerm}"`;
                console.log('Chat Admin: Aucun utilisateur trouvé');
            }
        } else {
            console.error('Chat Admin: Erreur lors de la recherche d\'utilisateurs', data.message);
            noUsersElement.style.display = 'block';
            noUsersElement.querySelector('p').textContent = 'Erreur lors de la recherche. Veuillez réessayer.';
    }
        showLoading(false);
    })
    .catch(error => {
        console.error('Chat Admin: Erreur lors de la recherche d\'utilisateurs', error);
        noUsersElement.style.display = 'block';
        noUsersElement.querySelector('p').textContent = 'Erreur lors de la recherche. Veuillez réessayer.';
        showLoading(false);
        
        // En cas d'erreur du serveur, faire une recherche locale
        performLocalSearch(userItems, searchTermNormalized, noUsersElement);
    });
}

// Effectuer une recherche locale sur les utilisateurs déjà chargés
function performLocalSearch(userItems, searchTermNormalized, noUsersElement) {
    let visibleCount = 0;
    
    // Parcourir tous les éléments d'utilisateur
    userItems.forEach(item => {
        // Récupérer et normaliser le nom et l'email
        const username = item.getAttribute('data-user-name') || 
                         item.querySelector('.user-name').textContent || '';
        
        // Normaliser pour la comparaison
        const usernameNormalized = username.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
        
        // Recherche par "commence par" au lieu de "contient"
        if (usernameNormalized.startsWith(searchTermNormalized)) {
            item.style.display = 'flex';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Mettre à jour l'affichage "aucun utilisateur"
    if (visibleCount === 0) {
        noUsersElement.style.display = 'block';
        noUsersElement.querySelector('p').textContent = `Aucun utilisateur trouvé pour "${searchTermNormalized}"`;
    } else {
        noUsersElement.style.display = 'none';
    }
    
    console.log(`Chat Admin: Recherche locale terminée - ${visibleCount} résultats trouvés`);
}

// Helper function to show/hide loading
function showLoading(show) {
    const loadingElement = document.getElementById('users-loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Trouver l'ID d'un utilisateur à partir de son email
function findUserIdByEmail(email) {
    return new Promise((resolve, reject) => {
        // Si nous avons déjà les utilisateurs chargés, chercher dans la liste
        if (availableUsers.length > 0) {
            const user = availableUsers.find(u => u.email === email);
            if (user) {
                return resolve(user._id);
            }
        }
        
        // Sinon, charger la liste des utilisateurs depuis l'API
        fetch('/api/chat/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.users) {
                availableUsers = data.users;
                const user = data.users.find(u => u.email === email);
                if (user) {
                    resolve(user._id);
                } else {
                    resolve(null); // Utilisateur non trouvé
                }
            } else {
                reject(new Error(data.message || 'Erreur lors de la récupération des utilisateurs'));
            }
        })
        .catch(reject);
    });
}

// Ouvrir une conversation dans l'interface admin
function openAdminConversation(userId, username, status) {
    // Mettre en évidence l'utilisateur sélectionné
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active', 'bg-light');
    });
    
    const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (userItem) {
        userItem.classList.add('active', 'bg-light');
    }
    
    // Mettre à jour l'interface
    document.getElementById('select-conversation').style.display = 'none';
    document.getElementById('conversation-content').style.display = 'block';
    
    // Mettre à jour les informations de l'utilisateur
    const userNameElement = document.getElementById('conversation-username');
    if (userNameElement) {
        userNameElement.textContent = username;
        
        // Ajouter une icône si en ligne
        if (status === 'online') {
            // Supprimer l'icône existante si présente
            const existingIcon = userNameElement.querySelector('.status-icon');
            if (existingIcon) {
                existingIcon.remove();
            }
            
            const statusIcon = document.createElement('i');
            statusIcon.className = 'bi bi-circle-fill text-success ms-1 status-icon';
            statusIcon.style.fontSize = '8px';
            statusIcon.style.verticalAlign = 'middle';
            userNameElement.appendChild(statusIcon);
        }
    }
    
    document.getElementById('user-initial').textContent = username.charAt(0).toUpperCase();
    
    // Mettre à jour le statut
    updateAdminUserStatus(userId, status || 'offline');
    
    // Variable globale pour le chat
    currentChatUserId = userId;
    
    // Vider le conteneur de messages
    const messagesContainer = document.getElementById('messages-container');
    messagesContainer.innerHTML = '';
    
    // Afficher une animation de chargement
    messagesContainer.innerHTML = `
        <div class="text-center py-5" id="messages-loading">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="text-muted">Chargement des messages...</p>
        </div>
    `;
    
    // Charger les messages
    fetch(`/api/chat/messages/${userId}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Supprimer l'animation de chargement
            messagesContainer.innerHTML = '';
            
            // Mettre à jour le statut
            updateAdminUserStatus(userId, data.otherUser.status || 'offline');
            
            if (data.messages && data.messages.length > 0) {
                // Ajouter les messages
                data.messages.forEach(message => {
                    addMessageToAdminUI(message);
                });
                
                // Scroller vers le bas
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } else {
                // Afficher un message si pas de messages
                messagesContainer.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="bi bi-chat-dots text-muted" style="font-size: 2rem;"></i>
                        <p class="mt-3">Aucun message</p>
                        <p class="small">Commencez une conversation avec ${username}.</p>
                    </div>
                `;
            }
        } else {
            console.error('Chat Admin: Erreur lors de la récupération des messages', data.message);
            messagesContainer.innerHTML = `
                <div class="text-center py-5 text-danger">
                    <i class="bi bi-exclamation-circle text-danger" style="font-size: 2rem;"></i>
                    <p class="mt-3">Erreur lors du chargement des messages</p>
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="openAdminConversation('${userId}', '${username}')">
                        Réessayer
                    </button>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Chat Admin: Erreur lors de la récupération des messages', error);
        messagesContainer.innerHTML = `
            <div class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-circle text-danger" style="font-size: 2rem;"></i>
                <p class="mt-3">Erreur lors du chargement des messages</p>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="openAdminConversation('${userId}', '${username}')">
                    Réessayer
                </button>
            </div>
        `;
    });
}

// Ajouter un message à l'interface admin
function addMessageToAdminUI(message) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    // Créer l'élément du message
    const messageElement = document.createElement('div');
    messageElement.className = 'mb-3';
    messageElement.setAttribute('data-message-id', message._id);
    
    // Déterminer s'il s'agit d'un message envoyé ou reçu
    const isSent = message.sender._id === currentUserId;
    
    // Formater l'heure
    const messageTime = formatMessageTime(new Date(message.timestamp));
    
    // Construire le contenu HTML
    if (isSent) {
        messageElement.innerHTML = `
            <div class="d-flex justify-content-end">
                <div class="bg-primary text-white p-2 rounded-3" style="max-width: 75%;">
                    <div>${message.content}</div>
                    <div class="text-end">
                        <small class="text-white-50">${messageTime}</small>
                    </div>
                </div>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <div class="d-flex">
                <div class="bg-light p-2 rounded-3" style="max-width: 75%;">
                    <div>${message.content}</div>
                    <div class="text-end">
                        <small class="text-muted">${messageTime}</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Ajouter l'élément à la liste
    messagesContainer.appendChild(messageElement);
}

// Mettre à jour le statut d'un utilisateur dans l'interface admin
function updateAdminUserStatus(userId, status) {
    console.log(`Admin Chat: Mise à jour du statut de l'utilisateur ${userId} à "${status}"`);
    
    // Mettre à jour le statut de l'utilisateur dans le header de conversation
    const statusElement = document.getElementById('user-status-indicator');
    const statusTextElement = document.getElementById('conversation-user-status');
    
    if (statusElement) {
        // Supprimer toutes les classes existantes
        statusElement.className = 'position-absolute bottom-0 end-0 status-indicator';
        
        // Ajouter la classe correspondante
        statusElement.classList.add(`status-${status}`);
        
        // Appliquer une taille plus grande
        statusElement.style.width = '12px';
        statusElement.style.height = '12px';
    }
    
    if (statusTextElement) {
        statusTextElement.textContent = getStatusText(status);
        
        // Ajouter une icône verte si en ligne
        const userNameElement = document.getElementById('conversation-username');
        if (userNameElement) {
            // Supprimer l'icône existante si présente
            const existingIcon = userNameElement.querySelector('.status-icon');
            if (existingIcon) {
                existingIcon.remove();
            }
            
            // Ajouter une icône si en ligne
            if (status === 'online') {
                const statusIcon = document.createElement('i');
                statusIcon.className = 'bi bi-circle-fill text-success ms-2 status-icon';
                statusIcon.style.fontSize = '12px';
                statusIcon.style.verticalAlign = 'middle';
                userNameElement.appendChild(statusIcon);
            }
        }
    }
    
    // Mettre à jour le statut dans la liste des utilisateurs
    const userItem = document.querySelector(`.user-item[data-user-id="${userId}"]`);
    if (userItem) {
        const statusIndicator = userItem.querySelector('.status-indicator');
        if (statusIndicator) {
            // Supprimer toutes les classes existantes de statut
            statusIndicator.className = 'position-absolute bottom-0 end-0 status-indicator';
            
            // Ajouter la classe correspondante
            statusIndicator.classList.add(`status-${status}`);
            
            // Appliquer une taille plus grande
            statusIndicator.style.width = '12px';
            statusIndicator.style.height = '12px';
        }
        
        // Mettre à jour le nom de l'utilisateur avec une icône si en ligne
        const userNameElement = userItem.querySelector('.user-name');
        if (userNameElement) {
            // Supprimer l'icône existante si présente
            const existingIcon = userNameElement.querySelector('.status-icon');
            if (existingIcon) {
                existingIcon.remove();
            }
            
            // Ajouter une icône si en ligne
            if (status === 'online') {
                const statusIcon = document.createElement('i');
                statusIcon.className = 'bi bi-circle-fill text-success ms-2 status-icon';
                statusIcon.style.fontSize = '12px';
                statusIcon.style.verticalAlign = 'middle';
                userNameElement.appendChild(statusIcon);
            }
        }
    }
}

// Envoyer un message depuis l'interface admin
function sendAdminMessage() {
    // Récupérer le contenu du message
    const messageInput = document.getElementById('admin-message-input');
    const content = messageInput.value.trim();
    
    // Vérifier si le message n'est pas vide
    if (content === '' || !currentChatUserId) {
        return;
    }
    
    // Vider le champ de saisie
    messageInput.value = '';
    
    // Ajouter le message temporaire à l'UI
    const messagesContainer = document.getElementById('messages-container');
    const messageTime = formatMessageTime(new Date());
    
    const messageElement = document.createElement('div');
    messageElement.className = 'mb-3';
    messageElement.innerHTML = `
        <div class="d-flex justify-content-end">
            <div class="bg-primary text-white p-2 rounded-3" style="max-width: 75%;">
                <div>${content}</div>
                <div class="text-end">
                    <small class="text-white-50">${messageTime}</small>
                    <small class="ms-1"><i class="bi bi-clock text-white-50"></i></small>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter à la liste
    messagesContainer.appendChild(messageElement);
    
    // Scroller vers le bas
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Envoyer le message via Socket.io
    if (adminSocket && adminSocket.connected) {
        adminSocket.emit('send_message', {
            receiverId: currentChatUserId,
            content
        });
    } else {
        // Si Socket.io n'est pas disponible, envoyer via l'API REST
        fetch(`/api/chat/messages/${currentChatUserId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Chat Admin: Erreur lors de l\'envoi du message', data.message);
                // Marquer le message comme non envoyé
                messageElement.querySelector('i').className = 'bi bi-exclamation-circle text-warning';
            }
        })
        .catch(error => {
            console.error('Chat Admin: Erreur lors de l\'envoi du message', error);
            // Marquer le message comme non envoyé
            messageElement.querySelector('i').className = 'bi bi-exclamation-circle text-warning';
        });
    }
}

// Observer pour surveiller les changements de navigation
document.addEventListener('DOMContentLoaded', function() {
    // Correctif pour la navigation: S'assurer que la section Messages se désactive correctement
    const fixChatNavigation = function() {
        // Surveiller les clics sur tous les liens de navigation (sauf le lien de messagerie)
        document.querySelectorAll('.nav-link:not([id="chat-tab-link"])').forEach(link => {
            link.addEventListener('click', function() {
                // Quand un autre onglet est cliqué, s'assurer que la section chat n'est pas visible
                const chatSection = document.getElementById('chat-section');
                if (chatSection) {
                    chatSection.classList.add('d-none');
                }
                
                // S'assurer que le lien de messagerie n'est plus actif
                const chatTabLink = document.getElementById('chat-tab-link');
                if (chatTabLink) {
                    chatTabLink.classList.remove('active');
                }
            });
        });

        // S'assurer que le lien de messagerie suit le comportement standard
        const chatTabLink = document.getElementById('chat-tab-link');
        if (chatTabLink) {
            // Remplacer le gestionnaire d'événements existant
            chatTabLink.onclick = function(e) {
                e.preventDefault();
                
                // Retirer la classe active de tous les liens de navigation
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                });
                
                // Ajouter la classe active uniquement au lien de messagerie
                chatTabLink.classList.add('active');
                
                // Masquer toutes les sections
                document.querySelectorAll('.section').forEach(section => {
                    section.classList.add('d-none');
                });
                
                // Afficher uniquement la section de messagerie
                const chatSection = document.getElementById('chat-section');
                if (chatSection) {
                    chatSection.classList.remove('d-none');
                }
                
                // Charger les données de messagerie
                loadAdminChatUsers();
            };
        }
    };

    // Exécuter le correctif une fois que le DOM est chargé
    fixChatNavigation();
});

// Initialiser les fonctionnalités de chat admin lorsque le document est prêt
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.sidebar')) {
        initAdminChat();
    }
});

// Fonction pour jouer le son de notification
function playNotificationSound() {
    // Vérifier si le son est initialisé et si l'onglet de message n'est pas actif
    if (notificationSound && !document.getElementById('chat-tab-link')?.classList.contains('active')) {
        try {
            // Vérifier si le son est déjà en cours de lecture ou en erreur
            if (!notificationSound._isPlaying && !notificationSound._hasError) {
                // Remettre le son au début et le jouer
                notificationSound.currentTime = 0;
                // Essayer de jouer le son (peut échouer en raison des politiques du navigateur)
                const playPromise = notificationSound.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        // Marquer le son comme ayant une erreur pour éviter de réessayer continuellement
                        notificationSound._hasError = true;
                        console.log('Chat Admin: Erreur lors de la lecture du son de notification', error);
                    });
                    
                    // Marquer le son comme en cours de lecture
                    notificationSound._isPlaying = true;
                    
                    // Réinitialiser l'état une fois la lecture terminée
                    notificationSound.onended = function() {
                        notificationSound._isPlaying = false;
                    };
                }
            }
        } catch (err) {
            // En cas d'erreur, marquer le son comme en erreur pour éviter les tentatives répétées
            notificationSound._hasError = true;
            console.log('Chat Admin: Exception lors de la lecture du son', err);
        }
    }
}

// Obtenir le texte du statut
function getStatusText(status) {
    return status === 'online' ? 'En ligne' : 'Hors ligne';
} 