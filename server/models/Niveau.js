const mongoose = require('mongoose');

const niveauSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        enum: ['L1', 'L2', 'L3', 'M1', 'M2', '4ème année ingénieur', '5ème année ingénieur'],
        unique: true
    },
    type: {
        type: String,
        required: true,
        enum: ['LMD', 'Ingénieur']
    },
    specialites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialite'
    }]
});

const Niveau = mongoose.model('Niveau', niveauSchema);

module.exports = Niveau; 