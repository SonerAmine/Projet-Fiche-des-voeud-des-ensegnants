const SystemSettings = require('../models/SystemSettings');

// Middleware pour vérifier si le site est verrouillé
exports.checkSiteStatus = async (req, res, next) => {
    try {
        // Les administrateurs peuvent toujours accéder au site, même s'il est verrouillé
        if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
            return next();
        }

        // Vérifier l'état du site
        const isLocked = await SystemSettings.isSiteLocked();
        
        if (isLocked) {
            const settings = await SystemSettings.getSiteStatus();
            const error = new Error(settings.lockMessage || 'Le site est actuellement verrouillé par l\'administration.');
            error.status = 403;
            error.code = 'SITE_LOCKED';
            throw error;
        }

        next();
    } catch (error) {
        next(error);
    }
};

// Middleware pour vérifier uniquement (sans bloquer) si le site est verrouillé
// Utilisé pour les routes qui doivent toujours être accessibles mais ont besoin de connaître l'état
exports.getSiteStatus = async (req, res, next) => {
    try {
        const settings = await SystemSettings.getSiteStatus();
        req.siteStatus = {
            isLocked: settings.siteStatus === 'locked',
            message: settings.lockMessage
        };
        next();
    } catch (error) {
        next(error);
    }
}; 