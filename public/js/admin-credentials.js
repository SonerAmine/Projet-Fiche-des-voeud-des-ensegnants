// Fonctions pour la gestion des envois d'emails
document.addEventListener('DOMContentLoaded', function() {
    // Référence aux éléments DOM
    const sendEmailsBtn = document.getElementById('send-emails-btn');
    const selectAllBtn = document.getElementById('select-all-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const resultContainer = document.getElementById('email-result');
    const progressBar = document.getElementById('progress-bar');
    
    // Variables pour stocker les utilisateurs sélectionnés
    let selectedUsers = [];
    
    // Référence aux éléments de la modal de confirmation
    const emailConfirmModal = new bootstrap.Modal(document.getElementById('emailConfirmModal'), {
        backdrop: 'static',
        keyboard: false
    });
    const emailConfirmCount = document.getElementById('emailConfirmCount');
    const emailConfirmBtn = document.getElementById('emailConfirmBtn');
    
    // Événement pour la case à cocher "Sélectionner tout"
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const userCheckboxes = document.querySelectorAll('.user-checkbox');
            userCheckboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
        });
    }

    // Événement pour le bouton "Sélectionner tout"
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', function() {
            const userCheckboxes = document.querySelectorAll('.user-checkbox');
            const isChecked = this.dataset.checked !== 'true';
            
            userCheckboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            
            this.dataset.checked = isChecked ? 'true' : 'false';
            this.textContent = isChecked ? 'Désélectionner tout' : 'Sélectionner tout';
            
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = isChecked;
            }
        });
    }
    
    // Fonction pour afficher une notification animée
    function showNotification(message, type = 'success') {
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} animate__animated animate__fadeInRight`;
        
        // Ajouter l'icône en fonction du type
        let icon = type === 'success' ? 'check-circle-fill' : 'exclamation-circle-fill';
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="bi bi-${icon}"></i>
                <span>${message}</span>
            </div>
            <button type="button" class="btn-close notification-close"></button>
        `;
        
        // Ajouter au conteneur de notifications
        const notificationContainer = document.getElementById('notification-container');
        if (!notificationContainer) {
            // Créer le conteneur s'il n'existe pas
            const container = document.createElement('div');
            container.id = 'notification-container';
            document.body.appendChild(container);
            container.appendChild(notification);
        } else {
            notificationContainer.appendChild(notification);
        }
        
        // Ajouter l'événement pour fermer la notification
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                notification.classList.remove('animate__fadeInRight');
                notification.classList.add('animate__fadeOutRight');
                setTimeout(() => {
                    notification.remove();
                }, 500);
            });
        }
        
        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('animate__fadeInRight');
                notification.classList.add('animate__fadeOutRight');
                setTimeout(() => {
                    notification.remove();
                }, 500);
            }
        }, 5000);
    }
    
    // Fonction pour envoyer les emails
    async function sendEmails() {
        // Afficher l'indicateur de progression
        if (progressBar) {
            progressBar.style.display = 'block';
        }
        
        if (resultContainer) {
            resultContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Envoi des emails en cours...</p>
                </div>
            `;
        }
        
        sendEmailsBtn.disabled = true;
        
        try {
            // Récupérer le token JWT
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Vous devez être connecté pour effectuer cette action');
            }
            
            // Appel API pour envoyer les emails
            const response = await fetch('/api/admin/send-credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    selectedUsers
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Afficher une notification de succès
                showNotification(`✅ ${data.successCount} email(s) envoyé(s) avec succès!`);
                
                // Afficher les résultats détaillés
                let resultHTML = `
                    <div class="result-card">
                        <div class="result-header success">
                            <i class="bi bi-envelope-check-fill"></i>
                            <h4>Envoi d'emails réussi!</h4>
                        </div>
                        <div class="result-body">
                            <div class="result-stats">
                                <div class="stat-item">
                                    <span class="stat-value">${data.totalEmails}</span>
                                    <span class="stat-label">Total</span>
                                </div>
                                <div class="stat-item success">
                                    <span class="stat-value">${data.successCount}</span>
                                    <span class="stat-label">Réussis</span>
                                </div>
                                <div class="stat-item ${data.errorCount > 0 ? 'error' : ''}">
                                    <span class="stat-value">${data.errorCount}</span>
                                    <span class="stat-label">Échecs</span>
                                </div>
                            </div>
                            
                            <div class="result-details">
                                <h5>Détails de l'envoi</h5>
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Email</th>
                                                <th>Statut</th>
                                                <th>Message</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                    `;
                    
                    data.results.forEach(result => {
                        resultHTML += `
                            <tr class="${result.success ? 'success-row' : 'error-row'}">
                                <td>${result.email}</td>
                                <td>${result.success ? 
                                    '<span class="badge bg-success"><i class="bi bi-check-circle-fill"></i> Succès</span>' : 
                                    '<span class="badge bg-danger"><i class="bi bi-x-circle-fill"></i> Échec</span>'}
                                </td>
                                <td>${result.message || ''}</td>
                            </tr>
                        `;
                    });
                    
                    resultHTML += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                `;
                
                if (resultContainer) {
                    resultContainer.innerHTML = resultHTML;
                }
            } else {
                // Afficher une notification d'erreur
                showNotification(`❌ Erreur: ${data.message}`, 'error');
                
                if (resultContainer) {
                    resultContainer.innerHTML = `
                        <div class="result-card">
                            <div class="result-header error">
                                <i class="bi bi-exclamation-triangle-fill"></i>
                                <h4>Erreur</h4>
                            </div>
                            <div class="result-body">
                                <p>${data.message}</p>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (error) {
            // Afficher une notification d'erreur
            showNotification(`❌ Erreur: ${error.message}`, 'error');
            
            if (resultContainer) {
                resultContainer.innerHTML = `
                    <div class="result-card">
                        <div class="result-header error">
                            <i class="bi bi-exclamation-triangle-fill"></i>
                            <h4>Erreur</h4>
                        </div>
                        <div class="result-body">
                            <p>Une erreur est survenue lors de l'envoi des emails.</p>
                            <p>${error.message}</p>
                        </div>
                    </div>
                `;
            }
        } finally {
            // Masquer l'indicateur de progression
            if (progressBar) {
                progressBar.style.display = 'none';
            }
            sendEmailsBtn.disabled = false;
        }
    }
    
    // Événement pour le bouton de confirmation dans la modale
    if (emailConfirmBtn) {
        emailConfirmBtn.addEventListener('click', function() {
            // Fermer la modale
            emailConfirmModal.hide();
            // Envoyer les emails
            sendEmails();
        });
    }
    
    // Événement pour l'envoi des emails
    if (sendEmailsBtn) {
        sendEmailsBtn.addEventListener('click', function() {
            // Vérifier si des utilisateurs sont sélectionnés
            const userCheckboxes = document.querySelectorAll('.user-checkbox');
            selectedUsers = Array.from(userCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => checkbox.value);
            
            if (selectedUsers.length === 0) {
                showNotification('Veuillez sélectionner au moins un enseignant', 'error');
                return;
            }
            
            // Mettre à jour le compteur dans la modale
            if (emailConfirmCount) {
                emailConfirmCount.textContent = selectedUsers.length;
            }
            
            // Afficher la modale de confirmation
            emailConfirmModal.show();
        });
    }
});

// Fonction pour charger les enseignants
async function loadTeachers() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.error('Vous devez être connecté pour effectuer cette action');
            return;
        }
        
        const response = await fetch('/api/admin/users?role=user', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des enseignants');
        }
        
        const teachers = await response.json();
        const teachersList = document.getElementById('teachers-list');
        
        if (teachersList) {
            teachersList.innerHTML = '';
            
            if (teachers.length === 0) {
                teachersList.innerHTML = '<tr><td colspan="4" class="text-center">Aucun enseignant trouvé</td></tr>';
                return;
            }
            
            teachers.forEach(teacher => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><input type="checkbox" class="user-checkbox" value="${teacher._id}"></td>
                    <td>${teacher.username || 'Non spécifié'}</td>
                    <td>${teacher.email}</td>
                    <td>${new Date(teacher.date_creation).toLocaleDateString()}</td>
                `;
                teachersList.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
        const teachersList = document.getElementById('teachers-list');
        if (teachersList) {
            teachersList.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Erreur: ${error.message}</td></tr>`;
        }
    }
} 