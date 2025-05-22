const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware pour vérifier si l'utilisateur est authentifié
exports.protect = async (req, res, next) => {
    try {
        let token;
        
        // Vérifier si le token est présent dans les headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            // Extraire le token du header Authorization
            token = req.headers.authorization.split(' ')[1];
        }
        
        // Vérifier si le token existe
        if (!token) {
            const error = new Error('Accès non autorisé. Veuillez vous connecter.');
            error.status = 401;
            error.code = 'AUTH_REQUIRED';
            throw error;
        }
        
        try {
            // Vérifier et décoder le token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'voeux-pedagogiques-secret-key');
            
            // Récupérer l'utilisateur associé au token
            const user = await User.findById(decoded.id);
            
            if (!user) {
                const error = new Error('Utilisateur non trouvé.');
                error.status = 401;
                error.code = 'USER_NOT_FOUND';
                throw error;
            }
            
            // Ajouter l'utilisateur à la requête
            req.user = user;
            next();
        } catch (error) {
            const authError = new Error('Token invalide ou expiré.');
            authError.status = 401;
            authError.code = 'INVALID_TOKEN';
            throw authError;
        }
    } catch (error) {
        next(error);
    }
};

// Middleware combiné qui vérifie l'authentification et autorise certains rôles
exports.authorize = (req, res, next) => {
    exports.protect(req, res, (err) => {
        if (err) return next(err);
        next();
    });
};

// Middleware pour vérifier si l'utilisateur a un rôle spécifique
exports.authorizeRoles = (roles) => {
    return (req, res, next) => {
        // Assurer que l'utilisateur est d'abord authentifié
        exports.protect(req, res, (err) => {
            if (err) return next(err);
            
            // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
            if (!roles.includes(req.user.role)) {
                const error = new Error(`Accès refusé. Rôle requis: ${roles.join(', ')}`);
                error.status = 403;
                error.code = 'INSUFFICIENT_PERMISSIONS';
                return next(error);
            }
            next();
        });
    };
};

// Middleware pour vérifier si l'utilisateur est super admin
exports.isSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superadmin') {
        const error = new Error('Accès refusé. Seul le superadmin peut effectuer cette action.');
        error.status = 403;
        error.code = 'SUPERADMIN_REQUIRED';
        return next(error);
    }
    next();
}; 