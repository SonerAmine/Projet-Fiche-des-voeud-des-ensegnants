const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

// Gestion du basculement entre login et inscription
if (registerBtn) {
    registerBtn.addEventListener('click', () => {
        container.classList.add('active');
    });
}

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        container.classList.remove('active');
    });
}

// Gestion du formulaire de connexion
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur de connexion');
            }

            // Stocker les informations d'authentification
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
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
            
        } catch (error) {
            showError(error.message);
        }
    });
}

// Gestion du formulaire d'inscription
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Vérifier que les mots de passe correspondent
        if (password !== confirmPassword) {
            showError('Les mots de passe ne correspondent pas');
            return;
        }
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username,
                    email, 
                    password 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erreur lors de l\'inscription');
            }

            // Afficher un message de succès puis rediriger vers la page de connexion
            showSuccess('Inscription réussie ! Vous allez être redirigé vers la page de connexion.');
            
            // Redirection vers la page de connexion après inscription réussie
            setTimeout(() => {
                container.classList.remove('active');
            }, 2000);
            
        } catch (error) {
            showError(error.message);
        }
    });

    // Validation en temps réel des mots de passe
    const confirmPasswordInput = document.getElementById('confirm-password');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const password = document.getElementById('password').value;
            const confirmPassword = this.value;
            
            if (password !== confirmPassword) {
                this.setCustomValidity('Les mots de passe ne correspondent pas');
            } else {
                this.setCustomValidity('');
            }
        });
    }
}

// Gestion du formulaire de mot de passe oublié
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const submitButton = this.querySelector('button[type="submit"]');
        const alertContainer = document.getElementById('alert-container');
        
        try {
            // Afficher un message de chargement
            alertContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="bx bx-loader-alt bx-spin"></i> Envoi en cours...
                </div>
            `;
            alertContainer.style.display = 'block';
            
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> ENVOI EN COURS...';
            
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Une erreur est survenue');
            }

            // Remplacer tout le contenu du formulaire par le message de succès
            const formBox = document.querySelector('.form-box');
            if (formBox) {
                formBox.innerHTML = `
                    <div class="success-message">
                        <div class="success-icon">
                            <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                            </svg>
                        </div>
                        <h1 class="success-title">Email Envoyé Avec Succès</h1>
                        <div class="animated-card">
                            <h4 class="success-subtitle">Email de récupération envoyé !</h4>
                            <p class="success-text">Nous avons envoyé un lien de réinitialisation à <strong>${email}</strong>.</p>
                            <p class="success-text">Veuillez consulter votre boîte de réception et suivre les instructions pour réinitialiser votre mot de passe.</p>
                            <p class="success-note"><i class="bx bx-time"></i> Le lien est valable pendant <strong>24 heures</strong> pour des raisons de sécurité.</p>
                        </div>
                        <div class="auth-links">
                            <a href="login.html" class="styled-button"><i class='bx bx-arrow-back'></i> Retour à la connexion</a>
                        </div>
                    </div>
                `;
                
                // Ajout d'une animation d'apparition au bouton après un délai
                setTimeout(() => {
                    const button = formBox.querySelector('.styled-button');
                    if (button) {
                        button.style.animation = 'fadeIn 0.5s ease forwards';
                    }
                }, 1500);
            } else {
                // Fallback au cas où .form-box n'existe pas
                forgotPasswordForm.innerHTML = `
                    <div class="success-message">
                        <div class="success-icon">
                            <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                                <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                            </svg>
                        </div>
                        <h1 class="success-title">Email Envoyé Avec Succès</h1>
                        <div class="animated-card">
                            <h4 class="success-subtitle">Email de récupération envoyé !</h4>
                            <p class="success-text">Nous avons envoyé un lien de réinitialisation à <strong>${email}</strong>.</p>
                            <p class="success-text">Veuillez consulter votre boîte de réception et suivre les instructions pour réinitialiser votre mot de passe.</p>
                            <p class="success-note"><i class="bx bx-time"></i> Le lien est valable pendant <strong>24 heures</strong> pour des raisons de sécurité.</p>
                        </div>
                        <div class="auth-links">
                            <a href="login.html" class="styled-button"><i class='bx bx-arrow-back'></i> Retour à la connexion</a>
                        </div>
                    </div>
                `;
                
                // Ajout d'une animation d'apparition au bouton après un délai
                setTimeout(() => {
                    const button = forgotPasswordForm.querySelector('.styled-button');
                    if (button) {
                        button.style.animation = 'fadeIn 0.5s ease forwards';
                    }
                }, 1500);
            }
            
        } catch (error) {
            alertContainer.innerHTML = `
                <div class="alert alert-danger">
                    ${error.message}
                </div>
            `;
            alertContainer.style.display = 'block';
            
            submitButton.disabled = false;
            submitButton.textContent = 'RÉINITIALISER MON MOT DE PASSE';
        }
    });
}

// Gestion du formulaire de réinitialisation de mot de passe
const resetPasswordForm = document.getElementById('resetPasswordForm');
if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const alertContainer = document.getElementById('alert-container');
        const submitButton = this.querySelector('button[type="submit"]');
        
        if (password !== confirmPassword) {
            alertContainer.innerHTML = `
                <div class="alert alert-danger">
                    Les mots de passe ne correspondent pas
                </div>
            `;
            alertContainer.style.display = 'block';
            return;
        }
        
        // Vérifiez la force du mot de passe
        const passwordStrength = calculatePasswordStrength(password);
        if (passwordStrength < 40) {
            alertContainer.innerHTML = `
                <div class="alert alert-warning">
                    <h4><i class='bx bx-error-circle'></i> Mot de passe trop faible</h4>
                    <p>Votre mot de passe est considéré comme trop faible. Veuillez choisir un mot de passe plus fort pour continuer.</p>
                </div>
            `;
            alertContainer.style.display = 'block';
            return;
        }
        
        // Afficher un message de chargement
        alertContainer.innerHTML = `
            <div class="alert alert-info">
                <i class="bx bx-loader-alt bx-spin"></i> Réinitialisation en cours...
            </div>
        `;
        alertContainer.style.display = 'block';
        
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> EN COURS...';
        
        // Récupérer le token depuis l'URL
        const token = window.location.pathname.split('/').pop();
        
        try {
            const response = await fetch(`/api/auth/reset-password/${token}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (!response.ok) {
                // Si le serveur indique que le mot de passe est le même que l'ancien
                if (data.code === 'SAME_PASSWORD') {
                    throw new Error('Vous ne pouvez pas réutiliser votre ancien mot de passe. Veuillez en choisir un nouveau.');
                }
                throw new Error(data.message || 'Erreur lors de la réinitialisation du mot de passe');
            }

            // Rediriger vers la page de succès avec le minuteur
            window.location.href = '/reset-password-success.html';
            
        } catch (error) {
            alertContainer.innerHTML = `
                <div class="alert alert-danger">
                    ${error.message}
                </div>
            `;
            alertContainer.style.display = 'block';
            
            submitButton.disabled = false;
            submitButton.textContent = 'Réinitialiser le mot de passe';
        }
    });
}

/**
 * Calcule la force d'un mot de passe
 * @param {string} password - Le mot de passe à évaluer
 * @returns {number} - Score de force entre 0 et 100
 */
function calculatePasswordStrength(password) {
    let strength = 0;
    
    if(!password) return strength;
    
    // Longueur
    if(password.length >= 6) strength += 25;
    if(password.length >= 10) strength += 15;
    
    // Complexité
    if(/[A-Z]/.test(password)) strength += 15;
    if(/[0-9]/.test(password)) strength += 15;
    if(/[^A-Za-z0-9]/.test(password)) strength += 15;
    
    // Pénalités pour répétitions
    if(/([a-zA-Z0-9])\1{2,}/.test(password)) strength -= 10;
    
    // Force minimum de 10%
    strength = Math.max(10, strength);
    
    // Maximum de 100%
    return Math.min(100, strength);
}

// Utilitaires pour afficher des messages
function showError(message) {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.innerHTML = `
            <div class="alert alert-danger">
                ${message}
            </div>
        `;
        alertContainer.style.display = 'block';
        // Scroll jusqu'au message
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function showSuccess(message) {
    const alertContainer = document.getElementById('alert-container');
    if (alertContainer) {
        alertContainer.innerHTML = `
            <div class="alert alert-success">
                ${message}
            </div>
        `;
        alertContainer.style.display = 'block';
        // Scroll jusqu'au message
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Mettre à jour la visibilité du formulaire si nécessaire
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        if (forgotPasswordForm) {
            forgotPasswordForm.style.display = 'none';
            
            // Ajouter un texte de retour à la connexion si nécessaire
            const authLinks = document.querySelector('.auth-links');
            if (authLinks) {
                authLinks.style.display = 'block';
                authLinks.style.marginTop = '20px';
            }
        }
    }
} 