const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Le nom d\'utilisateur est obligatoire'],
        unique: true,
        trim: true,
        minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
        maxlength: [50, 'Le nom d\'utilisateur ne peut pas dépasser 50 caractères']
    },
    email: {
        type: String,
        required: [true, 'L\'email est obligatoire'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez fournir un email valide']
    },
    telephone: {
        type: String,
        trim: true,
        unique: true,
        sparse: true, // Permet d'avoir des valeurs null/undefined tout en gardant l'unicité
        match: [/^(05|06|07)[0-9]{8}$/, 'Le numéro de téléphone doit commencer par 05, 06 ou 07 et contenir 10 chiffres']
    },
    password: {
        type: String,
        required: [true, 'Le mot de passe est obligatoire'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // Ne pas inclure le mot de passe dans les requêtes par défaut
    },
    profilePicture: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'user'],
        default: 'user'
    },
    promotedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    date_creation: {
        type: Date,
        default: Date.now
    }
});

// Middleware pour hasher le mot de passe avant de sauvegarder
userSchema.pre('save', async function(next) {
    // Ne hasher le mot de passe que s'il a été modifié
    if (!this.isModified('password')) {
        console.log(`Le mot de passe n'a pas été modifié pour ${this.email}, ignorer le hachage`);
        return next();
    }
    
    try {
        console.log(`Hachage du mot de passe pour ${this.email}...`);
        // Générer un sel et hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        console.log(`Mot de passe haché avec succès pour ${this.email}`);
        next();
    } catch (error) {
        console.error(`Erreur lors du hachage du mot de passe pour ${this.email}:`, error);
        next(error);
    }
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Méthode pour générer un token JWT
userSchema.methods.generateAuthToken = function() {
    return jwt.sign(
        { id: this._id, role: this.role },
        process.env.JWT_SECRET || 'voeux-pedagogiques-secret-key',
        { expiresIn: '1d' }
    );
};

// Méthode pour générer un token de réinitialisation de mot de passe
userSchema.methods.getResetPasswordToken = function() {
    // Générer le token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hasher le token et le stocker dans la base de données
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Définir la date d'expiration (24 heures au lieu de 10 minutes)
    this.resetPasswordExpire = Date.now() + 24 * 60 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User; 