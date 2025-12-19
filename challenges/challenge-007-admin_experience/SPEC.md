# Challenge 007 – Admin Evaluation Experience Specification

## 1. Contexte & objectifs
- **Problème identifié** : les équipes admin n’ont pas de visibilité sur les exécutions du workflow d’évaluation (statut, contributions détectées, erreurs). Lorsqu’un run échoue, aucune relance guidée n’est possible.
- **Objectif** : historiser chaque run d’évaluation, offrir une UI de diagnostic détaillée, et permettre la relance d’un run avec les mêmes paramètres (challenge, fenêtre temporelle, trigger).
- **Valeur attendue** : meilleure observabilité, résolution plus rapide des incidents, auditabilité complète du pipeline IA.

## 2. Portée & livrables
1. **Instrumentation backend** : tables `evaluation_runs` / `evaluation_run_contributions`, service RunLogger branché sur ChallengeService/Evaluator.
2. **API admin** : endpoints sécurisés pour lister, consulter et relancer les runs.
3. **Interface `/admin/evaluations`** : historique filtrable, vue détail, CTA de relance.
4. **Documentation & opérations** : mise à jour docs, exemples `.env`, runbook admin.
5. **Design System Evaluator** : stockage, édition et déploiement des grilles d’évaluation (critères, poids, instructions) directement depuis l’admin dashboard.
6. **Provisioning multi-repo** : création automatique d’espaces de travail (branche GitHub, repo Hugging Face, etc.) lors de l’association d’un challenge à un repo.

## 3. Architecture & composants impactés
| Zone | Actions |
| --- | --- |
| Database (Drizzle) | Ajouter tables + repositories `evaluationRuns` / `evaluationRunContributions`, schémas Zod. |
| Pipeline (ChallengeService & Evaluator) | Injecter RunLogger, suivi status/erreurs, persistance contributions. |
| Next Route Handlers | Nouvelles routes sous `apps/leaderboard-client/src/app/api/admin/evaluation-runs`. |
| Admin UI | Nouvelle page `/admin/evaluations`, drawer détail, modal relance. |
| Middleware/Auth | Vérifier que routes/API/Pages sont protégées (rôle admin). |
| Documentation | `docs/challenge-workflow.md`, runbook admin, `.env.example`. |
| Evaluator (packages/evaluator) | Lire les grilles depuis la DB/cache, fallback sur templates core, invalider le cache lorsqu’une grille est mise à jour. |
| Provisioning (packages/provisioner) | Nouveau package générique à drivers multiples pour créer les branches/espaces associés aux repos des challenges. |

## 4. Modèle de données détaillé

### 4.1 Table `evaluation_runs`
```ts
export const evaluationRuns = pgTable('evaluation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id')
    .notNull()
    .references(() => challenges.id, { onDelete: 'cascade' }),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'manual' | 'sync' | 'github_pr'
  triggerPayload: jsonb('trigger_payload'), // exemple: { prNumber, mergedBy }
  windowStart: timestamptz('window_start').notNull(),
  windowEnd: timestamptz('window_end').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // pending | running | succeeded | failed | canceled
  startedAt: timestamptz('started_at').defaultNow(),
  finishedAt: timestamptz('finished_at'),
  errorCode: varchar('error_code', { length: 100 }),
  errorMessage: text('error_message'),
  createdBy: uuid('created_by').references(() => users.id),
  retryOfRunId: uuid('retry_of_run_id').references(() => evaluationRuns.id),
  meta: jsonb('meta') // { contributionCount, durationMs, evaluatorVersion }
});
```
- Index `(challengeId, startedAt DESC)` pour les listes, `(status)` pour les filtres.
- Ajouter entité `EvaluationRun` + schéma Zod dans `packages/database-service/domain`.

### 4.2 Table `evaluation_run_contributions`
```ts
export const evaluationRunContributions = pgTable('evaluation_run_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id')
    .notNull()
    .references(() => evaluationRuns.id, { onDelete: 'cascade' }),
  contributionId: uuid('contribution_id')
    .notNull()
    .references(() => contributions.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull(), // identified | merged | evaluated | skipped
  notes: jsonb('notes'), // raison skip, warnings evaluator
  createdAt: timestamptz('created_at').defaultNow()
});
```
- Contrainte unique `(runId, contributionId)`.
- Repository dédié pour paginer les contributions d’un run, compter par statut.

### 4.3 Tables de grilles d’évaluation
Objectif : stocker la structure complète d’une grille (métadonnées, catégories, sous-critères, instructions) afin de la rendre éditable depuis l’admin.

```ts
export const evaluationGrids = pgTable('evaluation_grids', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).notNull().unique(), // ex: "code", "model"
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  instructions: text('instructions').notNull(),
  version: integer('version').notNull().default(1),
  isPublished: boolean('is_published').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamptz('created_at').defaultNow(),
  updatedAt: timestamptz('updated_at').defaultNow()
});

export const evaluationGridCategories = pgTable('evaluation_grid_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  gridId: uuid('grid_id')
    .notNull()
    .references(() => evaluationGrids.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  weight: numeric('weight', { precision: 5, scale: 4 }).notNull(), // somme des weights = 1
  type: varchar('type', { length: 32 }).notNull(), // objective | mixed | subjective | contextual
  position: integer('position').notNull()
});

export const evaluationGridSubcriteria = pgTable('evaluation_grid_subcriteria', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => evaluationGridCategories.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 120 }).notNull(),
  weight: numeric('weight', { precision: 5, scale: 4 }).notNull(),
  description: text('description'),
  metrics: jsonb('metrics'),      // string[]
  indicators: jsonb('indicators'),// string[]
  scoringExcellent: text('scoring_excellent').notNull(),
  scoringGood: text('scoring_good').notNull(),
  scoringAverage: text('scoring_average').notNull(),
  scoringPoor: text('scoring_poor').notNull(),
  position: integer('position').notNull()
});
```

- Contrainte : `weight` catégorie + sous-critères doivent totaliser 1 (contrôlé côté service).
- Ajouter entités `EvaluationGrid`, `EvaluationGridCategory`, `EvaluationGridSubcriterion` + schémas Zod.
- Repositories :
  - `evaluationGrids.repo.ts` (CRUD + publication, duplication/version increment).
  - `evaluationGridCategories.repo.ts` (bulk upsert + ré-ordonnancement).
  - `evaluationGridSubcriteria.repo.ts`.
- Prévoir seed initial qui migre les grilles statiques actuelles (`code`, `model`, `dataset`) vers ces tables.

### 4.4 Extension `challenge_repos` pour le provisioning
Objectif : stocker l’état du workspace créé automatiquement pour chaque couple challenge/repo.

```ts
export const challengeRepos = pgTable('challenge_repos', {
  challengeId: uuid('challenge_id').references(() => challenges.id, { onDelete: 'cascade' }),
  repoId: uuid('repo_id').references(() => repos.id, { onDelete: 'cascade' }),
  workspaceProvider: varchar('workspace_provider', { length: 32 }), // github, huggingface, ...
  workspaceRef: varchar('workspace_ref', { length: 200 }), // ex: refs/heads/challenge-codegen
  workspaceUrl: text('workspace_url'),
  workspaceStatus: varchar('workspace_status', { length: 20 }).default('pending'), // pending | ready | failed
  workspaceMeta: jsonb('workspace_meta'), // { baseBranch, createdBy, error }
}, (table) => ({
  pk: primaryKey({ columns: [table.challengeId, table.repoId] }),
}));
```
- `workspaceStatus` reflète l’état retourné par le provisioner (pending → ready ou failed).
- `workspaceMeta` capture les informations propres au provider (commit SHA, space slug, etc.).
- Repositories `challengeRepos.repo.ts`, mappers, entités et schémas Zod exposent ces nouveaux champs.

## 5. Instrumentation du pipeline

### 5.1 Service RunLogger
Créer `packages/services/run-logger.ts` :
- `startRun(ctx)` : insère `evaluation_runs` (status `running`, timestamps, challengeId, trigger info).
- `logContributions(runId, contributions)` : bulk insert `evaluation_run_contributions`.
- `markSucceeded(runId, meta)` : set `status = 'succeeded'`, `finishedAt`, `meta`.
- `markFailed(runId, { errorCode, errorMessage })` : set `status = 'failed'`, `finishedAt`, stocker message tronqué (1 000 caractères max).

### 5.2 Intégration ChallengeService
1. Lorsqu’un trigger démarre (manual, sync, PR), déterminer `windowStart` / `windowEnd`.
2. Appeler `RunLogger.startRun` et stocker `runId` dans le contexte pipeline (`EvaluationContext`).
3. Après `identify()`, appeler `logContributions` avec les UUIDs persistés.
4. En fin de workflow, `markSucceeded` avec `contributionCount`, `durationMs`.
5. `try/catch` global autour du pipeline → `markFailed` puis rethrow pour les observateurs.

### 5.3 Gestion des relances
- `retry_of_run_id` rempli lors d’un `POST /retry`.
- Les relances réutilisent par défaut `windowStart/windowEnd`, `triggerPayload`, `challengeId`.
- Vérifier qu’aucun run n’est déjà `running` pour le même challenge + fenêtre (sinon renvoyer 409 ou prévenir l’admin).

## 6. API Next.js (admin)

### 6.1 Commun
- Dossier : `apps/leaderboard-client/src/app/api/admin/evaluation-runs`.
- Protection middleware : seules les sessions `role === 'admin'` accèdent.
- Validation Zod pour query/body (`apps/leaderboard-client/src/lib/validation/admin/evaluation-runs.ts`).

### 6.2 Routes
1. `GET /api/admin/evaluation-runs`
   - Query : `challengeId`, `status[]`, `triggerType`, `from`, `to`, `page`, `pageSize`.
   - Réponse : `runs[]` (summary) + pagination.
2. `GET /api/admin/evaluation-runs/:id`
   - Détails : meta, triggerPayload (filtré), stats contributions (count par statut), erreurs.
3. `GET /api/admin/evaluation-runs/:id/contributions`
   - Query : `status`, `search` (UUID, user, step), pagination.
   - Jointure avec `contributions`, `users`, `challenge_steps`.
4. `POST /api/admin/evaluation-runs/:id/retry`
   - Body : `{ windowStart?, windowEnd?, reason }`.
   - Règles :
     - Autorisé si run original `failed` ou `succeeded`.
     - `reason` obligatoire (stocké dans `meta` du nouveau run).
     - Vérifier `windowStart <= windowEnd`.
     - Retour `202 Accepted` + `{ newRunId }`.
   - Déclenche `ChallengeService.runEvaluation` avec context `retryOfRunId`.

5. **Grilles d’évaluation**
   - `GET /api/admin/evaluation-grids`
     - Query : `search`, `status` (draft/published), `page`.
     - Retourne liste résumée (slug, version, statut, dernière mise à jour).
   - `GET /api/admin/evaluation-grids/:id`
     - Détail complet (catégories, sous-critères triés).
   - `POST /api/admin/evaluation-grids`
     - Crée une grille vide ou clonée d’une existante (`sourceGridId?`).
   - `PUT /api/admin/evaluation-grids/:id`
     - Mise à jour nom, instructions, description, statut (draft/published).
   - `PUT /api/admin/evaluation-grids/:id/categories`
     - Upsert ordonné des catégories (poids, type, position).
   - `PUT /api/admin/evaluation-grids/:id/subcriteria`
     - Upsert des sous-critères par catégorie.
   - `POST /api/admin/evaluation-grids/:id/publish`
     - Vérifie somme des poids, verrouille la version (incrémente `version` et bascule `isPublished = true`), invalide le cache evaluator.
   - Toutes les routes nécessitent rôle admin + validation stricte (Zod).

## 7. Interface `/admin/evaluations`

### 7.1 Navigation & feature flag
- Ajouter entrée “Évaluations” dans la sidebar admin.
- Gated par `NEXT_PUBLIC_ADMIN_EVALUATION_RUNS` (flag pour déploiement progressif).

### 7.2 Page principale
1. **Filtres persistants** : challenge (select), statut (multi), trigger, plage de dates.
2. **Cards métriques** : nb runs sur 7j, taux d’échec, durée moyenne, nb contributions traitées.
3. **Table historique** :
   - Colonnes : Run ID (copiable), Challenge, Trigger, Fenêtre analysée (start → end), Durée, # Contributions, Statut, Actions.
   - Action `Voir` → ouvre drawer détail.
   - Action `Relancer` (icône refresh) pour status `failed`.
4. **Pagination** (20 items).

### 7.3 Vue détail (drawer)
- **Header** : Challenge, statut badge, boutons `Relancer`, `Copier l’ID`.
- **Metadonnées** :
  - Trigger (type + payload exploitable).
  - Fenêtre temporelle, timestamps start/end, utilisateur à l’origine.
  - Message d’erreur (avec bouton “Copier”).
- **Timeline workflow** : steps `Identify → Merge → Evaluate → Persist`, chaque step affichant statut + durée.
- **Liste des contributions** :
  - Table paginée (UUID, auteur, étape roadmap, score, statut, date).
  - Bouton “Ouvrir contribution” renvoie `/admin/contributions/:id`.
- **Logs** (optionnel) : afficher extraits `meta.logs` (errno, warnings).

### 7.4 Modal de relance
- Pré-remplie avec `windowStart`, `windowEnd`, `triggerType`, `challenge`.
- Champs :
  - `Raison de la relance` (textarea obligatoire).
  - Option “Ajuster la fin à maintenant” (met `windowEnd = now`).
- Submit → `POST /retry`, spinner, feedback toast.
- Désactiver bouton si un run est déjà `running` pour le même challenge & fenêtre (message d’avertissement).

### 7.5 États & UX
- Skeleton sur table/détail pendant chargement.
- Message vide “Aucun run enregistré” + CTA documentation.
- Toasts d’erreur pour appels API (afficher `errorMessage` si disponible).

## 8. Interface `/admin/evaluation-grids`

### 8.1 Navigation & structure
- Nouvel onglet dans la sidebar : “Grilles d’évaluation”.
- Feature flag `NEXT_PUBLIC_ADMIN_GRIDS`.
- Layout en deux colonnes : liste des grilles (gauche) + panneau détail/édition (droite) ou navigation par routes (`/admin/evaluation-grids`, `/admin/evaluation-grids/:id`).

### 8.2 Listing
- Table ou carte listant : Nom, Type/slug, Version, Statut (Draft, Published), Dernière maj, Dernière publication.
- Actions :
  - `Voir / Éditer`
  - `Dupliquer` (cloner en draft)
  - `Créer une grille`
- Filtres : statut, type, recherche par nom/slug.

### 8.3 Edition d’une grille
1. **Entête** : Nom, description, slug (non modifiable après création), statut.
2. **Instructions** : éditeur Markdown (textarea + preview).
3. **Catégories** :
   - Liste ordonnable (drag & drop).
   - Champs : Titre, Type (select), Poids (slider % avec somme = 100%).
   - Bouton “Ajouter une catégorie”.
4. **Sous-critères** :
   - Pour chaque catégorie, formulaire répétable avec :
     - Label, Poids (somme = 100% de la catégorie ou calcul auto `cat.weight / nbSubcriteria`), description.
     - Liste de metrics / indicators (chips).
     - Scoring guide (Excellent/Good/Average/Poor) sous forme de textareas.
   - Possibilité de dupliquer un sous-critère.
5. **Actions** :
   - Bouton “Enregistrer brouillon”.
   - Bouton “Publier” (désactivé si validation KO).
   - Infos sur la version courante et l’auteur.

### 8.4 Validation & UX
- Contrôler en temps réel la somme des poids (barres de progression).
- Avertir si instructions vides ou slug déjà utilisé.
- Avant publication, afficher un récap (modal) listant les critères, total weights, changements majeurs.
- Indiquer si la grille est utilisée par un challenge actif (lecture via table `challenges` → `evaluation_grid_id` future extension).

### 8.5 États
- Loading skeleton quand on charge une grille.
- Empty state : “Aucune grille configurée” avec CTA “Importer depuis templates par défaut”.
- Toasts succès/erreur pour chaque action.

## 9. Intégration `packages/evaluator`

### 9.1 Chargement des grilles
- Ajouter un module `packages/evaluator/grids/loader.ts` :
  - `getEvaluationGrid(type: string)` → lit depuis cache mémoire.
  - Si cache manquant, requiert `packages/database-service` (ou service HTTP) pour récupérer la grille publiée (`is_published = true`, slug = type, version max).
  - Fallback : utiliser les templates statiques actuels embeddés (code/model/dataset) si DB vide.
- Exposer un mécanisme d’invalidation (ex: topic `evaluation-grid:updated:<slug>` ou simple TTL). L’API publish appelle `invalidateGridCache(slug)`.

### 9.2 Adaptation de `runEvaluateAgent`
- Remplacer l’import direct `EvaluationGridRegistry` par le nouveau loader.
- Maintenir compatibilité Detailed vs Simple :
  - Si la grille contient catégories + sous-critères → générer la même structure que précédemment.
  - Sinon (grille simple) → utiliser `criteriaTemplate`.
- Ajouter `grid.version` dans le contexte/prompt pour journaliser la version utilisée.
- Ajouter tests unitaires pour vérifier que le calcul des poids suit ce qui est défini en DB (cat.weight * sub.weight).

### 9.3 Migration des grilles existantes
- Script `packages/evaluator/scripts/migrate-grids.ts` :
  - Lire `code.grid.ts`, `model.grid.ts`, `dataset.grid.ts`.
  - Insérer dans la DB via les nouveaux repositories.
  - Marquer `isPublished = true`, version = 1.
- Après migration, conserver les fichiers TypeScript uniquement comme fallback (non référencés par défaut).

## 10. Provisioning multi-repo (workspace orchestration)

### 10.1 Package `packages/provisioner`
- **Objectif** : fournir une façade unique `provisionChallengeWorkspace()` qui sélectionne le provider adapté (`github`, `huggingface`, `custom`) selon le type de repo associé au challenge.
- **Structure** :
  - `src/index.ts` : fonction principale + wiring de la registry.
  - `src/registry.ts` : map `repoType` → provider (extensible).
  - `src/providers/githubBranch.provider.ts` : création d’une branche `challenge/<slug>` à partir de la ref par défaut (via Octokit REST ou GitHub App).
  - `src/providers/huggingfaceModel.provider.ts` : création d’un espace/branch modèle (placeholder si API non disponible immédiatement).
  - `src/types.ts` : `ProvisioningRequest`, `ProvisioningResult`, `WorkspaceStatus`.
  - `src/config.ts` : lecture des credentials/token/config provider.
  - `src/errors.ts` : erreurs normalisées (`AlreadyProvisioned`, `AuthenticationFailed`, `UnsupportedRepoType`…).
- **Contrat** :
  ```ts
  interface ProvisioningRequest {
    repoType: 'code' | 'model' | 'dataset' | string;
    provider: 'github' | 'huggingface' | string;
    repoExternalId: string; // ex: owner/name ou org/model
    challengeSlug: string;
    baseRef?: string;
    metadata?: Record<string, unknown>;
  }

  interface ProvisioningResult {
    provider: string;
    ref: string;        // refs/heads/challenge-ai-code
    url: string;        // https://github.com/...
    status: 'ready' | 'pending' | 'failed';
    meta?: Record<string, unknown>;
  }
  ```

### 10.2 Intégration dans ChallengeService / API admin
1. Lors de la création d’un challenge (`POST /api/challenges`) ou lors de l’association d’un repo (`POST /api/challenge-repos`), le service appelle `provisionChallengeWorkspace`.
2. Le résultat est persisté dans `challenge_repos.workspace*`.
3. En cas de statut `pending`, un job de retry peut réessayer ou marquer `failed`.
4. Le service renvoie les informations au front (lien branche, statut).

### 10.3 Surfaces côté admin
- Page challenge : nouvelle section “Workspace” listant chaque repo associé avec badge `Ready/Pending/Failed`.
- En cas d’échec, CTA “Reprovisionner” qui ré-appelle le package (avec confirmation).
- Historiser les métadonnées dans `workspaceMeta` (base branch, commit de départ, auteur).

### 10.4 Extensibilité & roadmap
- Ajout futur de providers (GitLab, Azure ML, dataset bucket) en déposant un nouveau driver + config.
- Possibilité d’ajouter un hook “post-provision” pour pré-remplir des templates (README, instructions).

## 11. Flux fonctionnels clés

### 10.1 Consultation des runs
1. Admin arrive sur `/admin/evaluations`.
2. Front appelle `GET /evaluation-runs` avec filtres par défaut (7 derniers jours).
3. L’admin clique sur un run → drawer -> fetch détail + contributions (lazy load).

### 10.2 Relance d’un run échoué
1. Depuis le drawer, clic “Relancer”.
2. Modal : admin valide ou ajuste dates, saisit raison.
3. `POST /retry` → réponse 202 avec `newRunId`.
4. UI insère un item “En cours” en tête de table, affiche toast succès.

### 10.3 Monitoring erreurs
1. Lorsqu’un run passe en `failed`, `errorMessage` est stocké.
2. UI couleur rouge + badge “Échec”.
3. Admin peut copier l’erreur pour la partager (bouton `Copier`).

### 10.4 Gestion d’une grille
1. Admin ouvre `/admin/evaluation-grids`.
2. Sélectionne une grille existante → l’éditeur charge les catégories/sous-critères via API.
3. Admin modifie poids / instructions, sauvegarde en draft (PUT).
4. Quand prêt, clique “Publier” → API effectue validations, crée nouvelle version, invalide cache evaluator.
5. Les prochains runs d’évaluation utiliseront la nouvelle version (loggée dans `evaluation_runs.meta.gridVersion`).

### 10.5 Provisioning automatique d’un workspace
1. Admin crée un challenge et associe un repo GitHub (type `code`) dans l’admin.
2. `ChallengeService` appelle `provisionChallengeWorkspace` → `GithubBranchProvider`.
3. Le provider crée la branche `challenge/<slug>` depuis la ref de base, puis retourne `{ status: 'ready', ref, url, meta }`.
4. `challenge_repos` est mis à jour (`workspaceProvider = 'github'`, `workspaceStatus = 'ready'`, etc.).
5. L’admin voit immédiatement le statut dans la fiche challenge. En cas d’échec, un bouton “Réessayer” relance l’appel.