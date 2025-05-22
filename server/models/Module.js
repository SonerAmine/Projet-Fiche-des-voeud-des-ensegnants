const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema({
    nom: {
        type: String,
        required: true
    },
    specialite: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialite',
        required: true
    },
    semestre: {
        type: Number,
        required: true,
        enum: [1, 2]
    },
    nature: {
        type: [String],
        required: true,
        enum: ['Cours', 'TD', 'TP']
    }
});

const Module = mongoose.model('Module', moduleSchema);

module.exports = Module; 