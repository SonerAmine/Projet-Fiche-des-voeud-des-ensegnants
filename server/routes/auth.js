const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const SystemSettings = require('../models/SystemSettings');
const router = express.Router();
const { forgotPassword, resetPassword } = require('../controllers/authController');
const crypto = require('crypto');

// Route pour l'inscription d'un nouvel utilisateur
router.post('/register', async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        
        // Vérifier si l'utilisateur existe déjà
        const userExists = await User.findOne({ 
            $or: [
                { email },
                { username }
            ]
        });
        
        if (userExists) {
            let errorMessage = 'Un utilisateur avec ';
            if (userExists.email === email) {
                errorMessage += 'cet email';
            } else if (userExists.username === username) {
                errorMessage += 'ce nom d\'utilisateur';
            }
            errorMessage += ' existe déjà';
            
            const error = new Error(errorMessage);
            error.status = 400;
            error.code = 'USER_EXISTS';
            throw error;
        }
        
        // Créer un nouvel utilisateur
        const user = await User.create({
            username,
            email,
            password,
            role: 'user' // Par défaut, le rôle est 'user'
        });
        
        // Générer un token JWT
        const token = user.generateAuthToken();
        
        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

// Route pour la connexion
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        // Vérifier si l'email et le mot de passe sont fournis
        if (!email || !password) {
            const error = new Error('Veuillez fournir un email et un mot de passe');
            error.status = 400;
            error.code = 'MISSING_CREDENTIALS';
            throw error;
        }
        
        // Récupérer l'utilisateur avec le mot de passe
        const user = await User.findOne({ email }).select('+password');
        
        // Vérifier si l'utilisateur existe
        if (!user) {
            const error = new Error('Email ou mot de passe incorrect');
            error.status = 401;
            error.code = 'INVALID_CREDENTIALS';
            throw error;
        }
        
        // Vérifier si le mot de passe est correct
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            const error = new Error('Email ou mot de passe incorrect');
            error.status = 401;
            error.code = 'INVALID_CREDENTIALS';
            throw error;
        }
        
        // Vérifier si le site est verrouillé (sauf pour les admins)
        if (user.role === 'user') {
            const siteSettings = await SystemSettings.getSiteStatus();
            if (siteSettings.siteStatus === 'locked') {
                // Utiliser un code erreur cohérent pour la détection côté client
                return res.status(403).json({
                    success: false,
                    message: siteSettings.lockMessage || 'Le site est actuellement verrouillé par l\'administration.',
                    error: {
                        code: 'SITE_LOCKED',
                        message: siteSettings.lockMessage || 'Le site est actuellement verrouillé par l\'administration.'
                    }
                });
            }
        }
        
        // Générer un token JWT
        const token = user.generateAuthToken();
        
        // Définir le token comme cookie pour plus de sécurité
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 heures
        });
        
        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

// Route pour récupérer le profil de l'utilisateur connecté
router.get('/me', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Vérifier si le site est verrouillé (sauf pour les admins)
        if (user.role === 'user') {
            const siteSettings = await SystemSettings.getSiteStatus();
            if (siteSettings.siteStatus === 'locked') {
                const error = new Error(siteSettings.lockMessage || 'Le site est actuellement verrouillé par l\'administration.');
                error.status = 403;
                error.code = 'SITE_LOCKED';
                throw error;
            }
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                date_creation: user.date_creation
            }
        });
    } catch (error) {
        next(error);
    }
});

// Route pour la demande de réinitialisation du mot de passe
router.post('/forgot-password', forgotPassword);

// Route pour réinitialiser le mot de passe
router.put('/reset-password/:resettoken', resetPassword);

// Route pour vérifier la validité d'un token de réinitialisation
router.get('/check-token/:resettoken', async (req, res, next) => {
    try {
        // Obtenir le token hashé
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        console.log('Vérification du token:', req.params.resettoken);
        console.log('Token hashé:', resetPasswordToken);

        // Vérifier si un utilisateur avec ce token existe et si le token n'a pas expiré
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            console.log('Aucun utilisateur trouvé avec ce token ou token expiré');
            return res.status(400).json({
                success: false,
                message: 'Token invalide ou expiré'
            });
        }

        // Token valide
        return res.status(200).json({
            success: true,
            message: 'Token valide'
        });
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        next(error);
    }
});

module.exports = router; 