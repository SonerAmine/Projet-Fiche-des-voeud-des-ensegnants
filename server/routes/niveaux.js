const express = require('express');
const router = express.Router();
const Niveau = require('../models/Niveau');

// Obtenir tous les niveaux
router.get('/', async (req, res) => {
    try {
        const niveaux = await Niveau.find().populate('specialites');
        res.json(niveaux);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir un niveau par ID
router.get('/:id', async (req, res) => {
    try {
        const niveau = await Niveau.findById(req.params.id).populate('specialites');
        if (!niveau) {
            return res.status(404).json({ message: 'Niveau non trouvé' });
        }
        res.json(niveau);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les niveaux par type (LMD ou Ingénieur)
router.get('/type/:type', async (req, res) => {
    try {
        const niveaux = await Niveau.find({ type: req.params.type }).populate('specialites');
        res.json(niveaux);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 