# Challenge 020 – Séparation du core, des workflows et des modules

## ROADMAP

Chaque lot se déploie seul. Critères communs à tous les lots :
- `npm test` passe (tests d'architecture compris dès L1) ;
- `npm run db:apply-schema` lancé deux fois ne change rien au second passage ;
- les vérifications manuelles du lot sont décrites dans sa PR.

Référence : `SPEC.md` (les § cités renvoient à ce document).

---

### L0 — Nettoyage

- 0.1 Supprimer le pipeline sync legacy : `packages/services/challenge/{challenge.service,challenge-context.service,sync-evaluation.service}.ts`, `packages/connectors/connectors.orchestrator.ts`, la route `app/api/challenges/[id]/sync` et le bouton Sync de `app/admin/challenges/page.tsx`.
- 0.2 Supprimer `packages/services/webhook.service.ts`.
- 0.3 Supprimer `packages/evaluator/openai/{identify,merge}.agent.ts`, les méthodes `identify()`/`merge()` d'`evaluator.ts` et leurs types devenus inutiles.
- 0.4 Supprimer `packages/connectors/implementation/GD.connector.ts` et le cas `google_drive`.
- 0.5 Supprimer `packages/test/*`.
- 0.6 Nettoyer le barrel `packages/services/challenge/index.ts`.
- 0.7 Rebrancher provisoirement `app/api/evaluation-runs/[id]/retry` : 409 « non rejouable » en attendant L2.

**Fin de lot :** plus aucune référence aux fichiers supprimés ; `/admin/challenges` et `/admin/evaluation-runs` s'affichent.

---

### L1 — Registres et composition root

- 1.1 Interfaces du core : `FlowDefinition`, `ExtensionDefinition`, `KitDefinition`, `ConnectorDefinition`, `BundleSourceDefinition`, `WorkspaceProviderDefinition`, `ModuleDefinition` (§4.2, §4.9).
- 1.2 Registres (`packages/registry/`) avec détection des doublons au démarrage.
- 1.3 Manifestes `distribution/mytwin.server.ts` et `mytwin.client.ts`. Branchement unique du provider de grilles DB, des providers et des connecteurs.
- 1.4 Flows `code`, `ml` et `validation` en enveloppes des services existants : descripteur, `ruleKeys`, `contributionTypes`, hooks qui appellent le code actuel.
- 1.5 Remplacer les lectures de descripteur : `TYPE_LABELS`, `BRIEF_GATED_TYPES`, `PUBLIC_TYPES`, badges de `ChallengeCard`, `JOIN_CAPTIONS`.
- 1.6 `ConnectorRegistry` sans `switch` ni imports d'implémentations ; suppression des imports directs (`test-run`, `slack/channels`, `slack-signals.service`, `githubUrl`).
- 1.7 Déplacer `groupPolicy`, `group` et `splitShares` dans le domaine du core (fin du cycle `user.repo.ts` → services).
- 1.8 Test d'architecture et test « distribution vide » (§4.10). Supprimer `prod:min`.

**Fin de lot :** aucun changement de schéma ni d'URL ; les deux tests passent.

---

### L2 — Économie et évaluation

- 2.1 Rule keys déclarées : vérification via le registre dans `createManyAndSyncRewards`, suppression de l'union et de l'enum fermés.
- 2.2 `consumesPool` : reliquat, `completion` et `db-resync-rewards` calculés par le core. Harmonisation Slack avec journal des challenges concernés (§4.3, §7).
- 2.3 `countsAsContribution` à la place des exclusions `discussion`. Chips Slack du profil en slot de l'extension. `bestMetricValue` déplacé dans le flow ML.
- 2.4 Registre des sources de CP ; la sandbox s'y enregistre.
- 2.5 Capacité `evaluate({ bundle, gridSlug, subject })`. Sources `github-snapshot` et `kaggle-artifact`. Code, ML et sandbox branchés dessus.
- 2.6 Calcul des CP (`code-reward`, `ml-reward`) déplacé dans les flows. `RewardEntryDraft` passe dans le core.
- 2.7 `evaluation_runs` écrit par la capacité (`window_*` nullables). `retry` rejoue le handler déclaré ; la page admin affiche le flow.
- 2.8 Grilles en seeds insérées si absentes ; suppression du repli statique.

**Fin de lot :** une évaluation code, une ML et une formative de sandbox produisent chacune un run ; le resync ne corrige plus rien sur une base saine.

---

### L3 — Reprises de données

- 3.1 Colonnes `challenges.flow_config` et `flow_config_version`. Reprise de `workspace_mode`, `compute_enabled`, `cp_per_validation` et `required_validations` en version 1. Le code lit `flow_config`.
- 3.1 bis Versionnement : chaque flow déclare sa version de config et ses fonctions de montée de version. La lecture applique la montée en mémoire. Le script `db:upgrade-flow-configs` enregistre les montées et est ajouté au postdeploy (`Procfile`, `scalingo.json`) (§4.2).
- 3.2 `reward_rules` parsé par le flow.
- 3.3 Scission de la validation en `endpoint-validation` et `journey-validation`. Reprise du type (arrêt si cas indécidable, §7). Kit validation, livrables déclarés, suppression de `validation-mode.ts` et `scenario-guard.ts`.
- 3.4 Paramètres `reviewer_qualification`, `eligible_roles` et `expert_comment_qualification`, repris avec `medical_pro`.
- 3.5 Index unique partiel (`source_challenge_id`, `type`) pour les flows de validation.
- 3.6 Table `user_qualifications`, reprise des `medical_pro`, audit. `UserList` et `SANDBOX_CREATOR_ROLES` adaptés.
- 3.7 `sandboxes.proposal_fields` et reprise de `repo_url`, `model_url` et `dataset_urls`.

**Fin de lot :** les requêtes SQL de contrôle de chaque reprise (comptes avant/après) sont jointes à la PR ; les anciennes colonnes sont toujours présentes.

---

### L4 — Route générique et interface

- 4.1 Dispatcher `/api/challenges/[id]/flow/[...action]` et `/ext/[key]/[...action]`, autorisation déclarée par action, réponses binaires.
- 4.2 Migration des 24 routes de flow en actions, puis bascule de tous les appels client et suppression des routes.
- 4.3 Règles de flow retirées de `proxy.ts:295-377`.
- 4.4 Slots client : onglets contributeur et manager, sections du formulaire, vue des règles, stat du hero, vue anonyme.
- 4.5 Suppression de `ChallengeForm.tsx` ; `/admin/challenges` sur `CreateChallengeDrawer`.
- 4.6 Hooks `onCreate`/`onJoin`/`onGroupJoin`/`onClose`/`onDelete` ; `join/route.ts` et `[id]/route.ts` deviennent génériques.
- 4.7 Capacité `board` (copie du template, `board.isDone`) et `uses.board` / `uses.groups`.
- 4.8 Tests de route convertis en tests de handler et de dispatcher.

**Fin de lot :** plus aucun test sur le type de challenge dans `apps/leaderboard-client/src` (vérifiable par recherche) ; parcours contributeur et manager des quatre flows décrits pour vérification manuelle.

---

### L5 — Intégrations et crons

- 5.1 Table `integration_credentials`, reprise depuis `app_settings`, capacité `crypto`, `credentials.get(key)`.
- 5.2 Routes `/api/integrations/[key]/…`, carte générique et slot d'extras Slack ; suppression des 13 routes et des 5 cartes.
- 5.3 Activité opaque avec `activityRenderer` par connecteur ; `repo-activity` générique.
- 5.4 Disponibilité des providers lue dans le store. Le provider `github-branch` utilise le token OAuth GitHub, lu à chaque appel, avec `GITHUB_TOKEN` en simple repli. Vérification : avec GitHub connecté par OAuth, une branche perso est créée et protégée au join d'un challenge code.
- 5.5 `packages/scaleway` et `scaleway-gpu.provider` déplacés dans l'extension compute.
- 5.6 Table `cron_runs`, registre de jobs, `/api/cron/tick`. Les 5 routes cron deviennent des enveloppes du registre.
- 5.7 Jobs de rétention par propriétaire ; suppression de `cron/digest/retention.ts`.
- 5.8 **Déploiement :** bascule du Scalingo Scheduler sur une seule entrée `/api/cron/tick`.

**Fin de lot :** chaque intégration se connecte, se teste et se déconnecte depuis la carte générique ; `cron_runs` montre les 5 jobs et les jobs de rétention exécutés en prod.

---

### L6 — Modules

- 6.1 Contrat de module et table `module_settings` (reprise des flags et réglages digest et sandbox). Application côté serveur : 404, jobs sautés, slots masqués.
- 6.2 Outbox `platform_events`, table `event_deliveries`, distribution par le tick. Catalogue initial de six événements, limité à ce que les quêtes d'onboarding consomment (§4.9) : `user.created`, `task.created`, `evaluation.requested`, `contribution.evaluated`, `ui.challenge_opened`, `ui.meeting_link_opened`.
- 6.3 Onboarding : quêtes déclarées, table `onboarding_progress(user_id, quest_key, completed_at)` et reprise ; retrait de `trackOnboardingStep` du core et des flows ; `initForUser` abonné à `user.created`.
- 6.4 `GoogleAuthService` déplacé dans l'identité du core ; module meetings (slot de la page challenge, route de lecture propre, `meetings` retiré de l'overview, nav admin et proxy par slots).
- 6.5 Digest en module (réglages dans `module_settings`).
- 6.6 Sandbox en module : capacité `proposable` des flows code et ML, `promotion.ts` sans branches par type, évaluation formative via `evaluate()`.

**Fin de lot :** chaque module désactivé renvoie 404 sur ses routes et n'exécute plus ses jobs ; les quêtes d'un nouvel utilisateur se valident par événements.

---

### L7 — Finalisation

- 7.1 `DROP` des colonnes remplacées :
  - `challenges` : `workspace_mode`, `compute_enabled`, `cp_per_validation`, `required_validations` ;
  - `app_settings` : credentials, flags de modules, réglages digest et sandbox ;
  - `onboarding_progress` : les 5 colonnes booléennes ;
  - `sandboxes` : `repo_url`, `model_url`, `dataset_urls`.
- 7.1 bis Retrait de `medical_pro` de la liste des rôles acceptés par `proxy.ts`, au moins 7 jours après le déploiement de L3 (durée d'un refresh token).
- 7.1 ter Retrait du repli `GITHUB_TOKEN`, dans le code (`getGithubToken`, `config`) puis dans l'environnement Scalingo, une fois le provisioning par OAuth vérifié en prod.
- 7.2 Suppression des enveloppes des anciennes routes cron (Scalingo Scheduler basculé et vérifié).
- 7.2 bis Vérifier qu'aucun projet Vercel ne déploie ce dépôt, puis supprimer `vercel.json` et les mentions de Vercel comme planificateur dans `docs/api.md`, `docs/deployment.md`, `docs/digest.md`, `docs/slack-signals.md` et `docs/project-structure.md` (§4.6). Si un déploiement Vercel est trouvé, garder un seul cron vers `/api/cron/tick`.
- 7.3 Mise à jour de `docs/architecture.md`, `docs/packages.md`, `docs/project-structure.md`, `docs/deployment.md`, `docs/admin-settings.md`, `docs/onboarding.md`, `docs/sandbox.md` et `docs/validation-challenges.md`. Nouveau `docs/writing-a-flow.md`.

**Fin de lot :** un flow d'exemple minimal (jetable, hors distribution) s'installe dans un manifeste de test, sans aucune modification du core ni du schéma.
