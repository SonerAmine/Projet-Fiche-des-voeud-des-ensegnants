/**
 * Success Message Handler
 * This script ensures a success message appears after form submission
 * Works independently of other scripts
 */

// Make the success message function globally available
window.createSuccessMessage = function() {
    // Check if we already have a success message
    if (document.querySelector('.success-message-alert')) {
        return;
    }
    
    // Create the success message element
    const message = document.createElement('div');
    message.className = 'success-message-alert';
    message.style.position = 'fixed';
    message.style.top = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.zIndex = '10000';
    message.style.backgroundColor = '#d4edda';
    message.style.color = '#155724';
    message.style.padding = '15px 25px';
    message.style.borderRadius = '5px';
    message.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    message.style.borderLeft = '6px solid #28a745';
    message.style.fontSize = '18px';
    message.style.fontWeight = 'bold';
    message.style.maxWidth = '90%';
    message.style.textAlign = 'center';
    
    // Add icon and message text
    message.innerHTML = '<i style="margin-right: 10px;" class="bi bi-check-circle-fill"></i>Votre fiche de vœux a été soumise avec succès!';
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.marginLeft = '15px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.float = 'right';
    closeBtn.style.fontSize = '22px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.lineHeight = '18px';
    
    closeBtn.onclick = function() {
        if (message.parentNode) {
            message.parentNode.removeChild(message);
        }
    };
    
    message.appendChild(closeBtn);
    
    // Add to document
    document.body.appendChild(message);
    
    // Automatically remove after 8 seconds
    setTimeout(function() {
        if (message.parentNode) {
            message.style.opacity = '0';
            message.style.transition = 'opacity 0.5s ease';
            
            setTimeout(function() {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 500);
        }
    }, 8000);
    
    // Scroll to top to ensure message is visible
    window.scrollTo({top: 0, behavior: 'smooth'});
};

(function() {
    // Execute when DOM is fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Clear any existing submission flags on page load
        localStorage.removeItem('lastFormSubmission');
        localStorage.removeItem('submitButtonClicked');
        
        // Find all forms in the document
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            // Add submit handler to each form
            form.addEventListener('submit', function(e) {
                // Store submission timestamp to identify this particular submission
                const submissionTime = new Date().getTime();
                localStorage.setItem('lastFormSubmission', submissionTime);
                
                // We'll let the server response determine if the message should be shown
                // No automatic showing of the message anymore
            });
        });
        
        // Modifier pour ne pas afficher automatiquement le message de succès
        const submitButtons = document.querySelectorAll('button[type="submit"], input[type="submit"], .btn-submit, [id*="submit"], [class*="submit"]');
        submitButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Nous ne stockons plus le flag de clic ici
                // La fonction createSuccessMessage sera appelée explicitement par le code après
                // confirmation que la soumission a réussi
            });
        });
        
        // Ne plus vérifier les soumissions précédentes au chargement de la page
        // Cette partie est supprimée pour éviter que le message apparaisse au rafraîchissement
    });
})(); 