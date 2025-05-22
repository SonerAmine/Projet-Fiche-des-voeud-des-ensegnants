const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env') });

// Vérifier les variables d'environnement
if (!process.env.MONGO_URI) {
    console.error("Erreur : La variable d'environnement MONGO_URI n'est pas définie.");
    process.exit(1);
}

// Charger les modèles
const User = require('../models/User');
const Voeu = require('../models/Voeu');
const Module = require('../models/Module');
const Niveau = require('../models/Niveau');
const Specialite = require('../models/Specialite');

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: 'majority',
    ssl: true,
    authSource: 'admin'
})
.then(async () => {
    console.log('Connecté à MongoDB Atlas');
    console.log('Base de données:', mongoose.connection.db.databaseName);
    
    try {
        // Lire et afficher les données de chaque collection
        
        // Utilisateurs
        const users = await User.find().select('-password');
        console.log('\n=== UTILISATEURS ===');
        console.log(`Total: ${users.length} utilisateurs`);
        if (users.length > 0) {
            console.log('Exemple du premier utilisateur:');
            console.log(users[0]);
        }
        
        // Voeux
        const voeux = await Voeu.find();
        console.log('\n=== VOEUX ===');
        console.log(`Total: ${voeux.length} voeux`);
        if (voeux.length > 0) {
            console.log('Exemple du premier voeu:');
            console.log(voeux[0]);
        }
        
        // Modules
        const modules = await Module.find();
        console.log('\n=== MODULES ===');
        console.log(`Total: ${modules.length} modules`);
        if (modules.length > 0) {
            console.log('Exemple du premier module:');
            console.log(modules[0]);
        }
        
        // Niveaux
        const niveaux = await Niveau.find();
        console.log('\n=== NIVEAUX ===');
        console.log(`Total: ${niveaux.length} niveaux`);
        if (niveaux.length > 0) {
            console.log('Exemple du premier niveau:');
            console.log(niveaux[0]);
        }
        
        // Spécialités
        const specialites = await Specialite.find();
        console.log('\n=== SPECIALITES ===');
        console.log(`Total: ${specialites.length} spécialités`);
        if (specialites.length > 0) {
            console.log('Exemple de la première spécialité:');
            console.log(specialites[0]);
        }
        
        // Afficher toutes les années disponibles
        const annees = await Voeu.distinct('annee');
        console.log('\n=== ANNÉES ACADÉMIQUES ===');
        console.log(annees);
        
        console.log('\nLecture des données terminée avec succès!');
    } catch (error) {
        console.error('Erreur lors de la lecture des données:', error);
    } finally {
        // Fermer la connexion
        await mongoose.connection.close();
        console.log('Connexion à MongoDB fermée');
    }
})
.catch(err => {
    console.error('Erreur de connexion à MongoDB Atlas:', err);
    process.exit(1);
}); 