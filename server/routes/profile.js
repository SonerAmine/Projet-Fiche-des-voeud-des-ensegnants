const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * @route   GET /api/profile/me
 * @desc    Récupérer le profil de l'utilisateur connecté
 * @access  Privé
 */
router.get('/me', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/profile/me
 * @desc    Mettre à jour le profil de l'utilisateur
 * @access  Privé
 */
router.put('/me', protect, upload.single('profilePicture'), async (req, res, next) => {
    try {
        // Récupérer les données modifiables
        const updateData = {};
        
        // Champs modifiables
        if (req.body.username) updateData.username = req.body.username;
        if (req.body.telephone) updateData.telephone = req.body.telephone;
        
        // Si une image a été uploadée
        if (req.file) {
            // Récupérer l'ancien chemin d'image pour suppression ultérieure
            const user = await User.findById(req.user.id);
            const oldProfilePicture = user ? user.profilePicture : null;
            
            // Ajouter le chemin de la nouvelle image
            updateData.profilePicture = `/uploads/profile_pics/${req.file.filename}`;
            
            // Supprimer l'ancienne image si elle existe
            if (oldProfilePicture) {
                const oldImagePath = path.join(__dirname, '..', oldProfilePicture);
                // Vérifier si le fichier existe avant de le supprimer
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (err) => {
                        if (err) console.error('Erreur lors de la suppression de l\'ancienne image:', err);
                    });
                }
            }
        }
        
        // Mettre à jour l'utilisateur
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        res.json({
            success: true,
            data: updatedUser,
            message: 'Profil mis à jour avec succès'
        });
    } catch (error) {
        // Gestion des erreurs de validation Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Erreur de validation',
                errors: messages
            });
        }
        
        next(error);
    }
});

module.exports = router; 