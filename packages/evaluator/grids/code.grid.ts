import { DetailedEvaluationGridTemplate } from './index.js';

export const evaluationGrid: DetailedEvaluationGridTemplate = {
  type: "code",
  categories: [
    {
      category: "Qualité technique mesurable",
      weight: 0.25,
      type: "objective", // Critères automatiquement vérifiables
      subcriteria: [
        {
          criterion: "Complexité du code",
          description: "Complexité cyclomatique, profondeur d'imbrication, longueur des fonctions",
          metrics: [
            "Complexité cyclomatique < 10 par fonction",
            "Profondeur max d'imbrication ≤ 4",
            "Fonctions < 50 lignes (hors cas justifiés)"
          ],
          scoringGuide: {
            excellent: "8-9: Toutes les métriques respectées",
            good: "5-7: 1-2 dépassements mineurs justifiables",
            average: "2-4: Plusieurs fonctions complexes sans refactoring",
            poor: "0-1: Complexité excessive généralisée"
          }
        },
        {
          criterion: "Duplication de code",
          description: "Absence de code dupliqué, réutilisation via abstractions",
          metrics: [
            "Taux de duplication < 3%",
            "Blocs dupliqués > 6 lignes identifiés et factorisés"
          ],
          scoringGuide: {
            excellent: "8-9: Aucune duplication significative",
            good: "5-7: Duplication mineure < 3%",
            average: "2-4: Duplication 3-10%",
            poor: "0-1: Duplication > 10%"
          }
        },
        {
          criterion: "Couverture de tests",
          description: "Tests unitaires et d'intégration pour le code ajouté",
          metrics: [
            "Couverture des lignes ≥ 80% du nouveau code",
            "Tests pour les cas limites et erreurs",
            "Tests existants toujours valides (non cassés)"
          ],
          scoringGuide: {
            excellent: "8-9: Couverture ≥ 80% + cas limites",
            good: "5-7: Couverture 60-79% ou tests de base solides",
            average: "2-4: Couverture 40-59% ou tests incomplets",
            poor: "0-1: Couverture < 40% ou absence de tests"
          }
        }
      ]
    },

    {
      category: "Architecture et conception",
      weight: 0.18,
      type: "mixed", // Critères semi-objectifs avec interprétation
      subcriteria: [
        {
          criterion: "Séparation des responsabilités",
          description: "Chaque module/classe/fonction a un rôle unique et clair",
          indicators: [
            "Fonctions mono-responsabilité (Single Responsibility Principle)",
            "Couplage faible entre modules",
            "Cohésion forte au sein des modules"
          ],
          scoringGuide: {
            excellent: "8-9: Architecture claire, responsabilités bien délimitées",
            good: "5-7: Bonne structure avec quelques couplages mineurs",
            average: "2-4: Certaines fonctions/classes multi-responsabilités",
            poor: "0-1: Couplage fort, responsabilités confuses"
          }
        },
        {
          criterion: "Modularité et extensibilité",
          description: "Facilité d'ajouter de nouvelles fonctionnalités sans tout casser",
          indicators: [
            "Utilisation d'interfaces/abstractions quand approprié",
            "Dépendances injectées plutôt que hard-codées",
            "Code ouvert à l'extension, fermé à la modification (Open/Closed)"
          ],
          scoringGuide: {
            excellent: "8-9: Design patterns appropriés, extensible naturellement",
            good: "5-7: Structure modulaire solide",
            average: "2-4: Modularité partielle, quelques rigidités",
            poor: "0-1: Code monolithique, difficile à étendre"
          }
        },
        {
          criterion: "Gestion des erreurs",
          description: "Traitement robuste des cas d'erreur et edge cases",
          indicators: [
            "Validation des entrées utilisateur/API",
            "Try-catch appropriés avec messages clairs",
            "Pas de suppression silencieuse d'erreurs",
            "Logs informatifs en cas d'erreur"
          ],
          scoringGuide: {
            excellent: "8-9: Gestion complète et anticipée des erreurs",
            good: "5-7: Gestion correcte des erreurs principales",
            average: "2-4: Gestion basique, certains cas non traités",
            poor: "0-1: Absence de gestion ou gestion inadéquate"
          }
        },
        {
          criterion: "Performance et optimisation",
          description: "Efficacité algorithmique et usage des ressources",
          indicators: [
            "Complexité algorithmique appropriée (O(n), O(log n)...)",
            "Pas de requêtes N+1 ou boucles inutiles",
            "Utilisation efficace de la mémoire",
            "Caching/optimisation quand pertinent"
          ],
          scoringGuide: {
            excellent: "8-9: Optimisations pertinentes, algorithmes efficaces",
            good: "5-7: Performance correcte, pas de goulots évidents",
            average: "2-4: Quelques inefficacités mineures",
            poor: "0-1: Problèmes de performance majeurs"
          }
        }
      ]
    },

    {
      category: "Impact et valeur métier",
      weight: 0.12,
      type: "contextual", // Nécessite compréhension du projet
      subcriteria: [
        {
          criterion: "Résolution de problème",
          description: "Le commit résout effectivement le problème annoncé",
          indicators: [
            "Lien avec issue/ticket clairement résolu",
            "Fonctionnalité implémentée comme spécifiée",
            "Bug corrigé avec test de non-régression"
          ],
          scoringGuide: {
            excellent: "8-9: Résout complètement le problème + anticipe les cas limites",
            good: "5-7: Résout le problème principal",
            average: "2-4: Résolution partielle ou incomplète",
            poor: "0-1: Ne résout pas le problème ou introduit des régressions"
          }
        },
        {
          criterion: "Ampleur fonctionnelle",
          description: "Étendue et richesse de la contribution",
          indicators: [
            "Nombre de fonctionnalités/améliorations apportées",
            "Portée de l'impact (1 module vs système entier)",
            "Valeur ajoutée pour l'utilisateur final"
          ],
          scoringGuide: {
            excellent: "8-9: Contribution majeure, multi-composants, forte valeur",
            good: "5-7: Fonctionnalité complète et utile",
            average: "2-4: Amélioration mineure mais valable",
            poor: "0-1: Impact négligeable ou non pertinent"
          }
        }
      ]
    },

    {
      category: "Documentation et clarté",
      weight: 0.12,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Lisibilité du code",
          description: "Code auto-documenté, noms explicites, structure claire",
          indicators: [
            "Noms de variables/fonctions descriptifs (pas de x, tmp, data)",
            "Logique facile à suivre sans commentaires",
            "Indentation et espacement cohérents",
            "Pas de code commenté ou mort laissé en place"
          ],
          scoringGuide: {
            excellent: "8-9: Code immédiatement compréhensible",
            good: "5-7: Lisible avec effort minimal",
            average: "2-4: Nécessite concentration, quelques noms obscurs",
            poor: "0-1: Difficile à comprendre, noms cryptiques"
          }
        },
        {
          criterion: "Documentation technique",
          description: "Commentaires, docstrings, README adaptés",
          indicators: [
            "Docstrings pour fonctions publiques (params, return, exceptions)",
            "Commentaires pour logique complexe uniquement",
            "README/doc mis à jour si API publique modifiée",
            "Pas de commentaires redondants ou obsolètes"
          ],
          scoringGuide: {
            excellent: "8-9: Documentation complète, claire, à jour",
            good: "5-7: Documentation suffisante pour comprendre l'usage",
            average: "2-4: Documentation minimale ou partiellement obsolète",
            poor: "0-1: Absence de documentation ou doc trompeuse"
          }
        }
      ]
    },

    {
      category: "Sécurité et robustesse",
      weight: 0.12,
      type: "objective",
      subcriteria: [
        {
          criterion: "Validation et sanitization",
          description: "Protection contre les entrées malveillantes",
          indicators: [
            "Validation des entrées utilisateur (type, format, range)",
            "Protection contre injections (SQL, XSS, command injection)",
            "Échappement/encodage approprié des sorties",
            "Rate limiting pour APIs si applicable"
          ],
          scoringGuide: {
            excellent: "8-9: Validation complète, défense en profondeur",
            good: "5-7: Validations principales en place",
            average: "2-4: Validation basique, certains vecteurs non couverts",
            poor: "0-1: Vulnérabilités évidentes ou absence de validation"
          }
        },
        {
          criterion: "Gestion des secrets et configuration",
          description: "Pas de données sensibles exposées",
          indicators: [
            "Aucun secret en clair (API keys, passwords, tokens)",
            "Utilisation de variables d'environnement ou vault",
            "Fichiers sensibles dans .gitignore",
            "Configuration externalisée"
          ],
          scoringGuide: {
            excellent: "8-9: Aucun secret exposé, bonnes pratiques respectées",
            good: "5-7: Secrets bien gérés",
            average: "2-4: Secrets présents mais en développement uniquement",
            poor: "0-1: Secrets en production exposés dans le code"
          }
        }
      ]
    },

    {
      category: "Maintenabilité",
      weight: 0.18,
      type: "mixed",
      subcriteria: [
        {
          criterion: "Dette technique",
          description: "Le commit réduit ou n'augmente pas la dette technique",
          indicators: [
            "Refactoring de code existant quand approprié",
            "Pas de TODOs ou FIXMEs laissés sans plan",
            "Pas de workarounds temporaires qui deviennent permanents",
            "Suppression de code obsolète"
          ],
          scoringGuide: {
            excellent: "8-9: Réduit activement la dette technique",
            good: "5-7: N'augmente pas la dette",
            average: "2-4: Dette mineure acceptable à court terme",
            poor: "0-1: Augmente significativement la dette"
          }
        },
        {
          criterion: "Facilité d'évolution",
          description: "Le code sera facile à modifier dans le futur",
          indicators: [
            "Tests facilitent les modifications sans casse",
            "Abstractions permettent changements localisés",
            "Pas de couplage rigide entre composants",
            "Documentation aide à comprendre pour modifier"
          ],
          scoringGuide: {
            excellent: "8-9: Très facile à modifier et étendre",
            good: "5-7: Modifications futures raisonnablement simples",
            average: "2-4: Nécessitera efforts pour modifications",
            poor: "0-1: Difficile à modifier sans tout casser"
          }
        }
      ]
    }
  ],

  instructions: `
## Instructions d'évaluation pour l'agent IA

### 1. SCORING PAR CRITÈRE
Pour chaque sous-critère :
1. Identifier les indicateurs applicables (certains ne s'appliquent pas à tous les commits)
2. Évaluer selon le scoringGuide fourni
3. Attribuer un score 0-9
4. **Justifier le score avec des exemples concrets du code**

### 2. GESTION DE LA SUBJECTIVITÉ
- **Critères objectifs** : Se baser sur métriques mesurables
- **Critères mixtes** : Combiner métriques + analyse qualitative
- **Critères contextuels** : Si contexte insuffisant, marquer "Non évaluable - contexte manquant"

### 3. RECOMMANDATIONS
- Être **factuel et constructif**, pas moralisateur
- Reconnaître les **compromis** (ex: performance vs lisibilité)
- Si un critère n'est pas applicable (ex: sécurité pour un commit de doc), marquer N/A

### 4. CALIBRATION
- **8-9** : Exceptionnel, référence à suivre
- **5-7** : Bon, production-ready avec améliorations mineures
- **2-4** : Acceptable, nécessite révisions avant merge
- **0-1** : Problématique, refactoring majeur nécessaire

### 5. LIMITATIONS À RECONNAÎTRE
- Admettre l'incertitude sur les critères subjectifs
- Ne pas pénaliser un commit pour des problèmes pré-existants dans le code
  `.trim()
};