const express = require('express');
const { protect, authorizeRoles } = require('../middleware/auth');
const Voeu = require('../models/Voeu');
const Module = require('../models/Module');
const Specialite = require('../models/Specialite');
const User = require('../models/User');
const UserPresence = require('../models/UserPresence');
const SystemSettings = require('../models/SystemSettings');
const nodemailer = require('nodemailer');
const router = express.Router();

// Middleware pour protéger toutes les routes admin
router.use(protect);
router.use(authorizeRoles(['admin', 'superadmin']));

// Stats pour le tableau de bord
router.get('/stats', async (req, res, next) => {
    try {
        // Récupérer les statistiques de base
        const nbEnseignants = await Voeu.countDocuments();
        const nbModules = await Module.countDocuments();
        const nbVoeux = await Voeu.countDocuments();
        
        // Récupérer les statistiques par module
        const moduleStats = await Voeu.aggregate([
            { $unwind: '$choix_s1' },
            { 
                $lookup: {
                    from: 'modules',
                    localField: 'choix_s1.module',
                    foreignField: '_id',
                    as: 'moduleInfo'
                }
            },
            { $unwind: '$moduleInfo' },
            {
                $group: {
                    _id: '$choix_s1.module',
                    module: { $first: '$moduleInfo.nom' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        // Récupérer les statistiques par grade
        const gradeStats = await Voeu.aggregate([
            {
                $group: {
                    _id: '$grade',
                    grade: { $first: '$grade' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            success: true,
            nbEnseignants,
            nbModules,
            nbVoeux,
            moduleStats,
            gradeStats
        });
    } catch (error) {
        next(error);
    }
});

// Liste des modules avec nombre d'enseignants
router.get('/modules', async (req, res, next) => {
    try {
        const modules = await Module.find()
            .populate('specialite', 'nom');
            
        // Enrichir les données avec le nombre d'enseignants
        const modulesAvecStats = await Promise.all(modules.map(async (module) => {
            const nbEnseignantsS1 = await Voeu.countDocuments({
                'choix_s1.module': module._id
            });
            
            const nbEnseignantsS2 = await Voeu.countDocuments({
                'choix_s2.module': module._id
            });
            
            return {
                _id: module._id,
                nom: module.nom,
                specialite: module.specialite,
                semestre: module.semestre,
                nature: module.nature,
                nbEnseignants: nbEnseignantsS1 + nbEnseignantsS2
            };
        }));
        
        res.json(modulesAvecStats);
    } catch (error) {
        next(error);
    }
});

// Récupérer les enseignants pour un module spécifique
router.get('/modules/:moduleId/enseignants', async (req, res, next) => {
    try {
        const { moduleId } = req.params;
        
        // Rechercher tous les voeux qui contiennent ce module
        const voeux = await Voeu.find({
            $or: [
                { 'choix_s1.module': moduleId },
                { 'choix_s2.module': moduleId }
            ]
        });
        
        // Traiter les données pour inclure les informations de nature
        const enseignants = voeux.map(voeu => {
            // Chercher ce module dans les choix du S1 et S2
            const moduleInS1 = voeu.choix_s1.find(choix => 
                choix.module && choix.module.toString() === moduleId
            );
            
            const moduleInS2 = voeu.choix_s2.find(choix => 
                choix.module && choix.module.toString() === moduleId
            );
            
            // Obtenir la nature depuis le choix qui contient ce module
            const nature = moduleInS1 ? moduleInS1.nature : 
                           moduleInS2 ? moduleInS2.nature : [];
            
            return {
                _id: voeu._id,
                nom: voeu.nom,
                email: voeu.email,
                telephone: voeu.telephone,
                grade: voeu.grade, 
                bureau: voeu.bureau,
                anciennete: voeu.anciennete,
                statut: voeu.statut,
                nature: nature // Inclure la nature spécifique à ce module
            };
        });
        
        res.json(enseignants);
    } catch (error) {
        next(error);
    }
});

// Liste des enseignants (depuis les vœux)
router.get('/enseignants', async (req, res, next) => {
    try {
        // Utiliser l'agrégation pour éviter les doublons basés sur l'email
        const enseignants = await Voeu.aggregate([
            {
                $sort: { date_creation: -1 } // Trier par date de création la plus récente d'abord
            },
            {
                $group: {
                    _id: "$email", // Regrouper par email pour éviter les doublons
                    nom: { $first: "$nom" },
                    email: { $first: "$email" },
                    telephone: { $first: "$telephone" },
                    grade: { $first: "$grade" },
                    bureau: { $first: "$bureau" },
                    anciennete: { $first: "$anciennete" }
                }
            },
            {
                $sort: { nom: 1 } // Trier par nom
            }
        ]);
        
        res.json(enseignants);
    } catch (error) {
        next(error);
    }
});

// Liste des vœux pour l'admin
router.get('/voeux', async (req, res, next) => {
    try {
        const voeux = await Voeu.find()
            .populate({
                path: 'choix_s1.module',
                select: 'nom'
            })
            .populate({
                path: 'choix_s2.module',
                select: 'nom'
            })
            .populate({
                path: 'moduleHistorique.module',
                select: 'nom'
            })
            .populate({
                path: 'moduleHistorique.specialite',
                select: 'nom'
            })
            .populate({
                path: 'moduleHistorique.palier',
                select: 'nom'
            })
            .sort('-date_creation');
        
        res.json(voeux);
    } catch (error) {
        next(error);
    }
});

// Mettre à jour le statut d'un vœu
router.put('/voeux/:id/status', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { statut } = req.body;
        
        // Vérifier que le statut est valide
        if (!['en_attente', 'approuve', 'refuse'].includes(statut)) {
            return res.status(400).json({
                success: false,
                message: 'Statut invalide'
            });
        }
        
        const voeu = await Voeu.findByIdAndUpdate(
            id,
            { statut },
            { new: true, runValidators: true }
        );
        
        if (!voeu) {
            return res.status(404).json({
                success: false,
                message: 'Vœu non trouvé'
            });
        }
        
        // Envoyer un email de notification à l'enseignant
        await sendNotificationEmail(voeu.email, {
            type: 'status_update',
            statut: statut,
            nom: voeu.nom,
            annee: voeu.annee
        });
        
        res.json({
            success: true,
            data: voeu
        });
    } catch (error) {
        next(error);
    }
});

// Générer l'organigramme
router.post('/organigramme', async (req, res, next) => {
    try {
        const { annee, specialite } = req.body;
        
        if (!annee) {
            return res.status(400).json({
                success: false,
                message: 'Année académique requise'
            });
        }
        
        console.log(`Génération de l'organigramme pour l'année ${annee}${specialite ? ' et la spécialité ' + specialite : ''}`);
        
        // Construire la requête de filtrage - Inclure tous les vœux, pas uniquement approuvés
        const filter = { annee };
        
        // Ajouter le filtre de spécialité si fourni
        let specialiteFilter = {};
        if (specialite) {
            specialiteFilter = { 
                $or: [
                    { 'choix_s1.specialite': specialite },
                    { 'choix_s2.specialite': specialite }
                ]
            };
        }
        
        // Récupérer tous les vœux, pas uniquement ceux approuvés
        const voeux = await Voeu.find({ ...filter, ...specialiteFilter })
            .populate('choix_s1.module', 'nom')
            .populate('choix_s2.module', 'nom')
            .populate('choix_s1.specialite', 'nom')
            .populate('choix_s2.specialite', 'nom');
        
        console.log(`Nombre de vœux trouvés: ${voeux.length}`);
        
        // Vérifier si des vœux ont été trouvés
        if (voeux.length === 0) {
            return res.json({
                success: true,
                message: 'Aucun vœu trouvé pour cette année académique',
                departement: 'Non spécifié',
                modules: []
            });
        }
        
        // Organiser les données par module
        const moduleMap = new Map();
        let moduleCount = 0;
        
        voeux.forEach(voeu => {
            // Vérifier que les tableaux de choix existent
            const choixS1 = Array.isArray(voeu.choix_s1) ? voeu.choix_s1 : [];
            const choixS2 = Array.isArray(voeu.choix_s2) ? voeu.choix_s2 : [];
            
            // Traiter les choix du semestre 1
            choixS1.forEach(choix => {
                if (!choix.module || !choix.specialite) {
                    console.warn('Choix S1 invalide détecté, module ou spécialité manquant');
                    return;
                }
                
                moduleCount++;
                const moduleId = choix.module._id.toString();
                const moduleName = choix.module.nom;
                const specialiteName = choix.specialite.nom;
                
                if (!moduleMap.has(moduleId)) {
                    moduleMap.set(moduleId, {
                        _id: moduleId,
                        nom: moduleName,
                        specialite: specialiteName,
                        enseignants: [],
                        statuts: []
                    });
                }
                
                if (!moduleMap.get(moduleId).enseignants.includes(voeu.nom)) {
                    moduleMap.get(moduleId).enseignants.push(voeu.nom);
                    moduleMap.get(moduleId).statuts.push(voeu.statut);
                }
            });
            
            // Traiter les choix du semestre 2
            choixS2.forEach(choix => {
                if (!choix.module || !choix.specialite) {
                    console.warn('Choix S2 invalide détecté, module ou spécialité manquant');
                    return;
                }
                
                moduleCount++;
                const moduleId = choix.module._id.toString();
                const moduleName = choix.module.nom;
                const specialiteName = choix.specialite.nom;
                
                if (!moduleMap.has(moduleId)) {
                    moduleMap.set(moduleId, {
                        _id: moduleId,
                        nom: moduleName,
                        specialite: specialiteName,
                        enseignants: [],
                        statuts: []
                    });
                }
                
                if (!moduleMap.get(moduleId).enseignants.includes(voeu.nom)) {
                    moduleMap.get(moduleId).enseignants.push(voeu.nom);
                    moduleMap.get(moduleId).statuts.push(voeu.statut);
                }
            });
        });
        
        console.log(`Nombre total de modules traités: ${moduleCount}`);
        console.log(`Nombre de modules uniques: ${moduleMap.size}`);
        
        // Convertir la Map en tableau
        const modules = Array.from(moduleMap.values());
        
        // Récupérer le nom du département (prendre le premier voeu comme référence)
        let departement = 'Département Informatique';
        if (voeux.length > 0 && voeux[0].departement && voeux[0].departement.nom) {
            departement = voeux[0].departement.nom;
        }
        
        console.log(`Département identifié: ${departement}`);
        console.log(`Envoi de ${modules.length} modules pour l'organigramme`);
        
        res.json({
            success: true,
            departement,
            modules
        });
    } catch (error) {
        console.error('Erreur lors de la génération de l\'organigramme:', error);
        next(error);
    }
});

// Liste des utilisateurs
router.get('/users', async (req, res, next) => {
    try {
        const { role } = req.query;
        const query = role ? { role } : {};
        
        const users = await User.find(query)
            .select('-password')
            .populate('promotedBy', 'username email');
        
        res.json(users);
    } catch (error) {
        next(error);
    }
});

// Promouvoir un utilisateur au rôle d'admin
router.put('/users/:id/promote', async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Seul le superadmin peut promouvoir des utilisateurs'
            });
        }
        
        const { id } = req.params;
        
        // Trouver l'utilisateur à promouvoir
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Vérifier si l'utilisateur est déjà admin
        if (user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Cet utilisateur est déjà administrateur'
            });
        }
        
        // Promouvoir l'utilisateur
        user.role = 'admin';
        user.promotedBy = req.user._id;
        await user.save();
        
        res.json({
            success: true,
            message: 'Utilisateur promu au rôle d\'administrateur',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

// Rétrograder un utilisateur du rôle d'admin
router.put('/users/:id/demote', async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Accès refusé. Seul le superadmin peut rétrograder des administrateurs'
            });
        }
        
        const { id } = req.params;
        
        // Trouver l'utilisateur à rétrograder
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }
        
        // Vérifier si l'utilisateur est bien admin
        if (user.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Cet utilisateur n\'est pas administrateur'
            });
        }
        
        // Rétrograder l'utilisateur
        user.role = 'user';
        user.promotedBy = null;
        await user.save();
        
        res.json({
            success: true,
            message: 'Administrateur rétrogradé au rôle d\'utilisateur',
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        next(error);
    }
});

// Route pour envoyer les identifiants par email
router.post('/send-credentials', async (req, res, next) => {
    try {
        // Récupérer les filtres éventuels
        const { filters, selectedUsers } = req.body;
        
        // Initialiser la requête
        let query = { role: 'user' };
        
        // Appliquer les filtres si nécessaire
        if (selectedUsers && selectedUsers.length > 0) {
            query._id = { $in: selectedUsers };
        }
        
        // Fonction de génération de mot de passe
        function generateRandomPassword(length = 8) {
            const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
            const numberChars = '0123456789';
            
            const allChars = uppercaseChars + lowercaseChars + numberChars;
            let password = '';
            
            // Assurer au moins un caractère de chaque type
            password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
            password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
            password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
            
            // Compléter avec des caractères aléatoires
            for (let i = 3; i < length; i++) {
                password += allChars.charAt(Math.floor(Math.random() * allChars.length));
            }
            
            // Mélanger les caractères
            return password.split('').sort(() => 0.5 - Math.random()).join('');
        }
        
        // Fonction d'envoi d'email
        async function sendCredentialsEmail(email, password) {
            try {
                // Configurer le transporteur d'email
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USERNAME,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
                
                // Options de l'email
                const mailOptions = {
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
                    to: email,
                    subject: 'Vos identifiants de connexion - Plateforme de Vœux Pédagogiques',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <div style="text-align: center; padding: 20px 0; background-color: #7494ec; color: white; border-radius: 5px;">
                                <h1>Plateforme de Vœux Pédagogiques</h1>
                            </div>
                            <div style="padding: 20px; line-height: 1.5;">
                                <h2>Bonjour,</h2>
                                <p>Nous vous informons que la plateforme de soumission des vœux pédagogiques est maintenant disponible.</p>
                                <p>Vous trouverez ci-dessous vos identifiants de connexion :</p>
                                <div style="background-color: #f8f8f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p><strong>Email :</strong> ${email}</p>
                                    <p><strong>Mot de passe :</strong> ${password}</p>
                                </div>
                                <p>Nous vous recommandons de changer votre mot de passe après votre première connexion pour des raisons de sécurité.</p>
                                <p>Pour vous connecter, veuillez accéder à notre plateforme en cliquant sur le lien ci-dessous :</p>
                                <div style="text-align: center; margin: 25px 0;">
                                    <a href="${(process.env.SITE_URL || 'http://localhost:5000') + '/login.html'}" style="background-color: #7494ec; color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">Accéder à la plateforme</a>
                                </div>
                                <p>Si vous avez des questions ou rencontrez des problèmes, n'hésitez pas à nous contacter.</p>
                                <p>Cordialement,</p>
                                <p><strong>L'équipe pédagogique</strong></p>
                            </div>
                        </div>
                    `
                };
                
                // Envoyer l'email
                const info = await transporter.sendMail(mailOptions);
                return info;
            } catch (error) {
                console.error(`Erreur lors de l'envoi de l'email à ${email}:`, error);
                throw error;
            }
        }
        
        // Récupérer les enseignants selon les filtres
        const teachers = await User.find(query);
        
        if (teachers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun enseignant trouvé selon les critères spécifiés'
            });
        }
        
        // Statistiques pour le rapport
        let successCount = 0;
        let errorCount = 0;
        let results = [];
        
        // Traiter chaque enseignant
        for (const teacher of teachers) {
            try {
                // Générer un mot de passe aléatoire
                const randomPassword = generateRandomPassword();
                
                // Récupérer l'utilisateur et mettre à jour le mot de passe
                const user = await User.findById(teacher._id);
                if (!user) {
                    results.push({ email: teacher.email, success: false, message: 'Utilisateur non trouvé' });
                    errorCount++;
                    continue;
                }
                
                // Mettre à jour le mot de passe
                user.password = randomPassword;
                
                // Sauvegarder pour déclencher le middleware de hachage
                await user.save();
                
                // Envoyer l'email avec les identifiants
                await sendCredentialsEmail(teacher.email, randomPassword);
                
                results.push({ email: teacher.email, success: true });
                successCount++;
                
                // Petite pause pour éviter les limitations des serveurs d'email
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                results.push({ email: teacher.email, success: false, message: error.message });
                errorCount++;
            }
        }
        
        // Retourner le rapport d'envoi
        res.json({
            success: true,
            totalEmails: teachers.length,
            successCount,
            errorCount,
            results
        });
        
    } catch (error) {
        next(error);
    }
});

// Route pour créer un nouvel utilisateur (enseignant)
router.post('/create-user', async (req, res, next) => {
    try {
        const { username, email, role } = req.body;

        // Vérifier que tous les champs nécessaires sont fournis
        if (!username || !email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Veuillez fournir un nom d\'utilisateur, un email et un rôle'
            });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() },
                { username: username.toLowerCase() }
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Un utilisateur avec cet email ou ce nom d\'utilisateur existe déjà'
            });
        }

        // Vérifier que le rôle est valide
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Le rôle doit être "user" ou "admin"'
            });
        }

        // Vérifier que l'utilisateur a les droits pour créer un admin
        if (role === 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Seul un superadmin peut créer un administrateur'
            });
        }

        // Générer un mot de passe aléatoire
        const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).toUpperCase().slice(-4);

        // Créer l'utilisateur
        const newUser = new User({
            username,
            email: email.toLowerCase(),
            password,
            role,
            promotedBy: role === 'admin' ? req.user._id : null
        });

        // Enregistrer l'utilisateur
        await newUser.save();

        // Ne pas renvoyer le mot de passe dans la réponse
        const userResponse = {
            _id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            date_creation: newUser.date_creation
        };

        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            data: userResponse,
            // Inclure le mot de passe généré pour affichage unique
            password
        });
    } catch (error) {
        next(error);
    }
});

// Récupérer les utilisateurs avec leur statut en ligne/hors ligne
router.get('/users-status', async (req, res, next) => {
    try {
        // Récupérer les utilisateurs (principalement les enseignants)
        const users = await User.find({ role: 'user' }).select('-password');
        
        // Récupérer les informations de présence
        const presences = await UserPresence.find({
            user: { $in: users.map(u => u._id) }
        });
        
        // Créer un map pour un accès rapide
        const presenceMap = {};
        presences.forEach(presence => {
            presenceMap[presence.user.toString()] = {
                status: presence.status,
                lastActive: presence.lastActive
            };
        });
        
        // Ajouter le statut à chaque utilisateur
        const usersWithStatus = users.map(user => {
            const presence = presenceMap[user._id.toString()] || { status: 'offline', lastActive: null };
            return {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture,
                status: presence.status,
                lastActive: presence.lastActive
            };
        });
        
        res.json({
            success: true,
            count: usersWithStatus.length,
            users: usersWithStatus
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du statut des utilisateurs:', error);
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

// Routes pour la gestion de l'état du site
// Récupérer l'état actuel du site
router.get('/site-status', async (req, res, next) => {
    try {
        const settings = await SystemSettings.getSiteStatus();
        
        // Récupérer l'utilisateur qui a fait la dernière modification
        let lastModifiedBy = null;
        if (settings.lastModifiedBy) {
            lastModifiedBy = await User.findById(settings.lastModifiedBy).select('username email');
        }
        
        res.json({
            success: true,
            siteStatus: settings.siteStatus,
            lockMessage: settings.lockMessage,
            lastModifiedBy,
            lastModifiedAt: settings.lastModifiedAt
        });
    } catch (error) {
        next(error);
    }
});

// Mettre à jour l'état du site
router.put('/site-status', async (req, res, next) => {
    try {
        const { status, message } = req.body;
        
        // Vérifier que le statut est valide
        if (!['active', 'locked'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Le statut du site doit être "active" ou "locked"'
            });
        }
        
        // Mettre à jour l'état du site
        const settings = await SystemSettings.updateSiteStatus(status, message, req.user._id);
        
        // Enregistrer l'action dans les logs (vous pouvez implémenter un système de logs séparé)
        console.log(`Site ${status === 'active' ? 'débloqué' : 'bloqué'} par ${req.user.username} (${req.user._id}) à ${new Date()}`);
        
        res.json({
            success: true,
            siteStatus: settings.siteStatus,
            lockMessage: settings.lockMessage,
            lastModifiedBy: req.user._id,
            lastModifiedAt: settings.lastModifiedAt
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router; 