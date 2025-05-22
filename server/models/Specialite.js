const mongoose = require('mongoose');

const specialiteSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true,
        unique: true
    },
    niveau: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niveau',
        required: true
    },
    modules: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module'
    }]
});

const Specialite = mongoose.model('Specialite', specialiteSchema);

module.exports = Specialite; 