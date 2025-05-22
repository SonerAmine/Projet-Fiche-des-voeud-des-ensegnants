const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    siteStatus: {
        type: String,
        enum: ['active', 'locked'],
        default: 'active',
        required: true
    },
    lockMessage: {
        type: String,
        default: "Le site est actuellement en maintenance. Veuillez réessayer plus tard."
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedAt: {
        type: Date,
        default: Date.now
    }
});

// Méthode statique pour obtenir l'état actuel du site
systemSettingsSchema.statics.getSiteStatus = async function() {
    const settings = await this.findOne() || await this.create({});
    return settings;
};

// Méthode statique pour vérifier si le site est verrouillé
systemSettingsSchema.statics.isSiteLocked = async function() {
    const settings = await this.findOne() || await this.create({});
    return settings.siteStatus === 'locked';
};

// Méthode statique pour mettre à jour l'état du site
systemSettingsSchema.statics.updateSiteStatus = async function(status, message, userId) {
    const settings = await this.findOne() || new this();
    settings.siteStatus = status;
    if (message) settings.lockMessage = message;
    settings.lastModifiedBy = userId;
    settings.lastModifiedAt = new Date();
    return settings.save();
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings; 