// Fonctions pour gérer l'état du site
document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM
    const siteStatusToggle = document.getElementById('site-status-toggle');
    const siteStatusToggleLabel = document.getElementById('site-status-toggle-label');
    const siteStatusIndicator = document.getElementById('site-status-indicator');
    const siteStatusMessage = document.getElementById('site-status-message');
    const siteStatusMessageContainer = document.getElementById('site-status-message-container');
    const saveSiteStatusBtn = document.getElementById('save-site-status-btn');
    const siteStatusLastModified = document.getElementById('site-status-last-modified');
    const siteStatusLink = document.getElementById('site-status-link');

    // Fonction pour formater la date
    function formatDate(dateString) {
        if (!dateString) return 'Jamais';
        const date = new Date(dateString);
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Fonction pour mettre à jour l'interface en fonction de l'état du site
    function updateUIBasedOnSiteStatus(isLocked, message, lastModifiedAt, lastModifiedBy) {
        siteStatusToggle.checked = !isLocked;
        
        if (isLocked) {
            siteStatusToggleLabel.textContent = 'Site verrouillé (inaccessible aux enseignants)';
            siteStatusIndicator.className = 'badge bg-danger';
            siteStatusIndicator.textContent = 'Site verrouillé';
            siteStatusMessageContainer.style.display = 'block';
            siteStatusMessage.value = message || '';
        } else {
            siteStatusToggleLabel.textContent = 'Site actif (accessible aux enseignants)';
            siteStatusIndicator.className = 'badge bg-success';
            siteStatusIndicator.textContent = 'Site actif';
            siteStatusMessageContainer.style.display = 'none';
        }

        let modifiedText = "Jamais";
        if (lastModifiedAt) {
            modifiedText = `${formatDate(lastModifiedAt)}`;
            if (lastModifiedBy) {
                modifiedText += ` par ${lastModifiedBy.username || 'un administrateur'}`;
            }
        }
        siteStatusLastModified.textContent = modifiedText;
    }

    // Fonction pour charger l'état du site
    async function loadSiteStatus() {
        try {
            const response = await fetch('/api/admin/site-status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la récupération de l\'état du site');
            }

            const data = await response.json();
            
            if (data.success) {
                updateUIBasedOnSiteStatus(
                    data.siteStatus === 'locked',
                    data.lockMessage,
                    data.lastModifiedAt,
                    data.lastModifiedBy
                );
            }
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors de la récupération de l\'état du site', 'danger');
        }
    }

    // Fonction pour mettre à jour l'état du site
    async function updateSiteStatus() {
        try {
            const isLocked = !siteStatusToggle.checked;
            const message = isLocked ? siteStatusMessage.value : '';

            const response = await fetch('/api/admin/site-status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    status: isLocked ? 'locked' : 'active',
                    message: message
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la mise à jour de l\'état du site');
            }

            const data = await response.json();
            
            if (data.success) {
                updateUIBasedOnSiteStatus(
                    data.siteStatus === 'locked',
                    data.lockMessage,
                    data.lastModifiedAt,
                    { username: 'vous' }
                );
                
                showNotification(
                    `Le site a été ${data.siteStatus === 'locked' ? 'verrouillé' : 'déverrouillé'} avec succès`, 
                    'success'
                );
            }
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors de la mise à jour de l\'état du site', 'danger');
        }
    }

    // Gestionnaire d'événements pour le toggle
    if (siteStatusToggle) {
        siteStatusToggle.addEventListener('change', function() {
            if (this.checked) {
                // Site actif
                siteStatusToggleLabel.textContent = 'Site actif (accessible aux enseignants)';
                siteStatusMessageContainer.style.display = 'none';
            } else {
                // Site verrouillé
                siteStatusToggleLabel.textContent = 'Site verrouillé (inaccessible aux enseignants)';
                siteStatusMessageContainer.style.display = 'block';
            }
        });
    }

    // Gestionnaire d'événements pour le bouton de sauvegarde
    if (saveSiteStatusBtn) {
        saveSiteStatusBtn.addEventListener('click', updateSiteStatus);
    }

    // Charger l'état initial lorsqu'on accède à l'onglet
    if (siteStatusLink) {
        siteStatusLink.addEventListener('click', function() {
            loadSiteStatus();
        });
    }

    // Fonction pour afficher des notifications
    function showNotification(message, type = 'info') {
        // Vérifier si la fonction existe déjà (définie dans un autre fichier)
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        const container = document.getElementById('notification-container') || document.createElement('div');
        if (!document.getElementById('notification-container')) {
            container.id = 'notification-container';
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `alert alert-${type} animate__animated animate__fadeInRight`;
        notification.role = 'alert';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" aria-label="Close"></button>
        `;

        container.appendChild(notification);

        // Fermer la notification en cliquant sur le bouton
        notification.querySelector('.btn-close').addEventListener('click', function() {
            notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
            setTimeout(() => {
                notification.remove();
            }, 500);
        });

        // Fermer automatiquement après 5 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 500);
            }
        }, 5000);
    }
}); 