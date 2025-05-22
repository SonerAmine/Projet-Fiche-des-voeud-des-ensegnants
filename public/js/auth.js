// Fonction pour afficher les messages d'alerte
function showAlert(message, type = 'danger') {
    // Récupérer le conteneur d'alerte
    const alertContainer = document.getElementById('alert-container');
    
    if (!alertContainer) return;
    
    // Vider les alertes précédentes
    alertContainer.innerHTML = '';
    
    // Créer l'élément d'alerte
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    
    // Ajouter l'icône appropriée selon le type
    let icon = '';
    if (type === 'success') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 12l2 2 6-6"></path></svg>';
    } else if (type === 'danger') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else if (type === 'warning') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else if (type === 'site-locked') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
    }
    
    // Structure HTML de l'alerte
    const alertHTML = `
        <div class="alert-content">
            <div class="alert-icon">${icon}</div>
            <div class="alert-message">${message}</div>
            <button type="button" class="alert-close" aria-label="Fermer">&times;</button>
        </div>
    `;
    
    // Insérer le HTML à l'intérieur de l'élément d'alerte
    alertDiv.innerHTML = alertHTML;
    
    // Ajouter l'alerte au conteneur
    alertContainer.appendChild(alertDiv);
    
    // Rendre l'alerte visible (effet de pulsation pour les erreurs importantes)
    if (type === 'danger' || type === 'site-locked') {
        // Effet de pulsation pour attirer l'attention
        setTimeout(() => {
            alertDiv.classList.add('pulse-attention');
            setTimeout(() => alertDiv.classList.remove('pulse-attention'), 1000);
        }, 2000);
    }
    
    // Ajouter un gestionnaire d'événement pour fermer l'alerte
    const closeButton = alertDiv.querySelector('.alert-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            alertDiv.classList.add('fade-out');
            setTimeout(() => {
                alertDiv.remove();
            }, 300); // Attendre la fin de l'animation avant de supprimer
        });
    }
    
    // Supprimer automatiquement seulement les messages de succès
    // Les messages d'erreur et de site verrouillé restent affichés jusqu'à ce que l'utilisateur les ferme
    if (type === 'success') {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.classList.add('fade-out');
                setTimeout(() => {
                    if (alertDiv.parentNode) {
                        alertDiv.remove();
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Fonction pour gérer la connexion
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Validation des champs
    if (!email || !password) {
        showAlert('Veuillez remplir tous les champs', 'warning');
        return;
    }

    try {
        // Désactiver le bouton de connexion et afficher un indicateur de chargement
        const loginBtn = document.querySelector('.login-btn');
        const originalBtnText = loginBtn.textContent;
        loginBtn.disabled = true;
        loginBtn.textContent = 'Connexion en cours...';
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        // Réactiver le bouton de connexion
        loginBtn.disabled = false;
        loginBtn.textContent = originalBtnText;

        const data = await response.json();

        if (response.ok) {
            // Stocker le token dans le localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Afficher le message de succès
            showAlert('Connexion réussie ! Redirection en cours...', 'success');
            
            // Rediriger selon le rôle de l'utilisateur
            setTimeout(() => {
                // Vérifier si l'utilisateur est un administrateur ou un superadmin
                if (data.user && (data.user.role === 'admin' || data.user.role === 'superadmin')) {
                    // Rediriger vers le panneau d'administration
                    window.location.href = '/admin-panel.html';
                } else {
                    // Rediriger vers la page principale pour les utilisateurs normaux
                    window.location.href = '/';
                }
            }, 1500);
        } else {
            // Gérer les cas d'erreur spécifiques
            console.log('Erreur de connexion:', data);
            
            // Site verrouillé par l'admin
            if (data.error && data.error.code === 'SITE_LOCKED') {
                // Message détaillé pour le site verrouillé
                let message = data.message || 'Le site est actuellement verrouillé par l\'administration.';
                message += '<br><br><strong>Que faire ?</strong><br>• Veuillez patienter et réessayer plus tard<br>• Contactez l\'administrateur pour plus d\'informations';
                
                // Force l'utilisation du type site-locked pour un style spécifique
                showAlert(message, 'site-locked');
                return;
            }
            
            // Identifiants invalides
            if (response.status === 401 || (data.error && data.error.code === 'INVALID_CREDENTIALS')) {
                const message = 'Email ou mot de passe incorrect.<br><br>Veuillez vérifier vos identifiants et réessayer.';
                showAlert(message, 'danger');
                // Réinitialiser le champ de mot de passe
                document.getElementById('password').value = '';
                // Focus sur le champ de mot de passe
                document.getElementById('password').focus();
                return;
            }
            
            // Message d'erreur spécifique du serveur
            if (data.message) {
                showAlert(data.message, 'danger');
            } else {
                // Erreur générique
                showAlert('Erreur lors de la connexion. Veuillez réessayer.', 'danger');
            }
        }
    } catch (error) {
        console.error('Erreur détaillée:', error);
        
        // Réactiver le bouton de connexion en cas d'erreur
        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Se connecter';
        }
        
        if (error.message && error.message.includes('Failed to fetch')) {
            showAlert('Impossible de se connecter au serveur. Vérifiez votre connexion internet.', 'danger');
        } else {
            showAlert('Une erreur est survenue. Veuillez réessayer.', 'danger');
        }
    }
}

// Fonction pour gérer l'inscription
async function handleSignup(event) {
    event.preventDefault();
    
    const nom = document.getElementById('nom').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validation des champs
    if (!nom || !email || !password || !confirmPassword) {
        showAlert('Veuillez remplir tous les champs', 'warning');
        return;
    }

    // Vérifier que les mots de passe correspondent
    if (password !== confirmPassword) {
        showAlert('Les mots de passe ne correspondent pas', 'danger');
        return;
    }

    // Vérifier la force du mot de passe
    if (password.length < 8) {
        showAlert('Le mot de passe doit contenir au moins 8 caractères', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: nom, 
                email, 
                password 
            })
        });

        const data = await response.json();

        if (response.ok) {
            showAlert('Inscription réussie ! Redirection vers la page de connexion...', 'success');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 1500);
        } else {
            // Afficher le message d'erreur spécifique du serveur
            if (data.message) {
                showAlert(data.message, 'danger');
            } else if (response.status === 409) {
                showAlert('Cet email est déjà utilisé', 'danger');
            } else if (response.status === 400) {
                showAlert('Données invalides. Veuillez vérifier vos informations.', 'danger');
            } else {
                showAlert('Erreur lors de l\'inscription. Veuillez réessayer.', 'danger');
            }
        }
    } catch (error) {
        console.error('Erreur détaillée:', error);
        if (error.message.includes('Failed to fetch')) {
            showAlert('Impossible de se connecter au serveur. Vérifiez votre connexion internet.', 'danger');
        } else {
            showAlert('Une erreur est survenue. Veuillez réessayer.', 'danger');
        }
    }
}

// Effets visuels pour la page de login
function applyVisualEffects() {
    // Animation des icônes
    const icons = document.querySelectorAll('.input-group i');
    icons.forEach(icon => {
        icon.addEventListener('mouseover', function() {
            this.style.transform = 'translateY(-50%) scale(1.2)';
        });
        icon.addEventListener('mouseout', function() {
            this.style.transform = 'translateY(-50%)';
        });
    });
    
    // Animation au focus des champs
    const inputs = document.querySelectorAll('.input-group input');
    inputs.forEach(input => {
        // Élargir la zone de clic
        const inputGroup = input.parentNode;
        
        // S'assurer que le clic sur tout le conteneur met le focus sur l'input
        inputGroup.addEventListener('click', function(e) {
            if (e.target === inputGroup) {
                input.focus();
            }
        });
        
        input.addEventListener('focus', function() {
            this.parentNode.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentNode.classList.remove('focused');
            }
        });
    });
    
    // Effet de pulsation sur le bouton de connexion
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        setInterval(() => {
            loginBtn.classList.add('pulse');
            setTimeout(() => {
                loginBtn.classList.remove('pulse');
            }, 1000);
        }, 5000);
    }
}

// Optimisation de l'image de fond
function optimizeBackgroundImage() {
    // URL de l'image optimisée avec Sharp
    const imageUrl = '/images/fond login.jpg?width=1920&quality=85&format=webp';
    
    // Précharger l'image
    const img = new Image();
    img.onload = function() {
        // Une fois l'image chargée, on l'applique comme fond
        document.body.style.backgroundImage = `url('${imageUrl}')`;
        document.body.classList.add('bg-loaded');
        
        // Ajouter un effet de fade-in sur le conteneur
        setTimeout(() => {
            const container = document.querySelector('.container');
            if (container) container.classList.add('reveal');
        }, 300);
    };
    
    // Définir la source de l'image pour démarrer le chargement
    img.src = imageUrl;
}

// Ajouter les écouteurs d'événements aux formulaires
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        
        // Correction pour le problème de sélection des champs
        const inputGroups = document.querySelectorAll('.input-group');
        inputGroups.forEach(group => {
            // Créer une zone cliquable invisible plus grande
            const clickHelper = document.createElement('div');
            clickHelper.style.position = 'absolute';
            clickHelper.style.top = '-10px';
            clickHelper.style.left = '0';
            clickHelper.style.width = '100%';
            clickHelper.style.height = 'calc(100% + 20px)';
            clickHelper.style.cursor = 'text';
            clickHelper.style.zIndex = '0';
            
            group.style.position = 'relative';
            group.appendChild(clickHelper);
            
            // Quand on clique sur cette zone, focus sur l'input
            clickHelper.addEventListener('click', () => {
                const input = group.querySelector('input');
                if (input) input.focus();
            });
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Appliquer l'optimisation de l'image de fond
    optimizeBackgroundImage();
    
    // Appliquer les effets visuels
    applyVisualEffects();
}); 