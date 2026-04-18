import { DetailedEvaluationGridTemplate } from './index.js';

export const datasetGrid: DetailedEvaluationGridTemplate = {
  type: "dataset",
  categories: [
    {
      category: "Qualité et intégrité des données",
      weight: 0.30,
      type: "objective",
      subcriteria: [
        {
          criterion: "Complétude et cohérence",
          description: "Absence de données manquantes ou incohérentes",
          metrics: [
            "Taux de valeurs manquantes < 5% (ou justifié et documenté)",
            "Pas de doublons non intentionnels",
            "Types de données cohérents (pas de chaînes dans colonnes numériques)",
            "Formats homogènes (dates, nombres, textes standardisés)"
          ],
          scoringGuide: {
            excellent: "8-9: Données complètes, aucune incohérence, formats parfaits",
            good: "5-7: Quelques valeurs manquantes justifiées, cohérence globale respectée",
            average: "2-4: Données partiellement incomplètes ou incohérences mineures",
            poor: "0-1: Données très incomplètes ou incohérences majeures"
          }
        },
        {
          criterion: "Validité et exactitude",
          description: "Correction et fiabilité des données collectées",
          metrics: [
            "Validation des valeurs (ranges attendus, contraintes métier respectées)",
            "Labels/annotations correctes (échantillonnage vérifié)",
            "Pas d'outliers aberrants non documentés",
            "Sources fiables et vérifiées"
          ],
          scoringGuide: {
            excellent: "8-9: Validation complète, échantillons vérifiés, exactitude garantie",
            good: "5-7: Validation des champs critiques, qualité globale correcte",
            average: "2-4: Validation partielle, quelques erreurs détectées",
            poor: "0-1: Données non validées ou erreurs nombreuses"
          }
        },
        {
          criterion: "Volume et représentativité",
          description: "Quantité et couverture appropriées du domaine",
          metrics: [
            "Taille du dataset adaptée au problème (suffisante pour entraînement)",
            "Distribution représentative (pas de biais de sélection évidents)",
            "Couverture des cas d'usage et edge cases",
            "Équilibre des classes si classification (ou déséquilibre documenté)"
          ],
          scoringGuide: {
            excellent: "8-9: Volume optimal, représentativité excellente, couverture complète",
            good: "5-7: Volume suffisant, bonne représentativité générale",
            average: "2-4: Volume minimal ou biais de représentativité",
            poor: "0-1: Volume insuffisant ou biais majeurs non documentés"
          }
        }
      ]
    },

    {
      category: "Documentation et traçabilité",
      weight: 0.25,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Documentation du dataset",
          description: "Description complète et exploitable du dataset",
          indicators: [
            "README avec contexte, source, date de collecte, licence",
            "Description de chaque champ/colonne (type, signification, unités, ranges)",
            "Statistiques descriptives (distributions, cardinalités, corrélations clés)",
            "Cas d'usage documentés et limitations connues"
          ],
          scoringGuide: {
            excellent: "8-9: Documentation exhaustive type Datasheet for Datasets, immédiatement exploitable",
            good: "5-7: Documentation solide, champs décrits, contexte clair",
            average: "2-4: Documentation minimale, certaines infos manquantes",
            poor: "0-1: Pas de documentation ou doc trompeuse/obsolète"
          }
        },
        {
          criterion: "Provenance et versioning",
          description: "Traçabilité de l'origine et des transformations",
          indicators: [
            "Sources des données clairement identifiées et citées",
            "Méthodologie de collecte/annotation documentée",
            "Historique des transformations (pipeline, scripts de nettoyage)",
            "Versioning du dataset (hash, DVC, tags avec changelog)"
          ],
          scoringGuide: {
            excellent: "8-9: Provenance complète, versioning rigoureux, reproductibilité garantie",
            good: "5-7: Sources documentées, versions identifiées",
            average: "2-4: Provenance partielle ou versioning basique",
            poor: "0-1: Origine floue ou pas de versioning"
          }
        },
        {
          criterion: "Métadonnées et schéma",
          description: "Schéma formel et métadonnées structurées",
          indicators: [
            "Schéma de données formalisé (JSON schema, Protobuf, Avro...)",
            "Métadonnées riches (auteur, date, taille, format, encodage)",
            "Taxonomie ou ontologie si applicable (labels hiérarchiques, relations)",
            "Exemples représentatifs fournis"
          ],
          scoringGuide: {
            excellent: "8-9: Schéma formel complet, métadonnées structurées, taxonomie claire",
            good: "5-7: Schéma présent, métadonnées de base documentées",
            average: "2-4: Schéma implicite ou métadonnées incomplètes",
            poor: "0-1: Pas de schéma ni métadonnées"
          }
        }
      ]
    },

    {
      category: "Préparation et structuration",
      weight: 0.18,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Nettoyage et prétraitement",
          description: "Qualité du pipeline de nettoyage appliqué",
          indicators: [
            "Données nettoyées de manière reproductible (scripts versionnés)",
            "Gestion appropriée des valeurs manquantes (imputation ou suppression justifiée)",
            "Normalisation/standardisation documentée (méthode, paramètres)",
            "Outliers traités de manière justifiée (suppression, transformation, conservation)"
          ],
          scoringGuide: {
            excellent: "8-9: Pipeline de nettoyage rigoureux, reproductible, toutes décisions justifiées",
            good: "5-7: Nettoyage correct, principales transformations documentées",
            average: "2-4: Nettoyage basique, certaines décisions non justifiées",
            poor: "0-1: Données brutes non nettoyées ou nettoyage inadéquat"
          }
        },
        {
          criterion: "Structuration et format",
          description: "Organisation et format des données",
          indicators: [
            "Format adapté au cas d'usage (CSV, Parquet, JSON, HDF5, TFRecord...)",
            "Structure logique (répertoires, splits train/val/test si applicable)",
            "Encodage correct et documenté (UTF-8, types numpy/pandas appropriés)",
            "Compression si pertinent (taille optimisée sans perte d'info)"
          ],
          scoringGuide: {
            excellent: "8-9: Format optimal, structure claire, facilement chargeable",
            good: "5-7: Format approprié, structure correcte",
            average: "2-4: Format acceptable mais non optimal ou structure confuse",
            poor: "0-1: Format inadapté ou structure chaotique"
          }
        },
        {
          criterion: "Splits et échantillonnage",
          description: "Découpage train/val/test et stratégies d'échantillonnage",
          indicators: [
            "Splits clairement définis et reproductibles (seeds documentés)",
            "Stratification si nécessaire (distribution classes préservée)",
            "Pas de data leakage entre splits (temporel respecté si séries temporelles)",
            "Ratios justifiés (ex: 70/15/15, 80/10/10 selon taille dataset)"
          ],
          scoringGuide: {
            excellent: "8-9: Splits rigoureux, stratifiés si besoin, leakage impossible",
            good: "5-7: Splits corrects et reproductibles",
            average: "2-4: Splits basiques, stratification manquante si nécessaire",
            poor: "0-1: Pas de splits ou data leakage présent"
          }
        }
      ]
    },

    {
      category: "Conformité et éthique",
      weight: 0.15,
      type: "objective",
      subcriteria: [
        {
          criterion: "Licences et droits d'usage",
          description: "Conformité légale et licences appropriées",
          indicators: [
            "Licence clairement spécifiée (CC-BY, CC0, propriétaire...)",
            "Droits d'usage vérifiés pour données tierces",
            "Attributions correctes si requis par licence source",
            "Restrictions d'usage documentées si applicable"
          ],
          scoringGuide: {
            excellent: "8-9: Licence claire, droits vérifiés, attributions complètes",
            good: "5-7: Licence spécifiée, droits principaux vérifiés",
            average: "2-4: Licence floue ou vérifications partielles",
            poor: "0-1: Pas de licence ou violation de droits"
          }
        },
        {
          criterion: "Vie privée et protection des données",
          description: "Respect de la vie privée et RGPD/conformité",
          indicators: [
            "Données personnelles anonymisées ou pseudonymisées",
            "Pas d'informations sensibles exposées (emails, adresses, SSN...)",
            "Consentement obtenu si données personnelles collectées",
            "Conformité RGPD/CCPA si applicable (droit à l'oubli, portabilité)"
          ],
          scoringGuide: {
            excellent: "8-9: Anonymisation rigoureuse, conformité totale, consentements documentés",
            good: "5-7: Données sensibles protégées, conformité de base respectée",
            average: "2-4: Protection partielle ou zones grises",
            poor: "0-1: Données sensibles exposées ou non-conformité"
          }
        },
        {
          criterion: "Biais et équité",
          description: "Identification et mitigation des biais",
          indicators: [
            "Analyse de biais effectuée (genre, âge, origine géographique...)",
            "Représentation équitable des sous-groupes ou déséquilibres documentés",
            "Biais de collecte/annotation identifiés et quantifiés",
            "Mesures de mitigation prises ou recommandations fournies"
          ],
          scoringGuide: {
            excellent: "8-9: Analyse complète, biais quantifiés, mitigation appliquée",
            good: "5-7: Biais principaux identifiés et documentés",
            average: "2-4: Analyse superficielle ou biais non quantifiés",
            poor: "0-1: Pas d'analyse de biais ou biais évidents ignorés"
          }
        }
      ]
    },

    {
      category: "Utilisabilité et accessibilité",
      weight: 0.12,
      type: "contextual",
      subcriteria: [
        {
          criterion: "Facilité d'accès et de chargement",
          description: "Dataset facile à obtenir et charger",
          indicators: [
            "Accès simple (URL publique, API, package pip/conda...)",
            "Scripts de chargement fournis (Python, R, Julia...)",
            "Taille et format adaptés (pas de téléchargement prohibitif)",
            "Exemples d'utilisation (notebooks, tutoriels)"
          ],
          scoringGuide: {
            excellent: "8-9: Dataset immédiatement utilisable, scripts fournis, exemples complets",
            good: "5-7: Accessible facilement, chargement documenté",
            average: "2-4: Accessible mais nécessite efforts, peu d'exemples",
            poor: "0-1: Difficile d'accès ou format obscur"
          }
        },
        {
          criterion: "Interopérabilité",
          description: "Compatibilité avec outils ML standards",
          indicators: [
            "Format compatible avec librairies courantes (pandas, PyTorch, TF, HuggingFace...)",
            "API standardisée si applicable (Dataset Hugging Face, TorchVision...)",
            "Pas de dépendances obscures ou obsolètes",
            "Conversion facile vers autres formats si besoin"
          ],
          scoringGuide: {
            excellent: "8-9: Compatible nativement avec écosystèmes ML majeurs",
            good: "5-7: Compatible avec outils standards moyennant conversion simple",
            average: "2-4: Nécessite adaptations ou dépendances spécifiques",
            poor: "0-1: Format propriétaire ou incompatible"
          }
        }
      ]
    }
  ],

  instructions: `
## Instructions d'évaluation pour l'agent IA

### 1. SCORING PAR CRITÈRE
Pour chaque sous-critère :
1. Identifier les indicateurs applicables au type de dataset (tabulaire, image, texte, audio, vidéo...)
2. Évaluer selon le scoringGuide fourni
3. Attribuer un score 0-9
4. **Justifier le score avec des exemples concrets (stats, fichiers, scripts)**

### 2. ADAPTATION AU TYPE DE DATASET
- **Tabulaire (CSV, Parquet)** : Focus sur complétude, schéma, stats descriptives
- **Images/Vidéos** : Résolution, format, métadonnées EXIF, diversité visuelle
- **Texte/NLP** : Tokenization, langue, longueur, diversité lexicale
- **Audio** : Sample rate, durée, format, transcriptions si applicable
- **Multimodal** : Alignement entre modalités, synchronisation

### 3. GESTION DE LA SUBJECTIVITÉ
- **Critères objectifs** : Métriques mesurables (taille, complétude, formats)
- **Critères mixtes** : Combiner métriques + jugement (représentativité, qualité annotations)
- **Critères contextuels** : Si contexte insuffisant (usage prévu inconnu), marquer "Non évaluable - contexte manquant"

### 4. SPÉCIFICITÉS DATASETS
- **Data leakage** : TOUJOURS critique, vérifier splits rigoureusement
- **Licences** : Vérifier compatibilité avec usage prévu (recherche, commercial)
- **Biais** : Particulièrement important pour datasets utilisés en production
- **Reproductibilité** : Seeds, scripts de collecte/nettoyage versionnés

### 5. RECOMMANDATIONS
- Être **factuel et constructif**, citer stats concrètes
- Reconnaître les **compromis** (taille vs qualité, diversité vs cohérence)
- Si un critère n'est pas applicable (ex: splits pour dataset non-ML), marquer N/A
- Suggérer améliorations concrètes (outils, méthodes)

### 6. CALIBRATION
- **8-9** : Dataset publication-ready, référence dans le domaine
- **5-7** : Dataset utilisable en production avec nettoyage mineur
- **2-4** : Dataset exploratoire, nécessite travail avant usage sérieux
- **0-1** : Dataset inutilisable ou problèmes critiques (biais, leakage, illégal)

### 7. LIMITATIONS À RECONNAÎTRE
- Admettre l'incertitude sur critères subjectifs (représentativité, qualité annotations à grande échelle)
- Ne pas pénaliser pour limitations inhérentes au domaine (ex: dataset médical petit car données rares)
- Contextualiser selon l'objectif (dataset exploratoire vs production)
  `.trim()
};
