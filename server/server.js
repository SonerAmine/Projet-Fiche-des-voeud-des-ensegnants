const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors'); // Ajoutez le middleware CORS
const path = require('path');
const sharp = require('sharp'); // Ajout de Sharp pour le traitement d'images
const fs = require('fs');
const cookieParser = require('cookie-parser'); // Ajout du cookie-parser
const http = require('http'); // Nécessaire pour Socket.io
const socketio = require('socket.io'); // Importation de Socket.io
const jwt = require('jsonwebtoken');
const { getSiteStatus } = require('./middleware/siteStatus');
const SystemSettings = require('./models/SystemSettings');

// Chargez les variables d'environnement
dotenv.config({ path: path.join(__dirname, '.env') });

// Vérifiez que les variables d'environnement sont chargées
if (!process.env.MONGO_URI || !process.env.PORT) {
    console.error("Erreur : Les variables d'environnement MONGO_URI ou PORT ne sont pas définies.");
    process.exit(1); // Arrêtez l'exécution si les variables sont manquantes
}

console.log('Mongo URI:', process.env.MONGO_URI);
console.log('Port:', process.env.PORT);

const app = express();
const server = http.createServer(app); // Créer un serveur HTTP
const io = socketio(server, {
    cors: {
        origin: '*', // Permettre toutes les origines pour le développement
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true
    }
}); // Initialiser Socket.io

// Middleware pour les logs
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} (Origine: ${req.get('origin') || 'Inconnue'}, Referer: ${req.get('referer') || 'Inconnu'})`);
    next();
});

// Middleware CORS pour autoriser les requêtes depuis le frontend
app.use(cors({
    origin: '*', // Autoriser toutes les origines
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware pour analyser les données JSON
app.use(bodyParser.json());

// Middleware pour parser les cookies
app.use(cookieParser());

// Middleware global pour vérifier l'état du site
app.use(async (req, res, next) => {
    try {
        // Ignorer les routes qui ne nécessitent pas d'authentification ou de vérification
        const publicRoutes = [
            '/api/auth/login', 
            '/api/auth/register', 
            '/api/auth/forgot-password', 
            '/api/auth/reset-password', 
            '/api/site-status',
            '/login.html',
            '/forgot-password.html',
            '/reset-password.html',
            '/api/voeux/data/annees'
        ];
        
        const isPublicRoute = publicRoutes.some(route => req.url.includes(route));
        const isStaticAsset = req.url.includes('/js/') || req.url.includes('/css/') || req.url.includes('/images/');
        
        if (isPublicRoute || isStaticAsset) {
            return next();
        }
        
        // Si la requête nécessite authentification, récupérer le token
        const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
        
        if (token) {
            try {
                // Vérifier le token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                // Si utilisateur admin ou superadmin, laisser passer
                if (decoded.role === 'admin' || decoded.role === 'superadmin') {
                    return next();
                }
                
                // Sinon, vérifier l'état du site pour les utilisateurs normaux
                const siteSettings = await SystemSettings.getSiteStatus();
                
                if (siteSettings.siteStatus === 'locked') {
                    // Site verrouillé pour les utilisateurs normaux
                    return res.status(403).json({
                        success: false,
                        message: siteSettings.lockMessage || 'Le site est actuellement verrouillé par l\'administration.',
                        error: {
                            code: 'SITE_LOCKED',
                            message: siteSettings.lockMessage || 'Le site est actuellement verrouillé par l\'administration.'
                        }
                    });
                }
            } catch (error) {
                // Erreur de token, continuer sans bloquer (les routes protégées géreront l'authentification)
            }
        }
        
        next();
    } catch (error) {
        console.error('Erreur lors de la vérification du statut du site:', error);
        next(); // En cas d'erreur, continuer sans bloquer
    }
});

// Chemin absolu vers le dossier public
if (process.env.NODE_ENV === 'production'){
    app.use(express.static(path.join(__dirname, '../public')));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../public',
        'index.html'));
    });
}

// Servir les fichiers statiques du dossier public
app.use(express.static(publicPath));

// Servir les images de profil depuis le dossier uploads
const uploadsPath = path.join(__dirname, 'uploads/profile_pics');
console.log('Chemin des images de profil:', uploadsPath);
app.use('/uploads/profile_pics', express.static(uploadsPath));

// Middleware pour optimiser les images à la volée
app.get('/images/:imageName', async (req, res, next) => {
    try {
        const { imageName } = req.params;
        const width = parseInt(req.query.width) || null;
        const height = parseInt(req.query.height) || null;
        const quality = parseInt(req.query.quality) || 80;
        const format = req.query.format || 'jpeg';
        
        // Chemin de l'image originale
        const imagePath = path.join(publicPath, 'images', imageName);
        
        // Vérifier si le fichier existe
        if (!fs.existsSync(imagePath)) {
            return next(); // Passer au middleware suivant si l'image n'existe pas
        }
        
        // Créer un pipeline Sharp
        let pipeline = sharp(imagePath);
        
        // Redimensionner si nécessaire
        if (width || height) {
            pipeline = pipeline.resize(width, height, {
                fit: 'cover',
                position: 'center'
            });
        }
        
        // Convertir au format demandé et définir la qualité
        if (format === 'jpeg' || format === 'jpg') {
            pipeline = pipeline.jpeg({ quality });
        } else if (format === 'png') {
            pipeline = pipeline.png({ quality });
        } else if (format === 'webp') {
            pipeline = pipeline.webp({ quality });
        }
        
        // Envoyer l'image traitée
        res.type(`image/${format}`);
        pipeline.pipe(res);
        
    } catch (error) {
        console.error('Erreur lors du traitement de l\'image:', error);
        next(error);
    }
});

// Routes API
const voeuxRoutes = require('./routes/voeux');
const authRoutes = require('./routes/auth');
const niveauxRoutes = require('./routes/niveaux');
const specialitesRoutes = require('./routes/specialites');
const modulesRoutes = require('./routes/modules');
const departementsRoutes = require('./routes/departements');
const adminRoutes = require('./routes/admin'); // Nouvelles routes admin
const profileRoutes = require('./routes/profile'); // Routes de profil utilisateur
const chatRoutes = require('./routes/chat'); // Nouvelles routes pour le chat

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes); // Montage des routes de profil
app.use('/api/chat', chatRoutes); // Ajouter les routes de chat
app.use('/api/niveaux', niveauxRoutes);
app.use('/api/specialites', specialitesRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/departements', departementsRoutes);
app.use('/api/admin', adminRoutes); // Nouvelles routes admin

// Route spéciale pour les années académiques (en dehors des routes protégées)
app.get('/api/voeux/data/annees', async (req, res) => {
    try {
        console.log('Route /api/voeux/data/annees appelée');
        const Voeu = require('./models/Voeu');
        // Si la méthode getAnneesDisponibles existe, l'utiliser
        if (typeof Voeu.getAnneesDisponibles === 'function') {
            const annees = await Voeu.getAnneesDisponibles();
            console.log('Années récupérées:', annees);
            return res.json(annees || []);
        }
        
        // Sinon, fallback sur une requête directe
        const annees = await Voeu.distinct('annee');
        console.log('Années récupérées (fallback):', annees);
        return res.json(annees || []);
    } catch (error) {
        console.error('Erreur lors de la récupération des années:', error);
        res.status(500).json({ error: error.message });
    }
});

// Monter les routes de voeux en dernier pour éviter les conflits avec les routes spécifiques
app.use('/api/voeux', voeuxRoutes);

// Importer les modèles pour Socket.io
const User = require('./models/User');
const UserPresence = require('./models/UserPresence');
const Message = require('./models/Message');

// Middleware d'authentification Socket.io
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
            return next(new Error('Authentification requise'));
        }
        
        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Vérifier que l'utilisateur existe
        const user = await User.findById(decoded.id);
        if (!user) {
            return next(new Error('Utilisateur introuvable'));
        }
        
        // Ajouter les informations de l'utilisateur à l'objet socket
        socket.user = {
            id: user._id,
            username: user.username,
            role: user.role
        };
        
        next();
    } catch (error) {
        console.error('Erreur d\'authentification Socket.io:', error);
        next(new Error('Token invalide'));
    }
});

// Gérer les connexions Socket.io
io.on('connection', async (socket) => {
    console.log(`Nouvel utilisateur connecté: ${socket.user.username} (${socket.user.id})`);
    
    try {
        // Mettre à jour le statut de l'utilisateur à "online" automatiquement à la connexion
        await UserPresence.updateUserStatus(socket.user.id, 'online', socket.id);
        
        // Informer tous les utilisateurs du changement de statut
        io.emit('user_status_change', {
            userId: socket.user.id,
            status: 'online'
        });
        
        // Rejoindre une room privée pour les messages privés
        socket.join(socket.user.id.toString());
        
        // Écouter les nouveaux messages
        socket.on('send_message', async (data) => {
            try {
                const { receiverId, content, attachment } = data;
                
                // Créer un nouveau message dans la base de données
                const message = new Message({
                    sender: socket.user.id,
                    receiver: receiverId,
                    content,
                    attachment: attachment || null
                });
                
                await message.save();
                
                // Populate les champs sender et receiver
                await message.populate('sender', 'username profilePicture role');
                await message.populate('receiver', 'username profilePicture role');
                
                // Envoyer le message au destinataire s'il est connecté
                io.to(receiverId).emit('receive_message', message);
                
                // Envoyer une confirmation à l'expéditeur
                socket.emit('message_sent', message);
                
                // Récupérer le socketId du destinataire
                const receiverPresence = await UserPresence.findOne({ user: receiverId });
                if (receiverPresence && receiverPresence.socketId) {
                    io.to(receiverPresence.socketId).emit('new_message_notification', {
                        from: socket.user.username,
                        fromId: socket.user.id,
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.error('Erreur lors de l\'envoi du message:', error);
                socket.emit('message_error', {
                    message: 'Erreur lors de l\'envoi du message',
                    error: error.message
                });
            }
        });
        
        // Écouter les marquages de conversation lue
        socket.on('mark_conversation_read', async (data) => {
            try {
                const { userId } = data;
                
                // Marquer tous les messages comme lus
                await Message.markConversationAsRead(socket.user.id, userId);
                
                // Envoyer une confirmation à l'utilisateur
                socket.emit('conversation_marked_read', { userId });
            } catch (error) {
                console.error('Erreur lors du marquage de la conversation:', error);
                socket.emit('conversation_mark_error', {
                    message: 'Erreur lors du marquage de la conversation',
                    error: error.message
                });
            }
        });
        
        // Écouter l'événement explicite de déconnexion (fermeture du navigateur)
        socket.on('user_logout', async () => {
            console.log(`Utilisateur a fermé son navigateur: ${socket.user.username} (${socket.user.id})`);
            
            try {
                // Mettre à jour le statut à offline immédiatement
                await UserPresence.setUserOffline(socket.user.id);
                
                // Informer tous les utilisateurs du changement de statut
                io.emit('user_status_change', {
                    userId: socket.user.id,
                    status: 'offline'
                });
            } catch (error) {
                console.error('Erreur lors de la déconnexion explicite:', error);
            }
        });
        
        // Déconnexion normale - Mettre immédiatement le statut à "offline"
        socket.on('disconnect', async () => {
            console.log(`Utilisateur déconnecté: ${socket.user.username} (${socket.user.id})`);
            
            try {
                // Mettre à jour le statut de l'utilisateur à "offline" immédiatement
                await UserPresence.setUserOffline(socket.user.id);
                
                // Informer tous les utilisateurs du changement de statut
                io.emit('user_status_change', {
                    userId: socket.user.id,
                    status: 'offline'
                });
            } catch (error) {
                console.error('Erreur lors de la mise à jour du statut de déconnexion:', error);
            }
        });
    } catch (error) {
        console.error('Erreur lors de la gestion de la connexion Socket.io:', error);
        socket.disconnect(true);
    }
});

// Route par défaut pour servir index.html ou rediriger vers login
app.get('/', async (req, res) => {
    try {
        // Vérifier si l'utilisateur est connecté via le token dans les cookies ou les headers
        const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
        
        if (!token) {
            // Si pas de token, rediriger vers la page de connexion
            return res.sendFile(path.join(publicPath, 'login.html'));
        }

        // Vérifier le token et obtenir les informations de l'utilisateur
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Vérifier le rôle de l'utilisateur
        if (decoded.role === 'superadmin' || decoded.role === 'admin') {
            // Si admin ou superadmin, rediriger vers le panel d'administration
            return res.sendFile(path.join(publicPath, 'admin-panel.html'));
        } else {
            // Si utilisateur normal, servir la page index
            return res.sendFile(path.join(publicPath, 'index.html'));
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
        // En cas d'erreur (token invalide), rediriger vers la page de connexion
        return res.sendFile(path.join(publicPath, 'login.html'));
    }
});

// Route pour la page de réinitialisation de mot de passe
app.get('/reset-password/:token', (req, res) => {
    res.sendFile(path.join(publicPath, 'reset-password.html'));
});

// Route pour le panel d'administration
app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin-panel.html'));
});

// Route pour vérifier l'état du site
app.get('/api/site-status', async (req, res) => {
    try {
        const settings = await SystemSettings.getSiteStatus();
        res.json({
            status: settings.siteStatus,
            message: settings.lockMessage,
            isLocked: settings.siteStatus === 'locked'
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'état du site:', error);
        res.status(500).json({ error: error.message });
    }
});

// Connexion à MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    retryWrites: true,
    w: 'majority',
    ssl: true,
    authSource: 'admin'
})
.then(() => {
    console.log('Connecté à MongoDB Atlas');
    console.log('Base de données:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error('Erreur de connexion à MongoDB Atlas', err);
    process.exit(1); // Arrêtez l'exécution en cas d'erreur de connexion
});

// Écouter les événements de connexion MongoDB
mongoose.connection.on('error', err => {
    console.error('Erreur MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Déconnecté de MongoDB Atlas');
});

mongoose.connection.on('reconnected', () => {
    console.log('Reconnecté à MongoDB Atlas');
});

// Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
    console.error('Erreur détaillée:', err);
    
    // Déterminer le type d'erreur et envoyer une réponse appropriée
    if (err.name === 'ValidationError') {
        // Erreur de validation Mongoose
        const messages = Object.values(err.errors).map(error => ({
            champ: error.path,
            message: error.message
        }));
        
        return res.status(400).json({
            success: false,
            message: 'Erreur de validation des données',
            errors: messages
        });
    }
    
    if (err.name === 'CastError') {
        // Erreur de type (par exemple, ID invalide)
        return res.status(400).json({
            success: false,
            message: `Format de données invalide pour le champ '${err.path}'`,
            error: {
                champ: err.path,
                message: `La valeur '${err.value}' n'est pas valide`
            }
        });
    }
    
    if (err.code === 11000) {
        // Erreur de doublon (clé unique)
        const champ = Object.keys(err.keyPattern)[0];
        return res.status(409).json({
            success: false,
            message: `Un enregistrement avec cette valeur de '${champ}' existe déjà`,
            error: {
                champ,
                message: `Cette valeur est déjà utilisée`
            }
        });
    }
    
    // Erreurs personnalisées avec code
    if (err.code === 'EMAIL_DUPLICATE') {
        return res.status(err.status || 400).json({
            success: false,
            message: err.userMessage || 'Cet email est déjà utilisé',
            error: {
                champ: err.champ || 'email',
                code: err.code,
                message: err.message
            }
        });
    }

    if (err.code === 'INVALID_CREDENTIALS') {
        return res.status(err.status || 401).json({
            success: false,
            message: 'Email ou mot de passe incorrect',
            error: {
                code: err.code,
                message: err.message
            }
        });
    }

    if (err.code === 'MISSING_CREDENTIALS') {
        return res.status(err.status || 400).json({
            success: false,
            message: 'Veuillez fournir un email et un mot de passe',
            error: {
                code: err.code,
                message: err.message
            }
        });
    }

    if (err.code === 'USER_EXISTS') {
        return res.status(err.status || 400).json({
            success: false,
            message: err.message,
            error: {
                code: err.code,
                message: err.message
            }
        });
    }
    
    // Erreur par défaut
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Une erreur est survenue sur le serveur',
        error: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            stack: err.stack
        } : 'Erreur interne du serveur'
    });
});

// Démarrer le serveur
const PORT = process.env.PORT || 5001; // Utiliser le port 5001 au lieu de 5000

function startServer(port) {
    server.listen(port, () => {
        console.log(`Serveur démarré sur le port ${port}`);
        console.log(`Servir les fichiers statiques depuis: ${publicPath}`);
    }).on('error', (err) => {
            console.error('Erreur lors du démarrage du serveur:', err);
        process.exit(1); // Arrête complètement le processus
    });
}

startServer(PORT);