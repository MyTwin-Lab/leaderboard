import { DetailedEvaluationGridTemplate } from './index.js';

export const modelGrid: DetailedEvaluationGridTemplate = {
  type: "model",
  categories: [
    {
      category: "Performance et résultats",
      weight: 0.28,
      type: "objective",
      subcriteria: [
        {
          criterion: "Métriques et benchmarks",
          description: "Performance mesurée du modèle sur les tâches définies",
          metrics: [
            "Métriques appropriées au problème mesurées et documentées (accuracy, F1, RMSE, BLEU...)",
            "Comparaison avec baseline(s) clairement établie",
            "Performance sur train/val/test cohérente (pas d'overfitting majeur)",
            "Résultats reproductibles (variance entre runs < 5% ou documentée)"
          ],
          scoringGuide: {
            excellent: "8-9: Métriques excellentes, surpasse baselines, résultats stables et reproductibles",
            good: "5-7: Métriques solides, amélioration vs baseline, reproductibilité correcte",
            average: "2-4: Métriques acceptables mais non optimales ou variance élevée",
            poor: "0-1: Métriques faibles, pas de baseline ou résultats non reproductibles"
          }
        },
        {
          criterion: "Généralisation et robustesse",
          description: "Capacité du modèle à généraliser sur données non vues",
          metrics: [
            "Écart train/validation raisonnable (< 10% pour la plupart des cas)",
            "Performance sur test set alignée avec validation",
            "Tests sur cas limites et edge cases effectués si applicable",
            "Analyse des erreurs documentée (où échoue le modèle, pourquoi)"
          ],
          scoringGuide: {
            excellent: "8-9: Généralisation excellente, robuste aux variations, erreurs analysées",
            good: "5-7: Bonne généralisation, overfitting limité",
            average: "2-4: Overfitting modéré ou performance test < validation",
            poor: "0-1: Overfitting sévère ou échec sur test set"
          }
        },
        {
          criterion: "Efficacité et scalabilité",
          description: "Performance computationnelle et scalabilité",
          metrics: [
            "Temps d'inférence mesuré et documenté (ms par sample, throughput)",
            "Utilisation mémoire raisonnable (fit en GPU/RAM disponible)",
            "Temps d'entraînement acceptable pour itération (< 24h pour epoch ou justifié)",
            "Scalabilité testée (performance avec augmentation batch size, données)"
          ],
          scoringGuide: {
            excellent: "8-9: Inférence rapide, mémoire optimisée, scalabilité démontrée",
            good: "5-7: Performance acceptable, pas de goulots majeurs",
            average: "2-4: Lent ou gourmand mais utilisable",
            poor: "0-1: Trop lent, OOM fréquents ou non scalable"
          }
        }
      ]
    },

    {
      category: "Qualité du code d'entraînement (train.py)",
      weight: 0.22,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Structure et modularité",
          description: "Organisation du code d'entraînement",
          indicators: [
            "Séparation claire : data loading, model init, training loop, validation, logging",
            "Fonctions/classes réutilisables (custom callbacks, loss functions, metrics)",
            "Configuration externalisée (hyperparams, paths en YAML/JSON/argparse, pas hardcodés)",
            "Code DRY (pas de duplication entre train/val loops)"
          ],
          scoringGuide: {
            excellent: "8-9: Architecture modulaire exemplaire, facilement extensible",
            good: "5-7: Bonne structure, composants réutilisables",
            average: "2-4: Structure basique, quelques duplications",
            poor: "0-1: Code monolithique, config hardcodée"
          }
        },
        {
          criterion: "Gestion de l'entraînement",
          description: "Robustesse et fonctionnalités du training loop",
          indicators: [
            "Checkpointing implémenté (meilleur modèle, recovery après crash)",
            "Early stopping ou critère d'arrêt clair",
            "Learning rate scheduling si pertinent (warmup, decay, cyclic...)",
            "Gestion des erreurs (NaN detection, gradient clipping si besoin)",
            "Logging approprié (loss, metrics, hyperparams trackés avec Tensorboard/WandB/MLflow)"
          ],
          scoringGuide: {
            excellent: "8-9: Entraînement production-ready, recovery automatique, logging complet",
            good: "5-7: Checkpointing et early stopping présents, logging suffisant",
            average: "2-4: Fonctionnalités basiques, logging minimal",
            poor: "0-1: Pas de checkpointing ou logging, entraînement fragile"
          }
        },
        {
          criterion: "Reproductibilité",
          description: "Capacité à reproduire l'entraînement",
          indicators: [
            "Seeds fixés pour toutes sources d'aléatoire (numpy, torch, random, CUDA)",
            "Environnement documenté (requirements.txt avec versions exactes)",
            "Script reproductible en une commande (ou instructions claires)",
            "Artifacts versionnés (checkpoints, configs, logs avec hash ou tag)"
          ],
          scoringGuide: {
            excellent: "8-9: Reproductibilité complète garantie, one-command execution",
            good: "5-7: Seeds fixés, environnement documenté, reproductible avec effort minimal",
            average: "2-4: Partiellement reproductible, certaines infos manquantes",
            poor: "0-1: Impossible à reproduire"
          }
        }
      ]
    },

    {
      category: "Qualité du code d'inférence (inference.py)",
      weight: 0.18,
      type: "mixed",
      subcriteria: [
        {
          criterion: "API et utilisabilité",
          description: "Interface d'inférence claire et pratique",
          indicators: [
            "API simple et intuitive (fonction predict claire, inputs/outputs bien définis)",
            "Chargement de modèle facile (from checkpoint, export ONNX/TorchScript si applicable)",
            "Preprocessing intégré ou clairement documenté (transforms identiques au train)",
            "Gestion du batching pour efficacité (single sample ET batch supported)"
          ],
          scoringGuide: {
            excellent: "8-9: API production-ready, chargement trivial, preprocessing automatique",
            good: "5-7: API claire, facile à utiliser avec doc",
            average: "2-4: API fonctionnelle mais nécessite adaptations",
            poor: "0-1: API confuse ou preprocessing manquant"
          }
        },
        {
          criterion: "Robustesse et validation",
          description: "Gestion des erreurs et validation des inputs",
          indicators: [
            "Validation des inputs (shapes, types, ranges attendus)",
            "Gestion des erreurs avec messages clairs (model not found, invalid input...)",
            "Tests unitaires pour inférence (forward pass, shapes, edge cases)",
            "Mode eval explicite (torch.no_grad(), model.eval())"
          ],
          scoringGuide: {
            excellent: "8-9: Validation complète, tests exhaustifs, messages d'erreur informatifs",
            good: "5-7: Validation des inputs principaux, gestion erreurs de base",
            average: "2-4: Validation minimale, peu de tests",
            poor: "0-1: Pas de validation, crashes sur inputs inattendus"
          }
        },
        {
          criterion: "Performance et optimisation",
          description: "Efficacité du code d'inférence",
          indicators: [
            "Optimisations appliquées (torch.compile, TensorRT, quantization si pertinent)",
            "Gestion mémoire efficace (batch size adaptatif, gradient désactivé)",
            "Device management clair (CPU/GPU auto-detect ou configurable)",
            "Benchmarks d'inférence fournis (latency, throughput)"
          ],
          scoringGuide: {
            excellent: "8-9: Optimisations avancées, benchmarks complets, très performant",
            good: "5-7: Optimisations de base, performance correcte",
            average: "2-4: Non optimisé mais fonctionnel",
            poor: "0-1: Lent, memory leaks ou device issues"
          }
        }
      ]
    },

    {
      category: "Architecture du modèle",
      weight: 0.15,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Choix architectural",
          description: "Pertinence et justification de l'architecture",
          indicators: [
            "Architecture adaptée au problème (CNN pour images, Transformer pour séquences...)",
            "Choix justifié (pourquoi cette archi vs alternatives)",
            "Complexité appropriée (pas d'over-engineering ni de sous-dimensionnement)",
            "Innovation ou adaptation pertinente si custom architecture"
          ],
          scoringGuide: {
            excellent: "8-9: Architecture optimale, choix brillamment justifié, innovation pertinente",
            good: "5-7: Architecture solide et bien motivée",
            average: "2-4: Architecture correcte mais peu justifiée",
            poor: "0-1: Architecture inadaptée ou arbitraire"
          }
        },
        {
          criterion: "Implémentation du modèle",
          description: "Qualité du code de l'architecture",
          indicators: [
            "Code modulaire (layers/blocks réutilisables)",
            "Forward pass clair et lisible",
            "Gestion des dimensions explicite (commentaires sur shapes si complexe)",
            "Utilisation idiomatique du framework (PyTorch, TensorFlow, JAX...)"
          ],
          scoringGuide: {
            excellent: "8-9: Code exemplaire, facilement extensible, shapes documentées",
            good: "5-7: Code propre et maintenable",
            average: "2-4: Code fonctionnel mais confus ou peu modulaire",
            poor: "0-1: Code difficile à comprendre ou modifier"
          }
        }
      ]
    },

    {
      category: "Documentation et reproductibilité",
      weight: 0.10,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Documentation technique",
          description: "Qualité de la documentation fournie",
          indicators: [
            "README complet (objectif, architecture, résultats, usage train/inference)",
            "Docstrings pour classes/fonctions principales",
            "Hyperparamètres documentés (ranges testés, valeurs finales, justification)",
            "Exemples d'utilisation fournis (notebooks, scripts démo)"
          ],
          scoringGuide: {
            excellent: "8-9: Documentation exhaustive, exemples complets, prise en main immédiate",
            good: "5-7: Documentation solide, usage clair",
            average: "2-4: Documentation minimale, certaines infos manquantes",
            poor: "0-1: Pas de documentation ou doc trompeuse"
          }
        },
        {
          criterion: "Résultats et analyse",
          description: "Documentation des expérimentations et résultats",
          indicators: [
            "Résultats clairement présentés (tableaux, courbes loss/metrics)",
            "Comparaison avec baselines documentée",
            "Analyse des forces/faiblesses du modèle",
            "Next steps ou améliorations suggérées"
          ],
          scoringGuide: {
            excellent: "8-9: Analyse approfondie, visualisations claires, insights exploitables",
            good: "5-7: Résultats bien présentés, comparaisons claires",
            average: "2-4: Résultats présents mais peu analysés",
            poor: "0-1: Résultats absents ou incompréhensibles"
          }
        }
      ]
    },

    {
      category: "Qualité des données et preprocessing",
      weight: 0.07,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Pipeline de données",
          description: "Qualité du data loading et preprocessing",
          indicators: [
            "DataLoader/Dataset efficace (prefetch, multiprocessing si pertinent)",
            "Augmentations/transformations appropriées et documentées",
            "Pas de data leakage (preprocessing cohérent train/val/test)",
            "Gestion des edge cases (empty batch, missing data)"
          ],
          scoringGuide: {
            excellent: "8-9: Pipeline optimisé, augmentations pertinentes, no leakage garanti",
            good: "5-7: Pipeline correct et efficace",
            average: "2-4: Pipeline basique, quelques inefficacités",
            poor: "0-1: Data leakage ou pipeline inefficace"
          }
        }
      ]
    }
  ],

  instructions: `
## Instructions d'évaluation pour l'agent IA

### 1. SCORING PAR CRITÈRE
Pour chaque sous-critère :
1. Examiner les fichiers pertinents (train.py, inference.py, model.py, configs, README, résultats)
2. Identifier les indicateurs applicables
3. Évaluer selon le scoringGuide fourni
4. **Justifier avec exemples concrets du code et métriques**

### 2. STRUCTURE ATTENDUE D'UNE CONTRIBUTION MODÈLE
Fichiers typiques à évaluer :
- \`train.py\` ou \`train.ipynb\` : Script d'entraînement
- \`inference.py\` ou \`predict.py\` : Script d'inférence/prédiction
- \`model.py\` ou architecture dans notebooks : Définition du modèle
- \`config.yaml/json\` ou argparse : Configuration hyperparamètres
- \`requirements.txt\` : Dépendances
- \`README.md\` : Documentation
- \`checkpoints/\` : Modèles sauvegardés
- \`results/\` ou \`logs/\` : Métriques, courbes, logs
- \`data/\` ou scripts data : Pipeline de données

### 3. ADAPTATION AU TYPE DE MODÈLE
- **Vision (CNN, ViT)** : Résolution images, augmentations, metrics (mAP, IoU...)
- **NLP (Transformer, RNN)** : Tokenization, seq length, metrics (BLEU, perplexity...)
- **Tabular (RF, XGBoost, MLP)** : Feature engineering, metrics (AUC, RMSE...)
- **Audio** : Sample rate, spectrogrammes, metrics (WER, MOS...)
- **Reinforcement Learning** : Reward curve, policy, environnement

### 4. POINTS D'ATTENTION CRITIQUES
- **Data leakage** : Vérifier preprocessing identique train/test, splits corrects
- **Reproductibilité** : Seeds partout (numpy, torch, random, CUDA, DataLoader workers)
- **Overfitting** : Écart train/val/test, régularisation, early stopping
- **Performance** : Temps inférence mesuré, pas juste training time
- **Baselines** : Comparaison claire avec au moins un modèle simple

### 5. GESTION DE LA SUBJECTIVITÉ
- **Critères objectifs** : Métriques mesurables (accuracy, latency, code coverage)
- **Critères mixtes** : Qualité code, choix architectural (justification requise)
- **Critères contextuels** : Si contexte manquant (tâche floue, baseline inconnue), marquer "Non évaluable"

### 6. RECOMMANDATIONS
- Être **factuel**, citer métriques et extraits de code
- Reconnaître **trade-offs ML** (accuracy vs speed, complexité vs interprétabilité)
- Si critère non applicable (ex: quantization pour petit modèle), marquer N/A
- Suggérer améliorations concrètes (hyperparams, architecture, optimisations)

### 7. CALIBRATION
- **8-9** : Publication-ready, SOTA ou très proche, code production-grade
- **5-7** : Solide, utilisable en production avec polish mineur
- **2-4** : Prototype fonctionnel, nécessite travail avant prod
- **0-1** : Non fonctionnel, résultats faibles ou code cassé

### 8. ERREURS FRÉQUENTES À DÉTECTER
- Seeds non fixés → résultats non reproductibles
- Preprocessing différent train/test → data leakage
- Pas de validation set → overfitting non détecté
- Hardcoded paths/configs → non portable
- Pas de checkpointing → perte si crash
- model.train() en inference → résultats incorrects
- Métriques non appropriées (accuracy sur dataset déséquilibré)
  `.trim()
};