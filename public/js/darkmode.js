// Récupérer la préférence de thème stockée dans le localStorage
let darkmode = localStorage.getItem('darkmode');
const themeSwitch = document.getElementById('theme-switch');

// Ajouter la transition CSS pour un changement de thème fluide
document.documentElement.style.setProperty('--transition-speed', '0.3s');
document.head.insertAdjacentHTML('beforeend', `
  <style>
    body, body * {
      transition: background-color var(--transition-speed) ease, 
                  color var(--transition-speed) ease, 
                  border-color var(--transition-speed) ease,
                  box-shadow var(--transition-speed) ease,
                  fill var(--transition-speed) ease !important;
    }
    
    /* Éléments qui ne doivent pas avoir de transition */
    .ripple, .animated-overlay, .voeux-background {
      transition: none !important;
    }
  </style>
`);

// Fonction pour activer le mode sombre
const enableDarkmode = () => {
  document.body.classList.add('darkmode');
  localStorage.setItem('darkmode', 'active');
  
  // Cibler spécifiquement la barre de navigation
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    navbar.style.backgroundColor = '#0c1024';
    navbar.style.borderBottom = '1px solid #101425';
  }
  
  // Mettre à jour les couleurs des particules
  if (typeof particlesJS !== 'undefined' && window.pJSDom && window.pJSDom.length > 0) {
    try {
      // Si particlesJS est déjà initialisé, mettre à jour les couleurs
      window.pJSDom[0].pJS.particles.color.value = '#3a435d';
      window.pJSDom[0].pJS.particles.line_linked.color = '#3a435d';
      window.pJSDom[0].pJS.particles.opacity.value = 0.2; // Plus visible en mode sombre
      window.pJSDom[0].pJS.particles.line_linked.opacity = 0.15;
      window.pJSDom[0].pJS.fn.particlesRefresh();
    } catch (e) {
      console.log('Impossible de mettre à jour les particules', e);
    }
  }
  
  // Mise à jour des attributs aria pour l'accessibilité
  if (themeSwitch) {
    themeSwitch.setAttribute('aria-label', 'Passer au mode clair');
    themeSwitch.setAttribute('title', 'Passer au mode clair');
  }
  
  // Afficher une légère notification pour confirmer le changement de thème
  showThemeChangeNotification('Mode sombre activé');
}

// Fonction pour désactiver le mode sombre
const disableDarkmode = () => {
  document.body.classList.remove('darkmode');
  localStorage.setItem('darkmode', null);
  
  // Restaurer la couleur d'origine de la barre de navigation
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    navbar.style.backgroundColor = '';
    navbar.style.borderBottom = '';
  }
  
  // Réinitialiser les couleurs des particules
  if (typeof particlesJS !== 'undefined' && window.pJSDom && window.pJSDom.length > 0) {
    try {
      // Si particlesJS est déjà initialisé, réinitialiser les couleurs
      window.pJSDom[0].pJS.particles.color.value = '#4361ee';
      window.pJSDom[0].pJS.particles.line_linked.color = '#4361ee';
      window.pJSDom[0].pJS.particles.opacity.value = 0.05; // Valeur normale pour le mode clair
      window.pJSDom[0].pJS.particles.line_linked.opacity = 0.05;
      window.pJSDom[0].pJS.fn.particlesRefresh();
    } catch (e) {
      console.log('Impossible de mettre à jour les particules', e);
    }
  }
  
  // Mise à jour des attributs aria pour l'accessibilité
  if (themeSwitch) {
    themeSwitch.setAttribute('aria-label', 'Passer au mode sombre');
    themeSwitch.setAttribute('title', 'Passer au mode sombre');
  }
  
  // Afficher une légère notification pour confirmer le changement de thème
  showThemeChangeNotification('Mode clair activé');
}

// Fonction pour afficher une notification lors du changement de thème
function showThemeChangeNotification(message) {
  // Vérifier si une notification existe déjà
  let notification = document.getElementById('theme-notification');
  if (notification) {
    notification.remove();
  }
  
  // Créer une nouvelle notification
  notification = document.createElement('div');
  notification.id = 'theme-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    padding: 10px 15px;
    background-color: var(--accent-color);
    color: white;
    border-radius: 4px;
    font-size: 14px;
    z-index: 9999;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Afficher la notification avec une animation
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  }, 10);
  
  // Faire disparaître la notification après 2 secondes
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(20px)';
    
    // Supprimer l'élément du DOM après la fin de l'animation
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

// Appliquer le thème selon la préférence stockée
if (darkmode === "active") {
  enableDarkmode();
} else {
  // Vérifier si l'utilisateur préfère le thème sombre au niveau du système
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  if (prefersDarkScheme.matches && darkmode !== "inactive") {
    enableDarkmode();
  }
}

// Ajouter des attributs d'accessibilité au bouton
if (themeSwitch) {
  themeSwitch.setAttribute('aria-label', document.body.classList.contains('darkmode') ? 'Passer au mode clair' : 'Passer au mode sombre');
  themeSwitch.setAttribute('title', document.body.classList.contains('darkmode') ? 'Passer au mode clair' : 'Passer au mode sombre');
  
  // Ajouter l'écouteur d'événement au bouton
  themeSwitch.addEventListener("click", () => {
    darkmode = localStorage.getItem('darkmode');
    if (darkmode !== "active") {
      enableDarkmode();
    } else {
      disableDarkmode();
    }
  });
}

// Ajouter un écouteur pour détecter les changements de préférence au niveau du système
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
prefersDarkScheme.addEventListener('change', (e) => {
  if (e.matches && localStorage.getItem('darkmode') !== "inactive") {
    enableDarkmode();
  } else if (!e.matches && localStorage.getItem('darkmode') !== "active") {
    disableDarkmode();
  }
}); 