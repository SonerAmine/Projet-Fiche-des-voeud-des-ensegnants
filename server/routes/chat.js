const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const UserPresence = require('../models/UserPresence');
const User = require('../models/User');
const { authorize, authorizeRoles } = require('../middleware/auth');

// Middleware pour vérifier que l'ID est valide
const validateObjectId = (req, res, next) => {
    const id = req.params.id || req.params.userId;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID utilisateur invalide'
        });
    }
    next();
};

// Récupérer la liste des conversations d'un utilisateur
router.get('/conversations', authorize, async (req, res) => {
    try {
        const userId = req.user.id;
        const conversations = await Message.getUserConversations(userId);
        
        // Récupérer les statuts en ligne pour tous les utilisateurs des conversations
        const userIds = conversations.map(conv => conv.otherUser._id);
        const presences = await UserPresence.find({ 
            user: { $in: userIds } 
        });
        
        // Créer un map pour un accès rapide
        const presenceMap = {};
        presences.forEach(presence => {
            presenceMap[presence.user.toString()] = presence.status;
        });
        
        // Ajouter le statut à chaque conversation
        const conversationsWithStatus = conversations.map(conv => ({
            ...conv,
            otherUser: {
                ...conv.otherUser,
                status: presenceMap[conv.otherUser._id.toString()] || 'offline'
            }
        }));
        
        res.json({
            success: true,
            count: conversationsWithStatus.length,
            conversations: conversationsWithStatus
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des conversations',
            error: error.message
        });
    }
});

// Récupérer les messages d'une conversation avec un utilisateur spécifique
router.get('/messages/:userId', authorize, validateObjectId, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = req.params.userId;
        
        // Vérifier que l'autre utilisateur existe
        const otherUser = await User.findById(otherUserId);
        if (!otherUser) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur introuvable'
            });
        }
        
        // Récupérer les messages entre les deux utilisateurs
        const messages = await Message.find({
            $or: [
                { sender: currentUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: currentUserId }
            ]
        })
        .sort({ timestamp: 1 })
        .populate('sender', 'username profilePicture role')
        .populate('receiver', 'username profilePicture role');
        
        // Marquer tous les messages reçus comme lus
        await Message.markConversationAsRead(currentUserId, otherUserId);
        
        // Récupérer le statut de l'autre utilisateur
        const presenceInfo = await UserPresence.findOne({ user: otherUserId });
        const status = presenceInfo ? presenceInfo.status : 'offline';
        
        res.json({
            success: true,
            count: messages.length,
            otherUser: {
                _id: otherUser._id,
                username: otherUser.username,
                profilePicture: otherUser.profilePicture,
                role: otherUser.role,
                status
            },
            messages
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des messages',
            error: error.message
        });
    }
});

// Envoyer un message à un utilisateur
router.post('/messages/:userId', authorize, validateObjectId, async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.userId;
        const { content, attachment } = req.body;
        
        // Vérifier que le contenu est fourni
        if (!content || content.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Le contenu du message est obligatoire'
            });
        }
        
        // Vérifier que l'utilisateur destinataire existe
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({
                success: false,
                message: 'Destinataire introuvable'
            });
        }
        
        // Créer le message
        const message = new Message({
            sender: senderId,
            receiver: receiverId,
            content,
            attachment: attachment || null
        });
        
        await message.save();
        
        // Populate les champs sender et receiver
        await message.populate('sender', 'username profilePicture role');
        await message.populate('receiver', 'username profilePicture role');
        
        res.status(201).json({
            success: true,
            message: 'Message envoyé avec succès',
            data: message
        });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi du message',
            error: error.message
        });
    }
});

// Supprimer un message
router.delete('/messages/:id', authorize, validateObjectId, async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = req.params.id;
        
        // Récupérer le message
        const message = await Message.findById(messageId);
        
        // Vérifier que le message existe
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message introuvable'
            });
        }
        
        // Vérifier que l'utilisateur est l'expéditeur du message
        if (message.sender.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Vous n\'êtes pas autorisé à supprimer ce message'
            });
        }
        
        // Supprimer le message
        await message.remove();
        
        res.json({
            success: true,
            message: 'Message supprimé avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du message:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la suppression du message',
            error: error.message
        });
    }
});

// Marquer une conversation comme lue
router.patch('/conversations/:userId/read', authorize, validateObjectId, async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = req.params.userId;
        
        // Marquer tous les messages comme lus
        await Message.markConversationAsRead(currentUserId, otherUserId);
        
        res.json({
            success: true,
            message: 'Conversation marquée comme lue'
        });
    } catch (error) {
        console.error('Erreur lors du marquage de la conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du marquage de la conversation',
            error: error.message
        });
    }
});

// Obtenir le nombre de messages non lus
router.get('/unread-count', authorize, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await Message.countUnreadMessages(userId);
        
        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Erreur lors du comptage des messages non lus:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du comptage des messages non lus',
            error: error.message
        });
    }
});

// Pour les admins: Obtenir la liste des utilisateurs pour le chat
router.get('/users', authorize, authorizeRoles(['admin', 'superadmin']), async (req, res) => {
    try {
        // Récupérer tous les utilisateurs (sauf l'utilisateur actuel)
        const users = await User.find({
            _id: { $ne: req.user.id }
        }).select('username email role profilePicture');
        
        // Récupérer les statuts de présence
        const userIds = users.map(user => user._id);
        const presences = await UserPresence.find({
            user: { $in: userIds }
        });
        
        // Créer un map pour accès rapide
        const presenceMap = {};
        presences.forEach(presence => {
            presenceMap[presence.user.toString()] = presence.status;
        });
        
        // Ajouter le statut à chaque utilisateur
        const usersWithStatus = users.map(user => ({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            profilePicture: user.profilePicture,
            status: presenceMap[user._id.toString()] || 'offline'
        }));
        
        res.json({
            success: true,
            count: usersWithStatus.length,
            users: usersWithStatus
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des utilisateurs',
            error: error.message
        });
    }
});

// Obtenir la liste des utilisateurs pour les utilisateurs normaux
router.get('/search', authorize, async (req, res) => {
    try {
        // Récupérer le terme de recherche à partir des query params
        const searchTerm = req.query.term || '';
        
        // Créer une expression régulière pour la recherche par "commence par" au lieu de "contient"
        // Échappement des caractères spéciaux dans regex pour éviter les erreurs
        const escapedSearchTerm = searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`^${escapedSearchTerm}`, 'i');
        
        console.log(`Recherche d'utilisateurs avec le terme: "${searchTerm}", regex: ${regex}`);
        
        // Rechercher les utilisateurs correspondants au terme de recherche
        let users = await User.find({
            _id: { $ne: req.user.id }, // Exclure l'utilisateur actuel
            username: regex // Rechercher par nom d'utilisateur commençant par le terme
        }).select('username role profilePicture').limit(20); // Augmenter la limite à 20 résultats
        
        console.log(`Résultats bruts trouvés: ${users.length} utilisateurs`);
        
        // S'assurer qu'il n'y a pas de doublons en utilisant un Set qui est plus approprié pour le déduplication
        const uniqueUserIds = new Set();
        const uniqueUsers = [];
        
        for (const user of users) {
            const userId = user._id.toString();
            if (!uniqueUserIds.has(userId)) {
                uniqueUserIds.add(userId);
                uniqueUsers.push(user);
            } else {
                console.warn(`Doublon supprimé: Utilisateur ${user.username} avec ID ${userId}`);
            }
        }
        
        console.log(`Après déduplication: ${uniqueUsers.length} utilisateurs uniques`);
        
        // Récupérer les statuts de présence pour les utilisateurs uniques
        const userIds = uniqueUsers.map(user => user._id);
        const presences = await UserPresence.find({
            user: { $in: userIds }
        });
        
        // Créer un map pour accès rapide
        const presenceMap = {};
        presences.forEach(presence => {
            presenceMap[presence.user.toString()] = presence.status;
        });
        
        // Ajouter le statut à chaque utilisateur
        const usersWithStatus = uniqueUsers.map(user => ({
            _id: user._id,
            username: user.username,
            role: user.role,
            profilePicture: user.profilePicture,
            status: presenceMap[user._id.toString()] || 'offline'
        }));
        
        res.json({
            success: true,
            count: usersWithStatus.length,
            users: usersWithStatus
        });
    } catch (error) {
        console.error('Erreur lors de la recherche des utilisateurs:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la recherche des utilisateurs',
            error: error.message
        });
    }
});

// Obtenir la liste des administrateurs pour les utilisateurs normaux
router.get('/admins', authorize, async (req, res) => {
    try {
        // Récupérer tous les administrateurs (admin et superadmin)
        const admins = await User.find({
            role: { $in: ['admin', 'superadmin'] },
            _id: { $ne: req.user.id } // Exclure l'utilisateur actuel (au cas où il serait admin)
        }).select('username email role profilePicture');
        
        console.log(`Récupération de ${admins.length} administrateurs`);
        
        // Récupérer les statuts de présence
        const adminIds = admins.map(admin => admin._id);
        const presences = await UserPresence.find({
            user: { $in: adminIds }
        });
        
        // Créer un map pour accès rapide
        const presenceMap = {};
        presences.forEach(presence => {
            presenceMap[presence.user.toString()] = presence.status;
        });
        
        // Ajouter le statut à chaque administrateur
        const adminsWithStatus = admins.map(admin => ({
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
            profilePicture: admin.profilePicture,
            status: presenceMap[admin._id.toString()] || 'offline'
        }));
        
        res.json({
            success: true,
            count: adminsWithStatus.length,
            admins: adminsWithStatus
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des administrateurs:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des administrateurs',
            error: error.message
        });
    }
});

module.exports = router; 