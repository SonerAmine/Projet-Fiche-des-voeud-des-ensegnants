const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Modèle pour les départements
const departementSchema = new mongoose.Schema({
    Name: {
        type: String,
        required: true,
        unique: true
    }
}, { collection: 'département' });

const Departement = mongoose.model('Departement', departementSchema);

// Route pour récupérer tous les départements
router.get('/', async (req, res, next) => {
    try {
        console.log('Récupération des départements...');
        const departements = await Departement.find().sort('Name');
        console.log('Départements trouvés:', departements);
        res.json(departements);
    } catch (error) {
        console.error('Erreur lors de la récupération des départements:', error);
        next(error);
    }
});

module.exports = router; 