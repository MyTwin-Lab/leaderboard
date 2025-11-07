# 🏆 MyTwin Leaderboard

Système automatisé d'évaluation et de récompense des contributions développeurs pour des challenges de développement. Le système identifie, évalue et attribue automatiquement des points de contribution basés sur l'analyse IA des commits, du code et des documents.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Structure du projet](#structure-du-projet)
- [Packages](#packages)

## 🎯 Vue d'ensemble

**MyTwin Leaderboard** est une plateforme qui automatise l'évaluation des contributions développeurs dans le cadre de challenges de développement. Le système :

- 🔌 **Se connecte** à des services externes (GitHub, Google Drive, etc.)
- 🤖 **Identifie automatiquement** les contributions pertinentes via des agents IA
- 📊 **Évalue** chaque contribution selon des grilles de critères personnalisables
- 💰 **Distribue** des récompenses (Contribution Points) proportionnellement aux scores
- 📈 **Maintient** un leaderboard en temps réel

### Cas d'usage

Le système est conçu pour gérer des **challenges** (sprints de développement) où :

1. Une équipe travaille sur un projet avec des repositories GitHub
2. Des réunions de synchronisation sont documentées dans Google Drive
3. Le système analyse automatiquement les commits et identifie les contributions
4. Chaque contribution est évaluée selon des critères (qualité, impact, complexité, etc.)
5. À la fin du challenge, les récompenses sont distribuées proportionnellement

## 🏗️ Architecture

Le projet est organisé en **packages monorepo** avec une séparation claire des responsabilités :

```
leaderboard/
├── packages/
│   ├── connectors/          # Connecteurs externes (GitHub, Google Drive)
│   ├── database-service/     # Service de base de données PostgreSQL
│   ├── evaluator/           # Système d'évaluation IA
│   ├── services/             # Services d'orchestration
│   └── test/                 # Scripts de test
└── challenges/               # Spécifications des challenges
```

### Flux de données

```
1. Challenge Service
   ↓
2. Connectors (GitHub, Google Drive)
   ↓
3. Evaluator (Agents IA)
   ↓
4. Database Service
   ↓
5. Leaderboard
```

## ✨ Fonctionnalités

### 🔌 Connecteurs externes

- **GitHub** : Récupération des commits et contenu des fichiers modifiés
- **Google Drive** : Extraction des documents de synchronisation (Sync summaries)
- **Extensible** : Architecture permettant d'ajouter facilement de nouveaux connecteurs (HuggingFace, Slack, etc.)

### 🤖 Évaluation automatisée

- **Identification** : Agent IA qui identifie les contributions à partir des commits et réunions
- **Évaluation** : Agent IA qui évalue chaque contribution selon des grilles de critères
- **Grilles personnalisables** : Critères et poids ajustables par type (code, model, dataset, docs)
- **Tool calling** : L'agent peut lire des fichiers pour analyser le code en profondeur

### 💾 Base de données

- **PostgreSQL** avec **Drizzle ORM**
- **Validation Zod** pour toutes les entrées
- **Repositories** avec méthodes CRUD et requêtes spécialisées
- **Relations** configurées pour des jointures optimisées

### 💰 Système de récompenses

- **Distribution proportionnelle** : Les Contribution Points sont distribués selon les scores
- **Pool de récompenses** : Chaque challenge a un pool de points à distribuer
- **Calcul automatique** : Les récompenses sont calculées à la fin du challenge

## 🚀 Installation

### Prérequis

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x
- **npm** ou **yarn**

### Étapes d'installation

1. **Cloner le repository**

```bash
git clone <repository-url>
cd leaderboard
```

2. **Installer les dépendances**

```bash
npm install
# ou
yarn install
```

3. **Configurer la base de données**

Créez une base de données PostgreSQL :

```sql
CREATE DATABASE mytwin_leaderboard;
```

4. **Configurer les variables d'environnement**

Créez un fichier `.env` à la racine du projet :

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/mytwin_leaderboard

# OpenAI (pour l'évaluateur)
OPENAI_API_KEY=sk-...

# GitHub (pour les connecteurs)
GITHUB_TOKEN=ghp_xxxxx
GITHUB_OWNER=your-org

# Google Drive (pour les connecteurs)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
GOOGLE_FOLDER_ID=your-folder-id
```

5. **Initialiser la base de données**

Les schémas Drizzle sont définis dans `packages/database-service/db/drizzle.ts`. Vous devrez exécuter les migrations pour créer les tables.

## ⚙️ Configuration

### Variables d'environnement requises

| Variable               | Description                                   | Exemple                                    |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| `DATABASE_URL`         | URL de connexion PostgreSQL                   | `postgresql://user:pass@localhost:5432/db` |
| `OPENAI_API_KEY`       | Clé API OpenAI pour l'évaluateur              | `sk-...`                                   |
| `GITHUB_TOKEN`         | Personal Access Token GitHub                  | `ghp_xxxxx`                                |
| `GITHUB_OWNER`         | Propriétaire/organisation GitHub              | `facebook`                                 |
| `GOOGLE_CLIENT_ID`     | Client ID OAuth2 Google                       | `xxx.apps.googleusercontent.com`           |
| `GOOGLE_CLIENT_SECRET` | Client Secret OAuth2 Google                   | `GOCSPX-xxxxx`                             |
| `GOOGLE_REFRESH_TOKEN` | Refresh Token Google                          | `1//xxxxx`                                 |
| `GOOGLE_FOLDER_ID`     | ID du dossier Google Drive contenant les Sync | `1ABC...XYZ`                               |

### Configuration des connecteurs

Les connecteurs sont créés dynamiquement via le `ConnectorRegistry` basé sur les repos enregistrés en base de données. Chaque repo doit avoir un `type` (github, google_drive, etc.) et les credentials correspondants dans les variables d'environnement.

## 📖 Utilisation

### Exemple : Lancer une évaluation de synchronisation

```typescript
import { ChallengeService } from "./packages/services/challenge.service.js";

const service = new ChallengeService();

// Lancer une évaluation pour un challenge
const challengeId = "your-challenge-uuid";
const evaluations = await service.runSyncEvaluation(challengeId);

console.log(`${evaluations.length} contributions évaluées`);
```

### Exemple : Calculer les récompenses

```typescript
// À la fin d'un challenge
const rewards = await service.computeChallengeRewards(challengeId);

rewards.forEach((reward) => {
  console.log(`${reward.contributionTitle}: ${reward.reward} CP`);
});
```

### Utilisation des packages individuellement

#### Connecteurs

```typescript
import { GitHubExternalConnector } from "./packages/connectors/implementation/Github.connector.js";

const connector = new GitHubExternalConnector({
  token: process.env.GITHUB_TOKEN,
  owner: "facebook",
  repo: "react",
});

await connector.connect();
const commits = await connector.fetchItems({ maxCommits: 50 });
const content = await connector.fetchItemContent(commits[0].id);
```

#### Database Service

```typescript
import {
  ProjectRepository,
  UserRepository,
} from "./packages/database-service/repositories/index.js";

const projectRepo = new ProjectRepository();
const project = await projectRepo.create({
  title: "MyTwin AI",
  description: "Projet de leaderboard IA",
});
```

#### Evaluator

```typescript
import { OpenAIAgentEvaluator, EvaluationGridRegistry } from "./packages/evaluator/index.js";

const evaluator = new OpenAIAgentEvaluator();

// Identifier les contributions
const contributions = await evaluator.identify({
  syncPreview: "...",
  commits: [...],
  users: [...]
});

// Évaluer une contribution
const grid = EvaluationGridRegistry.getGrid("code");
const evaluation = await evaluator.evaluate(contribution, {
  snapshot: {...},
  grid
});
```

## 📁 Structure du projet

```
leaderboard/
├── packages/
│   ├── connectors/
│   │   ├── interfaces.ts              # Interface ExternalConnector
│   │   ├── registry.ts                 # Factory pour créer des connecteurs
│   │   ├── connectors.orchestrator.ts  # Orchestration de plusieurs connecteurs
│   │   ├── implementation/
│   │   │   ├── Github.connector.ts     # Connecteur GitHub
│   │   │   └── GD.connector.ts         # Connecteur Google Drive
│   │   └── README.md
│   │
│   ├── database-service/
│   │   ├── db/
│   │   │   ├── drizzle.ts              # Schémas Drizzle + Client DB
│   │   │   └── mappers.ts              # Conversions DB ↔ Domain
│   │   ├── domain/
│   │   │   ├── entities.ts             # Entités métier TypeScript
│   │   │   └── schemas_zod.ts          # Validation Zod
│   │   ├── repositories/
│   │   │   ├── *.repo.ts               # Repositories CRUD
│   │   │   └── index.ts
│   │   └── README.md
│   │
│   ├── evaluator/
│   │   ├── evaluator.ts                # OpenAIAgentEvaluator
│   │   ├── interfaces.ts               # Interface AgentEvaluator
│   │   ├── types.ts                    # Types de données
│   │   ├── reward.ts                   # Calcul des récompenses
│   │   ├── grids/
│   │   │   ├── code.grid.ts            # Grille d'évaluation code
│   │   │   ├── model.grid.ts           # Grille d'évaluation modèles
│   │   │   ├── dataset.grid.ts         # Grille d'évaluation datasets
│   │   │   ├── docs.grid.ts            # Grille d'évaluation docs
│   │   │   └── index.ts
│   │   ├── openai/
│   │   │   ├── identify.agent.ts        # Agent d'identification
│   │   │   └── evaluate.agent.ts       # Agent d'évaluation
│   │   └── README.md
│   │
│   ├── services/
│   │   └── challenge.service.ts        # Service d'orchestration principal
│   │
│   └── test/
│       ├── test-challenge-service.ts
│       ├── test-github.ts
│       ├── test-gd.ts
│       └── test-db-connection.ts
│
└── challenges/
    ├── challenge_001_leaderboard/
    ├── challenge_002_authentication/
    └── challenge_003_collaboration_patterns/
```

## 📦 Packages

### 🔌 `connectors`

Package de connecteurs externes pour interagir avec différentes plateformes.

**Fonctionnalités** :

- Interface unifiée `ExternalConnector`
- Connecteurs GitHub et Google Drive
- Orchestrateur pour gérer plusieurs connecteurs en parallèle
- Extensible pour de nouveaux connecteurs

**Documentation** : Voir `packages/connectors/README.md`

### 🗄️ `database-service`

Service de gestion de la base de données PostgreSQL avec Drizzle ORM.

**Fonctionnalités** :

- Schémas Drizzle pour toutes les entités
- Repositories avec CRUD complet
- Validation Zod pour toutes les entrées
- Mappers bidirectionnels DB ↔ Domain

**Documentation** : Voir `packages/database-service/README.md`

### 🤖 `evaluator`

Système d'évaluation automatisé des contributions basé sur des agents IA.

**Fonctionnalités** :

- Agents OpenAI pour identification et évaluation
- Grilles d'évaluation personnalisables par type
- Calcul de récompenses proportionnel
- Tool calling pour analyse approfondie du code

**Documentation** : Voir `packages/evaluator/README.md`

### 🎯 `services`

Services d'orchestration de haut niveau.

**Fonctionnalités** :

- `ChallengeService` : Orchestration complète du cycle de vie d'un challenge
- Méthodes `runSyncEvaluation` et `computeChallengeRewards`

## 🔄 Workflow d'un challenge

1. **Création du challenge** : Un challenge est créé en base avec dates, équipe, repos associés
2. **Sync Meeting** :
   - Récupération des commits depuis GitHub
   - Récupération du résumé de réunion depuis Google Drive
   - Identification des contributions par l'agent IA
   - Évaluation de chaque contribution
   - Sauvegarde en base de données
3. **Fin du challenge** :
   - Calcul des récompenses proportionnelles
   - Mise à jour des contributions avec les points attribués
   - Génération du leaderboard

## 🧪 Tests

Des scripts de test sont disponibles dans `packages/test/` :

```bash
# Tester la connexion à la base de données
npx tsx packages/test/test-db-connection.ts

# Tester les connecteurs
npx tsx packages/test/test-github.ts
npx tsx packages/test/test-gd.ts

# Tester le service de challenge
npx tsx packages/test/test-challenge-service.ts
```

## 🔐 Sécurité

- **Ne jamais hardcoder** les tokens et credentials
- Utiliser des **variables d'environnement** pour tous les secrets
- Valider toutes les entrées avec **Zod**
- Respecter les **rate limits** des APIs externes

## 🚧 Développement

### Ajouter un nouveau connecteur

1. Créer une classe implémentant `ExternalConnector` dans `packages/connectors/implementation/`
2. Ajouter le type dans `ConnectorType`
3. Implémenter toutes les méthodes requises
4. Ajouter la logique de création dans `ConnectorRegistry`

### Ajouter une nouvelle grille d'évaluation

1. Créer un fichier dans `packages/evaluator/grids/`
2. Définir les critères et leurs poids
3. Enregistrer dans `EvaluationGridRegistry`

## 📝 Licence

[À définir]

## 👥 Équipe

- **Antoine** - Software Engineer - github:KaoDje
- **Alix** - Software Engineer - github:Akralan

---

Pour plus de détails sur chaque package, consultez les README individuels dans chaque dossier `packages/*/README.md`.
