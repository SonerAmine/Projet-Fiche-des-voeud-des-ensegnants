const mongoose = require('mongoose');

const userPresenceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'L\'identifiant de l\'utilisateur est obligatoire'],
        unique: true
    },
    status: {
        type: String,
        enum: ['online', 'offline'],
        default: 'offline'
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    socketId: {
        type: String,
        default: null
    }
});

// Méthode statique pour mettre à jour le statut d'un utilisateur
userPresenceSchema.statics.updateUserStatus = async function(userId, status, socketId = null) {
    const update = { 
        status, 
        lastActive: new Date() 
    };
    
    if (socketId) {
        update.socketId = socketId;
    }
    
    return this.findOneAndUpdate(
        { user: userId },
        update,
        { upsert: true, new: true }
    );
};

// Méthode statique pour marquer un utilisateur comme hors ligne
userPresenceSchema.statics.setUserOffline = async function(userId) {
    // Utilisation de lean() et exec() pour une exécution plus rapide
    // Priorité maximale sur cette opération
    return this.findOneAndUpdate(
        { user: userId },
        { 
            status: 'offline', 
            lastActive: new Date(),
            socketId: null
        },
        { 
            upsert: true, 
            new: true,
            // Utiliser writeConcern 'majority' pour s'assurer que l'opération est enregistrée sur plusieurs serveurs
            writeConcern: { w: 'majority' },
            // Priorité d'exécution
            timestamps: true 
        }
    ).lean().exec();
};

// Méthode statique pour obtenir le statut d'un utilisateur
userPresenceSchema.statics.getUserStatus = async function(userId) {
    const presence = await this.findOne({ user: userId });
    return presence ? presence.status : 'offline';
};

// Méthode statique pour obtenir tous les utilisateurs en ligne
userPresenceSchema.statics.getOnlineUsers = async function() {
    return this.find({ status: 'online' }).populate('user', 'username email role profilePicture');
};

// Méthode statique pour obtenir l'ID socket d'un utilisateur
userPresenceSchema.statics.getSocketId = async function(userId) {
    const presence = await this.findOne({ user: userId });
    return presence ? presence.socketId : null;
};

const UserPresence = mongoose.model('UserPresence', userPresenceSchema);

module.exports = UserPresence; 