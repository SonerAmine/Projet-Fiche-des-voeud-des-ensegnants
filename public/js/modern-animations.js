/**
 * Modern Animations and Interactions for Fiches de Vœux Pédagogiques
 * This file adds enhanced user experience elements to the form
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all animations and interactive elements
    initIconInputs();
    initRippleEffect();
    initFloatingLabels();
    initAnimateOnScroll();
    initCardAnimations();
    initFormValidation();
    initCollapsibleCards();
    initLoadingIndicator();
    initSmoothScrolling();
    
    const form = document.getElementById('voeuxForm');
    const loadingElement = document.querySelector('.form-loading');
    
    if (form && loadingElement) {
        form.addEventListener('submit', function() {
            // Vérifier si le formulaire est valide avant d'afficher l'indicateur
            if (form.checkValidity()) {
                loadingElement.classList.add('active');
            }
        });
    }
});

/**
 * Add icons to form inputs based on field name
 */
function initIconInputs() {
    // Map field names to icons
    const iconMap = {
        'nom': 'person-fill',
        'email': 'envelope-fill',
        'telephone': 'telephone-fill',
        'grade': 'award-fill',
        'departement': 'building-fill',
        'bureau': 'door-open-fill',
        'heures': 'clock-fill',
        'module': 'book-fill',
        'niveau': 'layers-fill',
        'specialite': 'diagram-3-fill',
        'commentaires': 'chat-left-text-fill'
    };
    
    // Add missing icons to form labels that don't already have them
    document.querySelectorAll('.form-label').forEach(label => {
        if (label.querySelector('i')) return; // Skip if already has icon
        
        const forAttr = label.getAttribute('for');
        if (!forAttr) return;
        
        // Find matching icon based on field name
        let iconName = null;
        Object.keys(iconMap).forEach(key => {
            if (forAttr.toLowerCase().includes(key)) {
                iconName = iconMap[key];
            }
        });
        
        // Add icon if found
        if (iconName) {
            const icon = document.createElement('i');
            icon.className = `bi bi-${iconName} me-2 text-primary`;
            label.prepend(icon);
        }
    });
}

/**
 * Add scroll animations that trigger when elements come into view
 */
function initAnimateOnScroll() {
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    
    // Observer callback
    const onIntersection = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    };
    
    // Create observer
    const observer = new IntersectionObserver(onIntersection, {
        root: null,
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Observe each element
    animateElements.forEach(el => {
        observer.observe(el);
        
        // Add default animation class if not already animated
        if (!el.classList.contains('animated') && 
            !el.classList.contains('animate__animated')) {
            el.classList.add('fade-in-up');
        }
    });
}

/**
 * Add ripple effect to buttons when clicked
 */
function initRippleEffect() {
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            this.appendChild(ripple);
            
            // Remove the ripple element after animation completes
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
}

/**
 * Add floating label behavior to form inputs
 */
function initFloatingLabels() {
    const inputs = document.querySelectorAll('.form-control, .form-select');
    
    inputs.forEach(input => {
        // Skip inputs that already have floating labels
        if (input.parentElement.classList.contains('form-floating')) return;
        
        // For inputs with labels inside .icon-input
        if (input.parentElement.classList.contains('icon-input')) {
            const label = input.parentElement.querySelector('.form-label');
            if (label) {
                // Add floating behavior
                input.addEventListener('focus', () => {
                    label.classList.add('active');
                });
                
                input.addEventListener('blur', () => {
                    if (!input.value) {
                        label.classList.remove('active');
                    }
                });
                
                // Set initial state based on whether input has a value
                if (input.value || input.getAttribute('placeholder')) {
                    label.classList.add('active');
                }
            }
        }
        
        // Add animation effects on focus and blur
        input.addEventListener('focus', () => {
            input.classList.add('input-focused');
        });
        
        input.addEventListener('blur', () => {
            input.classList.remove('input-focused');
        });
    });
}

/**
 * Add animations to cards
 */
function initCardAnimations() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        // Add hover effect class if not already present
        if (!card.classList.contains('card-hover-effect')) {
            card.classList.add('card-hover-effect');
        }
        
        // Add animated entrance with delay based on card position
        if (!card.classList.contains('animate-on-scroll')) {
            card.classList.add('animate-on-scroll');
            card.style.animationDelay = `${index * 0.1}s`;
        }
        
        // Add dynamic gradient colors to card headers based on their section
        const header = card.querySelector('.card-header');
        if (header) {
            // Get text content to determine card type
            const headerText = header.textContent.toLowerCase();
            
            if (headerText.includes('personnel')) {
                header.classList.add('bg-primary-gradient');
            } else if (headerText.includes('semestre 1') || headerText.includes('choix') && headerText.includes('1')) {
                header.classList.add('bg-success-gradient');
            } else if (headerText.includes('semestre 2') || headerText.includes('choix') && headerText.includes('2')) {
                header.classList.add('bg-info-gradient');
            } else if (headerText.includes('module') && headerText.includes('précédent')) {
                header.classList.add('bg-secondary-gradient');
            } else if (headerText.includes('préférence') || headerText.includes('option')) {
                header.classList.add('bg-accent-gradient');
            }
        }
    });
}

/**
 * Implement dynamic form validation with visual feedback
 */
function initFormValidation() {
    const form = document.getElementById('voeuxForm');
    if (!form) return;
    
    // Add validation styles on input
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            validateInput(input);
        });
        
        input.addEventListener('blur', () => {
            validateInput(input);
        });
    });
    
    // Add form submission validation
    form.addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent the default form submission
        
        let isValid = true;
        inputs.forEach(input => {
            if (!validateInput(input)) {
                isValid = false;
            }
        });
        
        if (isValid) {
            // Show loading indicator
            const loadingElement = document.querySelector('.form-loading');
            if (loadingElement) loadingElement.classList.add('active');
            
            // Log to console that form is being submitted
            console.log('Form is valid, submitting...');
            
            // Simulate form submission (replace with actual submission logic)
            setTimeout(() => {
                // Ne pas afficher le message de succès automatiquement
                // displaySuccessMessage();
                
                // Hide loading indicator
                if (loadingElement) loadingElement.classList.remove('active');
                
                // Scroll to top to ensure message is visible
                window.scrollTo({top: 0, behavior: 'smooth'});
                
                console.log('Form submission complete, success message should be displayed');
            }, 1500);
        } else {
            // Scroll to first invalid input
            const firstInvalid = form.querySelector('.is-invalid');
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstInvalid.focus();
            }
        }
    });
    
    // Validation function
    function validateInput(input) {
        // Identifier le conteneur parent pour rechercher les messages d'erreur
        const container = input.closest('.icon-input') || input.parentNode;
        
        if (input.hasAttribute('required') && !input.value) {
            setInvalid(input, 'Ce champ est obligatoire');
            return false;
        }
        
        if (input.type === 'email' && input.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value)) {
                setInvalid(input, 'Veuillez entrer une adresse email valide');
                return false;
            }
        }
        
        if (input.hasAttribute('pattern') && input.value) {
            const pattern = new RegExp(input.getAttribute('pattern'));
            if (!pattern.test(input.value)) {
                setInvalid(input, input.getAttribute('data-error-message') || 'Valeur non valide');
                return false;
            }
        }
        
        setValid(input);
        
        // Nettoyer tous les messages d'erreur manuels qui pourraient avoir été ajoutés à côté du champ
        if (container) {
            // Rechercher les textes d'erreur qui pourraient avoir été ajoutés directement (sans classe spécifique)
            Array.from(container.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === 'Ce champ est obligatoire') {
                    container.removeChild(node);
                }
            });
            
            // Rechercher les éléments frères qui contiennent un message d'erreur
            const siblings = Array.from(container.children);
            siblings.forEach(sibling => {
                if (sibling !== input && 
                    sibling.textContent && 
                    sibling.textContent.includes('Ce champ est obligatoire')) {
                    sibling.remove();
                }
            });
        }
        
        return true;
    }
    
    function setInvalid(input, message) {
        input.classList.add('is-invalid');
        input.classList.remove('is-valid');
        
        // Nettoyer d'abord les messages d'erreur existants
        cleanErrorMessages(input);
        
        // Find or create feedback element
        let feedback = input.nextElementSibling;
        if (!feedback || !feedback.classList.contains('invalid-feedback')) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            input.parentNode.insertBefore(feedback, input.nextSibling);
        }
        
        feedback.textContent = message;
        
        // Ensure proper spacing and alignment
        feedback.style.display = 'block';
        feedback.style.marginTop = '6px';
        feedback.style.marginLeft = '5px';
    }
    
    function setValid(input) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        
        // Nettoyer tous les messages d'erreur
        cleanErrorMessages(input);
    }
    
    // Fonction pour nettoyer tous les types de messages d'erreur
    function cleanErrorMessages(input) {
        // Supprimer le message d'erreur standard s'il existe
        const feedback = input.nextElementSibling;
        if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.remove();
        }
        
        // Rechercher également les messages d'erreur qui pourraient être ailleurs dans le conteneur
        const parentContainer = input.closest('.icon-input') || input.parentNode;
        if (parentContainer) {
            // Supprimer les .invalid-feedback
            const errorMessages = parentContainer.querySelectorAll('.invalid-feedback');
            errorMessages.forEach(errorMsg => {
                errorMsg.remove();
            });
            
            // Supprimer tout élément avec une classe error
            const errorElements = parentContainer.querySelectorAll('.error');
            errorElements.forEach(errorElem => {
                errorElem.remove();
            });
            
            // Supprimer tout texte "Ce champ est obligatoire" ou tout autre texte d'erreur
            const allElementsInContainer = parentContainer.childNodes;
            Array.from(allElementsInContainer).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()) {
                    const errorText = node.textContent.trim();
                    if (errorText === 'Ce champ est obligatoire' || 
                        errorText.includes('obligatoire') ||
                        errorText.includes('valide')) {
                        parentContainer.removeChild(node);
                    }
                }
            });
        }
    }
    
    // Direct function to display success message - guaranteed to work
    function displaySuccessMessage() {
        // Create success message
        const message = 'Votre fiche de vœux a été soumise avec succès!';
        
        // Get alert container
        const alertContainer = document.getElementById('alert-container');
        if (!alertContainer) {
            console.error('Alert container not found');
            return;
        }
        
        // Create alert element with highly visible styling
        const alert = document.createElement('div');
        alert.className = 'alert alert-success alert-dismissible fade show';
        alert.style.fontSize = '1.2rem';
        alert.style.fontWeight = 'bold';
        alert.style.padding = '1.25rem 1.5rem';
        alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        alert.style.borderLeft = '6px solid #2e8540';
        alert.style.backgroundColor = '#d4edda';
        alert.style.color = '#155724';
        alert.style.borderRadius = '0.5rem';
        alert.style.position = 'relative';
        alert.style.zIndex = '1050';
        
        // Add content
        alert.innerHTML = `
            <i class="bi bi-check-circle-fill me-2" style="font-size: 1.4rem;"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Clear any existing alerts
        alertContainer.innerHTML = '';
        
        // Add to container
        alertContainer.appendChild(alert);
        
        // Automatically dismiss after 8 seconds
        setTimeout(() => {
            if (alert.parentNode === alertContainer) {
                alert.classList.add('fade');
                setTimeout(() => {
                    if (alert.parentNode === alertContainer) {
                        alertContainer.removeChild(alert);
                    }
                }, 500);
            }
        }, 8000);
    }
}

/**
 * Make card headers collapsible
 */
function initCollapsibleCards() {
    const cardHeaders = document.querySelectorAll('.card-header');
    
    cardHeaders.forEach(header => {
        // Skip headers that don't have h4, h5, or h6 titles
        const title = header.querySelector('h4, h5, h6');
        if (!title) return;
        
        // Add toggle icon and make clickable
        const iconSpan = document.createElement('span');
        iconSpan.className = 'ms-auto toggle-icon';
        iconSpan.innerHTML = '<i class="bi bi-chevron-up"></i>';
        title.appendChild(iconSpan);
        
        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        
        // Find the next card-body to toggle
        const cardBody = header.nextElementSibling;
        if (!cardBody || !cardBody.classList.contains('card-body')) return;
        
        // Add click event
        header.addEventListener('click', () => {
            // Toggle body visibility
            const isVisible = !cardBody.style.maxHeight || cardBody.style.maxHeight === 'none';
            
            if (isVisible) {
                cardBody.style.maxHeight = '0';
                cardBody.style.opacity = '0';
                cardBody.style.overflow = 'hidden';
                iconSpan.querySelector('i').classList.remove('bi-chevron-up');
                iconSpan.querySelector('i').classList.add('bi-chevron-down');
            } else {
                cardBody.style.maxHeight = 'none';
                cardBody.style.opacity = '1';
                cardBody.style.overflow = 'visible';
                iconSpan.querySelector('i').classList.remove('bi-chevron-down');
                iconSpan.querySelector('i').classList.add('bi-chevron-up');
            }
        });
    });
}

/**
 * Initialize loading indicator for form submission
 */
function initLoadingIndicator() {
    const loadingElement = document.querySelector('.form-loading');
    if (!loadingElement) return;
    
    // Style the loading indicator
    loadingElement.style.position = 'fixed';
    loadingElement.style.top = '0';
    loadingElement.style.left = '0';
    loadingElement.style.width = '100%';
    loadingElement.style.height = '100%';
    loadingElement.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingElement.style.display = 'flex';
    loadingElement.style.justifyContent = 'center';
    loadingElement.style.alignItems = 'center';
    loadingElement.style.zIndex = '9999';
    loadingElement.style.visibility = 'hidden';
    loadingElement.style.opacity = '0';
    loadingElement.style.transition = 'opacity 0.3s, visibility 0.3s';
    
    // Add active class handler
    loadingElement.classList.add = function(className) {
        if (className === 'active') {
            this.style.visibility = 'visible';
            this.style.opacity = '1';
        } else {
            HTMLElement.prototype.classList.add.call(this, className);
        }
    };
    
    loadingElement.classList.remove = function(className) {
        if (className === 'active') {
            this.style.opacity = '0';
            setTimeout(() => {
                this.style.visibility = 'hidden';
            }, 300);
        } else {
            HTMLElement.prototype.classList.remove.call(this, className);
        }
    };
}

/**
 * Add smooth scrolling to anchor links
 */
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            window.scrollTo({
                top: targetElement.offsetTop - 100,
                behavior: 'smooth'
            });
        });
    });
}

/**
 * CSS animations for the page
 */
// Add keyframes to document if not already present
if (!document.getElementById('modern-animations-keyframes')) {
    const keyframesStyle = document.createElement('style');
    keyframesStyle.id = 'modern-animations-keyframes';
    keyframesStyle.textContent = `
        /* Fade in up animation */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Scale in animation */
        @keyframes scaleIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        /* Add animation classes */
        .fade-in-up {
            opacity: 0;
            transform: translateY(20px);
        }
        
        .fade-in-up.animated {
            animation: fadeInUp 0.5s ease forwards;
        }
        
        .scale-in {
            opacity: 0;
            transform: scale(0.9);
        }
        
        .scale-in.animated {
            animation: scaleIn 0.5s ease forwards;
        }
        
        /* Input icon styles */
        .icon-input {
            position: relative;
        }
        
        .icon-input i {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--primary);
            z-index: 10;
        }
        
        .icon-input .form-control,
        .icon-input .form-select {
            padding-left: 35px;
        }
        
        .icon-input .form-label {
            position: absolute;
            left: 35px;
            top: 50%;
            transform: translateY(-50%);
            transition: all 0.3s;
            pointer-events: none;
            margin-bottom: 0;
            color: var(--gray-500);
            background-color: transparent;
            z-index: 5;
        }
        
        .icon-input .form-label.active,
        .icon-input .form-control:focus ~ .form-label,
        .icon-input .form-control:not(:placeholder-shown) ~ .form-label,
        .icon-input .form-select:focus ~ .form-label,
        .icon-input .form-select:not([value=""]) ~ .form-label {
            top: 0;
            font-size: 0.75rem;
            color: var(--primary);
            background-color: white;
            padding: 0 5px;
            z-index: 6;
        }
        
        /* Gradient backgrounds for card headers */
        .bg-primary-gradient {
            background: linear-gradient(135deg, var(--primary) 0%, #6786fb 100%);
            color: white;
        }
        
        .bg-success-gradient {
            background: linear-gradient(135deg, var(--success) 0%, #56cc9d 100%);
            color: white;
        }
        
        .bg-info-gradient {
            background: linear-gradient(135deg, var(--info) 0%, #62d5f2 100%);
            color: white;
        }
        
        .bg-warning-gradient {
            background: linear-gradient(135deg, var(--warning) 0%, #ffcf7b 100%);
            color: white;
        }
        
        .bg-danger-gradient {
            background: linear-gradient(135deg, var(--danger) 0%, #ff7b93 100%);
            color: white;
        }
        
        .bg-secondary-gradient {
            background: linear-gradient(135deg, var(--secondary) 0%, #a4a7b7 100%);
            color: white;
        }
        
        .bg-accent-gradient {
            background: linear-gradient(135deg, #7c4dff 0%, #aa83ff 100%);
            color: white;
        }
    `;
    
    document.head.appendChild(keyframesStyle);
} 