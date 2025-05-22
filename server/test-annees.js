const mongoose = require('mongoose');
const Voeu = require('./models/Voeu');

// Connexion à MongoDB
mongoose.connect('mongodb+srv://mohamed_amine:groupe24@cluster0.opvyfkx.mongodb.net/voeux-pedagogiques', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log('Connecté à MongoDB Atlas');
    
    try {
        // Test de la méthode getAnneesDisponibles
        const annees = await Voeu.getAnneesDisponibles();
        console.log('Années disponibles:', annees);
        
        // Vérifier si des années existent dans la base de données
        const count = await Voeu.countDocuments();
        console.log('Nombre total de vœux:', count);
        
        // Vérifier les documents avec le champ 'annee'
        const voeux = await Voeu.find({}, 'annee').limit(5);
        console.log('Exemples de vœux avec leurs années:', voeux);
    } catch (error) {
        console.error('Erreur lors de la récupération des années:', error);
    } finally {
        // Fermer la connexion
        mongoose.disconnect();
        console.log('Déconnecté de MongoDB Atlas');
    }
})
.catch(err => {
    console.error('Erreur de connexion à MongoDB Atlas', err);
}); 