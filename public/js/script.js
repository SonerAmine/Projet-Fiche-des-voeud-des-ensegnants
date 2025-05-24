// Fonction utilitaire pour gérer les requêtes API avec gestion du statut du site
async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        // Vérifier si l'erreur concerne le site verrouillé
        if (!response.ok && response.status === 403 && data.error && data.error.code === 'SITE_LOCKED') {
            showSiteLockedMessage(data.message);
            throw new Error('Site verrouillé');
        }
        
        return { response, data };
    } catch (error) {
        if (error.message === 'Site verrouillé') {
            throw error;
        }
        
        console.error('Erreur lors de la requête API:', error);
        throw error;
    }
}

// Fonction pour charger les niveaux depuis l'API
async function chargerNiveaux(selectElement) {
    try {
        const response = await fetch('/api/niveaux');
        const niveaux = await response.json();
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez un palier</option>';
        
        // Définir l'ordre personnalisé des niveaux
        const ordreNiveaux = ['L1', 'L2', 'L3', 'M1', '4ème année ingénieur', 'M2', '5ème année ingénieur'];
        
        // Trier les niveaux selon l'ordre défini
        niveaux.sort((a, b) => {
            const indexA = ordreNiveaux.indexOf(a.nom);
            const indexB = ordreNiveaux.indexOf(b.nom);
            return indexA - indexB;
        });
        
        // Ajouter les niveaux
        niveaux.forEach(niveau => {
            const option = document.createElement('option');
            option.value = niveau._id;
            option.textContent = niveau.nom;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des niveaux:', error);
        showAlert('Erreur lors du chargement des niveaux', 'danger');
    }
}

// Fonction pour charger les spécialités d'un niveau
async function chargerSpecialites(niveauId, selectElement) {
    try {
        console.log(`Chargement des spécialités pour le niveau ${niveauId}...`);
        
        // Vérifier d'abord que l'ID est valide
        if (!niveauId || niveauId === '') {
            console.error('ID de niveau non fourni ou vide');
            selectElement.innerHTML = '<option value="">Sélectionnez d\'abord un palier valide</option>';
            return;
        }
        
        // Vérification du format de l'ID MongoDB
        if (!/^[0-9a-fA-F]{24}$/.test(niveauId)) {
            console.error(`ID de niveau invalide: ${niveauId}`);
            selectElement.innerHTML = '<option value="">ID de niveau invalide</option>';
            return;
        }
        
        // Effectuer la requête avec gestion du timeout
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Délai d\'attente dépassé')), 10000);
        });
        
        const fetchPromise = fetch(`/api/specialites/niveau/${niveauId}`);
        
        // Utiliser race pour avoir un timeout sur la requête fetch
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(timeoutId); // Nettoyer le timeout si la requête est terminée
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('Réponse spécialités:', responseData);
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez une spécialité</option>';
        
        // Vérifier si la réponse est un tableau
        if (!Array.isArray(responseData)) {
            console.error('Les données reçues ne sont pas un tableau:', responseData);
            throw new Error('Format de réponse invalide pour les spécialités');
        }
        
        // Ajouter les spécialités
        responseData.forEach(specialite => {
            if (specialite && specialite._id && specialite.nom) {
            const option = document.createElement('option');
            option.value = specialite._id;
            option.textContent = specialite.nom;
            selectElement.appendChild(option);
                console.log(`Spécialité ajoutée: ${specialite.nom} (${specialite._id})`);
            } else {
                console.warn('Spécialité invalide:', specialite);
            }
        });
        
        console.log(`${responseData.length} spécialités chargées`);
    } catch (error) {
        console.error('Erreur détaillée lors du chargement des spécialités:', error);
        showAlert(`Erreur lors du chargement des spécialités: ${error.message}`, 'danger');
        
        // Réinitialiser le select en cas d'erreur
        selectElement.innerHTML = '<option value="">Erreur de chargement des spécialités</option>';
    }
}

// Fonction pour charger les modules d'une spécialité pour un semestre
async function chargerModules(specialiteId, semestre, selectElement) {
    try {
        const response = await fetch(`/api/modules/specialite/${specialiteId}/semestre/${semestre}`);
        const modules = await response.json();
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez un module</option>';
        
        // Ajouter les modules
        modules.forEach(module => {
            const option = document.createElement('option');
            option.value = module._id;
            option.textContent = module.nom;
            option.dataset.nature = JSON.stringify(module.nature);
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des modules:', error);
        showAlert('Erreur lors du chargement des modules', 'danger');
    }
}

// Fonction pour mettre à jour les modules disponibles
async function updateModules(containerId, index) {
    const palierSelect = document.getElementById(`palier_${containerId}_${index}`);
    const specialiteSelect = document.getElementById(`specialite_${containerId}_${index}`);
    const moduleSelect = document.getElementById(`module_${containerId}_${index}`);
    
    if (!palierSelect.value) {
        specialiteSelect.innerHTML = '<option value="">Sélectionnez d\'abord un palier</option>';
        moduleSelect.innerHTML = '<option value="">Sélectionnez d\'abord une spécialité</option>';
        return;
    }
    
    if (!specialiteSelect.value) {
        moduleSelect.innerHTML = '<option value="">Sélectionnez d\'abord une spécialité</option>';
        return;
    }
    
    // Déterminer le semestre à partir de containerId (s1 ou s2)
    const semestre = containerId === 's1' ? 1 : 2;
    
    // Charger les modules pour la spécialité et le semestre sélectionnés
    await chargerModules(specialiteSelect.value, semestre, moduleSelect);
    
    // Mettre à jour les natures disponibles quand un module est sélectionné
    moduleSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption && selectedOption.dataset.nature) {
            try {
            const natures = JSON.parse(selectedOption.dataset.nature);
                console.log(`Natures disponibles: ${natures.join(', ')}`);
                
                // Identifier le conteneur parent du choix
                const choixDiv = this.closest('.module-choice-container');
                if (!choixDiv) {
                    console.error('Conteneur du choix non trouvé');
                    return;
                }
                
                // Vérifier si nous utilisons des checkboxes
                const natureCheckboxes = choixDiv.querySelectorAll('input.nature-checkbox');
                const natureSelect = choixDiv.querySelector('select[name*="nature"]');
                
                if (natureCheckboxes.length > 0) {
                    // Mettre à jour les options de nature disponibles pour les checkboxes
                    natureCheckboxes.forEach(checkbox => {
                        checkbox.checked = natures.includes(checkbox.value);
                    });
                } else if (natureSelect) {
                    // Mettre à jour les options de nature disponibles pour le select
                    Array.from(natureSelect.options).forEach(option => {
                        option.selected = natures.includes(option.value);
                    });
                }
            } catch (e) {
                console.error("Erreur lors du parsing des natures:", e);
            }
        }
    });
}

// Fonction pour ajouter un choix dynamiquement
function ajouterChoix(semestre) {
    const container = document.getElementById(`choix-${semestre}-container`);
    const index = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'module-choice-container';

    div.innerHTML = `
        <div class="module-selection-header">
            <h5 class="mb-0">Choix ${index}</h5>
            <button type="button" class="btn btn-supprimer" onclick="supprimerChoix(this)">
                <i class="bi bi-trash me-1"></i>Supprimer
            </button>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-3">
                <label for="palier_${semestre}_${index}" class="field-label">Palier :</label>
                <select id="palier_${semestre}_${index}" name="choix_${semestre}[${index-1}][palier]" class="form-select" required>
                    <option value="">Sélectionnez un palier</option>
                </select>
            </div>
            
            <div class="col-md-6 mb-3">
                <label for="specialite_${semestre}_${index}" class="field-label">Spécialité :</label>
                <select id="specialite_${semestre}_${index}" name="choix_${semestre}[${index-1}][specialite]" class="form-select" required>
                    <option value="">Sélectionnez d'abord un palier</option>
                </select>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-3">
                <label for="module_${semestre}_${index}" class="field-label">Module :</label>
                <select id="module_${semestre}_${index}" name="choix_${semestre}[${index-1}][module]" class="form-select" required>
                    <option value="">Sélectionnez d'abord une spécialité</option>
                </select>
            </div>
            
            <div class="col-md-6 mb-3">
                <label class="field-label">Nature :</label>
                <div class="nature-options">
                    <input type="checkbox" class="nature-checkbox" id="nature_${semestre}_${index}_Cours" 
                           name="choix_${semestre}[${index-1}][nature][]" value="Cours">
                    <label class="nature-label" for="nature_${semestre}_${index}_Cours">Cours</label>
                    
                    <input type="checkbox" class="nature-checkbox" id="nature_${semestre}_${index}_TD" 
                           name="choix_${semestre}[${index-1}][nature][]" value="TD">
                    <label class="nature-label" for="nature_${semestre}_${index}_TD">TD</label>
                    
                    <input type="checkbox" class="nature-checkbox" id="nature_${semestre}_${index}_TP" 
                           name="choix_${semestre}[${index-1}][nature][]" value="TP">
                    <label class="nature-label" for="nature_${semestre}_${index}_TP">TP</label>
                </div>
                <small class="nature-help-text"><i class="bi bi-info-circle me-1"></i>Vous pouvez sélectionner plusieurs options</small>
            </div>
        </div>
    `;
    
    container.appendChild(div);
    
    // Initialiser les événements pour le nouveau choix
    const palierSelect = document.getElementById(`palier_${semestre}_${index}`);
    const specialiteSelect = document.getElementById(`specialite_${semestre}_${index}`);
    const moduleSelect = document.getElementById(`module_${semestre}_${index}`);
    
    // Charger les niveaux
    chargerNiveaux(palierSelect);
    
    // Ajouter les événements
    palierSelect.addEventListener('change', async function() {
        console.log(`Palier sélectionné: ${this.value}`);
        await chargerSpecialites(this.value, specialiteSelect);
        if (specialiteSelect.value) {
            const semestreNum = semestre === 's1' ? 1 : 2;
            await chargerModules(specialiteSelect.value, semestreNum, moduleSelect);
        }
    });
    
    specialiteSelect.addEventListener('change', async function() {
        console.log(`Spécialité sélectionnée: ${this.value}`);
        if (this.value) {
            const semestreNum = semestre === 's1' ? 1 : 2;
            await chargerModules(this.value, semestreNum, moduleSelect);
        }
    });
}

// Fonction pour supprimer un choix dynamique
function supprimerChoix(button) {
    // Identifier le conteneur du module et son semestre
    const choixContainer = button.closest('.module-choice-container');
    const semestre = choixContainer.parentElement.id.includes('s1') ? 's1' : 's2';
    
    // Supprimer le choix
    choixContainer.remove();
    
    // Renuméroter les choix restants
    renumberChoices(semestre);
}

// Fonction pour renumber choices after deletion
function renumberChoices(semestre) {
    const container = document.getElementById(`choix-${semestre}-container`);
    const choices = container.querySelectorAll('.module-choice-container');
    
    choices.forEach((choice, index) => {
        // Update title
        const title = choice.querySelector('h5');
        if (title) {
            title.textContent = `Choix ${index + 1}`;
        }
        
        // Update input names
        const inputs = choice.querySelectorAll('select');
        inputs.forEach(input => {
            const name = input.name;
            if (name) {
                input.name = name.replace(/choix_[^[]+\[(\d+)\]/, `choix_${semestre}[${index}]`);
            }
        });
    });
}

// Fonction pour ajouter un module à l'historique
function ajouterModuleHistorique() {
    const container = document.getElementById('historique-modules-container');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'module-choice-container historique-module';
    div.dataset.index = index;

    div.innerHTML = `
        <div class="module-selection-header">
            <h5 class="mb-0">Module enseigné #${index + 1}</h5>
            <button type="button" class="btn btn-supprimer" onclick="supprimerModuleHistorique(this)">
                <i class="bi bi-trash me-1"></i>Supprimer
            </button>
        </div>
        
        <div class="row">
            <div class="col-md-4 mb-3">
                <label for="hist_palier_${index}" class="field-label">Palier :</label>
                <select id="hist_palier_${index}" name="moduleHistorique[${index}][palier]" class="form-select">
                    <option value="">Sélectionnez un palier</option>
                </select>
            </div>
            
            <div class="col-md-4 mb-3">
                <label for="hist_specialite_${index}" class="field-label">Spécialité :</label>
                <select id="hist_specialite_${index}" name="moduleHistorique[${index}][specialite]" class="form-select">
                    <option value="">Sélectionnez d'abord un palier</option>
                </select>
            </div>

            <div class="col-md-4 mb-3">
                <label for="hist_module_${index}" class="field-label">Module :</label>
                <select id="hist_module_${index}" name="moduleHistorique[${index}][module]" class="form-select">
                    <option value="">Sélectionnez d'abord une spécialité</option>
                </select>
            </div>
        </div>
    `;
    
    container.appendChild(div);
    
    // Initialiser les événements pour le nouveau module historique
    const palierSelect = document.getElementById(`hist_palier_${index}`);
    const specialiteSelect = document.getElementById(`hist_specialite_${index}`);
    const moduleSelect = document.getElementById(`hist_module_${index}`);
    
    // Charger les niveaux
    chargerNiveaux(palierSelect);
    
    // Ajouter les événements
    palierSelect.addEventListener('change', async function() {
        console.log(`Palier historique sélectionné: ${this.value}`);
        await chargerSpecialites(this.value, specialiteSelect);
        if (specialiteSelect.value) {
            // Pour l'historique, on charge les modules des deux semestres
            const modules = [];
            try {
                const response1 = await fetch(`/api/modules/specialite/${specialiteSelect.value}/semestre/1`);
                const modules1 = await response1.json();
                
                const response2 = await fetch(`/api/modules/specialite/${specialiteSelect.value}/semestre/2`);
                const modules2 = await response2.json();
                
                // Combiner les modules des deux semestres
                const allModules = [...modules1, ...modules2];
                
                // Vider et réinitialiser le select
                moduleSelect.innerHTML = '<option value="">Sélectionnez un module</option>';
                
                // Ajouter les modules
                allModules.forEach(module => {
                    const option = document.createElement('option');
                    option.value = module._id;
                    option.textContent = module.nom;
                    moduleSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Erreur lors du chargement des modules pour historique:', error);
                showAlert('Erreur lors du chargement des modules', 'danger');
            }
        }
    });
    
    specialiteSelect.addEventListener('change', async function() {
        console.log(`Spécialité historique sélectionnée: ${this.value}`);
        if (this.value) {
            // Pour l'historique, on charge les modules des deux semestres
            try {
                const response1 = await fetch(`/api/modules/specialite/${specialiteSelect.value}/semestre/1`);
                const modules1 = await response1.json();
                
                const response2 = await fetch(`/api/modules/specialite/${specialiteSelect.value}/semestre/2`);
                const modules2 = await response2.json();
                
                // Combiner les modules des deux semestres
                const allModules = [...modules1, ...modules2];
                
                // Vider et réinitialiser le select
                moduleSelect.innerHTML = '<option value="">Sélectionnez un module</option>';
                
                // Ajouter les modules
                allModules.forEach(module => {
                    const option = document.createElement('option');
                    option.value = module._id;
                    option.textContent = module.nom;
                    moduleSelect.appendChild(option);
                });
                
                // Attendre encore
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.error(`Erreur lors du rechargement des modules pour le module historique #${i+1}:`, err);
            }
        }
    });
}

// Fonction pour supprimer un module de l'historique
function supprimerModuleHistorique(button) {
    // Identifier le conteneur du module
    const moduleContainer = button.closest('.historique-module');
    
    // Supprimer le module
    moduleContainer.remove();
    
    // Renuméroter les modules restants
    renumberModulesHistorique();
}

// Fonction pour renuméroter les modules de l'historique après suppression
function renumberModulesHistorique() {
    const container = document.getElementById('historique-modules-container');
    const modules = container.querySelectorAll('.historique-module');
    
    modules.forEach((module, index) => {
        // Mettre à jour l'index dans le dataset
        module.dataset.index = index;
        
        // Mettre à jour le titre
        const title = module.querySelector('h5');
        if (title) {
            title.textContent = `Module enseigné #${index + 1}`;
        }
        
        // Mettre à jour les noms des inputs
        const inputs = module.querySelectorAll('select');
        inputs.forEach(input => {
            const name = input.name;
            if (name) {
                input.name = name.replace(/moduleHistorique\[(\d+)\]/, `moduleHistorique[${index}]`);
            }
            
            // Mettre à jour les IDs
            const oldId = input.id;
            if (oldId && oldId.match(/hist_(palier|specialite|module)_\d+/)) {
                const newId = oldId.replace(/_\d+$/, `_${index}`);
                input.id = newId;
                
                // Mettre à jour le label correspondant s'il existe
                const label = module.querySelector(`label[for="${oldId}"]`);
                if (label) {
                    label.setAttribute('for', newId);
                }
            }
        });
    });
}

// Validation du formulaire avant soumission
function validerFormulaire(formData) {
    const champsObligatoires = ['nom', 'email', 'heures_supplementaires', 'anciennete'];
    for (const champ of champsObligatoires) {
        if (!formData.get(champ)) {
            alert(`Le champ "${champ}" est obligatoire.`);
            return false;
        }
    }
    return true;
}

// Fonction pour vérifier si l'utilisateur est connecté
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        return false;
    }
    
    try {
        // Vérifier si l'utilisateur est admin ou superadmin
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Les admins peuvent toujours accéder, peu importe l'état du site
        if (user.role === 'admin' || user.role === 'superadmin') {
            return true;
        }
        
        // Pour les utilisateurs normaux, vérifier l'état du site
        const response = await fetch('/api/site-status');
        const siteStatus = await response.json();
        
        if (siteStatus.isLocked) {
            // Si le site est verrouillé, afficher le message et retourner false
            showSiteLockedMessage(siteStatus.message);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'état du site:', error);
        return !!token; // En cas d'erreur, se baser uniquement sur la présence du token
    }
}

// Fonction pour obtenir les headers d'authentification
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    
    // Si un token existe, l'ajouter aux en-têtes
    if (token) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }
    
    // Sinon, retourner juste le Content-Type
    return {
        'Content-Type': 'application/json'
    };
}

// Fonction pour gérer la déconnexion
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
}

// Fonction pour soumettre le formulaire de vœux
async function handleSubmit(event) {
    event.preventDefault();
    try {
        // Récupérer les données du formulaire
        const formData = new FormData(event.target);

        // Récupérer les choix du semestre 1
        const choix_s1 = Array.from(document.querySelectorAll('#choix-s1-container .module-choice-container')).map((choixDiv, idx) => {
            const palierSelect = choixDiv.querySelector('select[name*="palier"]');
            const specialiteSelect = choixDiv.querySelector('select[name*="specialite"]');
            const moduleSelect = choixDiv.querySelector('select[name*="module"]');
            
            if (!palierSelect || !palierSelect.value) {
                throw new Error(`Veuillez sélectionner un palier pour le choix ${idx + 1} du semestre 1`);
            }
            
            if (!specialiteSelect || !specialiteSelect.value) {
                throw new Error(`Veuillez sélectionner une spécialité pour le choix ${idx + 1} du semestre 1`);
            }
            
            if (!moduleSelect || !moduleSelect.value) {
                throw new Error(`Veuillez sélectionner un module pour le choix ${idx + 1} du semestre 1`);
            }
            
            // Vérifier si nous avons des checkboxes ou un select multiple
            const natureCheckboxes = choixDiv.querySelectorAll('input.nature-checkbox:checked');
            const natureSelect = choixDiv.querySelector('select[name*="nature"]');
            let nature = [];
            
            if (natureCheckboxes.length > 0) {
                nature = Array.from(natureCheckboxes).map(cb => cb.value);
            } else if (natureSelect) {
                nature = Array.from(natureSelect.selectedOptions).map(option => option.value);
            }
            
            if (nature.length === 0) {
                throw new Error(`Veuillez sélectionner au moins une nature (Cours, TD ou TP) pour le choix ${idx + 1} du semestre 1`);
            }

            return {
                palier: palierSelect.value,
                specialite: specialiteSelect.value,
                module: moduleSelect.value,
                nature: nature
            };
        });

        // Récupérer les choix du semestre 2
        const choix_s2 = Array.from(document.querySelectorAll('#choix-s2-container .module-choice-container')).map((choixDiv, idx) => {
            const palierSelect = choixDiv.querySelector('select[name*="palier"]');
            const specialiteSelect = choixDiv.querySelector('select[name*="specialite"]');
            const moduleSelect = choixDiv.querySelector('select[name*="module"]');
            
            if (!palierSelect || !palierSelect.value) {
                throw new Error(`Veuillez sélectionner un palier pour le choix ${idx + 1} du semestre 2`);
            }
            
            if (!specialiteSelect || !specialiteSelect.value) {
                throw new Error(`Veuillez sélectionner une spécialité pour le choix ${idx + 1} du semestre 2`);
            }
            
            if (!moduleSelect || !moduleSelect.value) {
                throw new Error(`Veuillez sélectionner un module pour le choix ${idx + 1} du semestre 2`);
            }
            
            // Vérifier si nous avons des checkboxes ou un select multiple
            const natureCheckboxes = choixDiv.querySelectorAll('input.nature-checkbox:checked');
            const natureSelect = choixDiv.querySelector('select[name*="nature"]');
            let nature = [];
            
            if (natureCheckboxes.length > 0) {
                nature = Array.from(natureCheckboxes).map(cb => cb.value);
            } else if (natureSelect) {
                nature = Array.from(natureSelect.selectedOptions).map(option => option.value);
            }
            
            if (nature.length === 0) {
                throw new Error(`Veuillez sélectionner au moins une nature (Cours, TD ou TP) pour le choix ${idx + 1} du semestre 2`);
            }

            return {
                palier: palierSelect.value,
                specialite: specialiteSelect.value,
                module: moduleSelect.value,
                nature: nature
            };
        });
        
        // Récupérer l'historique des modules enseignés
        const moduleHistorique = Array.from(document.querySelectorAll('#historique-modules-container .historique-module')).map((moduleDiv, idx) => {
            const palierSelect = moduleDiv.querySelector(`select[id^="hist_palier_"]`);
            const specialiteSelect = moduleDiv.querySelector(`select[id^="hist_specialite_"]`);
            const moduleSelect = moduleDiv.querySelector(`select[id^="hist_module_"]`);

            if (!palierSelect || !specialiteSelect || !moduleSelect) {
                console.warn(`Module historique ${idx + 1} incomplet, ignoré`);
                return null;
            }
            
            if (!palierSelect.value || !specialiteSelect.value || !moduleSelect.value) {
                console.warn(`Module historique ${idx + 1} incomplet (valeurs manquantes), ignoré`);
                return null;
            }

            return {
                palier: palierSelect.value,
                specialite: specialiteSelect.value,
                module: moduleSelect.value
            };
        }).filter(Boolean); // Filtrer les entrées null

        // Construire l'objet de données complet à envoyer
        const voeuxData = {
            nom: formData.get('nom'),
            email: formData.get('email'),
            telephone: formData.get('telephone'),
            grade: formData.get('grade'),
            anciennete: parseInt(formData.get('anciennete'), 10) || 0,
            bureau: formData.get('bureau'),
            departement: {
                id: formData.get('departement'),
                nom: document.getElementById('departement').options[document.getElementById('departement').selectedIndex].text
            },
            choix_s1: choix_s1,
            choix_s2: choix_s2,
            moduleHistorique: moduleHistorique,
            heures_supp_s1: parseFloat(formData.get('heures_supplementaires')) || 0,
            pfe_l3: formData.get('pfe_l3') === 'on',
            commentaires: formData.get('commentaires') || ''
        };

        // Valider et envoyer les données
        if (!validerFormulaire(formData)) {
            return;
        }

        // Déterminer si c'est une création ou une mise à jour
        const form = document.getElementById('voeuxForm');
        const method = form.getAttribute('data-method') === 'PUT' ? 'PUT' : 'POST';
        const voeuId = form.getAttribute('data-voeu-id');
        
        // Construire l'URL en fonction de la méthode
        let url = '/api/voeux';
        if (method === 'PUT' && voeuId) {
            url = `/api/voeux/${voeuId}`;
        }

        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(voeuxData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Erreur lors de la soumission');
        }

        const result = await response.json();
        
        // Afficher un message différent selon la méthode
        if (method === 'PUT') {
            showAlert('Votre fiche de vœux a été mise à jour avec succès !', 'success');
            
            // Mettre à jour le bouton d'export PDF avec le nouvel ID si nécessaire
            if (result.voeu && result.voeu._id) {
                const exportBtn = document.getElementById('exportPdfBtn');
                if (exportBtn) {
                    // Mettre à jour l'événement click avec le nouvel ID
                    exportBtn.onclick = () => telechargerPDF(result.voeu._id);
                }
            }
        } else {
            showAlert('Votre fiche de vœux a été soumise avec succès ! La page va se recharger pour afficher le mode édition...', 'success');
            
            // En cas de création, recharger la page après 2 secondes pour afficher le mode édition
        setTimeout(() => {
                console.log("Rechargement de la page après création réussie...");
                window.location.href = window.location.href; // Utiliser href pour une redirection complète
        }, 2000);
        }
        
    } catch (error) {
        console.error('Erreur:', error);
        showAlert(`Erreur: ${error.message}`, 'danger');
    }
}

// Fonction pour afficher les messages d'alerte
function showAlert(message, type = 'danger') {
    const alertContainer = document.getElementById('alert-container');
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
}

// Fonction pour charger les départements
async function chargerDepartements() {
    try {
        console.log('Début du chargement des départements...');
        const response = await fetch('/api/departements');
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const departements = await response.json();
        console.log('Réponse brute des départements:', departements);
        
        if (!Array.isArray(departements)) {
            throw new Error('Les données reçues ne sont pas un tableau');
        }
        
        const selectElement = document.getElementById('departement');
        if (!selectElement) {
            throw new Error('Élément select "departement" non trouvé dans le DOM');
        }
        
        // Vider et réinitialiser le select
        selectElement.innerHTML = '<option value="">Sélectionnez votre département</option>';
        
        // Ajouter les départements
        departements.forEach(departement => {
            if (!departement._id || !departement.Name) {
                console.warn('Département invalide:', departement);
                return;
            }
            
            const option = document.createElement('option');
            option.value = departement._id;
            option.textContent = departement.Name;
            selectElement.appendChild(option);
            console.log('Département ajouté:', departement.Name);
        });

        console.log(`${departements.length} départements chargés avec succès`);
    } catch (error) {
        console.error('Erreur détaillée lors du chargement des départements:', error);
        showAlert(`Erreur lors du chargement des départements: ${error.message}`, 'danger');
    }
}

// ----------------------------------------------------
// Initialisation du document lorsqu'il est chargé
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initializeApp();
        
        // Ajouter des gestionnaires d'événements pour les champs de formulaire
        setupFormFieldsListeners();
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'application:', error);
        showAlert('Une erreur est survenue lors de l\'initialisation de l\'application.', 'danger');
    }
});

// Fonction pour configurer les écouteurs d'événements sur les champs de formulaire
function setupFormFieldsListeners() {
    // Sélectionner tous les champs de formulaire
    const formFields = document.querySelectorAll('input, select, textarea');
    
    formFields.forEach(field => {
        // Ajouter un écouteur d'événement pour l'entrée de données
        field.addEventListener('input', function() {
            handleFieldChange(this);
        });
        
        // Ajouter un écouteur d'événement pour le changement de valeur (utile pour les selects)
        field.addEventListener('change', function() {
            handleFieldChange(this);
        });
    });
}

// Fonction pour gérer le changement de valeur dans un champ
function handleFieldChange(field) {
    // Trouver le conteneur parent du champ (icon-input ou autre)
    const parentContainer = field.closest('.icon-input') || field.parentNode;
    
    // Si le champ est requis et qu'il a maintenant une valeur, supprimer les messages d'erreur
    if (field.hasAttribute('required') && field.value.trim() !== '') {
        // Supprimer les messages d'erreur textuels dans le conteneur parent
        removeErrorMessages(parentContainer);
        
        // Ajouter une classe de succès visuelle
        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
    }
    
    // Pour les champs email, vérifier également le format
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (emailRegex.test(field.value)) {
            removeErrorMessages(parentContainer);
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
        }
    }
    
    // Pour les champs avec pattern (comme téléphone), vérifier la correspondance
    if (field.hasAttribute('pattern') && field.value) {
        const pattern = new RegExp(field.getAttribute('pattern'));
        if (pattern.test(field.value)) {
            removeErrorMessages(parentContainer);
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
        }
    }
}

// Fonction pour supprimer les messages d'erreur
function removeErrorMessages(container) {
    if (!container) return;
    
    // Supprimer les éléments avec classe d'erreur
    const errorElements = container.querySelectorAll('.invalid-feedback, .error-message, .text-danger');
    errorElements.forEach(el => el.remove());
    
    // Supprimer les textes d'erreur directs
    const childNodes = Array.from(container.childNodes);
    childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text === 'Ce champ est obligatoire' || 
                text.includes('obligatoire') || 
                text.includes('valid')) {
                container.removeChild(node);
            }
        }
    });
    
    // Vérifier les nœuds de texte immédiats après le conteneur
    if (container.nextSibling && container.nextSibling.nodeType === Node.TEXT_NODE) {
        const text = container.nextSibling.textContent.trim();
        if (text === 'Ce champ est obligatoire' || 
            text.includes('obligatoire') || 
            text.includes('valid')) {
            container.parentNode.removeChild(container.nextSibling);
        }
    }
}

// Fonction pour afficher le message de blocage
function showSiteLockedMessage(message) {
    const mainContainer = document.querySelector('.container') || document.body;
    
    // Créer le message de blocage
    const lockOverlay = document.createElement('div');
    lockOverlay.className = 'lock-overlay';
    lockOverlay.innerHTML = `
        <div class="lock-message animate__animated animate__fadeIn">
            <div class="lock-icon">
                <i class="bi bi-lock-fill"></i>
            </div>
            <h2>Accès temporairement indisponible</h2>
            <p>${message || 'Le site est actuellement verrouillé par l\'administration. Veuillez réessayer plus tard.'}</p>
            <button id="retry-access-btn" class="btn btn-outline-light mt-3">
                <i class="bi bi-arrow-clockwise me-2"></i>Réessayer
            </button>
        </div>
    `;
    
    // Ajouter du CSS pour le message
    const style = document.createElement('style');
    style.textContent = `
        .lock-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #4a6bae, #314773);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            color: white;
            text-align: center;
        }
        .lock-message {
            max-width: 500px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .lock-icon {
            font-size: 80px;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(lockOverlay);
    
    // Gérer le bouton de retry
    document.getElementById('retry-access-btn').addEventListener('click', function() {
        window.location.reload();
    });
    
    // Masquer le contenu de la page
    if (mainContainer && mainContainer !== document.body) {
        mainContainer.style.display = 'none';
    }
}

// Fonction pour initialiser l'application
async function initializeApp() {
    console.log('Initialisation du document...');
    
    // Vérifier l'authentification
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
        console.error('Utilisateur non connecté ou site verrouillé, redirection vers la page de connexion');
        window.location.href = '/login.html';
        return;
    }
    
    // Récupérer les informations de l'utilisateur connecté
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Pré-remplir le champ email avec l'email de l'utilisateur connecté
    const emailField = document.getElementById('email');
    if (emailField && userData.email) {
        emailField.value = userData.email;
    }
    
    // Initialiser le formulaire dynamique (charger les départements)
    try {
        await chargerDepartements();
    } catch (error) {
        console.error('Erreur lors du chargement des départements:', error);
    }
    
    // Ajouter le gestionnaire d'événements pour la déconnexion
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    
    // Vérifier si l'utilisateur a déjà une fiche de vœux
    const result = await verifierFicheExistante();
    
    if (result && result.success) {
        console.log('Résultat de vérification:', result);
        
        // Vérifier si l'utilisateur a des voeux de l'année précédente
        const resultAnneePrecedente = await verifierFicheAnneePrecedente();
        console.log('Résultat de vérification pour l\'année précédente:', resultAnneePrecedente);
        
        if (result.existe) {
            // Si l'utilisateur a déjà une fiche pour cette année, la charger
            try {
                console.log('Chargement de la fiche existante...');
                const loaded = await chargerFicheExistante();
                
                if (!loaded) {
                    console.warn('Impossible de charger la fiche existante, initialisation d\'un formulaire vide');
                    ajouterChoix('s1');
                    ajouterChoix('s2');
                    ajouterModuleHistorique();
                    
                    // Afficher un message d'avertissement
                    showAlert('Impossible de charger votre fiche existante. Un formulaire vide a été initialisé. Notez que la soumission échouera si vous avez déjà une fiche.', 'warning');
                }
            } catch (error) {
                console.error('Erreur lors du chargement de la fiche existante:', error);
                
                // Initialiser un formulaire vide en cas d'erreur
                ajouterChoix('s1');
                ajouterChoix('s2');
                ajouterModuleHistorique();
                
                // Afficher un message d'avertissement
                showAlert('Impossible de charger votre fiche existante. Un formulaire vide a été initialisé. Notez que la soumission échouera si vous avez déjà une fiche.', 'warning');
            }
        } else {
            // Sinon, initialiser le formulaire vide
            console.log('Aucune fiche existante, initialisation d\'un formulaire vide');
            ajouterChoix('s1');
            ajouterChoix('s2');
            ajouterModuleHistorique();
            
            // Si l'utilisateur a des voeux de l'année précédente, ajouter un bouton pour les charger
            if (resultAnneePrecedente && resultAnneePrecedente.success && resultAnneePrecedente.existe) {
                console.log('L\'utilisateur a des voeux de l\'année précédente, ajout du bouton de chargement');
                
                // Trouver le bouton de soumission existant
                const submitButton = document.querySelector('button[type="submit"]');
                if (submitButton && submitButton.parentNode) {
                    // Créer le bouton de chargement des voeux de l'année précédente
                    const loadPrevYearBtn = document.createElement('button');
                    loadPrevYearBtn.id = 'loadPrevYearBtn';
                    loadPrevYearBtn.type = 'button'; // Important: type='button' pour qu'il ne soumette pas le formulaire
                    loadPrevYearBtn.className = 'btn btn-info me-2';
                    loadPrevYearBtn.innerHTML = '<i class="bi bi-clock-history me-2"></i>Charger mes voeux de l\'année précédente';
                    loadPrevYearBtn.addEventListener('click', chargerVoeuxAnneePrecedente);
                    
                    // Insérer le bouton avant le bouton de soumission
                    submitButton.parentNode.insertBefore(loadPrevYearBtn, submitButton);
                    
                    // Ajouter une note explicative
                    const noteDiv = document.createElement('div');
                    noteDiv.className = 'alert alert-info mt-3';
                    noteDiv.innerHTML = '<i class="bi bi-info-circle-fill me-2"></i><strong>Information :</strong> Vous pouvez charger vos voeux de l\'année précédente en cliquant sur le bouton ci-dessus. N\'oubliez pas de soumettre le formulaire après avoir vérifié les informations.';
                    
                    // Trouver un endroit approprié pour insérer la note (après le formulaire ou après le dernier bouton)
                    const formEnd = document.querySelector('.form-actions') || submitButton.parentNode;
                    formEnd.appendChild(noteDiv);
                }
            }
        }
    } else {
        // En cas d'erreur de vérification, initialiser un formulaire minimal
        console.error('Erreur lors de la vérification de l\'existence d\'une fiche');
        ajouterChoix('s1');
        ajouterChoix('s2');
        ajouterModuleHistorique();
        showAlert('Une erreur est survenue lors de la vérification de vos données. Veuillez réessayer plus tard.', 'danger');
    }

    // Ajouter l'écouteur d'événements au formulaire
    const form = document.getElementById('voeuxForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    } else {
        console.error('Formulaire non trouvé dans le DOM');
    }
    
    console.log('Initialisation terminée');
    
}

// Fonction pour vérifier si l'utilisateur a déjà une fiche de vœux
async function verifierFicheExistante() {
    try {
        console.log('Vérification de l\'existence d\'une fiche de vœux...');
        
        // Récupérer le token d'authentification
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Aucun token d\'authentification trouvé');
            // Rediriger vers la page de connexion
            window.location.href = '/login.html';
            return false;
        }
        
        const response = await fetch('/api/voeux/me/verification', {
            headers: getAuthHeaders()
        });
        
        console.log('Statut de la réponse :', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Aucune fiche existante trouvée');
                return { success: true, existe: false };
            }
            
            if (response.status === 401 || response.status === 403) {
                console.error('Erreur d\'authentification lors de la vérification:', response.status);
                // Token invalide ou expiré, déconnecter l'utilisateur
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                // Message d'erreur et redirection
                showAlert('Votre session a expiré. Veuillez vous reconnecter.', 'warning');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return false;
            }
            
            const errorData = await response.json().catch(() => ({}));
            console.error('Erreur lors de la vérification de la fiche:', response.status, errorData);
            showAlert(`Erreur lors de la vérification: ${errorData.message || response.statusText}`, 'danger');
            return false;
        }
        
        const data = await response.json();
        console.log('Données de vérification reçues:', data);
        return data;
    } catch (error) {
        console.error('Erreur lors de la vérification de la fiche:', error);
        showAlert(`Erreur réseau: ${error.message}`, 'danger');
        return false;
    }
}

// Fonction pour vérifier si l'utilisateur a une fiche de l'année précédente
async function verifierFicheAnneePrecedente() {
    try {
        console.log('Vérification de l\'existence d\'une fiche de vœux pour l\'année précédente...');
        
        // Récupérer le token d'authentification
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Aucun token d\'authentification trouvé');
            return false;
        }
        
        const response = await fetch('/api/voeux/me/annee-precedente', {
            headers: getAuthHeaders()
        });
        
        console.log('Statut de la réponse pour l\'année précédente:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Aucune fiche de l\'année précédente trouvée');
                return { success: false, existe: false };
            }
            
            if (response.status === 401 || response.status === 403) {
                console.error('Erreur d\'authentification lors de la vérification:', response.status);
                return false;
            }
            
            const errorData = await response.json().catch(() => ({}));
            console.error('Erreur lors de la vérification de la fiche de l\'année précédente:', response.status, errorData);
            return false;
        }
        
        const data = await response.json();
        console.log('Données de vérification pour l\'année précédente reçues:', data);
        return data;
    } catch (error) {
        console.error('Erreur lors de la vérification de la fiche de l\'année précédente:', error);
        return false;
    }
}

// Fonction pour charger la fiche existante pour modification
async function chargerFicheExistante() {
    try {
        console.log('Chargement de la fiche existante pour modification...');
        
        // Récupérer la fiche existante
        const response = await fetch('/api/voeux/me', {
            headers: getAuthHeaders()
        });
        
        console.log('Statut de la réponse :', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log('Aucune fiche existante trouvée pour l\'utilisateur');
                return false;
            }
            
            const errorData = await response.json().catch(() => ({}));
            console.error('Erreur lors de la récupération de la fiche:', response.status, errorData);
            showAlert(`Erreur: ${errorData.message || 'Impossible de récupérer votre fiche de vœux'}`, 'danger');
            throw new Error(`Erreur HTTP: ${response.status} - ${errorData.message || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Données de la fiche reçues:', data);
        
        if (!data.success || !data.voeu) {
            console.error('Format de réponse invalide:', data);
            showAlert('Erreur : Le format des données reçues est invalide', 'danger');
            return false;
        }
        
        const voeu = data.voeu;
        
        // Afficher un message informant l'utilisateur qu'il modifie sa fiche
        showAlert('Vous modifiez votre fiche de vœux existante. Après modification, cliquez sur "Mettre à jour ma fiche" pour sauvegarder vos changements.', 'info');
        
        try {
            // Remplir le formulaire avec les données existantes - avec vérification de l'existence des éléments
            const nomField = document.getElementById('nom');
            if (nomField) nomField.value = voeu.nom || '';
            
            const emailField = document.getElementById('email');
            if (emailField) {
                emailField.value = voeu.email || '';
                emailField.readOnly = true; // Désactiver le champ email
            }
            
            const telephoneField = document.getElementById('telephone');
            if (telephoneField) telephoneField.value = voeu.telephone || '';
            
            const gradeField = document.getElementById('grade');
            if (gradeField) gradeField.value = voeu.grade || '';
            
            const ancienneteField = document.getElementById('anciennete');
            if (ancienneteField) ancienneteField.value = voeu.anciennete || 0;
            
            const bureauField = document.getElementById('bureau');
            if (bureauField) bureauField.value = voeu.bureau || '';
            
            // Vérifier si departement existe bien
            const departementField = document.getElementById('departement');
            if (departementField && voeu.departement && voeu.departement.id) {
                departementField.value = voeu.departement.id;
            }
            
            const heuresField = document.getElementById('heures_supplementaires');
            if (heuresField) heuresField.value = voeu.heures_supp_s1 || 0;
            
            const pfeField = document.getElementById('pfe_l3');
            if (pfeField) pfeField.checked = voeu.pfe_l3 || false;
            
            const commentairesField = document.getElementById('commentaires');
            if (commentairesField) commentairesField.value = voeu.commentaires || '';
            
            // Vider les conteneurs de choix
            const s1Container = document.getElementById('choix-s1-container');
            if (s1Container) s1Container.innerHTML = '';
            
            const s2Container = document.getElementById('choix-s2-container');
            if (s2Container) s2Container.innerHTML = '';
            
            const histContainer = document.getElementById('historique-modules-container');
            if (histContainer) histContainer.innerHTML = '';

            // On ajoute un petit délai pour s'assurer que le DOM est bien initialisé
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Ajouter les choix du semestre 1
            await remplirChoixSemestre(voeu, 's1');
            
            // Attendre un peu entre les deux semestres pour éviter les conflits
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Ajouter les choix du semestre 2
            await remplirChoixSemestre(voeu, 's2');
            
            // Attendre un peu avant de charger les modules historiques
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Ajouter les modules historiques s'il y en a
            if (voeu.moduleHistorique && voeu.moduleHistorique.length > 0) {
                console.log('Chargement des modules historiques:', voeu.moduleHistorique.length);
                await remplirModulesHistorique(voeu);
            } else {
                // Ajouter un module historique vide
                console.log('Aucun module historique trouvé, ajout d\'un formulaire vide');
                ajouterModuleHistorique();
            }
            
            // Modifier le bouton de soumission et ajouter le bouton d'export PDF
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Mettre à jour ma fiche';
                
                // Ajouter le bouton d'export PDF après le bouton de soumission
                if (!document.getElementById('exportPdfBtn')) {
                    const exportBtn = document.createElement('button');
                    exportBtn.id = 'exportPdfBtn';
                    exportBtn.type = 'button'; // Important: type='button' pour qu'il ne soumette pas le formulaire
                    exportBtn.className = 'btn btn-success ms-2';
                    exportBtn.innerHTML = '<i class="bi bi-file-pdf me-2"></i>Télécharger en PDF';
                    exportBtn.addEventListener('click', () => telechargerPDF(voeu._id));
                    submitBtn.parentNode.insertBefore(exportBtn, submitBtn.nextSibling);
                }
            }
            
            // Changer la méthode de soumission du formulaire pour utiliser PUT au lieu de POST
            const form = document.getElementById('voeuxForm');
            if (form) {
                form.setAttribute('data-voeu-id', voeu._id);
                form.setAttribute('data-method', 'PUT');
            }
            
            console.log('Fiche existante chargée avec succès');
            return true;
        } catch (formError) {
            console.error('Erreur lors du remplissage du formulaire:', formError);
            throw new Error(`Erreur lors du remplissage du formulaire: ${formError.message}`);
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la fiche:', error);
        showAlert(`Erreur: ${error.message}`, 'danger');
        return false;
    }
}

// Fonction auxiliaire pour remplir les choix d'un semestre
async function remplirChoixSemestre(voeu, semestre) {
    try {
        const choixArray = semestre === 's1' ? voeu.choix_s1 : voeu.choix_s2;
        
        if (!choixArray || !Array.isArray(choixArray) || choixArray.length === 0) {
            console.log(`Aucun choix trouvé pour le semestre ${semestre}, ajout d'un conteneur vide`);
            ajouterChoix(semestre);
            return;
        }
        
        console.log(`Chargement des choix du semestre ${semestre}:`, choixArray.length);
        
        // Vider le conteneur existant
        const container = document.getElementById(`choix-${semestre}-container`);
        if (!container) {
            console.error(`Conteneur des choix du semestre ${semestre} non trouvé`);
            return;
        }
        container.innerHTML = '';
        
        // Drapeau pour suivre si au moins un choix a été chargé correctement
        let auMoinsUnChoixCharge = false;
        
        for (let i = 0; i < choixArray.length; i++) {
            try {
                // Ajouter un nouveau conteneur de choix
                ajouterChoix(semestre);
                
                // Attendre un délai plus long pour que les sélecteurs soient bien initialisés
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Remplir les valeurs du choix
                const index = i + 1; // Les index dans le DOM commencent à 1
                const choix = choixArray[i];
                
                console.log(`Configuration du choix ${semestre} #${index}:`, choix);
                
                // Sélectionner le palier
                const palierSelect = document.getElementById(`palier_${semestre}_${index}`);
                if (!palierSelect) {
                    console.error(`Element non trouvé: palier_${semestre}_${index}`);
                    continue;
                }
                
                // Extraire l'ID correctement selon la structure
                const palierId = choix.palier?._id || choix.palier;
                if (!palierId) {
                    console.error(`ID du palier non trouvé pour le choix ${semestre} #${index}`, choix);
                    continue;
                }
                
                palierSelect.value = palierId;
                console.log(`Palier ID: ${palierId} => valeur select: ${palierSelect.value}`);
                
                // Déclencher l'événement change pour charger les spécialités
                palierSelect.dispatchEvent(new Event('change'));
                
                // Attendre plus longtemps que les spécialités soient chargées
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Sélectionner la spécialité
                const specialiteSelect = document.getElementById(`specialite_${semestre}_${index}`);
                if (!specialiteSelect) {
                    console.error(`Element non trouvé: specialite_${semestre}_${index}`);
                    continue;
                }
                
                // Extraire l'ID correctement selon la structure
                const specialiteId = choix.specialite?._id || choix.specialite;
                if (!specialiteId) {
                    console.error(`ID de spécialité non trouvé pour le choix ${semestre} #${index}`, choix);
                    continue;
                }
                
                // Vérifier si les spécialités sont chargées
                if (specialiteSelect.options.length <= 1) {
                    console.warn(`Les spécialités n'ont pas été chargées pour le choix ${semestre} #${index}, nouvelle tentative`);
                    // Nouvel essai
                    await chargerSpecialites(palierId, specialiteSelect);
                    // Attendre encore un peu
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                specialiteSelect.value = specialiteId;
                console.log(`Specialite ID: ${specialiteId} => valeur select: ${specialiteSelect.value}`);
                
                // Déclencher l'événement change pour charger les modules
                specialiteSelect.dispatchEvent(new Event('change'));
                
                // Attendre plus longtemps que les modules soient chargés
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Sélectionner le module
                const moduleSelect = document.getElementById(`module_${semestre}_${index}`);
                if (!moduleSelect) {
                    console.error(`Element non trouvé: module_${semestre}_${index}`);
                    continue;
                }
                
                // Extraire l'ID correctement selon la structure
                const moduleId = choix.module?._id || choix.module;
                if (!moduleId) {
                    console.error(`ID de module non trouvé pour le choix ${semestre} #${index}`, choix);
                    continue;
                }
                
                // Vérifier si les modules sont chargés
                if (moduleSelect.options.length <= 1) {
                    console.warn(`Les modules n'ont pas été chargés pour le choix ${semestre} #${index}, nouvelle tentative`);
                    // Nouvel essai
                    const semestreNum = semestre === 's1' ? 1 : 2;
                    await chargerModules(specialiteId, semestreNum, moduleSelect);
                    // Attendre encore un peu
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                moduleSelect.value = moduleId;
                console.log(`Module ID: ${moduleId} => valeur select: ${moduleSelect.value}`);
                
                // Sélectionner les natures
                const natureCheckboxes = document.querySelectorAll(`#nature_${semestre}_${index}_Cours, #nature_${semestre}_${index}_TD, #nature_${semestre}_${index}_TP`);
                if (natureCheckboxes.length === 0) {
                    console.error(`Checkboxes de nature non trouvées pour le choix ${semestre} #${index}`);
                } else {
                    natureCheckboxes.forEach(checkbox => {
                        if (choix.nature && Array.isArray(choix.nature)) {
                            checkbox.checked = choix.nature.includes(checkbox.value);
                            console.log(`Nature ${checkbox.value} ${checkbox.checked ? 'cochée' : 'décochée'}`);
                        } else {
                            console.warn(`Nature non valide pour le choix ${semestre} #${index}:`, choix.nature);
                        }
                    });
                }
                
                // Marquer qu'au moins un choix a été chargé correctement
                auMoinsUnChoixCharge = true;
                
            } catch (err) {
                console.error(`Erreur lors de la configuration du choix ${semestre} #${i+1}:`, err);
            }
        }
        
        if (!auMoinsUnChoixCharge) {
            console.warn(`Aucun choix n'a pu être chargé correctement pour le semestre ${semestre}, tentative de rechargement global`);
            showAlert(`Problème de chargement des choix du semestre ${semestre}. Les choix existants ont été réinitialisés.`, 'warning');
            
            // Si aucun choix n'a pu être chargé, on ajoute un choix vide
            ajouterChoix(semestre);
        }
        
    } catch (error) {
        console.error(`Erreur lors du remplissage des choix du semestre ${semestre}:`, error);
        showAlert(`Erreur lors du chargement des choix du semestre ${semestre}: ${error.message}`, 'danger');
        // Ajouter un conteneur vide en cas d'erreur
        ajouterChoix(semestre);
    }
}

// Fonction pour remplir les modules historiques
async function remplirModulesHistorique(voeu) {
    try {
        if (!voeu.moduleHistorique || !Array.isArray(voeu.moduleHistorique) || voeu.moduleHistorique.length === 0) {
            console.log('Aucun module historique à charger, ajout d\'un conteneur vide');
            ajouterModuleHistorique();
            return;
        }

        console.log(`Chargement de ${voeu.moduleHistorique.length} modules historiques`);
        
        // Conteneur des modules historiques
        const container = document.getElementById('historique-modules-container');
        if (!container) {
            console.error('Conteneur des modules historiques non trouvé');
            return;
        }
        
        // Vider le conteneur existant
        container.innerHTML = '';
        
        for (let i = 0; i < voeu.moduleHistorique.length; i++) {
            try {
                // Ajouter un nouveau module historique
                ajouterModuleHistorique();
                
                // Attendre que le DOM soit mis à jour avec un délai plus long
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Récupérer le module historique à charger
                const moduleHist = voeu.moduleHistorique[i];
                console.log(`Configuration du module historique #${i+1}:`, moduleHist);
                
                // Sélectionner les éléments
                const palierSelect = document.getElementById(`hist_palier_${i}`);
                const specialiteSelect = document.getElementById(`hist_specialite_${i}`);
                const moduleSelect = document.getElementById(`hist_module_${i}`);
                
                if (!palierSelect) {
                    console.error(`Élément non trouvé: hist_palier_${i}`);
                    continue;
                }
                
                // Sélectionner le palier
                const palierId = moduleHist.palier?._id || moduleHist.palier;
                if (palierId) {
                    palierSelect.value = palierId;
                    console.log(`Palier historique: ${palierId} => ${palierSelect.value}`);
                    
                    // Déclencher l'événement change pour charger les spécialités
                    palierSelect.dispatchEvent(new Event('change'));
                    
                    // Attendre que les spécialités soient chargées avec un délai plus long
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.warn(`ID de palier non trouvé pour le module historique #${i+1}`);
                }
                
                // Sélectionner la spécialité
                if (!specialiteSelect) {
                    console.error(`Élément non trouvé: hist_specialite_${i}`);
                    continue;
                }
                
                const specialiteId = moduleHist.specialite?._id || moduleHist.specialite;
                if (specialiteId) {
                    // Vérifier si les spécialités sont chargées
                    if (specialiteSelect.options.length <= 1) {
                        console.warn(`Les spécialités n'ont pas été chargées pour le module historique #${i+1}, nouvelle tentative`);
                        // Nouvel essai
                        await chargerSpecialites(palierId, specialiteSelect);
                        // Attendre encore
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    specialiteSelect.value = specialiteId;
                    console.log(`Spécialité historique: ${specialiteId} => ${specialiteSelect.value}`);
                    
                    // Déclencher l'événement change pour charger les modules
                    specialiteSelect.dispatchEvent(new Event('change'));
                    
                    // Attendre que les modules soient chargés
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.warn(`ID de spécialité non trouvé pour le module historique #${i+1}`);
                }
                
                // Sélectionner le module
                if (!moduleSelect) {
                    console.error(`Élément non trouvé: hist_module_${i}`);
                    continue;
                }
                
                const moduleId = moduleHist.module?._id || moduleHist.module;
                if (moduleId) {
                    // Vérifier si les modules sont chargés
                    if (moduleSelect.options.length <= 1) {
                        console.warn(`Les modules n'ont pas été chargés pour le module historique #${i+1}, nouvelle tentative`);
                        // Nouvel essai avec les deux semestres
                        try {
                            const response1 = await fetch(`/api/modules/specialite/${specialiteId}/semestre/1`);
                            const modules1 = await response1.json();
                            
                            const response2 = await fetch(`/api/modules/specialite/${specialiteId}/semestre/2`);
                            const modules2 = await response2.json();
                            
                            const allModules = [...modules1, ...modules2];
                            moduleSelect.innerHTML = '<option value="">Sélectionnez un module</option>';
                            
                            allModules.forEach(module => {
                                const option = document.createElement('option');
                                option.value = module._id;
                                option.textContent = module.nom;
                                moduleSelect.appendChild(option);
                            });
                            
                            // Attendre encore
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } catch (err) {
                            console.error(`Erreur lors du rechargement des modules pour le module historique #${i+1}:`, err);
                        }
                    }
                    
                    moduleSelect.value = moduleId;
                    console.log(`Module historique: ${moduleId} => ${moduleSelect.value}`);
                } else {
                    console.warn(`ID de module non trouvé pour le module historique #${i+1}`);
                }
                
            } catch (err) {
                console.error(`Erreur lors de la configuration du module historique #${i+1}:`, err);
            }
        }
        
        console.log('Modules historiques chargés avec succès');
    } catch (error) {
        console.error('Erreur lors du chargement des modules historiques:', error);
        showAlert(`Erreur lors du chargement des modules historiques: ${error.message}`, 'danger');
        
        // En cas d'erreur, ajouter un module historique vide
        ajouterModuleHistorique();
    }
}

// Fonction pour télécharger le PDF avec authentification
async function telechargerPDF(voeuId) {
    try {
        console.log(`Téléchargement du PDF pour le vœu: ${voeuId}`);
        
        // Vérifier que nous avons un ID
        if (!voeuId) {
            showAlert('ID de vœu manquant pour le téléchargement', 'danger');
            return;
        }
        
        // Effectuer une requête avec authentification pour récupérer le PDF en tant que Blob
        const response = await fetch(`/api/voeux/${voeuId}/pdf`, {
            headers: getAuthHeaders(),
            method: 'GET'
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                showAlert('Authentification requise. Veuillez vous reconnecter.', 'danger');
                // Rediriger vers la page de connexion après un délai
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return;
            }
            
            const errorText = await response.text();
            throw new Error(`Erreur ${response.status}: ${errorText}`);
        }
        
        // Récupérer le nom du fichier depuis les headers ou générer un nom par défaut
        const contentDisposition = response.headers.get('content-disposition');
        let filename;
        
        if (contentDisposition && contentDisposition.includes('filename=')) {
            filename = contentDisposition.split('filename=')[1].trim().replace(/"/g, '');
        } else {
            // Générer un nom par défaut avec la date actuelle
            const date = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
            filename = `fiche_voeux_${voeuId}_${date}.pdf`;
        }
        
        // Convertir la réponse en blob
        const blob = await response.blob();
        
        // Créer une URL pour le blob
        const url = window.URL.createObjectURL(blob);
        
        // Créer un élément <a> temporaire pour télécharger le fichier
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Nettoyer après le téléchargement
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log(`PDF téléchargé: ${filename}`);
    } catch (error) {
        console.error('Erreur lors du téléchargement du PDF:', error);
        showAlert(`Erreur lors du téléchargement du PDF: ${error.message}`, 'danger');
    }
}

// Fonction pour charger les voeux de l'année précédente
async function chargerVoeuxAnneePrecedente() {
    try {
        console.log('Chargement des voeux de l\'année précédente...');
        showAlert('Chargement de vos voeux de l\'année précédente...', 'info');
        
        // Récupérer les voeux de l'année précédente
        const response = await fetch('/api/voeux/me/annee-precedente', {
            headers: getAuthHeaders()
        });
        
        // Traiter les différentes réponses
        if (response.status === 400) {
            const data = await response.json();
            
            if (data.dejaExistant) {
                showAlert('Vous avez déjà soumis une fiche de vœux pour cette année académique. Veuillez utiliser la fonctionnalité de mise à jour.', 'warning');
                
                // Recharger la page pour afficher la fiche existante
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
                
                return;
            } else {
                throw new Error(data.message || 'Une erreur est survenue');
            }
        }
        
        if (response.status === 404) {
            showAlert('Aucune fiche de vœux n\'a été trouvée pour l\'année précédente. Vous devez remplir une nouvelle fiche.', 'warning');
            return;
        }
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Voeux de l\'année précédente reçus:', data);
        
        if (!data.success || !data.voeu) {
            throw new Error('Format de réponse invalide');
        }
        
        const voeu = data.voeu;
        
        // Vider le formulaire actuel
        const form = document.getElementById('voeuxForm');
        if (form) {
            // Réinitialiser les conteneurs des choix et des modules historiques
            const s1Container = document.getElementById('choix-s1-container');
            if (s1Container) s1Container.innerHTML = '';
            
            const s2Container = document.getElementById('choix-s2-container');
            if (s2Container) s2Container.innerHTML = '';
            
            const histContainer = document.getElementById('historique-modules-container');
            if (histContainer) histContainer.innerHTML = '';
            
            // Remplir les informations de base
            const nomField = document.getElementById('nom');
            if (nomField) nomField.value = voeu.nom || '';
            
            const emailField = document.getElementById('email');
            if (emailField) {
                emailField.value = voeu.email || '';
                emailField.readOnly = true;
            }
            
            const telephoneField = document.getElementById('telephone');
            if (telephoneField) telephoneField.value = voeu.telephone || '';
            
            const gradeField = document.getElementById('grade');
            if (gradeField) gradeField.value = voeu.grade || '';
            
            const ancienneteField = document.getElementById('anciennete');
            if (ancienneteField) ancienneteField.value = voeu.anciennete || 0;
            
            const bureauField = document.getElementById('bureau');
            if (bureauField) bureauField.value = voeu.bureau || '';
            
            // Vérifier si departement existe bien
            const departementField = document.getElementById('departement');
            if (departementField && voeu.departement && voeu.departement.id) {
                departementField.value = voeu.departement.id;
            }
            
            const heuresField = document.getElementById('heures_supplementaires');
            if (heuresField) heuresField.value = voeu.heures_supp_s1 || 0;
            
            const pfeField = document.getElementById('pfe_l3');
            if (pfeField) pfeField.checked = voeu.pfe_l3 || false;
            
            const commentairesField = document.getElementById('commentaires');
            if (commentairesField) commentairesField.value = voeu.commentaires || '';
            
            // On ajoute un petit délai pour s'assurer que le DOM est bien initialisé
            setTimeout(async () => {
                // Ajouter les choix des semestres
                await remplirChoixSemestre(voeu, 's1');
                
                // Attendre un peu entre les deux semestres pour éviter les conflits
                setTimeout(async () => {
                    await remplirChoixSemestre(voeu, 's2');
                    
                    // Ajouter les modules historiques s'il y en a
                    setTimeout(async () => {
                        if (voeu.moduleHistorique && voeu.moduleHistorique.length > 0) {
                            await remplirModulesHistorique(voeu);
                        } else {
                            ajouterModuleHistorique();
                        }
                        
                        showAlert('Les voeux de l\'année précédente ont été chargés avec succès. N\'oubliez pas de soumettre le formulaire pour confirmer vos choix pour l\'année actuelle.', 'success');
                    }, 1000);
                }, 1000);
            }, 500);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des voeux de l\'année précédente:', error);
        showAlert(`Erreur: ${error.message}. Impossible de charger les voeux de l'année précédente.`, 'danger');
    }
}