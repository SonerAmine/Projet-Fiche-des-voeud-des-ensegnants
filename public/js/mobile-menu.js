/**
 * Gestion du menu mobile
 * Facilite la navigation sur petits écrans
 */

document.addEventListener('DOMContentLoaded', function() {
    // Création du bouton de menu mobile s'il n'existe pas déjà
    if (!document.querySelector('.mobile-menu-toggle') && window.innerWidth <= 768) {
        createMobileMenuButton();
    }

    // Détection du redimensionnement de la fenêtre
    window.addEventListener('resize', function() {
        if (window.innerWidth <= 768 && !document.querySelector('.mobile-menu-toggle')) {
            createMobileMenuButton();
        } else if (window.innerWidth > 768 && document.querySelector('.mobile-menu-toggle')) {
            document.querySelector('.mobile-menu-toggle').remove();
        }
    });

    // Gestion du menu latéral (sidebar) pour l'admin
    if (document.querySelector('.sidebar')) {
        setupSidebar();
    }
});

/**
 * Crée le bouton de menu mobile
 */
function createMobileMenuButton() {
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-toggle';
    mobileMenuBtn.innerHTML = '<i class="bi bi-list" style="font-size: 1.5rem;"></i>';
    document.body.appendChild(mobileMenuBtn);

    // Gestion des clics sur le bouton de menu
    mobileMenuBtn.addEventListener('click', function() {
        // Si un menu latéral existe (admin panel)
        if (document.querySelector('.sidebar')) {
            document.querySelector('.sidebar').classList.toggle('active');
            return;
        }

        // Sinon, créer un menu pour les pages standard
        toggleMobileNavMenu();
    });
}

/**
 * Configure le menu latéral administrateur
 */
function setupSidebar() {
    // Ajouter un bouton de fermeture au sidebar
    if (!document.querySelector('.sidebar-close')) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'sidebar-close';
        closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        closeBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;';
        document.querySelector('.sidebar').prepend(closeBtn);

        closeBtn.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.remove('active');
        });
    }

    // Gérer les clics en dehors du sidebar pour le fermer
    document.addEventListener('click', function(event) {
        const sidebar = document.querySelector('.sidebar');
        const mobileMenuBtn = document.querySelector('.mobile-menu-toggle');
        
        if (sidebar && sidebar.classList.contains('active') && 
            !sidebar.contains(event.target) && 
            mobileMenuBtn && !mobileMenuBtn.contains(event.target)) {
            sidebar.classList.remove('active');
        }
    });
}

/**
 * Affiche/masque le menu de navigation mobile
 */
function toggleMobileNavMenu() {
    let mobileNav = document.querySelector('.mobile-nav');
    
    // Créer le menu s'il n'existe pas
    if (!mobileNav) {
        mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-nav';
        
        // Styles pour le menu mobile
        mobileNav.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 998;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            transition: all 0.3s ease;
            opacity: 0;
            visibility: hidden;
        `;
        
        // Récupérer les liens de navigation
        const navLinks = document.querySelectorAll('.navbar-nav .nav-link');
        navLinks.forEach(link => {
            const newLink = link.cloneNode(true);
            newLink.style.cssText = `
                color: white;
                font-size: 1.2rem;
                margin: 15px 0;
                text-decoration: none;
                transition: all 0.3s ease;
            `;
            mobileNav.appendChild(newLink);
        });
        
        // Ajouter un bouton de fermeture
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mobile-nav-close';
        closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            color: white;
            font-size: 2rem;
            cursor: pointer;
        `;
        
        closeBtn.addEventListener('click', function() {
            toggleMobileNavMenu();
        });
        
        mobileNav.appendChild(closeBtn);
        document.body.appendChild(mobileNav);
    }
    
    // Afficher ou masquer le menu
    setTimeout(() => {
        if (mobileNav.style.visibility === 'visible') {
            mobileNav.style.opacity = '0';
            mobileNav.style.visibility = 'hidden';
        } else {
            mobileNav.style.opacity = '1';
            mobileNav.style.visibility = 'visible';
        }
    }, 10);
}

/**
 * Optimise les formulaires pour mobile
 */
function optimizeFormsForMobile() {
    // S'assurer que les inputs sont assez grands sur mobile
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            // Sur mobile, scroller pour centrer l'élément actif
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    const rect = this.getBoundingClientRect();
                    const elementTop = rect.top + window.pageYOffset;
                    const elementMiddle = elementTop - (window.innerHeight / 3);
                    window.scrollTo({top: elementMiddle, behavior: 'smooth'});
                }, 300);
            }
        });
    });
}

// Optimiser les formulaires quand le DOM est chargé
document.addEventListener('DOMContentLoaded', optimizeFormsForMobile); 