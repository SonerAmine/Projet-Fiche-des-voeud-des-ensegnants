const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configuration du transporteur d'emails
let transporter;
try {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    // Vérifier la configuration
    transporter.verify(function(error, success) {
        if (error) {
            console.error('Erreur de configuration email:', error);
        } else {
            console.log('Serveur email prêt à envoyer des messages');
        }
    });
} catch (error) {
    console.error('Erreur lors de la création du transporteur email:', error);
}

// @desc    Demande de réinitialisation du mot de passe
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        if (!transporter) {
            return res.status(500).json({
                success: false,
                message: 'Le service d\'email n\'est pas configuré'
            });
        }

        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Aucun utilisateur trouvé avec cet email'
            });
        }

        // Obtenir le token de réinitialisation
        const resetToken = user.getResetPasswordToken();

        // Sauvegarder l'utilisateur avec le token
        await user.save({ validateBeforeSave: false });

        // Créer l'URL de réinitialisation
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;

        // Créer le message
        const message = `
            Vous recevez cet email car vous (ou quelqu'un d'autre) avez demandé la réinitialisation du mot de passe.
            Veuillez cliquer sur le lien suivant pour réinitialiser votre mot de passe :
            \n\n${resetUrl}\n\n
            Ce lien expirera dans 24 heures.
            Si vous n'avez pas demandé de réinitialisation, ignorez cet email.
        `;

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: user.email,
                subject: 'Réinitialisation de mot de passe',
                text: message,
                html: `
                    <h1>Réinitialisation de mot de passe</h1>
                    <p>Vous recevez cet email car vous (ou quelqu'un d'autre) avez demandé la réinitialisation du mot de passe.</p>
                    <p>Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Réinitialiser mon mot de passe
                    </a>
                    <p>Ce lien expirera dans 24 heures.</p>
                    <p>Si vous n'avez pas demandé de réinitialisation, ignorez cet email.</p>
                `
            });

            console.log(`Email de réinitialisation envoyé à ${user.email}`);

            res.status(200).json({
                success: true,
                message: 'Email envoyé'
            });
        } catch (err) {
            console.error('Erreur lors de l\'envoi de l\'email:', err);

            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de l\'email'
            });
        }
    } catch (error) {
        console.error('Erreur dans forgotPassword:', error);
        next(error);
    }
};

// @desc    Réinitialiser le mot de passe
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        // Obtenir le token hashé
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        console.log('Réinitialisation de mot de passe pour le token:', req.params.resettoken);
        console.log('Token hashé:', resetPasswordToken);

        // Vérifier si un utilisateur avec ce token existe et si le token n'a pas expiré
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        }).select('+password');

        if (!user) {
            console.log('Aucun utilisateur trouvé avec ce token');
            return res.status(400).json({
                success: false,
                message: 'Token de réinitialisation invalide ou expiré'
            });
        }

        // Vérification de la sécurité du mot de passe
        const password = req.body.password;
        
        // Vérifier la force du mot de passe (implémentation simple)
        const passwordStrength = calculatePasswordStrength(password);
        console.log(`Force du mot de passe: ${passwordStrength}`);
        
        // Rejet des mots de passe trop faibles (score < 30 sur 100)
        if (passwordStrength < 30) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe est trop faible. Veuillez utiliser un mot de passe plus fort.',
                score: passwordStrength
            });
        }

        // Si l'utilisateur change son mot de passe pour celui qu'il avait déjà
        if (await user.comparePassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Vous ne pouvez pas utiliser votre ancien mot de passe.',
                code: 'SAME_PASSWORD'
            });
        }

        // Définir le nouveau mot de passe (sera hashé dans le modèle)
        user.password = password;
        // Effacer les champs de token
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        // Enregistrement de l'événement
        console.log(`Mot de passe réinitialisé pour l'utilisateur: ${user.email}`);

        // Renvoyer une réponse positive
        res.status(200).json({
            success: true,
            message: 'Votre mot de passe a été réinitialisé avec succès.'
        });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation du mot de passe:', error);
        next(error);
    }
};

// Fonction auxiliaire pour calculer la force d'un mot de passe
function calculatePasswordStrength(password) {
    let strength = 0;
    
    if(!password) return strength;
    
    // Longueur
    if(password.length >= 6) strength += 20;
    if(password.length >= 10) strength += 10;
    
    // Complexité
    if(/[A-Z]/.test(password)) strength += 10;
    if(/[a-z]/.test(password)) strength += 10;
    if(/[0-9]/.test(password)) strength += 10;
    if(/[^A-Za-z0-9]/.test(password)) strength += 15;
    
    // Pénalités pour répétitions
    if(/([a-zA-Z0-9])\1{2,}/.test(password)) strength -= 10;
    
    // Force minimum de 5%
    strength = Math.max(5, strength);
    
    // Maximum de 100%
    return Math.min(100, strength);
} 