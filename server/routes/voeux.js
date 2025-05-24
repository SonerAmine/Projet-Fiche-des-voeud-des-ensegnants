const express = require('express');
const Voeu = require('../models/Voeu');
const { protect, authorize, authorizeRoles } = require('../middleware/auth');
const router = express.Router();
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { checkSiteStatus } = require('../middleware/siteStatus');

// IMPORTANT: Mettre les routes spécifiques qui ne nécessitent pas d'authentification EN PREMIER
// Récupérer les années académiques disponibles - ROUTE SPÉCIFIQUE sans authentification
// Utilisation de /api/voeux/data/annees pour éviter tout conflit avec /:id
router.get('/data/annees', async (req, res, next) => {
    try {
        console.log('Route /data/annees appelée');
        // Utiliser la méthode statique du modèle pour obtenir les années
        const annees = await Voeu.getAnneesDisponibles();
        console.log('Années récupérées:', annees);
        
        // S'assurer que la réponse est bien du JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(annees || []);
    } catch (error) {
        console.error('Erreur lors de la récupération des années:', error);
        next(error);
    }
});

// Nouvelle route pour récupérer les voeux de l'année précédente d'un enseignant
router.get('/me/annee-precedente', protect, async (req, res, next) => {
    try {
        console.log('Route /me/annee-precedente appelée par l\'utilisateur:', req.user.id);
        
        // Obtenir l'année courante au format "AAAA-AAAA"
        const dateActuelle = new Date();
        const anneeActuelle = dateActuelle.getFullYear();
        const anneePrecedente = anneeActuelle - 1;
        const anneeActuelleFormatee = `${anneeActuelle}-${anneeActuelle + 1}`;
        const anneePrecedenteFormatee = `${anneePrecedente}-${anneeActuelle}`;
        
        console.log('Recherche pour l\'année précédente:', anneePrecedenteFormatee);
        
        // Vérifier d'abord si l'utilisateur a déjà soumis des voeux pour l'année actuelle
        let voeuxAnneeCourante = null;
        
        try {
            // Recherche par ID utilisateur
            if (req.user && req.user.id) {
                voeuxAnneeCourante = await Voeu.findOne({ 
                    user: req.user.id, 
                    annee: anneeActuelleFormatee 
                });
            }
            
            // Si non trouvé, recherche par email (compatibilité)
            if (!voeuxAnneeCourante && req.user && req.user.email) {
                voeuxAnneeCourante = await Voeu.findOne({ 
                    email: req.user.email, 
                    annee: anneeActuelleFormatee 
                });
            }
            
            // Si l'utilisateur a déjà des voeux pour l'année courante
            if (voeuxAnneeCourante) {
                return res.status(400).json({
                    success: false,
                    message: `Vous avez déjà soumis une fiche de vœux pour l'année académique ${anneeActuelleFormatee}`,
                    existe: true,
                    dejaExistant: true
                });
            }
        } catch (error) {
            console.error('Erreur lors de la vérification des voeux de l\'année courante:', error);
        }
        
        // Rechercher les voeux de l'enseignant pour l'année précédente
        let voeu = null;
        
        try {
            // Recherche par ID utilisateur
            if (req.user && req.user.id) {
                console.log('Recherche par ID utilisateur:', req.user.id);
                
                voeu = await Voeu.findOne({ user: req.user.id, annee: anneePrecedenteFormatee })
                    .populate('choix_s1.module', 'nom')
                    .populate('choix_s1.specialite', 'nom')
                    .populate('choix_s1.palier', 'nom')
                    .populate('choix_s2.module', 'nom')
                    .populate('choix_s2.specialite', 'nom')
                    .populate('choix_s2.palier', 'nom');
                
                if (voeu) {
                    console.log('Fiche trouvée par ID utilisateur pour l\'année précédente');
                }
            }
            
            // Si non trouvé, recherche par email (compatibilité)
            if (!voeu && req.user && req.user.email) {
                console.log('Recherche par email utilisateur:', req.user.email);
                
                voeu = await Voeu.findOne({ email: req.user.email, annee: anneePrecedenteFormatee })
                    .populate('choix_s1.module', 'nom')
                    .populate('choix_s1.specialite', 'nom')
                    .populate('choix_s1.palier', 'nom')
                    .populate('choix_s2.module', 'nom')
                    .populate('choix_s2.specialite', 'nom')
                    .populate('choix_s2.palier', 'nom');
                
                if (voeu) {
                    console.log('Fiche trouvée par email utilisateur pour l\'année précédente');
                }
            }
        } catch (error) {
            console.error('Erreur lors de la recherche de la fiche de l\'année précédente:', error);
            throw new Error(`Erreur lors de la recherche de la fiche: ${error.message}`);
        }
        
        if (!voeu) {
            console.log('Aucune fiche trouvée pour l\'année précédente');
            return res.status(404).json({
                success: false,
                message: 'Aucune fiche de vœux trouvée pour l\'année précédente',
                existe: false
            });
        }
        
        // Créer une version modifiée du voeu pour l'année courante
        const voeuModifie = {
            ...voeu.toObject(),
            _id: undefined, // Supprimer l'ID pour éviter les conflits
            annee: anneeActuelleFormatee, // Mettre à jour l'année
            date_creation: new Date(), // Mettre à jour les dates
            date_modification: new Date(),
            statut: 'en_attente' // Réinitialiser le statut
        };
        
        console.log('Fiche de l\'année précédente trouvée, envoi de la réponse modifiée pour l\'année courante');
        res.json({
            success: true,
            message: 'Fiche de vœux de l\'année précédente récupérée avec succès',
            existe: true,
            voeu: voeuModifie
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la fiche de l\'année précédente:', error);
        next(error);
    }
});

// Middleware pour valider les données entrantes
const validerDonneesVoeux = async (req, res, next) => {
    try {
        // Définir l'année académique pour toutes les vérifications
        const anneeAcademique = req.body.annee || (() => {
            const date = new Date();
            const annee = date.getFullYear();
            return `${annee}-${annee + 1}`;
        })();

        // Vérifier si l'email est déjà utilisé pour l'année académique spécifique (sauf si c'est une mise à jour)
        if (req.method === 'POST' || (req.method === 'PUT' && req.body.email)) {
            // Rechercher un doublon avec le même email ET la même année académique
            const doublon = await Voeu.findOne({
                email: req.body.email,
                annee: anneeAcademique,
                _id: { $ne: req.params.id } // Exclure l'ID actuel en cas de mise à jour
            });
            
            if (doublon) {
                const error = new Error('Un enseignant avec cet email a déjà soumis des vœux pour cette année académique');
                error.code = 'EMAIL_DUPLICATE';
                error.status = 400;
                error.champ = 'email';
                error.userMessage = `Vous avez déjà soumis une fiche de vœux pour l'année académique ${anneeAcademique}. Veuillez utiliser la fonctionnalité de mise à jour ou contacter l'administrateur si vous pensez qu'il s'agit d'une erreur.`;
                throw error;
            }
        }

        // Vérifier si le numéro de téléphone est déjà utilisé pour l'année académique spécifique
        if (req.method === 'POST' || (req.method === 'PUT' && req.body.telephone)) {
            // Rechercher un doublon avec le même numéro de téléphone ET la même année académique
            const doublonTel = await Voeu.findOne({
                telephone: req.body.telephone,
                annee: anneeAcademique,
                _id: { $ne: req.params.id } // Exclure l'ID actuel en cas de mise à jour
            });
            
            if (doublonTel) {
                const error = new Error('Un enseignant avec ce numéro de téléphone a déjà soumis des vœux pour cette année académique');
                error.code = 'TELEPHONE_DUPLICATE';
                error.status = 400;
                error.champ = 'telephone';
                error.userMessage = `Ce numéro de téléphone est déjà utilisé par un autre enseignant pour l'année académique ${anneeAcademique}. Veuillez utiliser un autre numéro ou contacter l'administrateur si vous pensez qu'il s'agit d'une erreur.`;
                throw error;
            }
        }

        // Vérifier que les choix sont valides
        if (!req.body.choix_s1 || req.body.choix_s1.length === 0) {
            const error = new Error('Au moins un choix pour le semestre 1 est obligatoire');
            error.code = 'MISSING_S1_CHOICES';
            error.status = 400;
            error.champ = 'choix_s1';
            error.userMessage = 'Vous devez sélectionner au moins un module pour le semestre 1. Veuillez ajouter au moins un choix.';
            throw error;
        }

        if (!req.body.choix_s2 || req.body.choix_s2.length === 0) {
            const error = new Error('Au moins un choix pour le semestre 2 est obligatoire');
            error.code = 'MISSING_S2_CHOICES';
            error.status = 400;
            error.champ = 'choix_s2';
            error.userMessage = 'Vous devez sélectionner au moins un module pour le semestre 2. Veuillez ajouter au moins un choix.';
            throw error;
        }

        // Vérifier que les modules correspondent aux paliers et spécialités
        const modulesValides = [...req.body.choix_s1, ...req.body.choix_s2].every(choix => {
            return choix.palier && choix.specialite && choix.module;
        });

        if (!modulesValides) {
            const error = new Error('Les modules doivent correspondre au palier et à la spécialité');
            error.code = 'INVALID_MODULE';
            error.status = 400;
            error.champ = 'choix_s1,choix_s2';
            error.userMessage = 'Certains modules ne correspondent pas au palier ou à la spécialité sélectionnés. Veuillez vérifier vos choix et les corriger.';
            throw error;
        }

        // Vérifier que les natures des modules sont valides
        const naturesValides = [...req.body.choix_s1, ...req.body.choix_s2].every(choix => {
            if (!choix.nature || !Array.isArray(choix.nature) || choix.nature.length === 0) {
                return false;
            }
            return choix.nature.every(n => ['Cours', 'TD', 'TP'].includes(n));
        });

        if (!naturesValides) {
            const error = new Error('Les natures des modules doivent être valides');
            error.code = 'INVALID_NATURE';
            error.status = 400;
            error.champ = 'choix_s1,choix_s2';
            error.userMessage = 'Les natures des modules doivent être "Cours", "TD" ou "TP". Veuillez vérifier vos choix et les corriger.';
            throw error;
        }
        
        // Vérifier que les modules historiques sont valides (si présents)
        if (req.body.moduleHistorique && Array.isArray(req.body.moduleHistorique) && req.body.moduleHistorique.length > 0) {
            const modulesHistoriqueValides = req.body.moduleHistorique.every(module => {
                return module.palier && module.specialite && module.module;
            });

            if (!modulesHistoriqueValides) {
                const error = new Error('Les modules historiques doivent être valides');
                error.code = 'INVALID_HISTORIQUE';
                error.status = 400;
                error.champ = 'moduleHistorique';
                error.userMessage = 'Certains modules historiques ne sont pas correctement renseignés. Veuillez vérifier vos données et les corriger.';
                throw error;
            }
        }

        next();
    } catch (error) {
        console.error('Erreur de validation:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
};

// Middleware pour vérifier si un voeu existe
const verifierExistenceVoeu = async (req, res, next) => {
    try {
        const voeu = await Voeu.findById(req.params.id);
        if (!voeu) {
            const error = new Error('Fiche de vœux non trouvée');
            error.code = 'VOEU_NOT_FOUND';
            error.status = 404;
            throw error;
        }
        req.voeu = voeu; // Stocker le voeu pour les routes suivantes
        next();
    } catch (error) {
        console.error('Erreur lors de la vérification du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
};

// Middleware pour vérifier si l'utilisateur est autorisé à accéder à ce voeu
const verifierAutorisationVoeu = async (req, res, next) => {
    try {
        // Les administrateurs et superadmins peuvent accéder à tous les vœux
        if (req.user.role === 'admin' || req.user.role === 'superadmin') {
            return next();
        }
        
        // Les utilisateurs normaux ne peuvent accéder qu'à leurs propres vœux
        // Vérifier par email ET par ID utilisateur
        const isOwner = 
            (req.user.email && req.voeu.email && req.user.email === req.voeu.email) || 
            (req.user.id && req.voeu.user && req.user.id.toString() === req.voeu.user.toString());
        
        if (isOwner) {
            return next();
        }
        
        console.log('Accès non autorisé:', {
            userEmail: req.user.email,
            voeuEmail: req.voeu.email,
            userId: req.user.id,
            voeuUserId: req.voeu.user
        });
        
        const error = new Error('Vous n\'êtes pas autorisé à accéder à cette fiche de vœux');
        error.code = 'UNAUTHORIZED_ACCESS';
        error.status = 403;
        throw error;
    } catch (error) {
        next(error);
    }
};

// Middleware spécial pour autoriser uniquement les utilisateurs standards (non admin et non superadmin)
const authorizeStandardUsers = (req, res, next) => {
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        const error = new Error('Les administrateurs ne peuvent pas soumettre de vœux pédagogiques');
        error.status = 403;
        error.code = 'ADMIN_CANNOT_SUBMIT';
        return next(error);
    }
    next();
};

// IMPORTANT: Mettre les routes spécifiques AVANT les routes avec paramètres (:id)

// Vérifier si l'utilisateur a déjà une fiche de vœux pour l'année en cours
router.get('/me/verification', protect, async (req, res, next) => {
    try {
        console.log('Route /me/verification appelée par l\'utilisateur:', req.user.id);
        
        // Obtenir l'année en cours au format "AAAA-AAAA"
        const dateActuelle = new Date();
        const anneeActuelle = dateActuelle.getFullYear();
        const anneeFormatee = `${anneeActuelle}-${anneeActuelle + 1}`;
        
        console.log('Vérification pour l\'année:', anneeFormatee);
        
        // Rechercher si l'utilisateur a déjà une fiche pour cette année
        let voeu = null;
        
        try {
            // Si le champ user est utilisé
            if (req.user && req.user.id) {
                console.log('Recherche par ID utilisateur:', req.user.id);
                voeu = await Voeu.findOne({ user: req.user.id, annee: anneeFormatee });
                
                if (voeu) {
                    console.log('Fiche trouvée par ID utilisateur');
                }
            }
            
            // Si aucun vœu n'est trouvé par l'ID utilisateur, essayer par email (compatibilité)
            if (!voeu && req.user && req.user.email) {
                console.log('Recherche par email utilisateur:', req.user.email);
                voeu = await Voeu.findOne({ email: req.user.email, annee: anneeFormatee });
                
                if (voeu) {
                    console.log('Fiche trouvée par email utilisateur');
                }
            }
        } catch (error) {
            console.error('Erreur lors de la recherche de la fiche:', error);
            throw new Error(`Erreur lors de la recherche de la fiche: ${error.message}`);
        }
        
        const reponse = {
            success: true,
            existe: !!voeu,
            voeu: voeu ? {
                id: voeu._id,
                annee: voeu.annee,
                statut: voeu.statut,
                date_creation: voeu.date_creation,
                date_modification: voeu.date_modification
            } : null
        };
        
        console.log('Réponse de vérification:', reponse);
        res.json(reponse);
    } catch (error) {
        console.error('Erreur lors de la vérification de l\'existence d\'une fiche:', error);
        next(error);
    }
});

// Récupérer la fiche de vœux de l'utilisateur connecté pour l'année en cours
router.get('/me', protect, async (req, res, next) => {
    try {
        console.log('Route /me appelée par l\'utilisateur:', req.user.id);
        
        // Obtenir l'année en cours au format "AAAA-AAAA"
        const dateActuelle = new Date();
        const anneeActuelle = dateActuelle.getFullYear();
        const anneeFormatee = `${anneeActuelle}-${anneeActuelle + 1}`;
        
        console.log('Recherche pour l\'année:', anneeFormatee);
        
        // Rechercher si l'utilisateur a déjà une fiche pour cette année
        let voeu = null;
        
        try {
            // Recherche par ID utilisateur (méthode préférée)
            if (req.user && req.user.id) {
                console.log('Recherche par ID utilisateur:', req.user.id);
                
                // Utiliser la méthode findOne directement avec tous les populates
                voeu = await Voeu.findOne({ user: req.user.id, annee: anneeFormatee })
                    .populate('choix_s1.module', 'nom')
                    .populate('choix_s1.specialite', 'nom')
                    .populate('choix_s1.palier', 'nom')
                    .populate('choix_s2.module', 'nom')
                    .populate('choix_s2.specialite', 'nom')
                    .populate('choix_s2.palier', 'nom');
                
                if (voeu) {
                    console.log('Fiche trouvée par ID utilisateur');
                }
            }
            
            // Si non trouvé, recherche par email (compatibilité)
            if (!voeu && req.user && req.user.email) {
                console.log('Recherche par email utilisateur:', req.user.email);
                
                voeu = await Voeu.findOne({ email: req.user.email, annee: anneeFormatee })
                    .populate('choix_s1.module', 'nom')
                    .populate('choix_s1.specialite', 'nom')
                    .populate('choix_s1.palier', 'nom')
                    .populate('choix_s2.module', 'nom')
                    .populate('choix_s2.specialite', 'nom')
                    .populate('choix_s2.palier', 'nom');
                
                if (voeu) {
                    console.log('Fiche trouvée par email utilisateur');
                }
            }
        } catch (error) {
            console.error('Erreur lors de la recherche de la fiche:', error);
            throw new Error(`Erreur lors de la recherche de la fiche: ${error.message}`);
        }
        
        if (!voeu) {
            console.log('Aucune fiche trouvée pour l\'utilisateur');
            return res.status(404).json({
                success: false,
                message: 'Aucune fiche de vœux trouvée pour l\'année en cours',
                existe: false
            });
        }
        
        console.log('Fiche trouvée, envoi de la réponse');
        res.json({
            success: true,
            message: 'Fiche de vœux récupérée avec succès',
            existe: true,
            voeu
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la fiche:', error);
        next(error);
    }
});

// Enregistrer une fiche de vœux
router.post('/', protect, authorizeStandardUsers, validerDonneesVoeux, async (req, res, next) => {
    try {
        console.log('Données reçues:', JSON.stringify(req.body, null, 2));
        
        // Si l'année n'est pas spécifiée, utiliser l'année en cours
        if (!req.body.annee) {
            const date = new Date();
            const annee = date.getFullYear();
            req.body.annee = `${annee}-${annee + 1}`;
        }
        
        // Vérifier si l'utilisateur a déjà soumis une fiche pour cette année
        let ficheExistante;
        
        // Recherche par ID utilisateur
        if (req.user && req.user.id) {
            ficheExistante = await Voeu.trouverParUtilisateur(req.user.id, req.body.annee);
        }
        
        // Si non trouvé, recherche par email (compatibilité)
        if (!ficheExistante && req.user && req.user.email) {
            ficheExistante = await Voeu.findOne({ email: req.user.email, annee: req.body.annee });
        }
        
        if (ficheExistante) {
            const error = new Error('Vous avez déjà soumis une fiche de vœux pour cette année académique');
            error.code = 'DUPLICATE_SUBMISSION';
            error.status = 400;
            error.userMessage = 'Vous ne pouvez pas créer une nouvelle fiche. Veuillez modifier votre fiche existante.';
            throw error;
        }
        
        // Ajouter l'ID de l'utilisateur à la fiche
        if (req.user && req.user.id) {
            req.body.user = req.user.id;
        }
        
        const voeu = new Voeu(req.body);
        console.log('Voeu créé:', voeu);
        
        const savedVoeu = await voeu.save();
        console.log('Voeu sauvegardé:', savedVoeu);
        
        res.status(201).json({
            success: true,
            message: 'Fiche de vœux enregistrée avec succès',
            voeu: savedVoeu
        });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Récupérer toutes les fiches de vœux avec pagination et filtrage
router.get('/', protect, async (req, res, next) => {
    try {
        const { page = 1, limit = 10, statut, palier, specialite, annee, all } = req.query;
        
        // Construire le filtre
        const filtre = {};
        
        // Si l'utilisateur n'est pas admin ou superadmin, il ne peut voir que ses propres vœux
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            filtre.email = req.user.email;
        } else if (all === 'true' && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
            // Si le paramètre all=true est présent et l'utilisateur est admin/superadmin,
            // ne pas appliquer de filtres supplémentaires pour retourner tous les voeux
            console.log('Mode tous les voeux activé, aucun filtrage appliqué');
        } else {
            // Appliquer les filtres normaux pour les admins/superadmins
            if (statut) filtre.statut = statut;
            if (palier) filtre['choix_s1.palier'] = palier;
            if (specialite) filtre['choix_s1.specialite'] = specialite;
            if (annee) filtre.annee = annee;
        }
        
        // Exécuter la requête avec pagination, sauf si all=true
        const query = Voeu.find(filtre).sort({ date_creation: -1 });
        
        if (all === 'true' && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
            // Sans pagination si all=true pour les administrateurs
            const voeux = await query;
            
            return res.json({
                success: true,
                voeux,
                totalVoeux: voeux.length
            });
        } else {
            // Avec pagination normalement
            const voeux = await query
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .exec();
            
            // Compter le nombre total de documents pour la pagination
            const count = await Voeu.countDocuments(filtre);
            
            return res.json({
                success: true,
                voeux,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                totalVoeux: count
            });
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des vœux:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Obtenir des statistiques sur les vœux
router.get('/stats/summary', protect, async (req, res, next) => {
    try {
        const { annee } = req.query;
        
        // Construire le filtre
        const filtre = {};
        
        // Si l'utilisateur n'est pas admin ou superadmin, il ne peut voir que ses propres statistiques
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            filtre.email = req.user.email;
        }
        
        if (annee) filtre.annee = annee;
        
        const totalVoeux = await Voeu.countDocuments(filtre);
        const voeuxApprouves = await Voeu.countDocuments({ ...filtre, statut: 'approuve' });
        const voeuxRefuses = await Voeu.countDocuments({ ...filtre, statut: 'refuse' });
        const voeuxEnAttente = await Voeu.countDocuments({ ...filtre, statut: 'en_attente' });
        
        // Compter les choix par palier
        const voeux = await Voeu.find(filtre);
        const choixParPalier = {};
        
        voeux.forEach(voeu => {
            [...voeu.choix_s1, ...voeu.choix_s2].forEach(choix => {
                if (!choixParPalier[choix.palier]) {
                    choixParPalier[choix.palier] = 0;
                }
                choixParPalier[choix.palier]++;
            });
        });
        
        res.json({
            success: true,
            total: totalVoeux,
            approuves: voeuxApprouves,
            refuses: voeuxRefuses,
            enAttente: voeuxEnAttente,
            choixParPalier
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Récupérer une fiche de vœux par ID
router.get('/:id', protect, async (req, res, next) => {
    try {
        console.log('Récupération du vœu avec ID:', req.params.id);
        
        // Vérifier d'abord la validité de l'ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error(`ID de vœu invalide: ${req.params.id}`);
            return res.status(400).json({
                success: false,
                message: 'ID de vœu invalide',
                error: 'INVALID_ID_FORMAT'
            });
        }
        
        const voeu = await Voeu.findById(req.params.id)
            .populate('choix_s1.module', 'nom')
            .populate('choix_s1.specialite', 'nom')
            .populate('choix_s1.palier', 'nom')
            .populate('choix_s2.module', 'nom')
            .populate('choix_s2.specialite', 'nom')
            .populate('choix_s2.palier', 'nom')
            .populate('moduleHistorique.module', 'nom')
            .populate('moduleHistorique.specialite', 'nom')
            .populate('moduleHistorique.palier', 'nom');
        
        if (!voeu) {
            const error = new Error('Vœu non trouvé');
            error.status = 404;
            error.code = 'VOEU_NOT_FOUND';
            throw error;
        }
        
        // Vérification d'accès étendue (admin/superadmin ou propriétaire du vœu)
        // Vérifier par email ET par ID utilisateur
        const isOwner = 
            (req.user.email && voeu.email && req.user.email === voeu.email) || 
            (req.user.id && voeu.user && req.user.id.toString() === voeu.user.toString());
        
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        
        console.log('Vérification d\'accès:', {
            userEmail: req.user.email,
            voeuEmail: voeu.email,
            userId: req.user.id,
            voeuUserId: voeu.user,
            isOwner: isOwner,
            isAdmin: isAdmin
        });
        
        if (!isAdmin && !isOwner) {
            const error = new Error('Vous n\'êtes pas autorisé à accéder à cette fiche de vœux');
            error.status = 403;
            error.code = 'UNAUTHORIZED_ACCESS';
            throw error;
        }
        
        console.log('Vœu récupéré avec succès');
        
        res.json({
            success: true,
            voeu
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Mettre à jour complètement une fiche de vœux
router.put('/:id', protect, verifierExistenceVoeu, verifierAutorisationVoeu, validerDonneesVoeux, async (req, res, next) => {
    try {
        // Mettre à jour tous les champs
        const updatedVoeu = await Voeu.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        // Si la mise à jour est faite par un admin, envoyer un email de notification
        if (req.user.role === 'admin' || req.user.role === 'superadmin') {
            // Générer la liste des modifications pour l'email
            try {
                await sendNotificationEmail(updatedVoeu.email, {
                    type: 'voeu_update',
                    nom: updatedVoeu.nom,
                    annee: updatedVoeu.annee,
                    modifications: [
                        "Une mise à jour complète de vos vœux pédagogiques a été effectuée par l'administration"
                    ]
                });
                console.log(`Email de notification envoyé à ${updatedVoeu.email} pour la mise à jour complète des vœux`);
            } catch (emailError) {
                console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            }
        }
        
        res.json({
            success: true,
            message: 'Fiche de vœux mise à jour avec succès',
            voeu: updatedVoeu
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Mettre à jour partiellement une fiche de vœux
router.patch('/:id', protect, verifierExistenceVoeu, verifierAutorisationVoeu, async (req, res, next) => {
    try {
        // Vérifier si c'est une mise à jour de statut
        if (req.body.statut) {
            if (!['en_attente', 'approuve', 'refuse'].includes(req.body.statut)) {
                const error = new Error('Statut invalide');
                error.code = 'INVALID_STATUS';
                error.status = 400;
                error.champ = 'statut';
                throw error;
            }
            
            // Seuls les administrateurs et superadmins peuvent changer le statut
            if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
                const error = new Error('Vous n\'êtes pas autorisé à changer le statut');
                error.code = 'UNAUTHORIZED_STATUS_CHANGE';
                error.status = 403;
                throw error;
            }
        }
        
        // Mettre à jour les champs fournis
        const updatedVoeu = await Voeu.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        
        // Si la mise à jour est faite par un admin et qu'il y a des changements, envoyer un email
        if ((req.user.role === 'admin' || req.user.role === 'superadmin') && Object.keys(req.body).length > 0) {
            // Identifier les champs modifiés pour l'email
            const modifications = Object.keys(req.body).map(key => {
                let fieldName = key;
                switch(key) {
                    case 'choix_s1': 
                        return "Modifications des choix du semestre 1";
                    case 'choix_s2': 
                        return "Modifications des choix du semestre 2";
                    case 'statut': 
                        const statusText = req.body.statut === 'approuve' ? 'approuvés' : 
                                          req.body.statut === 'refuse' ? 'refusés' : 'en attente';
                        return `Vos vœux ont été ${statusText}`;
                    case 'commentaires': 
                        return "Mise à jour des commentaires";
                    case 'bureau': 
                        return "Mise à jour du bureau";
                    case 'telephone': 
                        return "Mise à jour du numéro de téléphone";
                    case 'anciennete': 
                        return "Mise à jour de l'ancienneté";
                    case 'grade': 
                        return "Mise à jour du grade";
                    default:
                        return `Modification de ${fieldName}`;
                }
            });
            
            try {
                if (req.body.statut) {
                    // Si c'est une mise à jour de statut, utiliser l'email de notification de statut
                    await sendNotificationEmail(updatedVoeu.email, {
                        type: 'status_update',
                        statut: req.body.statut,
                        nom: updatedVoeu.nom,
                        annee: updatedVoeu.annee
                    });
                } else {
                    // Sinon, utiliser l'email de notification de mise à jour
                    await sendNotificationEmail(updatedVoeu.email, {
                        type: 'voeu_update',
                        nom: updatedVoeu.nom,
                        annee: updatedVoeu.annee,
                        modifications: modifications
                    });
                }
                console.log(`Email de notification envoyé à ${updatedVoeu.email} pour la mise à jour des vœux`);
            } catch (emailError) {
                console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            }
        }
        
        res.json({
            success: true,
            message: 'Fiche de vœux mise à jour avec succès',
            voeu: updatedVoeu
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Mettre à jour le statut d'une fiche de vœux
router.patch('/:id/statut', protect, authorizeRoles(['admin', 'superadmin']), verifierExistenceVoeu, async (req, res, next) => {
    try {
        const { statut } = req.body;
        
        if (!['en_attente', 'approuve', 'refuse'].includes(statut)) {
            const error = new Error('Statut invalide');
            error.code = 'INVALID_STATUS';
            error.status = 400;
            error.champ = 'statut';
            throw error;
        }
        
        const voeu = await Voeu.findByIdAndUpdate(
            req.params.id,
            { statut },
            { new: true, runValidators: true }
        );
        
        // Envoyer un email de notification à l'enseignant
        try {
            await sendNotificationEmail(voeu.email, {
                type: 'status_update',
                statut: statut,
                nom: voeu.nom,
                annee: voeu.annee
            });
            console.log(`Email de notification envoyé à ${voeu.email} pour la mise à jour du statut`);
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email:', emailError);
        }
        
        res.json({
            success: true,
            message: 'Statut mis à jour avec succès',
            voeu
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Supprimer une fiche de vœux
router.delete('/:id', protect, authorizeRoles(['admin', 'superadmin']), verifierExistenceVoeu, async (req, res, next) => {
    try {
        await Voeu.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true,
            message: 'Fiche de vœux supprimée avec succès',
            id: req.params.id
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du voeu:', error);
        next(error); // Transmettre l'erreur au middleware de gestion d'erreurs
    }
});

// Route pour télécharger une fiche de vœux en PDF
router.get('/:id/pdf', protect, verifierExistenceVoeu, verifierAutorisationVoeu, async (req, res, next) => {
    try {
        const voeu = req.voeu;
        
        // Populer les références pour obtenir les noms des modules, spécialités, etc.
        await voeu.populate('choix_s1.module', 'nom');
        await voeu.populate('choix_s1.specialite', 'nom');
        await voeu.populate('choix_s1.palier', 'nom');
        await voeu.populate('choix_s2.module', 'nom');
        await voeu.populate('choix_s2.specialite', 'nom');
        await voeu.populate('choix_s2.palier', 'nom');
        await voeu.populate('moduleHistorique.module', 'nom');
        await voeu.populate('moduleHistorique.specialite', 'nom');
        await voeu.populate('moduleHistorique.palier', 'nom');
        
        // Définir le nom du fichier PDF
        const filename = `fiche_voeux_${voeu._id}_${voeu.annee}.pdf`;
        
        // Définir les en-têtes
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');
        
        // Chemin vers les logos
        const logoUSHThBPath = path.join(__dirname, '../../public/images/logo-usthb.jpg');
        const logoVoeuxProPath = path.join(__dirname, '../../public/images/LOGO Site.png');
        
        // Créer un document PDF
        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);
        
        // Ajouter les logos en haut du document
        // Logo USTHB à gauche
        if (require('fs').existsSync(logoUSHThBPath)) {
            doc.image(logoUSHThBPath, 50, 50, { width: 80 });
        } else {
            console.warn('Logo USTHB non trouvé:', logoUSHThBPath);
        }
        
        // Logo Voeux Pro à droite
        if (require('fs').existsSync(logoVoeuxProPath)) {
            doc.image(logoVoeuxProPath, doc.page.width - 130, 50, { width: 80 });
        } else {
            console.warn('Logo Voeux Pro non trouvé:', logoVoeuxProPath);
        }
        
        // Titre et en-tête
        doc.moveDown(4); // Espace pour les logos
        doc.fontSize(20).text('Fiche de Vœux Pédagogiques', {
            align: 'center'
        });
        doc.moveDown();
        
        // Année académique
        doc.fontSize(16).text(`Année Académique: ${voeu.annee}`, {
            align: 'center'
        });
        doc.moveDown();
        
        // Informations de l'enseignant
        doc.fontSize(14).text('Informations de l\'enseignant', {
            underline: true
        });
        doc.moveDown(0.5);
        
        doc.fontSize(12).text(`Nom: ${voeu.nom}`);
        doc.fontSize(12).text(`Email: ${voeu.email}`);
        doc.fontSize(12).text(`Département: ${voeu.departement.nom}`);
        doc.fontSize(12).text(`Téléphone: ${voeu.telephone}`);
        doc.fontSize(12).text(`Grade: ${voeu.grade}`);
        doc.fontSize(12).text(`Ancienneté: ${voeu.anciennete} an(s)`);
        doc.fontSize(12).text(`Bureau: ${voeu.bureau}`);
        doc.moveDown();
        
        // Historique des modules enseignés
        doc.fontSize(14).text('Historique des modules enseignés', {
            underline: true
        });
        doc.moveDown(0.5);
        
        if (voeu.moduleHistorique && voeu.moduleHistorique.length > 0) {
            voeu.moduleHistorique.forEach((module, index) => {
                doc.fontSize(12).text(`Module enseigné #${index + 1}:`);
                doc.fontSize(12).text(`  - Palier: ${module.palier?.nom || 'Non spécifié'}`);
                doc.fontSize(12).text(`  - Spécialité: ${module.specialite?.nom || 'Non spécifiée'}`);
                doc.fontSize(12).text(`  - Module: ${module.module?.nom || 'Non spécifié'}`);
                doc.moveDown(0.5);
            });
        } else {
            doc.fontSize(12).text('Aucun module historique enregistré');
        }
        doc.moveDown();
        
        // Choix du semestre 1
        doc.fontSize(14).text('Choix pour le Semestre 1', {
            underline: true
        });
        doc.moveDown(0.5);
        
        if (voeu.choix_s1 && voeu.choix_s1.length > 0) {
            voeu.choix_s1.forEach((choix, index) => {
                doc.fontSize(12).text(`Choix ${index + 1}:`);
                doc.fontSize(12).text(`  - Palier: ${choix.palier?.nom || 'Non spécifié'}`);
                doc.fontSize(12).text(`  - Spécialité: ${choix.specialite?.nom || 'Non spécifiée'}`);
                doc.fontSize(12).text(`  - Module: ${choix.module?.nom || 'Non spécifié'}`);
                doc.fontSize(12).text(`  - Nature: ${choix.nature.join(', ')}`);
                doc.moveDown(0.5);
            });
        } else {
            doc.fontSize(12).text('Aucun choix pour ce semestre');
        }
        doc.moveDown();
        
        // Choix du semestre 2
        doc.fontSize(14).text('Choix pour le Semestre 2', {
            underline: true
        });
        doc.moveDown(0.5);
        
        if (voeu.choix_s2 && voeu.choix_s2.length > 0) {
            voeu.choix_s2.forEach((choix, index) => {
                doc.fontSize(12).text(`Choix ${index + 1}:`);
                doc.fontSize(12).text(`  - Palier: ${choix.palier?.nom || 'Non spécifié'}`);
                doc.fontSize(12).text(`  - Spécialité: ${choix.specialite?.nom || 'Non spécifiée'}`);
                doc.fontSize(12).text(`  - Module: ${choix.module?.nom || 'Non spécifié'}`);
                doc.fontSize(12).text(`  - Nature: ${choix.nature.join(', ')}`);
                doc.moveDown(0.5);
            });
        } else {
            doc.fontSize(12).text('Aucun choix pour ce semestre');
        }
        doc.moveDown();
        
        // Heures supplémentaires et PFE
        doc.fontSize(14).text('Informations complémentaires', {
            underline: true
        });
        doc.moveDown(0.5);
        
        doc.fontSize(12).text(`Heures supplémentaires S1: ${voeu.heures_supp_s1 || 0}`);
        doc.fontSize(12).text(`PFE L3: ${voeu.pfe_l3 ? 'Oui' : 'Non'}`);
        doc.moveDown();
        
        // Commentaires
        if (voeu.commentaires) {
            doc.fontSize(14).text('Commentaires', {
                underline: true
            });
            doc.moveDown(0.5);
            doc.fontSize(12).text(voeu.commentaires);
            doc.moveDown();
        }
        
        // Statut et dates
        doc.fontSize(14).text('Informations administratives', {
            underline: true
        });
        doc.moveDown(0.5);
        
        const statuts = {
            'en_attente': 'En attente',
            'approuve': 'Approuvé',
            'refuse': 'Refusé'
        };
        
        doc.fontSize(12).text(`Statut: ${statuts[voeu.statut] || voeu.statut}`);
        doc.fontSize(12).text(`Date de création: ${new Date(voeu.date_creation).toLocaleString()}`);
        doc.fontSize(12).text(`Dernière modification: ${new Date(voeu.date_modification).toLocaleString()}`);
        
        // Pied de page avec logos
        doc.moveDown(2);
        
        // Ajouter une ligne de séparation
        doc.moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .stroke();
        
        doc.moveDown(0.5);
        
        // Texte de pied de page
        doc.fontSize(10).text(`Document généré le ${new Date().toLocaleString()} - Université des Sciences et de la Technologie Houari Boumediene`, {
            align: 'center',
            color: 'grey'
        });
        
        // Finaliser le document
        doc.end();
    } catch (error) {
        console.error('Erreur lors de la génération du PDF:', error);
        next(error);
    }
});

// Route pour charger les voeux de l'année académique précédente
router.get('/charger-annee-precedente', protect, authorizeStandardUsers, async (req, res, next) => {
    try {
        console.log('Route /charger-annee-precedente appelée par l\'utilisateur:', req.user.id);
        
        // Obtenir l'année en cours et l'année précédente au format "AAAA-AAAA"
        const dateActuelle = new Date();
        const anneeActuelle = dateActuelle.getFullYear();
        const anneePrecedente = anneeActuelle - 1;
        const anneeActuelleFormatee = `${anneeActuelle}-${anneeActuelle + 1}`;
        const anneePrecedenteFormatee = `${anneePrecedente}-${anneeActuelle}`;
        
        console.log('Année actuelle:', anneeActuelleFormatee);
        console.log('Année précédente:', anneePrecedenteFormatee);
        
        // Vérifier si l'utilisateur a déjà soumis une fiche pour cette année
        let ficheExistante;
        
        // Recherche par ID utilisateur
        if (req.user && req.user.id) {
            ficheExistante = await Voeu.trouverParUtilisateur(req.user.id, anneeActuelleFormatee);
        }
        
        // Si non trouvé, recherche par email (compatibilité)
        if (!ficheExistante && req.user && req.user.email) {
            ficheExistante = await Voeu.findOne({ email: req.user.email, annee: anneeActuelleFormatee });
        }
        
        if (ficheExistante) {
            return res.status(400).json({
                success: false,
                message: 'Vous avez déjà soumis une fiche de vœux pour cette année académique',
                error: {
                    code: 'DUPLICATE_SUBMISSION',
                    message: 'Vous ne pouvez pas créer une nouvelle fiche. Veuillez modifier votre fiche existante.'
                }
            });
        }
        
        // Rechercher la fiche de l'année précédente
        let fichePrecedente;
        
        // Recherche par ID utilisateur
        if (req.user && req.user.id) {
            fichePrecedente = await Voeu.trouverParUtilisateur(req.user.id, anneePrecedenteFormatee)
                .populate('choix_s1.module')
                .populate('choix_s1.specialite')
                .populate('choix_s1.palier')
                .populate('choix_s2.module')
                .populate('choix_s2.specialite')
                .populate('choix_s2.palier');
        }
        
        // Si non trouvé, recherche par email (compatibilité)
        if (!fichePrecedente && req.user && req.user.email) {
            fichePrecedente = await Voeu.findOne({ email: req.user.email, annee: anneePrecedenteFormatee })
                .populate('choix_s1.module')
                .populate('choix_s1.specialite')
                .populate('choix_s1.palier')
                .populate('choix_s2.module')
                .populate('choix_s2.specialite')
                .populate('choix_s2.palier');
        }
        
        if (!fichePrecedente) {
            return res.status(404).json({
                success: false,
                message: 'Aucune fiche de vœux trouvée pour l\'année précédente',
                error: {
                    code: 'NO_PREVIOUS_VOEUX',
                    message: 'Vous n\'avez pas soumis de fiche de vœux pour l\'année précédente.'
                }
            });
        }
        
        // Créer une nouvelle fiche basée sur la précédente
        const nouvellesFiche = new Voeu({
            user: req.user.id,
            nom: fichePrecedente.nom,
            email: fichePrecedente.email,
            departement: fichePrecedente.departement,
            telephone: fichePrecedente.telephone,
            grade: fichePrecedente.grade,
            anciennete: fichePrecedente.anciennete + 1, // Augmenter l'ancienneté d'un an
            bureau: fichePrecedente.bureau,
            annee: anneeActuelleFormatee,
            choix_s1: fichePrecedente.choix_s1.map(choix => ({
                palier: choix.palier._id || choix.palier,
                specialite: choix.specialite._id || choix.specialite,
                module: choix.module._id || choix.module,
                nature: choix.nature
            })),
            choix_s2: fichePrecedente.choix_s2.map(choix => ({
                palier: choix.palier._id || choix.palier,
                specialite: choix.specialite._id || choix.specialite,
                module: choix.module._id || choix.module,
                nature: choix.nature
            })),
            moduleHistorique: fichePrecedente.moduleHistorique || [],
            heures_supp_s1: fichePrecedente.heures_supp_s1 || 0,
            pfe_l3: fichePrecedente.pfe_l3 || false,
            commentaires: '',  // Réinitialiser les commentaires pour la nouvelle année
            statut: 'en_attente'
        });
        
        const savedVoeu = await nouvellesFiche.save();
        
        res.status(201).json({
            success: true,
            message: 'Fiche de vœux de l\'année précédente chargée avec succès',
            voeu: savedVoeu
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des vœux de l\'année précédente:', error);
        next(error);
    }
});

// Fonction d'envoi d'email de notification aux enseignants
async function sendNotificationEmail(email, options) {
    try {
        // Options par défaut
        const { type, statut, nom, annee, modifications } = options;
        
        // Configurer le transporteur d'email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        
        // Définir le sujet et le contenu selon le type de notification
        let subject, htmlContent;
        
        if (type === 'status_update') {
            const statusText = statut === 'approuve' ? 'approuvés' : 
                               statut === 'refuse' ? 'refusés' : 'en attente de validation';
            const statusColor = statut === 'approuve' ? '#2ecc71' : 
                                statut === 'refuse' ? '#e74c3c' : '#f39c12';
            
            subject = `[Vœux Pédagogiques] Mise à jour du statut de vos vœux`;
            
            htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <div style="text-align: center; padding: 20px 0; background-color: #3498db; color: white; border-radius: 5px 5px 0 0;">
                        <h1>Notification de Statut</h1>
                    </div>
                    <div style="padding: 20px; line-height: 1.5;">
                        <h2>Bonjour ${nom},</h2>
                        <p>Nous vous informons que le statut de vos vœux pédagogiques pour l'année académique ${annee} a été mis à jour.</p>
                        <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 5px solid ${statusColor};">
                            <p><strong>Nouveau statut :</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
                        </div>
                        ${statut === 'approuve' ? 
                            `<p>Félicitations ! Vos vœux pédagogiques ont été approuvés. Vous pouvez consulter les détails sur la plateforme.</p>` : 
                        statut === 'refuse' ? 
                            `<p>Malheureusement, vos vœux pédagogiques n'ont pas pu être approuvés. Veuillez consulter la plateforme pour plus de détails ou contacter l'administration si vous souhaitez en discuter.</p>` : 
                            `<p>Vos vœux pédagogiques sont actuellement en cours d'examen par l'administration.</p>`
                        }
                        <p>Pour consulter l'état complet de vos vœux, veuillez vous connecter à la plateforme en cliquant sur le bouton ci-dessous :</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${(process.env.SITE_URL || 'http://localhost:5000') + '/index.html'}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">Accéder à la plateforme</a>
                        </div>
                        <p>Si vous avez des questions, n'hésitez pas à contacter l'administration.</p>
                        <p>Cordialement,</p>
                        <p><strong>L'équipe administrative</strong></p>
                    </div>
                    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; font-size: 12px; color: #7f8c8d;">
                        <p>Ceci est un message automatique. Merci de ne pas y répondre directement.</p>
                    </div>
                </div>
            `;
        } else if (type === 'voeu_update') {
            subject = `[Vœux Pédagogiques] Mise à jour de vos vœux pédagogiques`;
            
            // Générer une liste des modifications
            let modificationsHtml = '';
            if (modifications && modifications.length > 0) {
                modificationsHtml = `
                    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 5px solid #3498db;">
                        <p><strong>Modifications apportées :</strong></p>
                        <ul style="padding-left: 20px;">
                            ${modifications.map(mod => `<li>${mod}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
            
            htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <div style="text-align: center; padding: 20px 0; background-color: #3498db; color: white; border-radius: 5px 5px 0 0;">
                        <h1>Mise à jour de vos Vœux Pédagogiques</h1>
                    </div>
                    <div style="padding: 20px; line-height: 1.5;">
                        <h2>Bonjour ${nom},</h2>
                        <p>Nous vous informons que vos vœux pédagogiques pour l'année académique ${annee} ont été mis à jour par l'administration.</p>
                        ${modificationsHtml}
                        <p>Pour consulter le détail complet de vos vœux, veuillez vous connecter à la plateforme en cliquant sur le bouton ci-dessous :</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <a href="${(process.env.SITE_URL || 'http://localhost:5000') + '/index.html'}" style="background-color: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">Accéder à la plateforme</a>
                        </div>
                        <p>Si vous avez des questions concernant ces modifications, n'hésitez pas à contacter l'administration.</p>
                        <p>Cordialement,</p>
                        <p><strong>L'équipe administrative</strong></p>
                    </div>
                    <div style="background-color: #f8f8f8; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; font-size: 12px; color: #7f8c8d;">
                        <p>Ceci est un message automatique. Merci de ne pas y répondre directement.</p>
                    </div>
                </div>
            `;
        }
        
        // Options de l'email
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
            to: email,
            subject: subject,
            html: htmlContent
        };
        
        // Envoyer l'email
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email de notification envoyé à ${email}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email de notification à ${email}:`, error);
        throw error;
    }
}

// Appliquer le middleware d'authentification et de vérification de l'état du site pour toutes les routes suivantes
router.use(protect);
router.use(checkSiteStatus);

// Toutes les routes ci-dessous seront protégées et accessibles uniquement si le site n'est pas verrouillé
// ou si l'utilisateur est un administrateur

module.exports = router;