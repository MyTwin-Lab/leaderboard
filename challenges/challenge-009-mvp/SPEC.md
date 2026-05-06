# Challenge 009 – MVP Release — Spécification technique

## 0. Modèle utilisateur & profil

### 0.1 Fusion `google_accounts` / `users`

La table `users` contient directement `email` et `google_user_id` (pas de table `google_accounts` séparée). Le callback OAuth (`GET /api/google-auth/callback`) gère le flux login/register unifié :

1. Lookup `users.google_user_id` → utilisateur existant → JWT → cookies → redirect.
2. Lookup `users.email` → utilisateur existant sans Google → link le compte.
3. Aucun match → création `users` (role `contributor`, `full_name` depuis Google) + init onboarding → JWT → redirect.

Vérifier qu'il ne reste aucune référence à une table `google_accounts` dans le code ou les migrations, et consolider le modèle si nécessaire.

#### Schéma `users`

```sql
users (
  uuid              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role              VARCHAR(100) NOT NULL,
  full_name         VARCHAR(255) NOT NULL,
  github_username   VARCHAR(255),       -- nullable, unique
  email             VARCHAR(255),       -- nullable, unique
  google_user_id    VARCHAR(255),       -- nullable, unique
  bio               TEXT,
  created_at        TIMESTAMP DEFAULT now()
)
```

#### Middleware (`proxy.ts`)

- Auth obligatoire sur les pages protégées (`/admin`, `/contributors/me`, `/challenges/*`).
- Routes API protégées (`/api/challenges`, `/api/tasks`, `/api/users`, etc.) → 401 si pas de token.
- Routes publiques : `/api/google-auth/*`, `/api/auth/refresh`, `/api/auth/logout`.
- Redirection automatique vers Google OAuth si token absent sur une page protégée.

### 0.2 Édition du profil

**API** : `PATCH /api/users/me`
- Body : `{ full_name?, bio? }`.
- Auth requise. L'utilisateur ne peut modifier que son propre profil.
- Validation Zod.

**UI** (`/contributors/me`) :
- Bouton "Modifier le profil" ouvrant un formulaire inline ou une modale.
- Champs : Nom complet (`full_name`), Bio (`bio`).
- Feedback : toast succès/erreur, mise à jour immédiate du `ContributorHeader`.

---

## 1. Design & évaluation

### 1.1 Refonte design des pages clés

#### Principes

- Cohérence avec le design system existant (`components/ui/*`).
- Glassmorphism subtil (`bg-white/5`, `backdrop-blur`, `border-white/10`).
- Responsive mobile-first.
- Skeletons de chargement.

#### `/challenges/[id]`

- Header avec titre, badge statut, dates, reward CP.
- Barre de progression.
- Section tâches : arborescence parent/enfant avec statut visuel, avatars assignés, CTA assign.
- Section meetings : cards upcoming/past avec lien Meet.
- Section équipe : grille d'avatars.

#### `/tasks/[id]`

- Header avec titre, badge type (solo/concurrent), statut.
- Lien vers le challenge parent.
- Section workspaces avec badges statut (`ready`/`pending`/`failed`), branche, lien "Open".
- Section évaluation : score global en cercle, scores détaillés avec barres et commentaires IA.
- CTA évaluer/réévaluer.

#### `/sync-meetings/[id]`

- Header avec titre, statut, dates/heures, bouton "Join Meeting".
- Section participants en grille d'avatars.
- Section analyse IA avec onglets Summary/Details : résumé, décisions, actions (avec priorité), signaux de contribution.

#### `/contributors/me`

- Header avec nom, CP total, bouton logout.
- Section "My Tasks" : liste des tâches assignées avec badge type, lien vers la tâche.
- Section "My Contributions" : liste des challenges avec contributions.

### 1.2 Évaluation depuis `/contributors/me`

Appeler `POST /api/tasks/:id/evaluate` au clic sur le bouton Evaluate dans `MyTasks`. Afficher le dernier score (global) à côté de chaque tâche. Appeler `trackOnboardingStep('evaluated_contribution')` après évaluation réussie.

#### Pipeline d'évaluation

`POST /api/tasks/:id/evaluate` → `TaskEvaluationService.evaluateTask()` :

1. **Contexte** : récupère challenge, task, assignés, workspaces via `TaskContextService`.
2. **Connecteurs** : crée les connecteurs via `ConnectorRegistry` (GitHub supporté, HuggingFace à venir) et les orchestre via `ConnectorsOrchestrator`.
3. **Snapshot** : fetch les commits sur la branche du workspace, construit un snapshot agrégé via `SnapshotService`.
4. **Grille** : charge la grille d'évaluation depuis la DB via `EvaluationGridRegistry`.
5. **Évaluation** : appelle `OpenAIAgentEvaluator.evaluate()` avec le snapshot et la grille.
6. **Upsert** : crée ou met à jour la contribution en base (`contributions` table).

### 1.3 Composant d'onboarding contextuel sur `/tasks/[id]`

Composant d'aide contextuelle affiché sur la page d'une tâche pour guider les nouveaux utilisateurs dans l'accès et l'utilisation des workspaces.

**Contenu** :
- Explication de ce qu'est un workspace (branche GitHub, espace HuggingFace, projet Figma…).
- Étapes pour accéder au workspace : cliquer sur "Open", cloner le repo, checkout la branche.

**Comportement** :
- Affiché une seule fois (ou masquable) pour les utilisateurs qui n'ont pas encore évalué de contribution.
- Adapté au type de workspace affiché (GitHub pour l'instant).

---

## 2. Tiroir d'onboarding

### 2.1 Drawer avec quêtes guidées

`OnboardingDrawer` fixé en bas de l'écran, affiché pour les utilisateurs dont l'onboarding n'est pas complété.

**Quêtes** (5 étapes) :
- `clicked_challenge` — Explorer un challenge
- `assigned_task` — S'assigner à une tâche
- `evaluated_contribution` — Évaluer une contribution
- `validated_task` — Valider une tâche
- `joined_meeting` — Rejoindre un meeting

**UI** :
- Header réduit avec anneau de progression et compteur (`X/5 quêtes complétées`).
- Clic pour expand/collapse la liste des quêtes.
- Chaque quête affiche une icône, un label en français, et un état (complété ou non).
- Ouverture automatique à la première connexion (nouvel utilisateur).

**Tracking** :
- `trackOnboardingStep(step)` → `PATCH /api/onboarding` (fire-and-forget côté client).
- Appelé aux bons endroits : page challenge (`clicked_challenge`), assign (`assigned_task`), évaluation (`evaluated_contribution`), join meeting (`joined_meeting`).

#### Schéma `onboarding_progress`

```sql
onboarding_progress (
  user_id                UUID PRIMARY KEY REFERENCES users(uuid),
  clicked_challenge      BOOLEAN NOT NULL DEFAULT false,
  assigned_task          BOOLEAN NOT NULL DEFAULT false,
  evaluated_contribution BOOLEAN NOT NULL DEFAULT false,
  validated_task         BOOLEAN NOT NULL DEFAULT false,
  joined_meeting         BOOLEAN NOT NULL DEFAULT false,
  completed_at           TIMESTAMP,
  created_at             TIMESTAMP DEFAULT now(),
  updated_at             TIMESTAMP DEFAULT now()
)
```

### 2.2 Complétion des quêtes

- Chaque appel `PATCH /api/onboarding` avec `{ step }` marque le step comme `true`.
- Quand toutes les quêtes sont complétées → `completed_at` est set automatiquement.
- Bouton "Fermer définitivement" dans le drawer qui set `completed_at` même si toutes les quêtes ne sont pas faites.
- Le drawer disparaît quand `completed_at` est non-null.

---

## 3. Documentation API & modèle de données

### 3.1 Documentation OpenAPI/Swagger

Fichier `openapi.yaml` servant de source de vérité pour la documentation API. Servi en JSON via `GET /api/openapi.json` (dev only) et rendu interactif via `GET /api/docs` avec Scalar UI.

Toutes les routes de l'API doivent être documentées, y compris les nouvelles routes ajoutées dans ce challenge (`PATCH /api/users/me`, etc.).

**Tags** : Auth, Google Auth, Users, Contributors, Projects, Challenges, Challenge Team, Tasks, Contributions, Repos, Evaluation Grids, Sync Meetings, Leaderboard, Onboarding, Cron.

### 3.2 Liaison tâches ↔ repo de challenge

La table `tasks` possède un champ `repo_id` (FK vers `repos`). L'API CRUD tasks (`POST /api/tasks`, `PUT /api/tasks/:id`) accepte `repo_id` dans le body.

- **Admin** : permettre de choisir le repo lié lors de la création/édition d'une tâche (dropdown des repos liés au challenge via `challenge_repos`).
- **Public** : sur `/tasks/[id]`, afficher le repo lié à la tâche (nom, type, lien externe) dans la section workspaces ou dans le header.
- **OpenAPI** : documenter le champ `repo_id` dans les schémas `CreateTask` et `UpdateTask`.