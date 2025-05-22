const express = require('express');
const router = express.Router();
const Specialite = require('../models/Specialite');

// Obtenir toutes les spécialités
router.get('/', async (req, res) => {
    try {
        const specialites = await Specialite.find().populate('niveau').populate('modules');
        res.json(specialites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir une spécialité par ID
router.get('/:id', async (req, res) => {
    try {
        const specialite = await Specialite.findById(req.params.id)
            .populate('niveau')
            .populate('modules');
        if (!specialite) {
            return res.status(404).json({ message: 'Spécialité non trouvée' });
        }
        res.json(specialite);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les spécialités par niveau
router.get('/niveau/:niveauId', async (req, res) => {
    try {
        console.log(`Recherche des spécialités pour le niveau: ${req.params.niveauId}`);
        
        if (!req.params.niveauId || !req.params.niveauId.match(/^[0-9a-fA-F]{24}$/)) {
            console.error(`ID de niveau invalide: ${req.params.niveauId}`);
            return res.status(400).json({ 
                message: 'ID de niveau invalide',
                error: 'INVALID_ID_FORMAT'
            });
        }
        
        const specialites = await Specialite.find({ niveau: req.params.niveauId });
        
        console.log(`${specialites.length} spécialités trouvées pour le niveau ${req.params.niveauId}`);
        res.json(specialites);
    } catch (error) {
        console.error('Erreur lors de la recherche des spécialités:', error);
        res.status(500).json({ 
            message: 'Erreur lors de la recherche des spécialités',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router; 