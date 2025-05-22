/**
 * Fichier gérant les fonctionnalités du profil utilisateur
 */

// Définir le chemin de l'image par défaut
const DEFAULT_PROFILE_IMAGE = '/images/anonyme-user-picture.avif';

// Fonction pour charger les données du profil utilisateur
function loadProfileData() {
    // Récupérer le token d'authentification
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error('Aucun token d\'authentification trouvé');
        return;
    }
    
    // Afficher un indicateur de chargement si nécessaire
    const profileImageElement = document.getElementById('profile-picture-preview');
    profileImageElement.classList.add('opacity-50');
    
    // Appel API pour récupérer les données de profil
    fetch('/api/profile/me', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const user = data.data;
            
            // Remplir les champs du formulaire
            document.getElementById('username').value = user.username || '';
            document.getElementById('email').value = user.email || '';
            document.getElementById('telephone').value = user.telephone || '';
            document.getElementById('role').value = user.role || '';
            
            // Mettre à jour l'image de profil
            if (user.profilePicture) {
                // S'assurer que le chemin commence par un slash
                const profilePicPath = user.profilePicture.startsWith('/') 
                    ? user.profilePicture 
                    : `/${user.profilePicture}`;
                    
                profileImageElement.src = profilePicPath;
                
                // Mettre à jour l'image de profil dans la barre latérale
                updateSidebarProfileImage(profilePicPath);
            } else {
                // Image par défaut
                profileImageElement.src = DEFAULT_PROFILE_IMAGE;
                
                // Mettre à jour l'image de profil dans la barre latérale
                updateSidebarProfileImage(DEFAULT_PROFILE_IMAGE);
            }
            
            // Mettre à jour le nom d'utilisateur dans la sidebar
            const usernameElement = document.getElementById('user-name');
            if (usernameElement) {
                usernameElement.textContent = user.username;
            }
        } else {
            console.error('Erreur lors du chargement du profil:', data.message);
            showToast('error', 'Erreur lors du chargement du profil');
        }
    })
    .catch(error => {
        console.error('Erreur fetch:', error);
        showToast('error', 'Erreur de connexion au serveur');
    })
    .finally(() => {
        // Supprimer l'indicateur de chargement
        profileImageElement.classList.remove('opacity-50');
    });
}

// Fonction pour mettre à jour l'image de profil dans la barre latérale
function updateSidebarProfileImage(imagePath) {
    // Chercher l'image de profil dans la barre latérale (utilisée dans le dropdown)
    const dropdownToggle = document.getElementById('user-dropdown');
    if (dropdownToggle) {
        const firstChild = dropdownToggle.querySelector('img');
        if (firstChild) {
            firstChild.src = imagePath;
        } else {
            // Si l'élément img n'existe pas, on peut le créer et l'ajouter avant l'icône
            const img = document.createElement('img');
            img.src = imagePath;
            img.alt = "Photo de profil";
            img.classList.add('rounded-circle', 'me-2');
            img.style.width = '30px';
            img.style.height = '30px';
            img.style.objectFit = 'cover';
            
            // Trouver l'icône et l'insérer avant
            const icon = dropdownToggle.querySelector('i');
            if (icon) {
                dropdownToggle.insertBefore(img, icon);
            } else {
                dropdownToggle.prepend(img);
            }
        }
    }
}

// Fonction pour prévisualiser l'image sélectionnée
function previewProfileImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            document.getElementById('profile-picture-preview').src = e.target.result;
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

// Fonction pour afficher un toast de notification
function showToast(type, message) {
    // Vérifier si la fonction showSuccessToast existe (définie dans admin.js)
    if (typeof showSuccessToast === 'function' && type === 'success') {
        showSuccessToast(message);
        return;
    }
    
    // Alternative si la fonction showNotification n'existe pas
    const toastContainer = document.getElementById('notification-container');
    if (!toastContainer) {
        console.error('Container de notification non trouvé');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `notification ${type === 'error' ? 'notification-error' : ''}`;
    
    const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
    
    toast.innerHTML = `
        <div class="notification-content">
            <i class="bi ${icon}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">
            <i class="bi bi-x"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Ajouter un gestionnaire d'événement pour fermer le toast
    toast.querySelector('.notification-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Supprimer automatiquement après 5 secondes
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Initialisation des événements
document.addEventListener('DOMContentLoaded', () => {
    // Gestionnaire pour la prévisualisation de l'image
    const profileImageInput = document.getElementById('profile-picture-input');
    if (profileImageInput) {
        profileImageInput.addEventListener('change', function() {
            previewProfileImage(this);
        });
    }
    
    // Gestionnaire pour la soumission du formulaire
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Récupérer le token
            const token = localStorage.getItem('token');
            if (!token) {
                showToast('error', 'Vous devez être connecté pour effectuer cette action');
                return;
            }
            
            // Création de l'objet FormData à partir du formulaire
            const formData = new FormData(this);
            
            // Vérifier si un fichier a été sélectionné
            const fileInput = document.getElementById('profile-picture-input');
            if (fileInput.files.length === 0) {
                // Aucun fichier sélectionné, supprimer le champ du FormData
                formData.delete('profilePicture');
            }
            
            // Désactiver le bouton d'envoi pour éviter les doubles soumissions
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="bi bi-hourglass"></i> Enregistrement...';
            }
            
            // Envoi des données au serveur
            fetch('/api/profile/me', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur HTTP: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Mise à jour réussie
                    showToast('success', 'Profil mis à jour avec succès');
                    
                    // Mettre à jour le nom d'utilisateur dans la sidebar
                    const usernameElement = document.getElementById('user-name');
                    if (usernameElement && data.data.username) {
                        usernameElement.textContent = data.data.username;
                    }
                    
                    // Mettre à jour l'image de profil dans la barre latérale si une nouvelle image a été téléchargée
                    if (fileInput.files.length > 0 && data.data.profilePicture) {
                        const profilePicPath = data.data.profilePicture.startsWith('/') 
                            ? data.data.profilePicture 
                            : `/${data.data.profilePicture}`;
                        updateSidebarProfileImage(profilePicPath);
                    }
                    
                    // Si nous utilisons une modale, la fermer
                    const profileModal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
                    if (profileModal) {
                        profileModal.hide();
                    }
                } else {
                    // Erreur lors de la mise à jour
                    showToast('error', data.message || 'Erreur lors de la mise à jour du profil');
                }
            })
            .catch(error => {
                console.error('Erreur fetch:', error);
                showToast('error', 'Erreur de connexion au serveur');
            })
            .finally(() => {
                // Réactiver le bouton d'envoi
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Enregistrer';
                }
            });
        });
    }
    
    // Si nous utilisons une modale, configurer l'événement d'ouverture
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('show.bs.modal', function() {
            loadProfileData();
        });
    }
    
    // Charger les données du profil au chargement de la page
    // pour mettre à jour l'image dans la barre latérale
    loadProfileData();
}); 