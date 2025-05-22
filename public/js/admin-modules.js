/**
 * Gestion des modules dans l'interface d'administration
 */

document.addEventListener('DOMContentLoaded', function() {
    // Charger les spécialités pour le formulaire d'ajout de module
    loadSpecialites();
    
    // Écouteur d'événement sur le bouton de sauvegarde de module
    const saveModuleBtn = document.getElementById('save-module-btn');
    if (saveModuleBtn) {
        saveModuleBtn.addEventListener('click', handleSaveModule);
    }
    
    // Réinitialiser le formulaire à l'ouverture du modal
    $('#addModuleModal').on('shown.bs.modal', function() {
        resetModuleForm();
    });
});

/**
 * Charge les spécialités depuis l'API pour les afficher dans le formulaire
 */
async function loadSpecialites() {
    try {
        const response = await fetch('/api/specialites', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des spécialités');
        }
        
        const specialites = await response.json();
        
        // Remplir le sélecteur de spécialités
        const specialiteSelect = document.getElementById('module-specialite');
        if (specialiteSelect) {
            // Conserver l'option par défaut
            specialiteSelect.innerHTML = '<option value="" selected disabled>Choisir une spécialité</option>';
            
            // Ajouter les spécialités
            specialites.forEach(specialite => {
                const option = document.createElement('option');
                option.value = specialite._id;
                option.textContent = specialite.nom;
                specialiteSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erreur lors du chargement des spécialités:', error);
        showNotification('error', 'Erreur lors du chargement des spécialités');
    }
}

/**
 * Gère la sauvegarde d'un nouveau module
 */
async function handleSaveModule() {
    try {
        // Réinitialiser les messages d'erreur
        resetModuleFormErrors();
        
        // Récupérer les valeurs du formulaire
        const nom = document.getElementById('module-nom').value;
        const specialite = document.getElementById('module-specialite').value;
        const semestre = document.getElementById('module-semestre').value;
        
        // Récupérer les natures sélectionnées
        const natureCours = document.getElementById('module-nature-cours').checked;
        const natureTD = document.getElementById('module-nature-td').checked;
        const natureTP = document.getElementById('module-nature-tp').checked;
        
        // Construire le tableau des natures
        const nature = [];
        if (natureCours) nature.push('Cours');
        if (natureTD) nature.push('TD');
        if (natureTP) nature.push('TP');
        
        // Valider le formulaire
        let isValid = true;
        
        if (!nom) {
            document.getElementById('module-nom').classList.add('is-invalid');
            isValid = false;
        }
        
        if (!specialite) {
            document.getElementById('module-specialite').classList.add('is-invalid');
            isValid = false;
        }
        
        if (!semestre) {
            document.getElementById('module-semestre').classList.add('is-invalid');
            isValid = false;
        }
        
        if (nature.length === 0) {
            document.getElementById('nature-feedback').style.display = 'block';
            isValid = false;
        }
        
        if (!isValid) {
            return;
        }
        
        // Envoi des données au serveur
        const response = await fetch('/api/modules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                nom,
                specialite,
                semestre: parseInt(semestre),
                nature
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Erreur lors de la création du module');
        }
        
        // Afficher un message de succès
        showModuleFormSuccess('Module créé avec succès !');
        
        // Attendre un peu avant de fermer le modal
        setTimeout(() => {
            // Réinitialiser le formulaire
            resetModuleForm();
            
            // Fermer le modal
            $('#addModuleModal').modal('hide');
            
            // Rafraîchir la liste des modules
            loadModules();
            
            // Afficher une notification
            showNotification('success', 'Le module a été créé avec succès');
        }, 1500);
        
    } catch (error) {
        console.error('Erreur lors de la création du module:', error);
        showModuleFormError(error.message);
    }
}

/**
 * Réinitialise le formulaire d'ajout de module
 */
function resetModuleForm() {
    // Réinitialiser les champs
    document.getElementById('module-nom').value = '';
    document.getElementById('module-specialite').value = '';
    document.getElementById('module-semestre').value = '';
    document.getElementById('module-nature-cours').checked = false;
    document.getElementById('module-nature-td').checked = false;
    document.getElementById('module-nature-tp').checked = false;
    
    // Masquer les messages d'erreur
    resetModuleFormErrors();
    
    // Masquer les messages de succès
    document.getElementById('module-form-success').classList.add('d-none');
}

/**
 * Réinitialise les erreurs du formulaire
 */
function resetModuleFormErrors() {
    // Réinitialiser les classes d'invalidation
    document.getElementById('module-nom').classList.remove('is-invalid');
    document.getElementById('module-specialite').classList.remove('is-invalid');
    document.getElementById('module-semestre').classList.remove('is-invalid');
    document.getElementById('nature-feedback').style.display = 'none';
    
    // Masquer le message d'erreur global
    document.getElementById('module-form-error').classList.add('d-none');
}

/**
 * Affiche un message d'erreur dans le formulaire
 */
function showModuleFormError(message) {
    const errorElement = document.getElementById('module-form-error');
    errorElement.textContent = message;
    errorElement.classList.remove('d-none');
}

/**
 * Affiche un message de succès dans le formulaire
 */
function showModuleFormSuccess(message) {
    const successElement = document.getElementById('module-form-success');
    successElement.textContent = message;
    successElement.classList.remove('d-none');
}

/**
 * Affiche une notification
 */
function showNotification(type, message) {
    // Vérifie si la fonction existe (définie dans un autre fichier)
    if (typeof showToast === 'function') {
        showToast(type, message);
    } else {
        // Fallback si la fonction n'existe pas
        alert(message);
    }
} 