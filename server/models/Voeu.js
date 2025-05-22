const mongoose = require('mongoose');

// Schéma pour les choix de modules
const choixSchema = new mongoose.Schema({
    palier: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Niveau',
        required: [true, 'Le palier est obligatoire']
    },
    specialite: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialite',
        required: [true, 'La spécialité est obligatoire']
    },
    module: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Module',
        required: [true, 'Le module est obligatoire']
    },
    nature: { 
        type: [String], 
        required: [true, 'La nature est obligatoire'],
        validate: {
            validator: function(v) {
                return v.length > 0;
            },
            message: 'Au moins une nature doit être sélectionnée'
        },
        enum: {
            values: ['Cours', 'TD', 'TP'],
            message: 'La nature doit être Cours, TD et/ou TP'
        }
    }
});

// Schéma principal pour les vœux
const voeuSchema = new mongoose.Schema({
    // Référence vers l'utilisateur
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optionnel pour la compatibilité avec les fiches existantes
    },
    // Informations de l'enseignant
    nom: { 
        type: String, 
        required: [true, 'Le nom est obligatoire'],
        trim: true,
        minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
        maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
    },
    email: { 
        type: String, 
        required: [true, 'L\'email est obligatoire'],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez fournir un email valide']
    },
    departement: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Departement',
            required: [true, 'Le département est obligatoire']
        },
        nom: {
            type: String,
            required: [true, 'Le nom du département est obligatoire']
        }
    },
    telephone: {
        type: String,
        required: [true, 'Le numéro de téléphone est obligatoire'],
        trim: true,
        match: [/^(05|06|07)[0-9]{8}$/, 'Le numéro de téléphone doit commencer par 05, 06 ou 07 et contenir 10 chiffres']
    },
    grade: { 
        type: String, 
        required: [true, 'Le grade est obligatoire'],
        enum: {
            values: ['Professeur', 'Maître de conférences', 'Maître assistant', 'Assistant'],
            message: 'Le grade doit être Professeur, Maître de conférences, Maître assistant ou Assistant'
        }
    },
    anciennete: {
        type: Number,
        required: [true, 'L\'ancienneté est obligatoire'],
        min: [0, 'L\'ancienneté ne peut pas être négative'],
        validate: {
            validator: function(v) {
                return Number.isInteger(v);
            },
            message: 'L\'ancienneté doit être un nombre entier'
        }
    },
    bureau: { 
        type: String, 
        required: [true, 'Le bureau est obligatoire'],
        trim: true
    },
    
    // Année académique
    annee: {
        type: String,
        required: [true, 'L\'année académique est obligatoire'],
        default: function() {
            const date = new Date();
            const annee = date.getFullYear();
            return `${annee}-${annee + 1}`;
        },
        validate: {
            validator: function(v) {
                // Format attendu: "2023-2024"
                return /^\d{4}-\d{4}$/.test(v);
            },
            message: 'Le format de l\'année académique doit être AAAA-AAAA (ex: 2023-2024)'
        }
    },
    
    // Choix de modules
    choix_s1: [choixSchema],
    choix_s2: [choixSchema],
    
    // Historique des modules enseignés
    moduleHistorique: [{
        palier: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Niveau'
        },
        specialite: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Specialite'
        },
        module: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Module'
        }
    }],
    
    // Heures supplémentaires
    heures_supp_s1: { 
        type: Number, 
        default: 0,
        min: [0, 'Les heures supplémentaires ne peuvent pas être négatives'],
        max: [10, 'Les heures supplémentaires ne peuvent pas dépasser 10']
    },
    
    // PFE L3
    pfe_l3: { 
        type: Boolean, 
        default: false
    },
    
    // Commentaires
    commentaires: { 
        type: String, 
        trim: true,
        maxlength: [500, 'Les commentaires ne peuvent pas dépasser 500 caractères']
    },
    
    // Statut et dates
    statut: { 
        type: String, 
        enum: ['en_attente', 'approuve', 'refuse'],
        default: 'en_attente'
    },
    date_creation: { 
        type: Date, 
        default: Date.now 
    },
    date_modification: { 
        type: Date, 
        default: Date.now 
    }
});

// Middleware pour mettre à jour la date de modification
voeuSchema.pre('save', function(next) {
    this.date_modification = Date.now();
    next();
});

// Middleware pour vérifier que les modules correspondent au palier et à la spécialité
voeuSchema.pre('save', async function(next) {
    const tousLesChoix = [...this.choix_s1, ...this.choix_s2];
    
    for (const choix of tousLesChoix) {
        // Vérification basique - à adapter selon vos règles métier
        if (choix.palier === 'L1' && choix.specialite !== 'Informatique') {
            next(new Error(`Le palier L1 n'est disponible que pour la spécialité Informatique`));
            return;
        }
    }

    // Vérifier l'unicité du numéro de téléphone pour l'année académique spécifique
    if (this.isNew || this.isModified('telephone')) {
        const voeuExistant = await this.constructor.findOne({
            telephone: this.telephone,
            annee: this.annee,
            _id: { $ne: this._id }
        });

        if (voeuExistant) {
            next(new Error(`Ce numéro de téléphone est déjà utilisé par un autre enseignant pour l'année académique ${this.annee}`));
            return;
        }
    }
    
    next();
});

// Méthode statique pour vérifier les doublons
voeuSchema.statics.verifierDoublon = async function(email, idExclu = null, annee = null) {
    // Construire la requête
    const query = { email };
    
    // Si une année est fournie, filtrer par année également
    if (annee) {
        query.annee = annee;
    }
    
    // Si un ID est fourni, exclure ce document de la recherche
    if (idExclu) {
        query._id = { $ne: idExclu };
    }
    
    const voeu = await this.findOne(query);
    return voeu !== null;
};

// Méthode statique pour vérifier l'unicité du numéro de téléphone
voeuSchema.statics.verifierTelephoneUnique = async function(telephone, idExclu = null, annee = null) {
    const query = { telephone };
    
    // Si une année est fournie, filtrer par année également
    if (annee) {
        query.annee = annee;
    }
    
    if (idExclu) {
        query._id = { $ne: idExclu };
    }
    
    const voeu = await this.findOne(query);
    return voeu !== null;
};

// Méthode statique pour obtenir les années disponibles
voeuSchema.statics.getAnneesDisponibles = async function() {
    const annees = await this.distinct('annee');
    return annees.sort().reverse(); // Trier par ordre décroissant
};

// Méthode statique pour vérifier si un utilisateur a déjà une fiche de vœux
voeuSchema.statics.trouverParUtilisateur = async function(userId, annee = null) {
    const query = { user: userId };
    
    // Si une année est fournie, filtrer par année également
    if (annee) {
        query.annee = annee;
    }
    
    // Retourner directement le résultat de findOne pour permettre le chaînage avec populate
    return this.findOne(query);
};

const Voeu = mongoose.model('Voeu', voeuSchema);

module.exports = Voeu;