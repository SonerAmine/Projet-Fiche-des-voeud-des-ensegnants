const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '.env') });

// Importer le modèle User
const User = require('./models/User');

// L'email de l'utilisateur dont vous voulez réinitialiser le mot de passe
const EMAIL = 'mohamedaminesnr@gmail.com';
// Le nouveau mot de passe
const NEW_PASSWORD = 'aa_11&';

// Fonction pour réinitialiser le mot de passe
async function resetPassword() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connecté à MongoDB');
        
        // Trouver l'utilisateur par email
        const user = await User.findOne({ email: EMAIL });
        
        if (!user) {
            console.error(`Utilisateur avec l'email ${EMAIL} non trouvé`);
            return;
        }
        
        // Générer un salt et hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
        
        // Mettre à jour le mot de passe directement dans la base de données (bypass les middlewares)
        const result = await User.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    password: hashedPassword,
                    resetPasswordToken: undefined,
                    resetPasswordExpire: undefined
                } 
            }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`Mot de passe réinitialisé avec succès pour ${EMAIL}`);
            console.log(`Nouveau mot de passe: ${NEW_PASSWORD}`);
        } else {
            console.log("Aucune modification effectuée");
        }
        
    } catch (error) {
        console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    } finally {
        // Fermer la connexion MongoDB
        mongoose.connection.close();
        console.log('Connexion MongoDB fermée');
    }
}

// Exécuter la fonction
resetPassword(); 