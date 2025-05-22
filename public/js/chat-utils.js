/**
 * Utilitaires pour le système de chat
 */

// Afficher/masquer le chargement
function showLoading(show) {
    const loadingElement = document.getElementById('chat-loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'flex' : 'none';
    }
}

// Afficher les conversations
function showConversations() {
    document.getElementById('chat-messages').classList.remove('active');
    document.getElementById('chat-conversations').style.display = 'block';
    
    // Réinitialiser la conversation courante
    chatState.currentConversation = null;
    currentChatUserId = null;
}

// Afficher les messages
function showMessages() {
    document.getElementById('chat-messages').classList.add('active');
    document.getElementById('chat-conversations').style.display = 'none';
}

// Formater l'heure d'un message
function formatMessageTime(date) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    // Format heure
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    
    if (isToday) {
        return timeString;
    } else if (isYesterday) {
        return `Hier, ${timeString}`;
    } else {
        // Format date court
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}, ${timeString}`;
    }
}

// Tronquer un texte
function truncateText(text, maxLength) {
    if (!text) return '';
    
    if (text.length <= maxLength) {
        return text;
    }
    
    return text.substring(0, maxLength) + '...';
}

// Mettre à jour l'indicateur de statut dans l'UI
function updateUIStatus(status) {
    // Fonction simplifiée - n'est plus utilisée activement mais gardée pour compatibilité
    const statusText = status === 'online' ? 'En ligne' : 'Hors ligne';
    return statusText;
}

// Mettre à jour le compteur de messages non lus
function updateUnreadCount(count) {
    if (typeof count === 'number') {
        unreadMessages = count;
    } else {
        unreadMessages++;
    }
    
    // Mettre à jour le badge sur le bouton de chat
    if (unreadMessages > 0) {
        // Créer le badge s'il n'existe pas
        let badge = newChatButton.querySelector('.chat-floating-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'chat-floating-badge';
            newChatButton.appendChild(badge);
        }
        
        // Mettre à jour le contenu du badge
        badge.textContent = unreadMessages > 99 ? '99+' : unreadMessages;
    } else {
        // Supprimer le badge s'il existe
        const badge = newChatButton.querySelector('.chat-floating-badge');
        if (badge) {
            badge.remove();
        }
    }
}

// Réinitialiser le compteur de messages non lus
function resetUnreadCount() {
    // Réinitialiser le compteur
    unreadMessages = 0;
    
    // Mettre à jour l'interface
    updateUnreadCount(0);
}

// Obtenir le texte correspondant à un statut
function getStatusText(status) {
    return status === 'online' ? 'En ligne' : 'Hors ligne';
}

// Mettre à jour le statut de l'utilisateur
function updateStatus(status) {
    // Fonction simplifiée - mise à jour du statut gérée uniquement par le serveur
    userStatus = status;
}

// Toggle le menu de statut
function toggleStatusMenu(show) {
    const statusMenu = document.getElementById('status-menu');
    if (statusMenu) {
        if (show === undefined) {
            // Toggle
            statusMenu.classList.toggle('show');
        } else {
            // Set
            if (show) {
                statusMenu.classList.add('show');
            } else {
                statusMenu.classList.remove('show');
            }
        }
    }
}

// Mettre à jour le statut d'un utilisateur dans l'UI
function updateUserStatusUI(userId, status) {
    // Mettre à jour dans les conversations
    const conversationItem = document.querySelector(`.conversation-item[data-user-id="${userId}"]`);
    if (conversationItem) {
        const statusIndicator = conversationItem.querySelector('.status-indicator');
        if (statusIndicator) {
            // Supprimer toutes les classes existantes
            statusIndicator.className = 'status-indicator';
            
            // Ajouter la classe correspondante
            statusIndicator.classList.add(`status-${status}`);
        }
    }
    
    // Mettre à jour dans les détails de conversation
    if (currentChatUserId === userId) {
        const statusText = getStatusText(status);
        document.getElementById('chat-user-status').textContent = statusText;
    }
}

// Envoyer un message
function sendMessage() {
    // Récupérer le contenu du message
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    
    // Vérifier si le message n'est pas vide
    if (content === '' || !currentChatUserId) {
        return;
    }
    
    // Afficher le message temporaire
    const tempMessage = {
        _id: 'temp-' + Date.now(),
        sender: {
            _id: currentUserId
        },
        receiver: {
            _id: currentChatUserId
        },
        content,
        timestamp: new Date(),
        sending: true
    };
    
    // Ajouter le message à l'UI
    addMessageToUI(tempMessage);
    
    // Scroller vers le bas
    scrollToBottom();
    
    // Vider le champ de saisie
    messageInput.value = '';
    
    // Réinitialiser l'indicateur de frappe
    resetTypingIndicator();
    
    // Envoyer le message via Socket.io
    if (socket && socket.connected) {
        socket.emit('send_message', {
            receiverId: currentChatUserId,
            content
        });
    } else {
        // Si Socket.io n'est pas disponible, envoyer via l'API REST
        sendMessageViaAPI(currentChatUserId, content)
            .then(message => {
                // Remplacer le message temporaire par le vrai message
                replaceTemporaryMessage(tempMessage._id, message);
            })
            .catch(error => {
                console.error('Chat: Erreur lors de l\'envoi du message', error);
                
                // Marquer le message comme non envoyé
                markMessageAsFailed(tempMessage._id);
            });
    }
}

// Envoyer un message via l'API REST
function sendMessageViaAPI(receiverId, content) {
    return fetch(`/api/chat/messages/${receiverId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            return data.data;
        } else {
            throw new Error(data.message || 'Erreur lors de l\'envoi du message');
        }
    });
}

// Ajouter un message à l'UI
function addMessageToUI(message) {
    // Vérifier si messagesListElement existe
    if (!messagesListElement) {
        console.error('Chat: messagesListElement non trouvé');
        return;
    }
    
    // Créer l'élément du message
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.setAttribute('data-message-id', message._id);
    
    // Déterminer s'il s'agit d'un message envoyé ou reçu
    const isSent = message.sender._id === currentUserId;
    messageElement.classList.add(isSent ? 'sent' : 'received');
    
    // Formater l'heure
    const messageTime = formatMessageTime(new Date(message.timestamp));
    
    // État d'envoi
    let statusHTML = '';
    if (isSent) {
        if (message.sending) {
            statusHTML = '<div class="message-status">Envoi en cours <i class="bi bi-clock"></i></div>';
        } else if (message.failed) {
            statusHTML = '<div class="message-status">Erreur d\'envoi <i class="bi bi-exclamation-circle"></i></div>';
        } else if (message.read) {
            statusHTML = '<div class="message-status">Lu <i class="bi bi-check2-all"></i></div>';
        } else {
            statusHTML = '<div class="message-status">Envoyé <i class="bi bi-check2"></i></div>';
        }
    }
    
    // Construire le contenu HTML
    messageElement.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${messageTime}</div>
        ${statusHTML}
    `;
    
    // Ajouter l'élément à la liste
    messagesListElement.appendChild(messageElement);
}

// Remplacer un message temporaire par le vrai message
function replaceTemporaryMessage(tempId, message) {
    const messageElement = document.querySelector(`.message[data-message-id="${tempId}"]`);
    if (messageElement) {
        // Mettre à jour l'attribut ID
        messageElement.setAttribute('data-message-id', message._id);
        
        // Mettre à jour le statut
        const statusElement = messageElement.querySelector('.message-status');
        if (statusElement) {
            statusElement.innerHTML = 'Envoyé <i class="bi bi-check2"></i>';
        }
    }
}

// Marquer un message comme échoué
function markMessageAsFailed(messageId) {
    const messageElement = document.querySelector(`.message[data-message-id="${messageId}"]`);
    if (messageElement) {
        // Mettre à jour le statut
        const statusElement = messageElement.querySelector('.message-status');
        if (statusElement) {
            statusElement.innerHTML = 'Erreur d\'envoi <i class="bi bi-exclamation-circle"></i>';
        }
    }
}

// Gérer un nouveau message
function handleNewMessage(message) {
    // Vérifier si le message est pour la conversation courante
    if (currentChatUserId === message.sender._id) {
        // Ajouter le message à l'UI
        addMessageToUI(message);
        
        // Scroller vers le bas
        scrollToBottom();
        
        // Marquer la conversation comme lue
        markConversationAsRead(message.sender._id);
    } else {
        // Mettre à jour le compteur de messages non lus
        updateUnreadCount();
        
        // Afficher une notification
        showMessageNotification({
            from: message.sender.username,
            fromId: message.sender._id,
            content: message.content
        });
    }
}

// Marquer une conversation comme lue
function markConversationAsRead(userId) {
    if (socket && socket.connected) {
        socket.emit('mark_conversation_read', { userId });
    } else {
        // Si Socket.io n'est pas disponible, utiliser l'API REST
        fetch(`/api/chat/conversations/${userId}/read`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .catch(error => {
            console.error('Chat: Erreur lors du marquage de la conversation', error);
        });
    }
}

// Afficher une notification de message
function showMessageNotification(data) {
    // Créer l'élément de notification
    const notificationElement = document.createElement('div');
    notificationElement.className = 'chat-notification';
    
    // Contenu de la notification
    notificationElement.innerHTML = `
        <div class="notification-avatar">
            ${data.avatar ? `<img src="${data.avatar}" alt="${data.from}">` : data.from.charAt(0).toUpperCase()}
        </div>
        <div class="notification-content">
            <h5 class="notification-name">${data.from}</h5>
            <p class="notification-message">${data.content ? truncateText(data.content, 40) : 'Nouveau message'}</p>
        </div>
        <div class="notification-close">
            <i class="bi bi-x"></i>
        </div>
    `;
    
    // Ajouter la notification au document
    document.body.appendChild(notificationElement);
    
    // Animer l'apparition
    setTimeout(() => {
        notificationElement.classList.add('show');
    }, 10);
    
    // Ajouter l'événement de clic pour ouvrir la conversation
    notificationElement.addEventListener('click', (e) => {
        // Ne pas déclencher si on a cliqué sur le bouton de fermeture
        if (e.target.closest('.notification-close')) {
            return;
        }
        
        // Ouvrir la conversation
        toggleChat(); // S'assurer que le chat est visible
        openConversation(data.fromId);
        
        // Supprimer la notification
        removeNotification(notificationElement);
    });
    
    // Ajouter l'événement de clic pour fermer la notification
    const closeButton = notificationElement.querySelector('.notification-close');
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        removeNotification(notificationElement);
    });
    
    // Masquer automatiquement après 5 secondes
    setTimeout(() => {
        removeNotification(notificationElement);
    }, 5000);
}

// Supprimer une notification
function removeNotification(notificationElement) {
    // Animer la disparition
    notificationElement.classList.remove('show');
    
    // Supprimer l'élément après l'animation
    setTimeout(() => {
        if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement);
        }
    }, 300);
}

// Scroller vers le bas dans la liste des messages
function scrollToBottom() {
    if (messagesListElement) {
        messagesListElement.scrollTop = messagesListElement.scrollHeight;
    }
}

// Gérer l'indicateur de frappe
function handleTypingIndicator() {
    // Ne pas envoyer d'événement à chaque frappe
    if (!isTyping && currentChatUserId) {
        isTyping = true;
        
        // Envoyer l'événement de frappe via Socket.io
        if (socket && socket.connected) {
            socket.emit('typing', { receiverId: currentChatUserId });
        }
    }
    
    // Réinitialiser le timeout
    clearTimeout(typingTimeout);
    
    // Réinitialiser après 2 secondes d'inactivité
    typingTimeout = setTimeout(() => {
        resetTypingIndicator();
    }, 2000);
}

// Réinitialiser l'indicateur de frappe
function resetTypingIndicator() {
    isTyping = false;
    
    // Envoyer l'événement de fin de frappe via Socket.io
    if (socket && socket.connected && currentChatUserId) {
        socket.emit('stop_typing', { receiverId: currentChatUserId });
    }
}

// Afficher l'indicateur de frappe dans l'UI
function showTypingIndicator(userId) {
    // Vérifier si l'utilisateur est dans la conversation courante
    if (currentChatUserId === userId) {
        // Vérifier si l'indicateur existe déjà
        let typingElement = document.querySelector('.typing-indicator');
        if (!typingElement) {
            typingElement = document.createElement('div');
            typingElement.className = 'typing-indicator';
            typingElement.innerHTML = `
                <span>En train d'écrire</span>
                <div class="typing-dots">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            `;
            
            // Ajouter à la liste des messages
            messagesListElement.appendChild(typingElement);
            
            // Scroller vers le bas
            scrollToBottom();
        }
    }
}

// Masquer l'indicateur de frappe dans l'UI
function hideTypingIndicator(userId) {
    // Vérifier si l'utilisateur est dans la conversation courante
    if (currentChatUserId === userId || userId === undefined) {
        // Supprimer l'indicateur s'il existe
        const typingElement = document.querySelector('.typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }
} 