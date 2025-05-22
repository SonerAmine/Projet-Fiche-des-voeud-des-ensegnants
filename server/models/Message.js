const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'L\'identifiant de l\'expéditeur est obligatoire']
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'L\'identifiant du destinataire est obligatoire']
    },
    content: {
        type: String,
        required: [true, 'Le contenu du message est obligatoire'],
        trim: true,
        maxlength: [2000, 'Le message ne peut pas dépasser 2000 caractères']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    },
    // Optionnel: pour les pièces jointes (URL vers un fichier)
    attachment: {
        type: String,
        default: null
    }
});

// Index pour une recherche plus rapide des conversations
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });

// Méthode statique pour récupérer les conversations d'un utilisateur
messageSchema.statics.getUserConversations = async function(userId) {
    const conversations = await this.aggregate([
        // Trouver tous les messages où l'utilisateur est expéditeur ou destinataire
        {
            $match: {
                $or: [
                    { sender: new mongoose.Types.ObjectId(userId) },
                    { receiver: new mongoose.Types.ObjectId(userId) }
                ]
            }
        },
        // Trier par date
        { $sort: { timestamp: -1 } },
        // Créer un champ qui identifie l'autre participant
        {
            $addFields: {
                otherParticipant: {
                    $cond: {
                        if: { $eq: ["$sender", new mongoose.Types.ObjectId(userId)] },
                        then: "$receiver",
                        else: "$sender"
                    }
                }
            }
        },
        // Grouper par autre participant pour avoir les derniers messages
        {
            $group: {
                _id: "$otherParticipant",
                lastMessage: { $first: "$$ROOT" }
            }
        },
        // Lookup pour obtenir les infos des autres participants
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'otherUser'
            }
        },
        // Dérouler le tableau otherUser
        { $unwind: "$otherUser" },
        // Projeter uniquement les champs nécessaires
        {
            $project: {
                otherUser: {
                    _id: 1,
                    username: 1,
                    profilePicture: 1,
                    role: 1
                },
                lastMessage: {
                    _id: 1,
                    content: 1,
                    timestamp: 1,
                    read: 1,
                    sender: 1,
                    receiver: 1
                }
            }
        },
        // Trier par date du dernier message
        { $sort: { "lastMessage.timestamp": -1 } }
    ]);
    
    return conversations;
};

// Méthode statique pour marquer une conversation comme lue
messageSchema.statics.markConversationAsRead = async function(userId, otherUserId) {
    return this.updateMany(
        {
            sender: new mongoose.Types.ObjectId(otherUserId),
            receiver: new mongoose.Types.ObjectId(userId),
            read: false
        },
        { $set: { read: true } }
    );
};

// Méthode statique pour compter les messages non lus
messageSchema.statics.countUnreadMessages = async function(userId) {
    return this.countDocuments({
        receiver: new mongoose.Types.ObjectId(userId),
        read: false
    });
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 