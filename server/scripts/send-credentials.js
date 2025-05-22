const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const nodemailer = require('nodemailer');
const User = require('../models/User');

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env') });

// Vérifier les variables d'environnement nécessaires
if (!process.env.MONGO_URI || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    console.error("Erreur : Les variables d'environnement MONGO_URI, EMAIL_USERNAME ou EMAIL_PASSWORD ne sont pas définies.");
    console.error("Veuillez les définir dans le fichier .env");
    process.exit(1);
}

// Fonction pour générer un mot de passe aléatoire
function generateRandomPassword(length = 8) {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    
    const allChars = uppercaseChars + lowercaseChars + numberChars;
    let password = '';
    
    // Assurer au moins un caractère de chaque type
    password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
    password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
    password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
    
    // Compléter avec des caractères aléatoires
    for (let i = 3; i < length; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Mélanger les caractères
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Fonction pour envoyer l'email avec les identifiants
async function sendCredentialsEmail(email, password) {
    try {
        // Configurer le transporteur d'email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        
        // Options de l'email
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
            to: email,
            subject: 'Vos identifiants de connexion - Plateforme de Vœux Pédagogiques',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <div style="text-align: center; padding: 20px 0; background-color: #7494ec; color: white; border-radius: 5px;">
                        <h1>Plateforme de Vœux Pédagogiques</h1>
                    </div>
                    <div style="padding: 20px; line-height: 1.5;">
                        <h2>Bonjour,</h2>
                        <p>Nous vous informons que la plateforme de soumission des vœux pédagogiques est maintenant disponible.</p>
                        <p>Vous trouverez ci-dessous vos identifiants de connexion :</p>
                        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Email :</strong> ${email}</p>
                            <p><strong>Mot de passe :</strong> ${password}</p>
                        </div>
                        <p>Nous vous recommandons de changer votre mot de passe après votre première connexion pour des raisons de sécurité.</p>
                        <p>Pour vous connecter, veuillez accéder à notre plateforme en cliquant sur le lien ci-dessous :</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${(process.env.SITE_URL || 'http://localhost:5000') + '/login.html'}" style="background-color: #7494ec; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">Accéder à la plateforme</a>
                        </div>
                        <p>Si vous avez des questions ou rencontrez des problèmes, n'hésitez pas à nous contacter.</p>
                        <p>Cordialement,</p>
                        <p><strong>L'équipe pédagogique</strong></p>
                    </div>
                </div>
            `
        };
        
        // Envoyer l'email
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email à ${email}:`, error);
        throw error;
    }
}

// Fonction principale pour mettre à jour les mots de passe et envoyer les emails
async function sendCredentialsToTeachers() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority',
            ssl: true,
            authSource: 'admin'
        });
        
        console.log('Connecté à MongoDB Atlas');
        
        // Récupérer tous les enseignants (utilisateurs avec le rôle 'user')
        const teachers = await User.find({ role: 'user' });
        
        if (teachers.length === 0) {
            console.log('Aucun enseignant trouvé dans la base de données.');
            return;
        }
        
        console.log(`${teachers.length} enseignants trouvés. Début de l'envoi des emails...`);
        
        // Compteurs pour le suivi
        let successCount = 0;
        let errorCount = 0;
        
        // Traiter chaque enseignant
        for (const teacher of teachers) {
            try {
                // Générer un mot de passe aléatoire
                const randomPassword = generateRandomPassword();
                
                // Récupérer l'utilisateur et mettre à jour le mot de passe
                const user = await User.findById(teacher._id);
                if (!user) {
                    console.error(`❌ Utilisateur non trouvé pour l'email: ${teacher.email}`);
                    errorCount++;
                    continue;
                }
                
                // Mettre à jour le mot de passe
                user.password = randomPassword;
                
                // Sauvegarder pour déclencher le middleware de hachage
                await user.save();
                
                // Envoyer l'email avec les identifiants
                await sendCredentialsEmail(teacher.email, randomPassword);
                
                console.log(`✅ Email envoyé avec succès à ${teacher.email}`);
                successCount++;
                
                // Petite pause pour éviter les limitations des serveurs d'email
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ Erreur pour l'enseignant ${teacher.email}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n--- Résumé ---');
        console.log(`Emails envoyés avec succès: ${successCount}/${teachers.length}`);
        console.log(`Échecs: ${errorCount}/${teachers.length}`);
        
    } catch (error) {
        console.error('Erreur lors de l\'envoi des identifiants:', error);
    } finally {
        // Fermer la connexion MongoDB
        await mongoose.connection.close();
        console.log('Connexion à MongoDB fermée');
    }
}

// Exécuter la fonction principale
sendCredentialsToTeachers(); 