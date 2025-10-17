# 🤖 Evaluator Package

Système d'évaluation automatisé des contributions basé sur des agents IA (OpenAI). Ce package identifie, évalue et attribue des récompenses aux contributions des développeurs.

## 🎯 Vue d'ensemble

Le **evaluator** est un système intelligent qui analyse les contributions (commits, code, datasets, modèles, documentation) et les évalue selon des grilles de critères prédéfinies. Il utilise des agents OpenAI pour automatiser le processus d'évaluation.

## 🏗️ Architecture

```
evaluator/
├── evaluator.ts           # Implémentation principale (OpenAIAgentEvaluator)
├── interfaces.ts          # Interface AgentEvaluator
├── types.ts               # Types de données (Contribution, Evaluation, etc.)
├── reward.ts              # Calcul de distribution des récompenses
├── grids/                 # Grilles d'évaluation par type
│   ├── index.ts           # Registry des grilles
│   ├── code.grid.ts       # Grille pour le code
│   ├── model.grid.ts      # Grille pour les modèles ML
│   ├── dataset.grid.ts    # Grille pour les datasets
│   └── docs.grid.ts       # Grille pour la documentation
└── openai/                # Agents OpenAI
    ├── identify.agent.ts  # Agent d'identification
    └── evaluate.agent.ts  # Agent d'évaluation
```

## 🔄 Processus d'évaluation

Le système suit un pipeline en 3 étapes :

### 1. **Identification** (`identify`)
Analyse le contexte (réunions, commits GitHub) pour identifier les contributions pertinentes.

**Entrée** : Contexte (résumé de réunion + commits + membres d'équipe)  
**Sortie** : Liste de `Contribution[]`

### 2. **Évaluation** (`evaluate`)
Évalue chaque contribution selon une grille de critères spécifique à son type.

**Entrée** : `Contribution` + contexte (snapshot du code + grille d'évaluation)  
**Sortie** : `Evaluation` avec scores détaillés

### 3. **Agrégation** (`aggregate`)
Calcule le score final pondéré à partir des scores individuels.

**Entrée** : `Evaluation`  
**Sortie** : Score global (0-100)

## 📊 Types de données

### **Contribution**
Représente une contribution identifiée à évaluer.

```typescript
interface Contribution {
  title: string;           // Titre de la contribution
  type: string;            // Type: "code" | "model" | "dataset" | "docs"
  description?: string;    // Description détaillée
  challenge_id: string;    // ID du challenge associé
  tags?: string[];         // Tags techniques (NextJS, MONAI, etc.)
  userId: string;          // ID de l'utilisateur
  commitSha: string;       // SHA du commit GitHub
}
```

### **CriterionScore**
Score individuel sur un critère d'évaluation.

```typescript
interface CriterionScore {
  criterion: string;       // Nom du critère (qualité, impact, etc.)
  score: number;           // Score de 0 à 100
  weight: number;          // Poids du critère (0.0 à 1.0)
  comment?: string;        // Justification du score
}
```

### **Evaluation**
Résultat complet de l'évaluation d'une contribution.

```typescript
interface Evaluation {
  scores: CriterionScore[];       // Scores par critère
  globalScore: number;            // Score global pondéré
  contribution?: Contribution;    // Contribution évaluée
}
```

### **ContributionReward**
Récompense attribuée à une contribution.

```typescript
interface ContributionReward {
  userId: string;
  contributionTitle: string;
  score: number;           // Score obtenu
  reward: number;          // Contribution Points (CP) attribués
}
```

## 🎓 Grilles d'évaluation

Les grilles définissent les critères et leur pondération pour chaque type de contribution.

### **Code Grid** (`code`)

```typescript
{
  type: "code",
  criteriaTemplate: [
    { criterion: "qualité", weight: 0.2 },
    { criterion: "impact", weight: 0.3 },
    { criterion: "complexité", weight: 0.3 },
    { criterion: "architecture", weight: 0.2 }
  ]
}
```

**Critères** :
- **Qualité** (20%) : Propreté, lisibilité, conventions
- **Impact** (30%) : Importance fonctionnelle, valeur ajoutée
- **Complexité** (30%) : Difficulté technique, innovation
- **Architecture** (20%) : Design patterns, scalabilité

### **Model Grid** (`model`)
Grille pour les modèles de machine learning.

### **Dataset Grid** (`dataset`)
Grille pour les datasets et données.

### **Docs Grid** (`docs`)
Grille pour la documentation.

### **Registry des grilles**

```typescript
import { EvaluationGridRegistry } from "@mytwin/evaluator";

// Récupérer une grille
const grid = EvaluationGridRegistry.getGrid("code");

// Vérifier l'existence
if (EvaluationGridRegistry.hasGrid("model")) { ... }

// Lister les types disponibles
const types = EvaluationGridRegistry.getAvailableTypes();
// ["code", "model", "dataset", "docs"]
```

## 🤖 Agents OpenAI

### **Identify Agent**
Agent qui identifie les contributions à partir d'un contexte.

**Fonctionnement** :
1. Reçoit un contexte (résumé de réunion + commits + équipe)
2. Analyse et extrait les contributions pertinentes
3. Évite les doublons
4. Lie chaque contribution à un commit GitHub
5. Retourne un tableau JSON de contributions

**Contraintes** :
- Types autorisés : `"code"`, `"model"`, `"dataset"`, `"docs"`
- Obligation de lier chaque contribution à un commit
- Détection automatique des doublons

### **Evaluate Agent**
Agent qui évalue une contribution selon une grille de critères.

**Fonctionnement** :
1. Reçoit une contribution + snapshot du code + grille d'évaluation
2. Utilise l'outil `read_file` pour lire les fichiers nécessaires
3. Analyse le code selon les critères de la grille
4. Attribue un score (0-100) et un commentaire par critère
5. Retourne une évaluation structurée

**Outil disponible** : `read_file(path)`
- Permet à l'agent de lire des fichiers dans le workspace du commit
- Utilisé pour analyser le code en profondeur

**Boucle de tool calls** :
L'agent peut faire plusieurs appels à `read_file` avant de produire son évaluation finale.

## 💰 Calcul des récompenses

La fonction `computeRewards` distribue un pool de Contribution Points (CP) proportionnellement aux scores.

### Algorithme

```typescript
import { computeRewards } from "@mytwin/evaluator";

const rewards = computeRewards(evaluations, totalRewardPool);
```

**Étapes** :
1. Calcul du score total : `Σ(globalScore)`
2. Calcul de la proportion de chaque contribution : `score / totalScore`
3. Attribution proportionnelle : `reward = proportion × totalRewardPool`
4. Arrondi et ajustement pour garantir la distribution exacte du pool

**Cas particuliers** :
- Si `totalScore = 0` → distribution égale
- Ajustement d'arrondi sur la dernière contribution

### Exemple

```typescript
const evaluations = [
  { globalScore: 80, contribution: { userId: "user1", title: "Feature A" } },
  { globalScore: 60, contribution: { userId: "user2", title: "Feature B" } },
  { globalScore: 40, contribution: { userId: "user3", title: "Feature C" } }
];

const rewards = computeRewards(evaluations, 1000);
// [
//   { userId: "user1", score: 80, reward: 444 },  // 80/180 × 1000
//   { userId: "user2", score: 60, reward: 333 },  // 60/180 × 1000
//   { userId: "user3", score: 40, reward: 223 }   // 40/180 × 1000 + ajustement
// ]
```

## 🚀 Utilisation

### Exemple complet

```typescript
import { OpenAIAgentEvaluator, EvaluationGridRegistry, computeRewards } from "@mytwin/evaluator";

const evaluator = new OpenAIAgentEvaluator();

// 1. Identifier les contributions
const context = {
  meetingSummary: "...",
  commits: [...],
  teamMembers: [...]
};

const contributions = await evaluator.identify(context);

// 2. Évaluer chaque contribution
const evaluations = [];
for (const contribution of contributions) {
  const grid = EvaluationGridRegistry.getGrid(contribution.type);
  const snapshot = { workspacePath: "/tmp/commit-abc123", ... };
  
  const evaluation = await evaluator.evaluate(contribution, { snapshot, grid });
  evaluation.contribution = contribution;
  evaluations.push(evaluation);
}

// 3. Calculer les scores globaux
for (const evaluation of evaluations) {
  const globalScore = evaluator.aggregate(evaluation);
  console.log(`Score: ${globalScore}/100`);
}

// 4. Distribuer les récompenses
const totalRewardPool = 1000; // CP disponibles pour ce challenge
const rewards = computeRewards(evaluations, totalRewardPool);

console.log(rewards);
// [
//   { userId: "user1", contributionTitle: "...", score: 85, reward: 425 },
//   { userId: "user2", contributionTitle: "...", score: 70, reward: 350 },
//   ...
// ]
```

## 🔧 Interface `AgentEvaluator`

Interface conceptuelle pour tout système d'évaluation.

```typescript
interface AgentEvaluator {
  identify(context: any): Promise<Contribution[]>;
  evaluate(contribution: Contribution, context: any): Promise<Evaluation>;
  aggregate(evaluation: Evaluation): number;
}
```

**Implémentation actuelle** : `OpenAIAgentEvaluator`

Permet de créer d'autres implémentations (Claude, Gemini, règles manuelles, etc.).

## ⚙️ Configuration

### Variables d'environnement

```env
OPENAI_API_KEY=sk-...
```

### Modèle utilisé

Actuellement : **`gpt-5-nano`** (peut être changé pour `gpt-4o-mini` ou autres)

## 📝 Bonnes pratiques

1. **Toujours lier une contribution à un commit** : Permet la traçabilité
2. **Utiliser les grilles appropriées** : Chaque type a ses critères spécifiques
3. **Fournir un contexte riche** : Plus le contexte est détaillé, meilleure est l'évaluation
4. **Vérifier les scores** : Les scores sont entre 0 et 100
5. **Ajuster les poids** : Modifier les grilles selon les besoins du projet

## 🎯 Points clés

- ✅ **Pipeline automatisé** : Identification → Évaluation → Récompenses
- ✅ **Grilles personnalisables** : Critères et poids adaptables par type
- ✅ **Agents IA** : Utilisation d'OpenAI pour l'analyse intelligente
- ✅ **Tool calling** : L'agent peut lire des fichiers pour analyser le code
- ✅ **Distribution proportionnelle** : Récompenses basées sur les scores
- ✅ **Type-safe** : TypeScript pour la sécurité des types
- ✅ **Extensible** : Interface permettant d'autres implémentations

## 🔮 Extensions possibles

- Ajouter de nouvelles grilles (tests, design, etc.)
- Implémenter d'autres agents (Claude, Gemini)
- Ajouter des métriques de qualité automatiques (coverage, linting)
- Intégrer des outils d'analyse statique
- Créer un système de feedback pour améliorer les évaluations
