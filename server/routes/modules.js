const express = require('express');
const router = express.Router();
const Module = require('../models/Module');
const { protect, authorizeRoles } = require('../middleware/auth');

// Obtenir tous les modules
router.get('/', async (req, res) => {
    try {
        const modules = await Module.find().populate('specialite').sort({ nom: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Créer un nouveau module (uniquement pour les admins)
router.post('/', protect, authorizeRoles(['admin', 'superadmin']), async (req, res) => {
    try {
        const { nom, specialite, semestre, nature } = req.body;
        
        // Validation des données
        if (!nom || !specialite || !semestre || !nature || !Array.isArray(nature) || nature.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'Données invalides. Veuillez fournir un nom, une spécialité, un semestre et au moins une nature.'
            });
        }
        
        // Vérifier que le semestre est valide
        if (semestre !== 1 && semestre !== 2) {
            return res.status(400).json({
                success: false,
                message: 'Le semestre doit être 1 ou 2'
            });
        }
        
        // Vérifier que les natures sont valides
        const naturesValides = ['Cours', 'TD', 'TP'];
        if (!nature.every(n => naturesValides.includes(n))) {
            return res.status(400).json({
                success: false,
                message: 'Les natures doivent être Cours, TD ou TP'
            });
        }
        
        // Vérifier si un module avec le même nom existe déjà
        const moduleExistant = await Module.findOne({ nom, specialite });
        if (moduleExistant) {
            return res.status(409).json({
                success: false,
                message: 'Un module avec ce nom existe déjà pour cette spécialité'
            });
        }
        
        // Créer le nouveau module
        const nouveauModule = new Module({
            nom,
            specialite,
            semestre: parseInt(semestre),
            nature
        });
        
        // Sauvegarder le module
        const moduleSauvegarde = await nouveauModule.save();
        
        // Réponse avec le module créé
        res.status(201).json({
            success: true,
            message: 'Module créé avec succès',
            module: await Module.findById(moduleSauvegarde._id).populate('specialite')
        });
    } catch (error) {
        console.error('Erreur lors de la création du module:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
});

// Obtenir un module par ID
router.get('/:id', async (req, res) => {
    try {
        const module = await Module.findById(req.params.id).populate('specialite');
        if (!module) {
            return res.status(404).json({ message: 'Module non trouvé' });
        }
        res.json(module);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les modules par spécialité
router.get('/specialite/:specialiteId', async (req, res) => {
    try {
        const modules = await Module.find({ specialite: req.params.specialiteId }).sort({ nom: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les modules par spécialité et semestre
router.get('/specialite/:specialiteId/semestre/:semestre', async (req, res) => {
    try {
        const modules = await Module.find({
            specialite: req.params.specialiteId,
            semestre: parseInt(req.params.semestre)
        }).sort({ nom: 1 });
        res.json(modules);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 