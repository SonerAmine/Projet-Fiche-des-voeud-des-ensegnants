const multer = require('multer');
const path = require('path');
const fs = require('fs');

// S'assurer que le dossier de destination existe
const uploadDir = path.join(__dirname, '../uploads/profile_pics');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration du stockage
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        // Générer un nom de fichier unique
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + uniqueSuffix + ext);
    }
});

// Filtre pour vérifier les types de fichiers
const fileFilter = (req, file, cb) => {
    // Accepter uniquement les images
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        // Rejeter le fichier
        cb(new Error('Format de fichier non supporté. Veuillez télécharger une image (JPEG, PNG, GIF).'), false);
    }
};

// Configuration de multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // Limite à 5MB
    }
});

module.exports = upload; 