const mongoose = require('mongoose');
const Niveau = require('../models/Niveau');
const Specialite = require('../models/Specialite');
const Module = require('../models/Module');
const path = require('path');
const dotenv = require('dotenv');

// Charger les variables d'environnement depuis le bon chemin
dotenv.config({ path: path.join(__dirname, '../.env') });

// Vérifier que MONGO_URI est défini
if (!process.env.MONGO_URI) {
    console.error('Erreur: MONGO_URI n\'est pas défini dans le fichier .env');
    process.exit(1);
}

const niveauxData = [
    { nom: 'L1', type: 'LMD' },
    { nom: 'L2', type: 'LMD' },
    { nom: 'L3', type: 'LMD' },
    { nom: 'M1', type: 'LMD' },
    { nom: 'M2', type: 'LMD' },
    { nom: '4ème année ingénieur', type: 'Ingénieur' },
    { nom: '5ème année ingénieur', type: 'Ingénieur' }
];

const specialitesData = {
    'L1': [
        'L1 Ingénieur',
        'L1 Info LMD',
        'L1 SIGL à distance'
    ],
    'L2': [
        'L2 Ingénieur',
        'L2 ACAD',
        'L2 GTR',
        'L2 ISIL'
    ],
    'L3': [
        'L3 ACAD',
        'L3 ISIL',
        'L3 GTR',
        '3ème année Ingénieur Cyber sécurité',
        '3ème année Ingénieur Software Engineering',
        '3ème année Ingénieur AI'
    ],
    'M1': [
        'M1 SII',
        'M1 BIOINFO',
        'M1 IV',
        'M1 BIGDATA',
        'M1 HPC',
        'M1 IL',
        'M1 SSI',
        'M1 RSD'
    ],
    'M2': [
        'M2 SII',
        'M2 BIOINFO',
        'M2 IV',
        'M2 BIGDATA',
        'M2 HPC',
        'M2 IL',
        'M2 SSI',
        'M2 RSD'
    ],
    '4ème année ingénieur': [
        '4ème année Ingénieur Cyber sécurité',
        '4ème année Ingénieur Software Engineering',
        '4ème année Ingénieur AI'
    ],
    '5ème année ingénieur': [
        '5ème année Ingénieur Cyber sécurité',
        '5ème année Ingénieur Software Engineering',
        '5ème année Ingénieur AI'
    ]
};

const modulesL1InfoLMD = {
    'S1': [
        { nom: 'Physique 1 (mécanique du point)', nature: ['Cours', 'TD'] },
        { nom: 'Algèbre 1', nature: ['Cours', 'TD'] },
        { nom: 'Analyse 1', nature: ['Cours', 'TD'] },
        { nom: 'Algorithmique et structure de données 1', nature: ['Cours', 'TD', 'TP'] },
        { nom: 'Structure machine 1', nature: ['Cours', 'TD', 'TP'] },
        { nom: 'Langue étrangère 1', nature: ['Cours', 'TD'] },
        { nom: 'Terminologie scientifique et expression écrite', nature: ['Cours', 'TD'] }
    ],
    'S2': [
        { nom: 'Algèbre 2', nature: ['Cours', 'TD'] },
        { nom: 'Analyse 2', nature: ['Cours', 'TD'] },
        { nom: 'Algorithmique et structure de données 2', nature: ['Cours', 'TD', 'TP'] },
        { nom: 'Structure machine 2', nature: ['Cours', 'TD', 'TP'] },
        { nom: 'Introduction aux probabilités et statistique', nature: ['Cours', 'TD'] },
        { nom: 'Outils de programmation', nature: ['Cours', 'TD', 'TP'] },
        { nom: 'Technologie de l\'information et de la communication', nature: ['Cours', 'TD'] },
        { nom: 'Physique 2 (électricité générale)', nature: ['Cours', 'TD'] }
    ]
};

const modulesL1SIGL = {
    'S1': [
        { nom: 'Option 1 (codage et représentation de l\'information)', nature: ['Cours', 'TD'] },
        { nom: 'Option 2 (Mécanique du point/composants)', nature: ['Cours', 'TD'] },
        { nom: 'Algèbre 1', nature: ['Cours', 'TD'] },
        { nom: 'Analyse 1', nature: ['Cours', 'TD'] },
        { nom: 'Initiation à l\'algorithmique', nature: ['Cours', 'TD', 'TP'] },
        { nom: 'Technique de l\'information et de la communication', nature: ['Cours', 'TD'] },
        { nom: 'Terminologie scientifique et expression écrite', nature: ['Cours', 'TD'] },
        { nom: 'Anglais: langue étrangère', nature: ['Cours', 'TD'] }
    ]
};

async function initializeDB() {
    try {
        console.log('Tentative de connexion à MongoDB avec URI:', process.env.MONGO_URI);
        
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connecté à MongoDB');

        // Nettoyer la base de données
        await Niveau.deleteMany({});
        await Specialite.deleteMany({});
        await Module.deleteMany({});
        console.log('Base de données nettoyée');

        // Créer les niveaux
        const niveaux = await Niveau.insertMany(niveauxData);
        console.log('Niveaux créés');

        // Créer les spécialités et les modules
        for (const niveau of niveaux) {
            const specialites = specialitesData[niveau.nom] || [];
            const specialitesIds = [];

            for (const nomSpecialite of specialites) {
                const specialite = await Specialite.create({
                    nom: nomSpecialite,
                    niveau: niveau._id
                });
                specialitesIds.push(specialite._id);

                // Ajouter les modules pour L1 Info LMD
                if (nomSpecialite === 'L1 Info LMD') {
                    for (const [semestre, modules] of Object.entries(modulesL1InfoLMD)) {
                        for (const moduleData of modules) {
                            await Module.create({
                                ...moduleData,
                                specialite: specialite._id,
                                semestre: parseInt(semestre.replace('S', ''))
                            });
                        }
                    }
                }

                // Ajouter les modules pour L1 SIGL
                if (nomSpecialite === 'L1 SIGL à distance') {
                    for (const [semestre, modules] of Object.entries(modulesL1SIGL)) {
                        for (const moduleData of modules) {
                            await Module.create({
                                ...moduleData,
                                specialite: specialite._id,
                                semestre: parseInt(semestre.replace('S', ''))
                            });
                        }
                    }
                }
            }

            // Mettre à jour le niveau avec les IDs des spécialités
            await Niveau.findByIdAndUpdate(niveau._id, {
                specialites: specialitesIds
            });
        }

        console.log('Base de données initialisée avec succès');
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la base de données:', error);
        process.exit(1);
    }
}

initializeDB(); 