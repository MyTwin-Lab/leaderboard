# Challenge 006 – Contributor Experience Spec

## 1. Contexte & objectifs

- **Problème identifié** : L'expérience contributeur est limitée à l'interface admin. Aucune étape publique ne présente le projet ou les challenges, ni ne permet d'engager un contributeur de façon autonome.
- **Objectif** : Offrir un parcours public complet (pages About & Challenges), un flux d'engagement guidé (CTA « Rejoindre »), une authentification dédiée aux contributeurs et une page profil visible depuis un badge global.
- **Valeur attendue** :
  - Visibilité accrue du programme et des challenges actifs.
  - Meilleur taux de conversion grâce au CTA contextualisé.
  - Expérience unifiée (badge, navigation publique/admin) et profil enrichi.

## 2. Portée & livrables

- Création des pages publiques `/about` et `/challenges` avec contenu Markdown hardcodé et activité récente.
- CTA « Rejoindre un challenge » conditionnel (rôle contributeur).
- Extension de l'auth existante au rôle "contributeur" (sessions, middleware, guards UI, badge dans le layout).
- Enrichissement de la page profil contributeur (challenges, expertise, historique d'activité).
- Système de tâches permettant aux contributeurs de s'assigner à des tâches de challenge.

## 3. Architecture & composants impactés

### 3.0 Design UI sur Figma

- **Header MyTwin lab**
  - Designer l'affichage du badge utilisateur à droite dans le header actuel, ainsi que le sous-menu qui apparaît pour se déconnecter ou accéder à son profil contributeur.
  - Affichage d'un bouton pour accéder à la page admin pour les utilisateurs disposant du rôle "admin".
- **Page Challenges**
  - Affichage d'un bloc pour un projet, avec la possibilité de cliquer et avoir une modale affichant les différents challenges avec titre, description, équipe actuelle (badges ou icônes côte à côte).
  - Bouton "Rejoindre" ou "Contribuer" (voir section 4.3 pour le flux détaillé).
- **Page admin challenges**
  - Lors de la création d'un challenge, une modale s'ouvre.
  - Modification de la modale afin d'intégrer le nouveau système de tâches et d'écriture de la SPEC directement depuis le dashboard.
  - Ajout d'une tâche de manière automatique quand les champs sont remplis, avec type de tâche (solo vs concurrent), description et titre.
  - Une fois pret un bouton "Enregistrer" permet de passer le challenge au status "En cours" et enregistrer les données dans la DB.

### 3.1 Front public (Next.js App Router – apps/leaderboard-client)

- **Nouvelles routes** :
  - `/about` : Affichage des notes de contributions et lab (contenu Markdown hardcodé).
  - `/challenges` : Listing public (titre, statut, métriques), affichage activité (dernières contributions).
- **Layout** :
  - Mise à jour du layout public pour inclure navigation accessible (About, Challenges) + badge utilisateur (visible si session contributeur).
  - Guards UI (hooks/types) pour masquer CTA ou sections selon le rôle.
- **Nouveau hook** :
  - `useRole()` : Hook client fournissant `isAdmin`, `isContributor`, `isPublic` pour les guards UI.

### 3.2 Authentification & middleware

- `apps/leaderboard-client/src/middleware.ts` : Le middleware actuel gère déjà les rôles admin/contributor. Vérifier que les nouvelles routes sont correctement protégées.
- `apps/leaderboard-client/src/app/login` : Le login existant fonctionne pour tous les rôles (admin et contributor). Pas de modification nécessaire.
- **Note** : Le système JWT avec tokens HTTP-only est déjà en place (challenge-005).

### 3.3 Données & backend

#### 3.3.1 Nouvelles tables (migration Drizzle)

Ajouter les tables suivantes dans `packages/database-service/db/drizzle.ts` :

```typescript
// --- TASKS ---
export const tasks = pgTable("tasks", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  parent_task_id: uuid("parent_task_id").references(() => tasks.uuid, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // "solo" | "concurrent"
  created_at: timestamp("created_at").defaultNow(),
});

// --- TASK_ASSIGNEES ---
export const task_assignees = pgTable("task_assignees", {
  task_id: uuid("task_id").references(() => tasks.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  assigned_at: timestamp("assigned_at").defaultNow(),
});

// --- TASK_EVALUATIONS ---
export const task_evaluations = pgTable("task_evaluations", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  task_id: uuid("task_id").references(() => tasks.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  global_score: integer("global_score").notNull(),
  scores_json: jsonb("scores_json").notNull(), // CriterionScore[] sérialisé
  evaluated_at: timestamp("evaluated_at").defaultNow(),
});
```

#### 3.3.2 Nouveaux fichiers à créer

- `packages/database-service/domain/entities.ts` : Ajouter `Task` et `TaskAssignee`
- `packages/database-service/domain/schemas_zod.ts` : Ajouter `taskSchema` et `taskAssigneeSchema`
- `packages/database-service/db/mappers.ts` : Ajouter `toDomainTask`, `toDbTask`, `toDomainTaskAssignee`, `toDbTaskAssignee`
- `packages/database-service/repositories/task.repo.ts` : CRUD + `findByChallenge()`, `findByUser()`
- `packages/database-service/repositories/taskAssignee.repo.ts` : CRUD + `assignUser()`, `unassignUser()`, `findAssignees()`

#### 3.3.3 Modification table contributions

Ajouter le champ `created_at` à la table `contributions` pour permettre l'affichage chronologique :

```typescript
// Dans contributions table
created_at: timestamp("created_at").defaultNow(),
```

#### 3.3.5 Endpoints API

- `GET /api/challenges` : Déjà existant, ajouter les tâches dans la réponse
- `GET /api/tasks?challengeId=xxx` : Liste des tâches d'un challenge
- `POST /api/tasks` : Créer une tâche (admin only)
- `POST /api/tasks/:id/assign` : S'assigner à une tâche (contributor)
- `DELETE /api/tasks/:id/assign` : Se désassigner d'une tâche
- `GET /api/contributors/me` : Déjà existant, données complètes du profil
- `POST /api/tasks/:id/evaluate` : Déclenche l'évaluation d'une tâche assignée à l'utilisateur connecté
  - Utilise `OpenAIAgentEvaluator` du package `@leaderboard/evaluator`
  - Workflow : identify → merge → evaluate
  - Retourne l'`Evaluation` avec scores par critère et score global
  - Pré-requis : l'utilisateur doit être assigné à la tâche

## 4. Flux fonctionnels

### 4.1 Page About (`/about`)

1. Affichage du contenu Markdown hardcodé (sections vision, comment contribuer, liens onboarding).
2. Contenu structuré et facilement éditable dans le code source.

### 4.2 Page Challenges (`/challenges`)

1. SSR liste challenges actifs + filtre (statut, catégorie).
   - Affichage structuré en bloc avec une timeline des contributions (utilise le nouveau champ `created_at`).
2. Bloc "Activité publique" : top N contributions récentes (source API publique).
3. CTA « Rejoindre un challenge » :
   - Visible si session contributeur (rôle contributor ou admin).
   - Sinon, affichage d'un lien vers login.

### 4.3 Flux CTA Rejoindre

1. Clic CTA → ouverture d'une modale (texte explicatif ou renvoie vers la page about).
2. Soumission → redirection vers onboarding ou formulaire interne (URL configurée).
3. Le bouton passe de "Rejoindre" à "Contribuer". Un clic dessus ouvre alors une modale permettant d'afficher plus d'informations sur le challenge de manière structurée :
   - Les tâches sont affichées à la suite, avec la possibilité de voir l'(es) utilisateur(s) assigné(s) à une tâche ou de s'y assigner soi-même.
   - Tâches "solo" : un seul assigné possible
   - Tâches "concurrent" : plusieurs assignés possibles

### 4.4 Auth & badge global

1. Middleware vérifie cookie/session. Si rôle contributor, charge info profil minimale (nom, avatar, liens).
2. Layout affiche badge flottant (menu) avec raccourci vers page profil + logout.
3. Routes admin continuent de restreindre à admin.
4. **Nouveau** : Afficher un lien "Admin Dashboard" dans le dropdown du badge si `role === 'admin'`.

### 4.5 Page profil contributeur

1. `GET /contributors/:id` renvoie :
   - Identité, rôle, expertise, avatar.
   - Challenges en cours/terminés (status + rôle).
   - Historique : contributions récentes, badges, dernières évaluations.
2. Affichage d'un historique des évaluations personnelles (optionnel) : possibilité d'utiliser le workflow de l'agent d'évaluation afin d'identifier la contribution actuelle dans les différents repositories du challenge et de l'évaluer ou la réévaluer.

### 4.5.1 Flux d'évaluation d'une tâche

1. L'utilisateur voit ses tâches assignées sur sa page profil (`/contributors/me`).
2. Pour chaque tâche, un bouton "Évaluer ma contribution" est affiché.
3. Au clic :
   - Appel `POST /api/tasks/:taskId/evaluate`
   - Le backend récupère les commits liés au challenge de la tâche
   - L'`OpenAIAgentEvaluator` exécute le pipeline :
     - `identify()` : Identifie les contributions de l'utilisateur (reçoit les tâches du challenge au lieu de la roadmap)
     - `merge()` : Fusionne avec les contributions existantes
     - `evaluate()` : Évalue selon la grille du challenge
   - Résultat affiché dans une modale avec scores détaillés
4. L'historique des évaluations est persisté et visible sur le profil.

## 5. Spécifications techniques

### 5.1 API & données

- **Profil contributeur** :
  - `GET /api/contributors/me` (auth requise) → données complètes.
- **Tâches** :
  - `GET /api/tasks?challengeId=xxx` → liste des tâches avec assignés
  - `POST /api/tasks/:id/assign` → s'assigner (vérifie type solo/concurrent)
  - `DELETE /api/tasks/:id/assign` → se désassigner
- **Évaluation des tâches** :
  - `POST /api/tasks/:id/evaluate` → Déclenche l'évaluation de la tâche
  - Auth requise : contributor assigné à la tâche
  - Flow :
    1. Vérifier que l'utilisateur est assigné à la tâche
    2. Récupérer le challenge associé, ses tâches et sa grille d'évaluation
    3. Récupérer les commits du repository via le connecteur GitHub
    4. Appeler `OpenAIAgentEvaluator.identify()` avec le contexte (tâches du challenge au lieu de la roadmap)
    5. Appeler `OpenAIAgentEvaluator.merge()` si contributions existantes
    6. Appeler `OpenAIAgentEvaluator.evaluate()` avec la grille
    7. Persister l'évaluation dans `task_evaluations` et retourner le résultat
  - Response : `{ evaluation: Evaluation, contribution: Contribution }`

### 5.2 UI/UX

- Utiliser le design system existant (`apps/leaderboard-client/src/components/ui/*`).
- Navigation responsive : `/about`, `/challenges`, Leaderboard, Login.
- Badge utilisateur : composant existant `ContributorBadge` (icône + menu dropdown).
- CTA : style primaire, iconographie cohérente.

### 5.3 Sécurité & permissions

- Middleware vérifie rôle sur chaque requête sensible.
- Guards UI : nouveau hook `useRole()` fournissant `isAdmin`, `isContributor`, `isPublic`.
- Endpoints publics ne retournent aucune donnée sensible (emails, notes internes).
- Logging des tentatives d'accès non autorisées.

### 5.4 Entités Task

```typescript
interface Task {
  uuid: string;
  challenge_id: string;
  parent_task_id?: string;
  title: string;
  description?: string;
  type: "solo" | "concurrent";
  created_at: Date;
}

interface TaskAssignee {
  task_id: string;
  user_id: string;
  assigned_at: Date;
}

interface TaskEvaluation {
  uuid: string;
  task_id: string;
  user_id: string;
  global_score: number;
  scores_json: CriterionScore[]; // Depuis @leaderboard/evaluator
  evaluated_at: Date;
}
```