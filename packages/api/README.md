# 🚀 API Package

API REST backend pour le système MyTwin Leaderboard. Expose des endpoints pour gérer les projets, challenges, utilisateurs, contributions et leaderboards.

## 🎯 Vue d'ensemble

L'API MyTwin Leaderboard est le backend REST du système de classement des contributions du Lab. Elle orchestre l'évaluation automatique des contributions via des agents IA et fournit une interface complète pour le backoffice.

### Stack technique

- **Runtime** : Node.js avec TypeScript
- **Framework** : Express.js 4.18
- **Base de données** : PostgreSQL (via Drizzle ORM)
- **Authentification** : Basic Auth (admin)
- **Architecture** : Monorepo avec packages modulaires

## 🏗️ Architecture

L'API s'intègre dans une architecture modulaire :

```
packages/
├── api/                    # API REST (ce package)
├── database-service/       # Repositories & entités DB
├── services/              # Business logic (ChallengeService)
├── evaluator/             # Agent IA d'évaluation
└── connectors/            # Connecteurs externes (GitHub, Google Drive)
```

### Flux de données

```
Client → API Routes → Repositories → Database
                   ↓
                Services → Evaluator → External Connectors
```

### Structure du package

```
packages/api/
├── server.ts              # Point d'entrée du serveur Express
├── index.ts               # Export du package
├── routes/                # Définition des routes
│   ├── challenges.routes.ts
│   ├── users.routes.ts
│   ├── contributions.routes.ts
│   ├── projects.routes.ts
│   ├── repos.routes.ts
│   └── leaderboard.routes.ts
├── middleware/            # Middlewares Express
│   ├── async-handler.ts   # Gestion erreurs async
│   ├── auth.ts            # Authentification Basic Auth
│   └── error.ts           # Gestionnaire d'erreurs global
├── test/                  # Tests automatisés
│   ├── api.test.ts
│   ├── test-auth.ts
│   └── README.md
├── package.json
└── .env
```

## 🚀 Installation & Démarrage

### Prérequis

- Node.js 18+
- PostgreSQL en cours d'exécution
- Fichier `.env` configuré

### Configuration `.env`

```env
# API
API_PORT=3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/leaderboard_db

# Admin Auth
ADMIN_USERNAME=admin
ADMIN_PASSWORD=MyTwinAdmin2025!

# External Services
GITHUB_TOKEN=ghp_xxxxx
OPENAI_API_KEY=sk-xxxxx
GOOGLE_CLIENT_ID=xxxxx
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REFRESH_TOKEN=xxxxx
```

### Commandes

```bash
# Installation
cd packages/api
npm install

# Développement (avec hot-reload)
npm run dev

# Production
npm start

# Build TypeScript
npm run build
```

Le serveur démarre sur `http://localhost:3001` (ou `API_PORT` défini).

## 📡 Endpoints API

### Health Check

```http
GET /health
```

Retourne le statut du serveur et un timestamp.

**Réponse** :
```json
{
  "status": "ok",
  "timestamp": "2025-10-17T10:00:00.000Z"
}
```

---

### 🏆 Challenges

**Base** : `/api/challenges`

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/` | Liste tous les challenges | - |
| GET | `/:id` | Détails d'un challenge | - |
| GET | `/:id/context` | Contexte complet (repos, team, contributions) | - |
| POST | `/` | Créer un challenge | ✅ Admin |
| PUT | `/:id` | Modifier un challenge | ✅ Admin |
| DELETE | `/:id` | Supprimer un challenge | ✅ Admin |
| POST | `/:id/sync` | Lancer une évaluation Sync Meeting | ✅ Admin |
| POST | `/:id/close` | Clôturer et distribuer les rewards | ✅ Admin |

#### Endpoints spéciaux

**`POST /:id/sync`** - Déclenche l'évaluation des contributions depuis le dernier Sync

Processus :
1. Identifie les nouvelles contributions (GitHub, Google Drive)
2. Assigne un score 0-100 via l'agent IA
3. Stocke les évaluations en base

**Réponse** :
```json
{
  "success": true,
  "count": 5,
  "evaluations": [...]
}
```

**`POST /:id/close`** - Clôture le challenge

Processus :
1. Convertit tous les scores en Contribution Points (CP)
2. Distribue le pool de rewards proportionnellement
3. Met à jour le statut à `completed`

**Réponse** :
```json
{
  "success": true,
  "count": 5,
  "rewards": [
    {
      "userId": "uuid",
      "contributionTitle": "Feature X",
      "score": 85,
      "reward": 425
    }
  ]
}
```

---

### 👥 Users

**Base** : `/api/users`

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/` | Liste tous les users | - |
| GET | `/:id` | Détails d'un user | - |
| GET | `/:id/contributions` | Contributions d'un user | - |
| GET | `/github/:username` | User par GitHub username | - |
| POST | `/` | Créer un user | ✅ Admin |
| PUT | `/:id` | Modifier un user | ✅ Admin |
| DELETE | `/:id` | Supprimer un user | ✅ Admin |

**Exemple de création** :
```json
POST /api/users
{
  "role": "developer",
  "full_name": "John Doe",
  "github_username": "johndoe"
}
```

---

### 📝 Contributions

**Base** : `/api/contributions`

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/` | Liste toutes les contributions | - |
| GET | `/:id` | Détails d'une contribution | - |
| GET | `/user/:userId` | Contributions d'un user | - |
| GET | `/challenge/:challengeId` | Contributions d'un challenge | - |
| POST | `/` | Créer une contribution | - |
| PUT | `/:id` | Modifier une contribution | - |
| DELETE | `/:id` | Supprimer une contribution | - |

**Structure d'une contribution** :
```json
{
  "uuid": "...",
  "title": "Implement authentication",
  "type": "code",
  "description": "Added JWT authentication",
  "evaluation": {
    "scores": [...],
    "globalScore": 85
  },
  "tags": ["NextJS", "Auth"],
  "reward": 425,
  "user_id": "...",
  "challenge_id": "..."
}
```

---

### 📊 Leaderboard

**Base** : `/api/leaderboard`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Leaderboard global (toutes contributions) |
| GET | `/challenge/:challengeId` | Leaderboard d'un challenge spécifique |
| GET | `/challenge/:challengeId/stats` | Statistiques détaillées d'un challenge |

**Exemple de réponse** `/challenge/:id/stats` :

```json
{
  "challenge": {
    "id": "uuid",
    "title": "Sprint Q1 2025",
    "totalPool": 1000
  },
  "stats": {
    "totalContributions": 42,
    "totalRewardsDistributed": 850,
    "remainingPool": 150,
    "averageScore": 72.5
  }
}
```

---

### 📁 Projects

**Base** : `/api/projects`

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/` | Liste tous les projets | - |
| GET | `/:id` | Détails d'un projet | - |
| GET | `/:id/challenges` | Challenges d'un projet | - |
| GET | `/:id/repos` | Repos d'un projet | - |
| POST | `/` | Créer un projet | ✅ Admin |
| PUT | `/:id` | Modifier un projet | ✅ Admin |
| DELETE | `/:id` | Supprimer un projet | ✅ Admin |

---

### 🗂️ Repositories

**Base** : `/api/repos`

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/` | Liste tous les repos | - |
| GET | `/:id` | Détails d'un repo | - |
| POST | `/` | Créer un repo | ✅ Admin |
| PUT | `/:id` | Modifier un repo | ✅ Admin |
| DELETE | `/:id` | Supprimer un repo | ✅ Admin |
| POST | `/challenge-repos` | Lier un repo à un challenge | ✅ Admin |

---

## 🔐 Authentification

### Basic Auth (Admin)

Les routes protégées nécessitent un header `Authorization` :

```http
Authorization: Basic base64(username:password)
```

**Credentials** : Définis dans `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)

**Middleware** : `requireAdmin` (voir `middleware/auth.ts`)

### Codes de réponse

- **401** - Credentials manquants
- **403** - Credentials invalides
- **500** - Configuration serveur manquante

### Exemple avec curl

```bash
# Encoder les credentials
echo -n "admin:MyTwinAdmin2025!" | base64
# Output: YWRtaW46TXlUd2luQWRtaW4yMDI1IQ==

# Utiliser dans une requête
curl -X POST http://localhost:3001/api/challenges \
  -H "Authorization: Basic YWRtaW46TXlUd2luQWRtaW4yMDI1IQ==" \
  -H "Content-Type: application/json" \
  -d '{"title": "Sprint Q1", "status": "active"}'
```

---

## 🛠️ Middlewares

### 1. `asyncHandler` (`middleware/async-handler.ts`)

Wrapper pour gérer automatiquement les erreurs async dans les routes Express.

```typescript
import { asyncHandler } from "../middleware/async-handler.js";

router.get("/", asyncHandler(async (req, res) => {
  // Les erreurs sont automatiquement catchées et passées au errorHandler
  const data = await someAsyncOperation();
  res.json(data);
}));
```

**Avantages** :
- Évite les `try/catch` répétitifs
- Propage automatiquement les erreurs au gestionnaire global

---

### 2. `requireAdmin` (`middleware/auth.ts`)

Vérifie l'authentification Basic Auth pour les routes admin.

```typescript
import { requireAdmin } from "../middleware/auth.js";

router.post("/", requireAdmin, asyncHandler(async (req, res) => {
  // Cette route nécessite une authentification admin
}));
```

**Fonctionnement** :
1. Extrait le header `Authorization`
2. Décode les credentials Base64
3. Compare avec `ADMIN_USERNAME` et `ADMIN_PASSWORD`
4. Retourne 401/403 si invalide

---

### 3. `errorHandler` (`middleware/error.ts`)

Gestionnaire d'erreurs global placé en fin de chaîne middleware.

```typescript
app.use(errorHandler);
```

**Fonctionnalités** :
- Log les erreurs en console
- Retourne un JSON avec `error` et optionnellement `stack` (dev mode)
- Utilise `statusCode` de l'erreur ou 500 par défaut

**Format de réponse** :
```json
{
  "error": "Message d'erreur",
  "stack": "..." // Uniquement en mode développement
}
```

---

## 🔗 Intégrations

### ChallengeService

L'API utilise `ChallengeService` (`packages/services/challenge.service.ts`) pour orchestrer les opérations complexes.

#### Sync Meeting Evaluation

```typescript
const evaluations = await service.runSyncEvaluation(challengeId);
```

**Processus** :
1. Récupère le contexte du challenge (repos, team)
2. Collecte les données via connecteurs (GitHub, Google Drive)
3. Évalue les contributions via `OpenAIAgentEvaluator`
4. Stocke les scores en base

#### Reward Computation

```typescript
const rewards = await service.computeChallengeRewards(challengeId);
```

**Processus** :
1. Agrège tous les scores du challenge
2. Calcule la distribution proportionnelle du pool de rewards
3. Met à jour les contributions avec les CP finaux

---

### Repositories

L'API s'appuie sur les repositories de `database-service` :

- **`ChallengeRepository`** : CRUD challenges
- **`UserRepository`** : CRUD users
- **`ContributionRepository`** : CRUD contributions + filtres
- **`ProjectRepository`** : CRUD projects + relations
- **`RepoRepository`** : CRUD repos
- **`ChallengeRepoRepository`** : Liaison challenge-repo
- **`ChallengeTeamRepository`** : Liaison challenge-user

**Exemple d'utilisation** :
```typescript
import { ChallengeRepository } from "../../database-service/repositories/index.js";

const repo = new ChallengeRepository();
const challenges = await repo.findAll();
```

---

### External Connectors

Via `packages/connectors` :

- **GitHub** : Récupère commits, PRs, issues
- **Google Drive** : Récupère documents de Sync Meeting

**Exemple** :
```typescript
import { GitHubExternalConnector } from "@mytwin/connectors";

const connector = new GitHubExternalConnector({
  token: process.env.GITHUB_TOKEN,
  owner: "facebook",
  repo: "react"
});

await connector.connect();
const commits = await connector.fetchItems({ since: "2025-01-01" });
```

---

## 🔄 CORS

Configuration CORS dans `server.ts` :

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
```

**Permet** :
- Requêtes depuis le frontend avec credentials
- Cookies et auth headers

---

## 🐛 Gestion d'erreurs

### Codes HTTP

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Ressource créée |
| 204 | Suppression réussie (pas de contenu) |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Non autorisé |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

### Format de réponse d'erreur

```json
{
  "error": "Message d'erreur",
  "stack": "..." // Uniquement en mode développement
}
```

---

## 🧪 Tests

### Test complet automatisé

```bash
# 1. Démarrer l'API
npm run dev

# 2. Lancer les tests (autre terminal)
npx tsx packages/api/test/api.test.ts
```

**Couverture** :
- ✅ Health check
- ✅ Projects (CRUD)
- ✅ Challenges (CRUD + context)
- ✅ Users (CRUD)
- ✅ Contributions (CRUD + filtres)
- ✅ Leaderboard (classement + stats)

**Nettoyage** : Les tests suppriment automatiquement les données créées.

### Test d'authentification

```bash
npx tsx packages/api/test/test-auth.ts
```

Vérifie que les routes protégées nécessitent bien une authentification admin.

---

## 🚦 Workflow typique

### 1. Créer un challenge

```http
POST /api/challenges
Authorization: Basic xxx
Content-Type: application/json

{
  "index": 1,
  "title": "Sprint Q1 2025",
  "status": "active",
  "start_date": "2025-01-01",
  "end_date": "2025-03-31",
  "contribution_points_reward": 1000,
  "project_id": "uuid"
}
```

### 2. Lier des repos

```http
POST /api/repos/challenge-repos
Authorization: Basic xxx
Content-Type: application/json

{
  "challenge_id": "uuid",
  "repo_id": "uuid"
}
```

### 3. Sync Meeting (évaluation)

```http
POST /api/challenges/:id/sync
Authorization: Basic xxx
```

→ L'agent IA évalue les nouvelles contributions et stocke les scores.

### 4. Clôture du challenge

```http
POST /api/challenges/:id/close
Authorization: Basic xxx
```

→ Distribution des rewards et mise à jour du leaderboard.

### 5. Consulter le leaderboard

```http
GET /api/leaderboard/challenge/:id
```

---

## 📝 Notes importantes

- **Monorepo** : L'API importe des packages locaux (`database-service`, `services`, `evaluator`, `connectors`)
- **TypeScript** : Utilise `tsx` pour exécuter le code TS directement
- **Hot-reload** : `tsx watch` en mode dev
- **Sécurité** : Les credentials admin sont hardcodés dans `.env` (Basic Auth simple)
- **Production** : Prévoir une authentification plus robuste (JWT, OAuth) pour la prod

---

## 🔮 Évolutions possibles

- [ ] Authentification JWT pour les utilisateurs
- [ ] Rate limiting
- [ ] Pagination des listes
- [ ] Webhooks GitHub pour sync automatique
- [ ] Cache Redis pour le leaderboard
- [ ] Validation des payloads (Zod, Joi)
- [ ] Documentation OpenAPI/Swagger
- [ ] Logs structurés (Winston, Pino)
- [ ] Métriques et monitoring (Prometheus)
- [ ] Tests d'intégration avec base de données de test

---

## 🎯 Points clés

- ✅ **Architecture modulaire** : Séparation claire des responsabilités
- ✅ **REST API complète** : CRUD pour toutes les entités
- ✅ **Authentification** : Basic Auth pour les routes admin
- ✅ **Gestion d'erreurs** : Middleware global + async handler
- ✅ **Intégrations** : Services, repositories, connecteurs, evaluator
- ✅ **Tests automatisés** : Couverture complète des endpoints
- ✅ **CORS configuré** : Communication avec le frontend
- ✅ **TypeScript** : Type-safety complète
