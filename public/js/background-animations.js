/**
 * Animations et effets pour l'arrière-plan des fiches de vœux
 */

document.addEventListener('DOMContentLoaded', function() {
    // Modifier les paramètres des particules pour les adapter à notre nouvelle image de fond
    if (typeof particlesJS !== 'undefined') {
        particlesJS('particles-js', {
            particles: {
                number: { 
                    value: 80,
                    density: { enable: true, value_area: 800 } 
                },
                color: { value: '#4361ee' },
                shape: {
                    type: 'circle',
                    stroke: { width: 0, color: '#000000' },
                    polygon: { nb_sides: 5 }
                },
                opacity: {
                    value: 0.3,
                    random: true,
                    anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false }
                },
                size: {
                    value: 5,
                    random: true,
                    anim: { enable: true, speed: 5, size_min: 0.1, sync: false }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#4361ee',
                    opacity: 0.2,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: true,
                    straight: false,
                    out_mode: 'out',
                    bounce: false,
                    attract: { enable: true, rotateX: 600, rotateY: 1200 }
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: { enable: true, mode: 'bubble' },
                    onclick: { enable: true, mode: 'push' },
                    resize: true
                },
                modes: {
                    grab: { distance: 400, line_linked: { opacity: 1 } },
                    bubble: { distance: 100, size: 7, duration: 2, opacity: 0.8, speed: 3 },
                    repulse: { distance: 200, duration: 0.4 },
                    push: { particles_nb: 4 },
                    remove: { particles_nb: 2 }
                }
            },
            retina_detect: true
        });
    }

    // Effet parallaxe sur l'arrière-plan quand la souris se déplace
    const voeuxBackground = document.querySelector('.voeux-background');
    if (voeuxBackground) {
        document.addEventListener('mousemove', function(e) {
            const mouseX = e.clientX / window.innerWidth;
            const mouseY = e.clientY / window.innerHeight;
            
            voeuxBackground.style.transform = `translate(-${mouseX * 10}px, -${mouseY * 10}px) scale(1.1)`;
        });
    }

    // Ajouter la classe animated-form aux formulaires
    const voeuxForm = document.getElementById('voeuxForm');
    if (voeuxForm) {
        voeuxForm.classList.add('animated-form');
    }

    // Ajouter l'effet de flottement à certains éléments
    const headings = document.querySelectorAll('h1, h2');
    headings.forEach(heading => {
        heading.classList.add('floating-element');
    });

    // Ajouter un effet de transition sur les boutons
    const buttons = document.querySelectorAll('.btn-primary, .btn-success');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
        });
    });

    // Ajouter un effet visuel lors du chargement de la page
    const body = document.querySelector('body');
    if (body) {
        body.style.opacity = '0';
        setTimeout(() => {
            body.style.transition = 'opacity 1s ease';
            body.style.opacity = '1';
        }, 100);
    }

    // Ajouter des effets d'animation aux champs du formulaire
    const formInputs = document.querySelectorAll('.form-control, .form-select');
    formInputs.forEach((input, index) => {
        // Ajouter un délai croissant pour chaque champ
        const delay = 100 + (index * 50);
        
        // Initialement, rendre le champ invisible
        input.style.opacity = '0';
        input.style.transform = 'translateY(20px)';
        
        // Animer l'apparition avec un délai
        setTimeout(() => {
            input.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            input.style.opacity = '1';
            input.style.transform = 'translateY(0)';
        }, delay);
        
        // Ajouter des effets de focus
        input.addEventListener('focus', function() {
            this.style.boxShadow = '0 0 0 3px rgba(67, 97, 238, 0.3)';
            this.style.transform = 'scale(1.02)';
        });
        
        input.addEventListener('blur', function() {
            this.style.boxShadow = '';
            this.style.transform = '';
        });
    });

    // Ajouter des effets aux boutons d'ajout de choix
    const addChoiceButtons = document.querySelectorAll('.btn-add-choix');
    addChoiceButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Trouver le dernier élément ajouté
            const container = this.closest('.tab-pane').querySelector('.choix:last-child');
            if (container) {
                // Ajouter une classe pour l'animation d'apparition
                container.classList.add('animate__animated', 'animate__bounceIn');
                container.style.opacity = '0';
                
                // Attendre un court moment puis animer
                setTimeout(() => {
                    container.style.opacity = '1';
                    
                    // Créer un effet de brillance
                    const glow = document.createElement('div');
                    glow.className = 'glow-effect';
                    glow.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border-radius: 10px;
                        box-shadow: 0 0 30px 5px rgba(67, 97, 238, 0.5);
                        z-index: -1;
                        opacity: 0.8;
                        pointer-events: none;
                        animation: glowPulse 1.5s ease-out forwards;
                    `;
                    
                    container.style.position = 'relative';
                    container.appendChild(glow);
                    
                    // Supprimer l'effet après l'animation
                    setTimeout(() => {
                        glow.remove();
                    }, 1500);
                }, 100);
            }
        });
    });

    // Ajouter une animation de keyframe pour l'effet de brillance
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerHTML = `
        @keyframes glowPulse {
            0% { opacity: 0.8; }
            100% { opacity: 0; transform: scale(1.1); }
        }
    `;
    document.head.appendChild(styleSheet);
});

// Fonction pour créer un effet de vagues animées en bas de la page
function createWavesAnimation() {
    const wavesContainer = document.createElement('div');
    wavesContainer.className = 'waves-animation';
    wavesContainer.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100px;
        overflow: hidden;
        z-index: -1;
    `;

    // Créer 3 vagues avec des vitesses et des opacités différentes
    for (let i = 1; i <= 3; i++) {
        const wave = document.createElement('div');
        wave.className = `wave wave${i}`;
        wave.style.cssText = `
            position: absolute;
            bottom: ${(i-1) * 10}px;
            left: 0;
            width: 200%;
            height: ${30 + (i-1) * 10}px;
            background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 1000 150" xmlns="http://www.w3.org/2000/svg"><path d="M0,150 C200,75 300,0 500,100 C700,200 800,75 1000,150 L1000,250 L0,250 Z" fill="rgba(67, 97, 238, 0.${i*2-1})"/></svg>') repeat-x;
            animation: wave ${15 + i * 5}s linear infinite;
            opacity: ${0.7 - (i-1) * 0.2};
        `;
        wavesContainer.appendChild(wave);
    }

    document.body.appendChild(wavesContainer);
}

// Appeler la fonction pour créer l'animation de vagues
document.addEventListener('DOMContentLoaded', createWavesAnimation); 