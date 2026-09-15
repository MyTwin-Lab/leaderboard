# Challenge 020 – Séparation du core, des workflows et des modules

## 1. Contexte & objectifs

- **Problème identifié** : la plateforme ne sait faire que trois sortes de challenges (`code`, `ml`, `validation`), et chacune est câblée en dur partout.
  - `challenges.type` est une chaîne libre, testée plus de 130 fois dans une quarantaine de fichiers : services, routes, pages, formulaires (annexe A).
  - Il n'existe ni registre ni point d'assemblage. Chaque route instancie ses services, et trois registres statiques sont initialisés à trois endroits différents.
  - La configuration propre à chaque type, les credentials des intégrations, les interrupteurs des modules et les quêtes d'onboarding sont figés en colonnes.
  - Les dépendances vont dans les deux sens : des flows lisent le core, et le core lit des flows (le leaderboard connaît Slack, le ledger connaît la métrique ML).
- **Objectif** : séparer le code en natures distinctes, suivant `docs/input/leaderboardos-phase1-taxonomy.md`, **et** poser le **contrat de flow** qui manque. Un nouveau workflow de challenge doit pouvoir être ajouté sans modifier le core. C'est le prérequis au besoin MyTwin : générer des workflows personnalisés pour d'autres cas que le code et le ML.
- **Valeur attendue** :
  - Un nouveau flow (écrit à la main aujourd'hui, produit par un moteur de templates demain) se déclare et s'installe dans la distribution. Il n'exige ni migration de schéma, ni nouvelle route, ni modification des pages du core.
  - Les connecteurs de MyTwin (GitHub, Kaggle, Slack) passent par le chemin qu'emprunterait un connecteur client. C'est le « test du client zéro » de la taxonomie.
  - Le core démarre et se teste sans aucun contenu ni module installé.
  - Deux incohérences existantes disparaissent :
    - la règle « hors pool » est codée de quatre façons (§4.3) ;
    - les interrupteurs de modules ne protègent que l'interface (§4.9).

> Ce challenge va volontairement **au-delà de la phase 1 de la taxonomie** (simple re-rangement, zéro migration). Les écarts sont listés et justifiés en §4.12. Il ne construit **pas** le moteur de templates (phase 2).

Décisions arbitrées lors de la préparation (session du 15/09/2026) : toutes les options de ce document ont été validées une à une. Aucune n'est une proposition en attente.

## 2. Portée

Inclus dans ce challenge, livré en huit lots ordonnés et déployables un par un (voir `ROADMAP.md`) :

1. **Nettoyage** du code mort (lot L0).
2. **Registres et assemblage.** Le contrat de flow, d'extension, de connecteur, de source de bundle et de module. Un manifeste de distribution MyTwin. Des tests d'architecture (L1).
3. **Économie et évaluation génériques.** Clés du ledger déclarées, règle « hors pool » unique, sources de CP, évaluation sur bundle, runs systématiques, grilles en seeds (L2).
4. **Reprises de données.** `flow_config`, scission de la validation en deux flows, qualifications, champs de proposition de la sandbox (L3).
5. **Route générique et slots d'interface.** Une route de flow générique, l'autorisation déclarée par action, des slots d'UI à la place des ternaires (L4).
6. **Intégrations et crons.** Un store générique de credentials, des routes d'intégration génériques, un seul tick de cron, des jobs déclarés (L5).
7. **Modules.** Un contrat de module, un bus d'événements, des quêtes déclarées, la sandbox et les meetings en modules (L6).
8. **Finalisation.** Suppression des anciennes colonnes et mise à jour de la documentation (L7).

Explicitement **hors périmètre** : voir §8. Il n'y a ni moteur de templates, ni génération de workflow.

Point de départ : les correctifs de sécurité de `docs/temp.md` sont **déjà en place**. Ce challenge reprend leurs règles telles quelles, notamment `canAccessChallengeInternals` (`lib/server/managerAuth.ts:16`) et `toSignedInOverview` (`lib/public/overview.ts:111`), dans les déclarations d'autorisation des actions (§4.2) et dans la route du module meetings (§4.9).

## 3. Acteurs & permissions

| Acteur | Ce qui change pour lui |
|---|---|
| **Admin** | Rien de fonctionnel. Les intégrations (GitHub, Kaggle, OpenAI, Slack, Scaleway) se connectent depuis une carte générique. Les modules (meetings, onboarding, digest, sandbox) s'activent depuis un écran générique. Les qualifications se gèrent à part du rôle dans `UserList`. |
| **Manager de projet** | Inchangé (`projects.manager_id`). Ses droits sur les actions de flow sont désormais déclarés par chaque action, et non plus codés dans `proxy.ts`. |
| **Contributeur** | Inchangé. Ses quêtes d'onboarding se valident côté serveur, avec jusqu'à une minute de délai. Il ne peut plus marquer une étape lui-même. |
| **Personne qualifiée** (`medical_pro` aujourd'hui) | Devient un `contributor` porteur de la qualification `medical_pro`. Mêmes droits qu'avant. Un admin peut désormais aussi être qualifié. |
| **Viewer / visiteur anonyme** | Inchangé. |
| **Auteur de flow** (développeur MyTwin aujourd'hui, générateur demain) | Nouvel acteur technique. Il écrit un flow, une extension, un connecteur ou un module contre les interfaces du core, puis l'ajoute au manifeste de distribution. Il ne touche jamais aux fichiers du core. |
| **Planificateur** (Scalingo Scheduler) | Une seule entrée, `* * * * *`, vers `/api/cron/tick`, au lieu de cinq. |

## 4. Architecture détaillée

### 4.1 Vocabulaire et taxonomie

| Nature | Définition | Exemples |
|---|---|---|
| **Core** | Ce que tout programme utilise et qu'aucun ne redéfinit. | Identité, structure (projects, repos, challenges, participations, documents), économie (ledger, sources de CP, leaderboard), capacités, shell (layout, navigation, admin, design system) |
| **Capacité** | Service du core qu'un flow, une extension ou un module appelle. | `evaluate`, `bundle`, `http_proxy`, `crypto`, `cron`, `events`, `board`, `groups`, `qualifications` |
| **Flow** | Définition d'un type de challenge. Exactement un par challenge. | `code`, `ml`, `endpoint-validation`, `journey-validation` |
| **Extension** | Comportement attachable à un challenge, pour les flows qu'elle déclare compatibles. | `slack-signals` (tous les flows), `compute` (ML) |
| **Kit** | Code partagé par plusieurs flows, qui n'est pas un flow. | `validation` (cibles, contribution du validateur, paiement) |
| **Connecteur** | Accès à un service externe, derrière l'interface du core. | `github`, `kaggle`, `slack` |
| **Source de bundle** | Produit l'entrée d'une évaluation. | `github-snapshot`, `kaggle-artifact` |
| **Provider de workspace** | Provisionne un espace de travail. | `github-branch`, `scaleway-gpu` (dans l'extension compute) |
| **Module produit** | Fonctionnalité de la distribution, activable. | `meetings`, `onboarding`, `digest`, `sandbox` |
| **Distribution** | Manifeste qui assemble ce qui est installé. | `mytwin` |

Sens des dépendances autorisées : contenu (flows, extensions, kits, connecteurs, sources, providers) → core ; modules → core ; distribution → tout. Le core n'importe jamais le contenu ni les modules. Un flow n'importe jamais un autre flow ; il peut importer un kit. Voir §4.10.

### 4.2 Contrat de flow

Forme indicative (le nommage exact est fixé en L1) :

```ts
interface FlowDefinition<Config, Rules> {
  key: string;                               // 'code', 'ml', 'journey-validation'…
  descriptor: {
    label: string; badge: BadgeSpec; joinCaption: string;
    briefRequired: boolean; publiclyVisible: boolean;
  };
  config: { schema: ZodType<Config>; version: number;                    // flow_config + flow_config_version
            upgrades?: Record<number, (old: unknown) => unknown>;        // montée N → N+1
            editableKeys?: (keyof Config)[] };
  rules?: { parse(raw: unknown): Rules | null };                          // reward_rules
  ruleKeys: RuleKeyDeclaration[];            // { key, consumesPool } — §4.3
  contributionTypes: ContributionTypeDeclaration[];   // { key, countsAsContribution, profileSlot? }
  deliverables?: { contributionType: string; capabilities: ('endpoint' | 'deployed_app' | string)[] }[]; // §4.7
  requires?: { deliverableCapability: string };        // flows de validation
  uses?: { board?: boolean; groups?: boolean };        // §4.8
  hooks?: { onCreate?; onJoin?; onGroupJoin?; onClose?; onDelete? };
  actions: Record<string, FlowAction>;       // exposées par la route générique
  jobs?: JobDeclaration[];                   // §4.6
  quests?: QuestDeclaration[];               // §4.9
  proposable?: ProposableDeclaration;        // §4.9 sandbox
}

interface FlowAction {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  auth: { roles?: Role[]; qualification?: string | ((config) => string);
          member?: boolean; manager?: boolean; public?: boolean };
  handle(ctx: FlowActionContext): Promise<Response | JsonValue>;   // binaire autorisé
}
```

**Configuration : `challenges.flow_config` (jsonb), versionnée.**
- Elle est validée par `config.schema` à la création et figée ensuite, sauf les clés de `editableKeys`.
- **Versionnement** : la colonne `challenges.flow_config_version` (entier, `NOT NULL`, 1 par défaut) enregistre la version sous laquelle la config a été écrite.
  - Chaque flow déclare `config.version` (sa version courante) et `config.upgrades`, une fonction par version de départ qui transforme la config de la version N vers N+1.
  - **À la lecture**, une config plus ancienne est montée en mémoire jusqu'à la version courante, en enchaînant les fonctions. Aucune écriture n'a lieu à ce moment-là.
  - **Au déploiement**, le script idempotent `db:upgrade-flow-configs` enregistre les montées en base. Il est ajouté au postdeploy (`Procfile`, `scalingo.json`), après `db:apply-schema`.
  - **À l'écriture**, la config est toujours enregistrée dans la version courante.
  - Une fonction de montée manquante fait échouer le démarrage, comme un doublon de registre.
  - La version courante de tous les flows existants est 1 à la reprise (L3).
- Elle reprend `workspace_mode` (code), `cp_per_validation` et `required_validations` (validation).
- `compute_enabled` est la config de l'extension compute : on la stocke sous `flow_config.extensions.compute.enabled`, et elle reste éditable.
- Le code ne lit plus ces colonnes à partir de L3, et elles sont supprimées en L7.

**Lien parent.** `source_challenge_id` reste une vraie colonne avec sa FK : c'est une relation entre challenges, pas un paramètre. Le core la voit comme un lien générique vers un challenge parent, que seuls les flows de validation utilisent aujourd'hui.

**Règles de récompense.** `reward_rules` reste une colonne séparée, éditable après création. Elle est parsée par `rules.parse` du flow, ce qui supprime le « ML sinon Code » de `apps/leaderboard-client/src/app/api/challenges/route.ts:85` et de `[id]/route.ts`. Répartition : `flow_config` est figé à la création, `reward_rules` est modifiable.

**Route générique** `/api/challenges/[id]/flow/[...action]`, et `/api/challenges/[id]/ext/[key]/[...action]` pour les extensions.
- **Résolution et contrôle** : le dispatcher résout le challenge, son flow et l'action, puis applique `auth`. Les rôles viennent de `getSessionUser` (relu en base) ; `member` passe par `challenge_teams` et les groupes, `manager` par `isManagerOfChallenge`.
- **Exécution** : il appelle ensuite `handle`, qui peut renvoyer une réponse binaire (fichiers de validation, via `buildSafeFileHeaders`).
- **Routes supprimées** : les 24 routes de flow actuelles, dont tous les appels client sont migrés :
  - 15 routes `validation-*` ;
  - 4 routes compute ;
  - `ml-workspace`, `ml-rewards`, `project-evaluation`, `workspace` ;
  - `signals` et `slack-config`.
- **Proxy** : les règles propres aux flows de `apps/leaderboard-client/src/proxy.ts:295-377` disparaissent. Le proxy ne garde qu'une règle générique pour `/flow/` et `/ext/`, qui confie l'autorisation au dispatcher.
- **Tests** : les tests de route deviennent des tests de handler et de dispatcher.

**Slots d'interface.** Un registre client distinct, pour ne pas mêler les bundles serveur et navigateur, remplace :

| Slot | Remplace |
|---|---|
| `contributorTabs(ctx)` | les ternaires de `app/challenges/[slug]/ChallengeDetailClient.tsx:633-674` |
| `manageTabs(ctx)` | `components/challenges/ChallengeManageView.tsx:548-635` |
| `createFormSection` / `editFormSection` | les blocs par type de `components/admin/CreateChallengeDrawer.tsx` |
| `rulesView` | `components/challenges/RewardRulesDrawer.tsx:83-87` |
| `heroStat`, `anonymousView` | `ChallengeDetailClient.tsx:423-429,607` |
| `profileContributionSlot` | chips de profil (Slack) |
| `activityRenderer` | activité d'un connecteur (§4.5) |

`components/admin/ChallengeForm.tsx`, qui double le drawer, est supprimé. `app/admin/challenges/page.tsx` passe par `CreateChallengeDrawer`.

**Descripteur.** Il remplace les listes et tables écrites en dur :
- `lib/server/home.ts:17` `TYPE_LABELS` ;
- `lib/challengeBrief.ts:46` `BRIEF_GATED_TYPES` (utilisé aussi par `lib/joinGate.ts`) ;
- `lib/public/challengeVisibility.ts:14` `PUBLIC_TYPES` ;
- la map de badges de `components/public/ChallengeCard.tsx` ;
- `JOIN_CAPTIONS` de `components/challenges/ChallengeBrief.tsx`.

**Hooks.**
- `onCreate` remplace l'appel à `buildRepoDefinitions` (`packages/services/challenge/challengeRepos.ts`).
- `onJoin` remplace la logique par type de `app/api/challenges/[id]/join/route.ts:139-210`, c'est-à-dire la branche perso et sa protection. La copie du board relève de la capacité `board` (§4.8).
- `onGroupJoin` remplace `reprotectGroupBranch` (`join/route.ts:43`).
- `onClose` et `onDelete` remplacent l'arrêt des instances compute (`app/api/challenges/[id]/route.ts`), désormais porté par l'extension compute.

**Extensions.** Même forme réduite (`key`, `appliesTo: flowKey[] | '*'`, `config`, `ruleKeys`, `contributionTypes`, `actions`, `hooks`, `jobs`, `slots`). `slack-signals` s'applique à tous les flows ; `compute` au seul flow `ml`.

### 4.3 Économie

- **Clés du ledger.** Chaque flow, extension ou kit déclare ses `rule_key`, et le registre refuse les doublons au démarrage.
  - Les clés existantes restent identiques (`dataset`, `model_metric`, `model_code`, `beat_best`, `api_packaging`, `reuse_dataset`, `reuse_model`, `slack_signal`, `validation`, `code_fixed`, `code_quality`) : aucune reprise de données.
  - L'union fermée `RewardRuleKey` (`packages/database-service/domain/entities.ts:141`) et l'enum zod `rewardRuleKeySchema` (`domain/schemas_zod.ts`) sont remplacés par une vérification via le registre à l'écriture (`RewardEntryRepository.createManyAndSyncRewards`).
- **Hors pool, une seule règle.** Chaque clé déclare `consumesPool`. Le core calcule seul le reliquat, la `completion` et le resync.
  - État actuel, incohérent :
    - `ml-rewards.service.ts:248` et `code-rewards.service.ts:267,290` excluent `slack_signal` ;
    - `validation-challenge.service.ts:254` et `scenario-walkthrough.service.ts:337` ne l'excluent pas ;
    - `scripts/db-resync-rewards.ts:59` ne l'exclut que pour `ml`.
  - Bug probable qui en découle : à chaque déploiement, le resync réécrit la `completion` d'un challenge code ayant des signaux Slack, en comptant ces signaux.
  - **Décision** : `slack_signal` déclare `consumesPool: false`, et tous les calculs lisent cette déclaration (changement assumé, §5).
- **Contributions.** Chaque type de contribution déclare `countsAsContribution`, ce qui remplace les exclusions `type === 'discussion'` de `lib/leaderboard.ts:96`, `lib/server/home.ts:94` et `lib/server/leaderboard.ts:139`.
  - Un type est déclaré une seule fois : `discussion` par l'extension Slack, `validation` par le kit validation.
  - Les chips « Discussion » du profil (`lib/server/leaderboard.ts:167-199`) deviennent le `profileContributionSlot` de l'extension Slack.
  - `bestMetricValue` (`rewardEntry.repo.ts:86`, `rule_key = 'model_metric'`) part dans le flow ML.
- **Sources de CP.** Le core expose un registre de sources extérieures au ledger (`{ userId, points, createdAt, countsAsContribution }`), que `aggregateUsersByContribution` additionne à `reward_entries`.
  - `sandbox_rewards` reste une table séparée : on garde l'arbitrage de `docs/sandbox.md` (pas de `challenge_id`, pas de cache, idempotence par index partiels).
  - La sandbox s'enregistre comme source, ce qui supprime l'injection en dur de `lib/leaderboard.ts:109-118`.
- **Invariants conservés.** Ledger en ajout seul, trigger `trg_sync_contribution_reward`, et clôture d'un challenge sans aucun calcul.

### 4.4 Évaluation

- **Capacité `evaluate({ bundle, gridSlug, subject })`.** Un bundle est un dossier de fichiers et de textes préparé sur disque, que l'agent lit via son outil `read_file`.
  - La préparation et le nettoyage (`SnapshotService.prepareSnapshot` / `cleanup`) passent dans le core.
  - L'agent (`packages/evaluator/openai/evaluate.agent.ts`) et le registre de grilles restent dans le core.
- **Sources de bundle, en contenu :**
  - `github-snapshot` : `evaluateGithubRepo` de `packages/services/challenge/repo-evaluation.ts` et `SnapshotService.buildAggregatedSnapshot` ;
  - `kaggle-artifact` : la chaîne d'évaluation de `ml-rewards.service.ts`.

  Une source future (formulaire, fichier déposé, document) s'ajoute sans toucher au core. C'est la condition pour noter un workflow qui ne produit pas un repo.
- **Calcul des CP.** `packages/evaluator/code-reward.ts` part dans le flow code, `ml-reward.ts` dans le flow ML. `RewardEntryDraft`, aujourd'hui défini dans `ml-reward.ts` et importé par `code-reward.ts`, passe dans le domaine du core, tout comme `splitShares` (`evaluator/share.ts`).
- **Runs.** Chaque appel `evaluate()` écrit un `evaluation_runs`, pour tous les appelants : code, ML, sandbox et flows futurs.
  - `trigger_type` vaut la clé du flow, de l'extension ou du module appelant.
  - `window_start` et `window_end` deviennent nullables.
  - Une ligne `evaluation_run_contributions` pointe la contribution évaluée ; il n'y en a pas pour la sandbox, dont le sujet est rangé dans `meta.subject`.
  - `services/run-logger.ts` est réécrit comme partie de la capacité, et `evaluation-runs/[id]/retry` rappelle le handler déclaré par l'appelant.
  - La page `/admin/evaluation-runs` affiche flow, statut, durée et erreur.
  - Aujourd'hui, le seul écrivain de cette table est le pipeline legacy supprimé en L0.
- **Grilles.** `code`, `model` et `dataset` (`packages/evaluator/grids/*.grid.ts`) deviennent des seeds de contenu, insérées en base si absentes.
  - Le repli statique silencieux (`grids/index.ts:133-140`) est supprimé : une grille absente lève une erreur explicite qui cite son slug.
  - Le branchement du provider DB (`setDatabaseProvider`, aujourd'hui appelé à trois endroits) se fait une seule fois, dans la distribution.

### 4.5 Connecteurs, intégrations, provisioner

- **Store de credentials.** Nouvelle table `integration_credentials(key PK, secret_enc, secret_iv, meta jsonb, connected_at, connected_by → users ON DELETE SET NULL)`.
  - La reprise copie les colonnes `github_*`, `kaggle_*`, `openai_*`, `slack_*` et `scaleway_*` d'`app_settings` (`packages/database-service/db/drizzle.ts:880-925`). Ces colonnes ne sont plus lues à partir de L5 et sont supprimées en L7.
  - `encryptToken` et `decryptToken` (`packages/config/githubToken.ts`) deviennent la capacité `crypto`.
  - Les getters `packages/config/*Credentials.ts` sont remplacés par `credentials.get(key)`.
- **Routes génériques.** `/api/integrations/[key]/{connection,status,authorize,callback}`, plus des actions d'extras déclarées (ex. `channels` pour Slack).
  - Chaque connecteur déclare son mode d'authentification (`oauth` ou `api_key` avec ses champs), sa fonction de test et ses champs publics.
  - Une réponse de statut destinée à un non-admin se limite à `{ connected }`.
  - Les 13 routes par fournisseur (`app/api/{github-oauth,kaggle,slack,scaleway,openai}/**`) et les 5 cartes `components/contributor/*ConnectionCard.tsx` sont remplacées par une carte générique et un slot d'extras.
- **Registre.** Les connecteurs s'enregistrent dans la distribution (`{ key, repoTypes, create(repo, credentials, options) }`).
  - `packages/connectors/registry.ts` perd son `switch` et ses imports d'implémentations.
  - `ConnectorType` devient une chaîne validée par le registre.
  - Les imports directs d'implémentations disparaissent : `evaluation-grids/[id]/test-run/route.ts`, `slack/channels/route.ts`, `slack-signals.service.ts` et `githubUrl.ts` (Octokit en propre) passent tous par le registre.
- **Activité.** L'interface du core ne connaît plus que `{ connectorKey, payload }`, et `RepoActivity` / `GitHubRepoActivity` / `KaggleRepoActivity` quittent `packages/connectors/interfaces.ts`.
  - Chaque connecteur fournit son `activityRenderer` et, au besoin, un extracteur typé pour ses consommateurs (métriques Kaggle pour le flow ML).
  - `app/api/challenges/[id]/repo-activity/route.ts` et `lib/public/repoActivity.ts` deviennent génériques.
- **Provisioner.** Le squelette (`packages/provisioner/src/types.ts`, `registry.ts`) reste dans le core ; les providers s'enregistrent dans la distribution.
  - La disponibilité d'un provider se lit dans le store de credentials.
  - **Une seule identité GitHub.** Le provider `github-branch` utilise le token de la connexion OAuth GitHub, lu dans le store **à chaque appel** et non au démarrage, puisqu'un admin peut reconnecter GitHub à tout moment.
    - Aujourd'hui, les lectures (connecteur, évaluation) utilisent déjà ce token via `getGithubToken`. La création et la protection des branches passent en revanche par la variable d'environnement `GITHUB_TOKEN` (`github-branch.provider.ts:22`, `provisioner/src/index.ts:25`).
    - Le scope demandé (`repo read:org`, `app/api/github-oauth/authorize/route.ts`) et le contrôle « admin ou owner de l'organisation » du callback couvrent la création et la protection des branches.
    - Conséquence assumée : branches et protections sont faites au nom de l'admin qui a connecté GitHub. S'il quitte l'organisation ou révoque l'accès, il faut reconnecter GitHub, comme c'est déjà le cas pour les lectures.
    - `GITHUB_TOKEN` reste un repli jusqu'en L7, puis est retiré de l'environnement Scalingo.
  - `packages/scaleway` et `scaleway-gpu.provider.ts` passent dans l'extension compute, et `scaleway-provider.helper.ts` (ré-enregistrement à chaque appel) disparaît.

### 4.6 Crons et capacités techniques

- **Un seul tick.** La route `/api/cron/tick` est appelée chaque minute et protégée par `isCronAuthorized` (`lib/server/cronAuth.ts`).
  - Le registre des jobs (déclarés par le core, les flows, les extensions et les modules) porte les horaires en syntaxe cron.
  - Nouvelle table `cron_runs(job_key PK, last_started_at, last_finished_at, last_status, last_error, locked_until)`. Un job est dû si son horaire est échu depuis `last_started_at`. Il est pris par un `UPDATE … WHERE locked_until < now()` conditionnel, ce qui empêche qu'il tourne deux fois.
  - Le tick distribue aussi les événements (§4.9).
  - En prod, le **Scalingo Scheduler** passe à une seule entrée.
  - **Vercel.** `vercel.json` date d'un essai de février 2026, et la prod tourne sur Scalingo. En L7, on vérifie qu'aucun projet Vercel ne déploie ce dépôt. Si c'est le cas, on supprime `vercel.json` et les mentions de Vercel comme planificateur dans les docs. Si un déploiement Vercel existe, on garde un seul cron vers `/api/cron/tick`.
- **Jobs issus des routes actuelles :**

  | Job | Propriétaire | Horaire |
  |---|---|---|
  | `meetings.check` | module meetings | `* * * * *` |
  | `slack-signals.detect` | extension Slack | `0 6 * * *` |
  | `compute.provisioning` | extension compute | `* * * * *` |
  | `compute.expiration` | extension compute | `* * * * *` |
  | `digest.generate` | module digest | `0 5 * * *` |

- **Rétention.** Chaque propriétaire déclare son job quotidien, qui tourne même si le digest est désactivé ; `app/api/cron/digest/retention.ts` disparaît.
  - core : `refresh_tokens.cleanupExpired`, purge de `platform_events` ;
  - module sandbox : `purgeIpHashesOlderThan` ;
  - flow `endpoint-validation` : `purgeBytesForChallengesClosedBefore` sur les cas et les claims.
- **Déplacés sans refonte.** `ssrf-guard.ts` et `endpoint-proxy.ts` forment la capacité `http_proxy` du core.
- **Supprimé en L0.** `webhook.service.ts`, orphelin et cassé. Un déclencheur webhook sera réécrit le jour où il servira.

### 4.7 Validation

- **Deux flows au lieu d'un type à deux modes.**
  - `endpoint-validation` : cas de référence, claims, verdicts, quorum (template §2 de la suite LeaderboardOS).
  - `journey-validation` : étapes de scénario, walkthroughs, retours par étape (template §11).
  - Ils remplacent `type = 'validation'`. La reprise fixe le type selon le type de la source : `ml` → `endpoint-validation`, `code` → `journey-validation` (cas sans source : §7).
- **Kit validation, en contenu.** Il regroupe :
  - `validation_targets` ;
  - `validatorContribution.ts` (contribution agrégée `type: 'validation'`) ;
  - le paiement `cp_per_validation` avec `rule_key: 'validation'`.

  La clé et le type de contribution sont conservés et déclarés une seule fois par le kit.
- **Supprimés.** `validation-mode.ts` (`validationModeFor`, `TARGET_CONTRIBUTION_TYPE`) et `scenario-guard.ts`, remplacés par la résolution du flow.
- **Livrables.** Le flow source déclare ses livrables (`ml` : `api_packaging` → `endpoint` ; `code` : `project` → `deployed_app`), et chaque flow de validation déclare la capacité qu'il exige.
  - Le sélecteur de source du formulaire et la liste des contributions éligibles (`app/api/challenges/[id]/validation-targets/route.ts:72-84,234-240`) lisent ces déclarations.
  - Un flow personnalisé qui produit une application déployée devient ainsi parcourable sans toucher à la validation.
- **Paramètres de qualification.** `flow_config` porte :
  - `reviewer_qualification` (endpoint : rédaction, réclamation, verdict) ;
  - `eligible_roles` (journey) ;
  - `expert_comment_qualification` (journey : avis expert sur une étape).

  La reprise pose `medical_pro` sur les challenges existants.
- **Contrôles en dur remplacés.** `reference-case.service.ts:89,136`, `validation-challenge.service.ts:125` et `scenario-walkthrough.service.ts:37,268` lisent ces paramètres. La colonne `validation_step_feedbacks.medical_comment` est conservée ; son libellé d'UI vient du flow.
- **Unicité.** Index unique partiel sur (`source_challenge_id`, `type`) pour les flows de validation, à la place de la vérification par `findAll()` de `app/api/challenges/route.ts:131-137`. Une source offrant les deux livrables pourra avoir une validation de chaque sorte.

### 4.8 Board, groupes, qualifications

- **Board (kanban personnel) : capacité du core.**
  - Elle couvre les tâches, les templates, la copie du template au join (sortie de `join/route.ts:156-179`) et une lecture `board.isDone(ownerId)`.
  - Un flow l'active via `uses.board`, qui remplace le garde `challenge.type !== 'code'` de `app/api/tasks/route.ts:81`.
  - Le flow code en fait une condition préalable à l'évaluation, sans plus lire `taskRepo` en direct (`code-rewards.service.ts:154-156`).
- **Groupes : capacité du core, politique globale inchangée.**
  - `groupPolicy.ts` (3 membres maximum, multiplicateur par pas de 0,4, porteur), `group.ts` (`resolveWorkspaceOwner`) et `splitShares` passent dans le domaine du core.
  - Cela casse le cycle `packages/database-service/repositories/user.repo.ts:21` → `services/challenge/groupPolicy.ts`.
  - Un flow accepte les groupes via `uses.groups`.
- **Qualifications.** `users.role` ne porte plus que des permissions : `admin`, `contributor` ou `viewer`.
  - Nouvelle table `user_qualifications(user_id, key, granted_by, granted_at, note)`. Chaque octroi ou retrait est audité dans la même transaction, comme `role_changes`.
  - Les clés sont déclarées par la distribution (`mytwin` : `medical_pro`, avec son libellé).
  - Reprise : chaque utilisateur `medical_pro` devient `contributor` et reçoit la qualification `medical_pro`.
  - `SANDBOX_CREATOR_ROLES` (`lib/server/sandboxAuth.ts:22`) perd `medical_pro`, puisque les personnes qualifiées sont des contributeurs.
  - `components/admin/UserList.tsx` gère les qualifications à part du rôle.

### 4.9 Modules

- **Contrat de module** : `key`, `settings` (schéma zod), `routes`, `jobs`, `subscriptions`, `quests` et slots (navigation admin, section de la page challenge, layout racine, onglet de `/contributors/me`).
  - Module désactivé : ses routes répondent 404, ses jobs sont sautés, ses abonnements ne consomment pas d'événements, et ses slots sont masqués côté serveur **et** côté client.
  - Nouvelle table `module_settings(key PK, enabled, settings jsonb, updated_at, updated_by)`, remplie depuis `app_settings.modules_meetings_enabled`, `modules_onboarding_enabled`, `digest_enabled`, `digest_frequency_days`, `sandbox_star_tiers` et `sandbox_promotion_bonus_cp`.
  - `app/api/modules/route.ts` et `app/api/admin/digest-settings/route.ts` deviennent un écran de modules générique.
- **Bus d'événements (outbox)** : table `platform_events(id, type, payload jsonb, occurred_at)`, écrite **dans la transaction** de l'action.
  - Le tick distribue les événements aux abonnés, et `event_deliveries(subscriber_key, last_event_id)` suit l'avancement de chacun.
  - **Règle du catalogue** : un événement n'existe que s'il a au moins un abonné. Le catalogue initial couvre exactement les 5 quêtes d'onboarding d'aujourd'hui et l'initialisation de la progression. Un nouvel événement est ajouté par le lot, ou le flow, qui ajoute son abonné.

    | Événement | Émis par | Quand (équivalent actuel) | Données | Abonné |
    |---|---|---|---|---|
    | `user.created` | core (identité) | création du compte au login (`app/api/google-auth/callback/route.ts:104`, `initForUser`) | `userId` | onboarding : initialise la progression |
    | `task.created` | capacité `board` | création d'une tâche perso (`ContributorTaskBoard.tsx:104`) | `taskId`, `challengeId`, `userId` | onboarding : quête `assigned_task` |
    | `evaluation.requested` | flow `code` | lancement accepté d'une évaluation de projet (`CodeChallengePanel.tsx:60`) | `challengeId`, `userId` | onboarding : quête `validated_task` |
    | `contribution.evaluated` | capacité `evaluate` | fin d'un run réussi rattaché à une contribution (jamais émis aujourd'hui) | `contributionId`, `challengeId`, `userId`, `flowKey` | onboarding : quête `evaluated_contribution` |
    | `ui.challenge_opened` | client (page challenge) | ouverture d'un challenge (`ChallengeDetailClient.tsx:175`) | `challengeId` | onboarding : quête `clicked_challenge` |
    | `ui.meeting_link_opened` | client (slot meetings) | clic sur le lien Meet (`ChallengeDetailClient.tsx:630`) | `meetingId` | onboarding : quête `joined_meeting` |

  - **Événements d'interface.** Les événements `ui.*` sont les seuls émis depuis le navigateur. Ils passent par une route restreinte : utilisateur connecté, uniquement les clés `ui.*` déclarées par les propriétaires, et un challenge ou un meeting visible par cet utilisateur. Ils restent déclaratifs : ils ne prouvent qu'un clic.
  - Tous les appels `trackOnboardingStep` sont retirés du core et des flows : `ChallengeDetailClient.tsx`, `ContributorTaskBoard.tsx`, `CodeChallengePanel.tsx`.
  - Ce bus est aussi le futur déclencheur du moteur de la phase 2.
- **Onboarding.** Chaque propriétaire déclare ses quêtes (clé, libellé, événement déclencheur) : `validated_task` par le flow code, `joined_meeting` par meetings, `assigned_task` par le board, etc. Les clés de quête actuelles sont conservées.
  - Nouvelle table `onboarding_quest_progress(user_id, quest_key, completed_at)`, reprise depuis les 5 colonnes booléennes de `onboarding_progress`, qui garde son nom jusqu'au `DROP` de L7.
  - `onboardingStepSchema` (`schemas_zod.ts:445`) et `OnboardingStep` (`entities.ts:769`) sont supprimés.
  - `evaluated_contribution`, jamais émise aujourd'hui, se valide sur `contribution.evaluated`.
- **Meetings.**
  - `GoogleAuthService` (`packages/services/google-workspace/google-auth.service.ts`) est le login OAuth des utilisateurs : il rejoint l'identité du core. `google-calendar.service.ts` et `google-meet.service.ts` restent dans le module.
  - L'overview du core (`app/api/challenges/[id]/overview/route.ts:74-78`) ne renvoie plus `meetings`. Le module fournit son slot sur la page challenge et sa propre route de lecture. Celle-ci reprend les règles d'accès déjà en place : `canAccessChallengeInternals` et le filtrage des champs de meeting de `toSignedInOverview`.
  - Les références en dur passent par les slots : `proxy.ts`, `app/admin/layout.tsx:20`, `app/admin/page.tsx`, `ChallengeManageView.tsx`.
- **Digest.** Module qui lit le core (sens correct). Ses méthodes de fenêtre temporelle (`findCreatedBetween`, `findClosedBetween`) restent des lectures génériques des repositories du core.
- **Sandbox : module produit.**
  - Les flows qui acceptent les propositions déclarent `proposable` :
    - schéma des champs de la proposition ;
    - source de bundle et grille de l'évaluation formative ;
    - hook `promote(sandbox, input)`, qui produit le brouillon de challenge et crédite l'auteur (le flow ML appelle son propre `award`).
  - `sandboxes.type` devient une clé de flow validée par le registre.
  - Les champs `repo_url`, `model_url` et `dataset_urls` sont repris dans un jsonb `sandboxes.proposal_fields`, validé par le schéma du flow (colonnes supprimées en L7).
  - Couplages supprimés :
    - branches code/ml de `packages/services/sandbox/promotion.ts:122-138,195-299` ;
    - imports de `ML_ROLE_RULE`, `normalizeArtifactUrl`, `MlRewardsService` et `buildRepoDefinitions` dans `sandbox-promotion.service.ts` ;
    - `evaluateGithubRepo` en direct dans `sandbox-evaluation.service.ts`.

### 4.10 Assemblage et garde-fous

- **Distribution.** `apps/leaderboard-client/src/distribution/mytwin.server.ts` liste ce qui est installé (flows, extensions, kits, connecteurs, sources de bundle, providers, modules, qualifications, jobs) et remplit les registres une seule fois. `mytwin.client.ts` fait de même pour les slots d'interface. C'est la composition root unique : `setDatabaseProvider`, `initializeProviders` et les enregistrements du compute y convergent.
- **Test d'architecture (vitest).** Il parcourt le graphe d'imports de `packages/`, `content/`, `modules/` et `apps/` et échoue si :
  - le core importe du contenu, un module ou la distribution ;
  - un flow importe un autre flow (un kit est autorisé) ;
  - un module importe du contenu ou un autre module ;
  - une page ou une route du shell importe du contenu ou un module ailleurs que via la distribution.
- **Test « distribution vide ».** Le core démarre avec un manifeste vide : les registres sont vides, le leaderboard s'agrège et les routes du core répondent. Il remplace la fausse preuve de `prod:min`, qui ne fait que poser des variables d'environnement factices. `prod:min` et son mode `min` de `scripts/prod.sh` sont supprimés.
- **Pourquoi un test et pas un lint** : le dépôt n'a ni CI ni configuration ESLint effective, alors que `npm test` tourne déjà.

### 4.11 Arborescence cible

```
packages/                        # CORE
  config/  database-service/
  evaluator/                     # agent + registre de grilles (runtime)
  capabilities/                  # bundle, http_proxy, crypto, cron, events, board, groups, qualifications
  connectors/                    # interfaces + registre
  provisioner/                   # interfaces + registre
  registry/                      # flows, extensions, kits, modules, rule keys, sources de CP
content/                         # CONTENU INSTALLÉ
  flows/code/  flows/ml/  flows/endpoint-validation/  flows/journey-validation/
  kits/validation/
  extensions/slack-signals/      # + slack-signal-agent
  extensions/compute/            # + client Scaleway, provider scaleway-gpu
  connectors/github/  connectors/kaggle/  connectors/slack/
  bundle-sources/github-snapshot/  bundle-sources/kaggle-artifact/
  workspace-providers/github-branch/
  grids/                         # seeds (la base reste la source de vérité)
modules/                         # MODULES PRODUIT
  meetings/                      # + sync-meeting-agent, google-calendar, google-meet
  onboarding/  digest/  sandbox/
apps/leaderboard-client/         # shell + routes génériques
  src/distribution/mytwin.server.ts  src/distribution/mytwin.client.ts
```

Indicatif : ce qui compte, ce sont les frontières vérifiées par le test d'architecture, pas les noms exacts. Les composants React d'un flow ou d'un module vivent dans son dossier et sont exposés par ses slots.

### 4.12 Écarts avec la taxonomie

| Taxonomie | Ce challenge | Raison |
|---|---|---|
| Re-rangement seul, comportement identique | Contrat de flow + registres | Sans cela, un nouveau workflow touche encore environ 110 sites du core |
| Zéro migration de schéma | Migrations en L3/L5/L6, suppression des colonnes en L7 | Un flow, un connecteur ou un module installé comme contenu ne peut pas ajouter de colonnes |
| Scaleway, capacité native du core | Contenu de l'extension compute | Son seul consommateur est le compute ; le store de credentials et les jobs couvrent ses besoins |
| `webhook.service.ts` gardé comme futur déclencheur | Supprimé | Cassé (import inexistant), sans appelant |
| `medical_pro` → `params.reviewer_role` | Qualification séparée + paramètre de flow | Une qualification n'est pas une permission (`docs/architecture.md:106`) |
| Sandbox non classée | Module produit, flows « proposables » | Couplée au flow ML, activable, ledger séparé |
| Validation → deux templates en phase 3 | Deux flows dès maintenant | Le mode déduit empêche un flow personnalisé d'être validable |
| `prod:min` « prouve déjà » le core seul | Test « distribution vide » | `prod:min` ne désactive rien dans le code |
| Interfaces des connecteurs inchangées | Activité rendue opaque | `RepoActivity` est une union GitHub \| Kaggle dans le core |

## 5. Règles & contraintes

- **Chaque lot se déploie seul.** Tous les tests sont verts à chaque lot, et aucun lot ne laisse l'application dans un état intermédiaire cassé.
- **Les migrations passent par `scripts/db-apply-schema.ts`** et sont idempotentes : un second passage ne change rien. Le schéma Drizzle (`packages/database-service/db/drizzle.ts`) est mis à jour dans le même lot.
- **Suppression en deux temps.** Une colonne remplacée n'est plus lue dès son lot de reprise, mais elle n'est supprimée qu'en L7, après une mise en prod vérifiée. Un retour arrière du code reste possible sans perte.
- **Le core ne contient aucun nom de flow, d'extension, de connecteur ou de module.** Pas de `'code'`, `'ml'`, `'slack_signal'`, `'discussion'` ni `'medical_pro'` dans le code du core, ce que vérifie le test d'architecture.
- **Registres.** Toute déclaration en double (clé de flow, de rule key, de type de contribution, de job, de quête, de qualification) fait échouer le démarrage.
- **Ledger.** Il reste en ajout seul, le trigger de synchronisation est conservé, et la clôture d'un challenge ne calcule rien.
- **Autorisation déclarée.** Une action de flow sans déclaration `auth` est refusée à l'enregistrement : il n'existe aucune action publique par défaut.
- **Changements de comportement assumés** (et eux seuls) :
  1. `slack_signal` ne consomme plus le pool des challenges de validation, et `db-resync-rewards` ne réécrit plus la `completion` des challenges code en comptant Slack.
  2. Chaque évaluation écrit un `evaluation_runs`.
  3. Une grille absente de la base produit une erreur explicite au lieu d'un repli statique.
  4. Les interrupteurs de modules sont appliqués côté serveur ; la sandbox devient désactivable.
  5. Les quêtes d'onboarding se valident côté serveur, avec jusqu'à une minute de délai ; un utilisateur ne peut plus valider une étape lui-même, et `evaluated_contribution` fonctionne.
  6. `medical_pro` devient `contributor` avec la qualification `medical_pro`.
  7. Les URL d'API des flows, des intégrations et du cron changent (seul client : l'application).
  8. Le planificateur n'appelle plus qu'un seul endpoint.
- **Vérification des lots.** Les vérifications manuelles d'un lot sont décrites pour l'équipe : l'agent qui implémente ne lance ni serveur ni navigateur.

## 6. États

**Cycle d'un lot**

```
en cours → mergé → déployé → vérifié en prod → (L7 seulement) colonnes remplacées supprimées
```

**Job de cron** (`cron_runs`)

```
dû (horaire échu depuis last_started_at) → pris (locked_until posé par UPDATE conditionnel)
  → succeeded | failed (last_error) → verrou relâché
pris et process mort → verrou expiré (locked_until dépassé) → dû au tick suivant
module désactivé → sauté (aucun passage enregistré)
```

**Événement** (`platform_events` / `event_deliveries`)

```
écrit dans la transaction de l'action → distribué par le tick à chaque abonné actif
  → curseur de l'abonné avancé après succès
  → échec : curseur non avancé, nouvel essai au tick suivant (abonné idempotent)
abonné d'un module désactivé → curseur figé → reprise du retard à la réactivation
événement plus vieux que la rétention → purgé
```

**Run d'évaluation** (`evaluation_runs.status`)

```
pending → running → succeeded | failed → (retry) nouveau run rejouant le handler déclaré
```

## 7. Cas limites à couvrir

- **Challenge dont le flow n'est pas installé** dans la distribution (clé inconnue) :
  - la page s'affiche en lecture seule avec un descripteur générique ;
  - ses actions répondent 404, ses hooks et jobs ne s'exécutent pas ;
  - aucune création n'est possible avec cette clé ;
  - ses lignes de ledger continuent de compter au leaderboard.
- **Rule key présente dans le ledger mais non déclarée** (extension retirée) : elle compte dans les totaux, et `consumesPool` prend `true` par défaut, ce qui est journalisé. Aucune ligne n'est modifiée.
- **`flow_config` d'une version plus ancienne** que celle du flow installé : montée en mémoire à la lecture, puis enregistrée par `db:upgrade-flow-configs` au déploiement (§4.2). Si une fonction de montée échoue sur un challenge, le script le journalise et passe au suivant. Ce challenge reste alors en lecture seule jusqu'à correction.
- **`flow_config` d'une version plus récente** que celle du flow installé (retour arrière du code après un déploiement) : le challenge s'affiche en lecture seule, ses actions d'écriture répondent 409, et aucune descente de version n'est tentée.
- **Challenge de validation sans source** (source supprimée) lors de la scission :
  - le type se déduit des tables filles (`validation_reference_cases` → endpoint, `validation_scenario_steps` → journey) ;
  - si aucune n'existe, la reprise **s'arrête** et liste les identifiants à trancher à la main. Aucun type n'est deviné.
- **Signaux Slack déjà prélevés sur le pool d'un challenge de validation** avant l'harmonisation :
  - aucun CP déjà versé n'est repris ;
  - le reliquat augmente et le resync recalcule la `completion` à la baisse ;
  - la reprise journalise les challenges concernés.
- **Jeton JWT émis avant la reprise** avec `role: 'medical_pro'` :
  - le proxy accepte aujourd'hui ce rôle pour l'accès aux pages (`proxy.ts:8,19-20`) et continue de l'accepter jusqu'en L7, donc au moins 7 jours après le déploiement de L3 (durée d'un refresh token), pour ne bloquer aucune session en cours ;
  - les contrôles serveur relisent le rôle et les qualifications en base (`getSessionUser`), donc les droits réels sont ceux d'un `contributor` qualifié dès la reprise ;
  - au prochain refresh, le jeton porte `contributor`.
- **Bascule du planificateur** : les anciennes routes cron restent en place tant que le Scalingo Scheduler n'est pas basculé sur `/api/cron/tick` (L5). Elles deviennent de fines enveloppes qui exécutent le job du registre, et ne sont supprimées qu'en L7. Le verrou `cron_runs` empêche une double exécution si les deux appels coexistent.
- **Tick plus long qu'une minute** : le verrou par job empêche le chevauchement, et le tick suivant ne reprend que les jobs non verrouillés.
- **Module désactivé** : les CP déjà gagnés via la sandbox restent au leaderboard (la source de CP reste enregistrée en lecture) ; ses routes d'écriture répondent 404.
- **Sandbox dont le flow n'est plus proposable ou plus installé** : la promotion est refusée avec une erreur explicite ; la proposition reste consultable.
- **Deux déclarations du même type de contribution** (ex. deux flows qui déclareraient `validation`) : le démarrage échoue. Le type est déclaré une seule fois, par le kit.
- **Flow personnalisé sans board ni groupes** : le join crée la participation sans copier de template ni proposer de groupe ; les routes `tasks` refusent ce challenge.
- **Qualification retirée** à une personne ayant des verdicts ou des walkthroughs en cours : ce qui est déjà enregistré reste compté (même règle que la section 7 de challenge-014) ; les nouvelles actions sont refusées.
- **Reprise de l'onboarding** : les étapes déjà faites deviennent des quêtes avec `completed_at` = date de reprise, faute d'historique.
- **`app_settings` sans ligne** sur une base vierge : les reprises vers `integration_credentials` et `module_settings` ne créent rien. Elles se contentent du défaut « module désactivé ou non configuré ».

## 8. Hors périmètre / limites connues

- **Moteur de templates et génération de workflows** (phase 2) : ce challenge fournit l'interface que le moteur implémentera, pas le moteur lui-même.
- **Format de manifeste en données** des connecteurs (0.3) : les connecteurs restent des « manifestes en code ».
- **Colonnes de workspace et de rôle ML** : `challenge_teams.workspace_*`, `challenge_repos.workspace_*` et `challenge_repos.role` restent en place, lues uniquement par les flows code et ML. Leur passage en ressources génériques relève de la phase 3.
- **`contributions` comme ressource générique**, et les colonnes propres aux flows `artifact_url`, `live_endpoint_url` et `evaluation_status` : inchangées.
- **Correctifs de sécurité et de conformité** de `docs/temp.md` : déjà livrés. Ce challenge part de cet état et reprend leurs règles (§2).
- **Capacités futures** `spawn_challenge`, notifications sortantes et déclencheur webhook : non créées.
- **Packaging** en workspaces npm : les frontières sont garanties par test, pas par des `package.json`.
- **Refonte visuelle** : les slots reproduisent l'interface actuelle à l'identique.

## 9. Questions ouvertes

Aucune question bloquante. Les questions de la préparation sont tranchées :
- **Correctifs de `docs/temp.md`** : déjà en place (§2).
- **Versionnement de `flow_config`** : `flow_config_version` et fonctions de montée déclarées par les flows (§4.2).
- **Catalogue d'événements** : limité aux quêtes d'onboarding existantes (§4.9).
- **Token GitHub du provisioning** : `GITHUB_TOKEN` est défini sur Scalingo, donc le provisioning fonctionne aujourd'hui en prod. Il passera par le token OAuth à partir de L5, et la variable sera retirée en L7 (§4.5).

Une vérification reste à faire en cours de route :
1. **Vercel** (en L7) : vérifier qu'aucun projet Vercel ne déploie ce dépôt avant de supprimer `vercel.json` (§4.6).

## Annexe A — Inventaire des tests sur le type de challenge

Relevé du 15/09/2026 : comparaisons à `'code'`, `'ml'` ou `'validation'`, drapeaux `isML` / `isValidation` / `isScenarioValidation`, `validationModeFor`, et listes `BRIEF_GATED_TYPES` / `PUBLIC_TYPES` / `TYPE_LABELS` / `JOIN_CAPTIONS`. On compte 142 occurrences dans 42 fichiers, dont 7 dans 2 fichiers de test.

Le relevé ne capture pas les tests indirects : type passé en prop, heuristique `ML_REPO_TYPES`, `sandbox.type`. Chaque lot refait la recherche sur son périmètre avant de se déclarer terminé.

| Zone | Fichier (occurrences) | Traité en |
|---|---|---|
| Domaine | `packages/database-service/domain/schemas_zod.ts` (2) | L3 (clés validées par le registre) |
| Services | `services/challenge/code-rewards.service.ts` (2), `ml-rewards.service.ts` (1) | L1 (enveloppes), L4 (garde du dispatcher) |
| Services | `services/challenge/validation-challenge.service.ts` (1), `reference-case.service.ts` (2), `validatorContribution.ts` (1), `validation-mode.ts` (1), `scenario-guard.ts` (2) | L3 (scission de la validation) |
| Services | `services/challenge/challengeRepos.ts` (2) | L4 (hook `onCreate`) |
| Services | `services/compute/compute-request.service.ts` (1) | L5 (extension compute) |
| Services | `services/sandbox/promotion.ts` (5) | L6 (flows proposables) |
| Routes | `app/api/challenges/route.ts` (7), `app/api/challenges/[id]/route.ts` (1), `[id]/join/route.ts` (1) | L3 (config), L4 (hooks) |
| Routes | `[id]/workspace` (1), `[id]/ml-rewards` (1), `[id]/compute-requests` (1), `compute-requests/[requestId]/decision` (1), `[id]/validation-rewards` (1), `[id]/validation-runs` (1), `validation-runs/[attemptId]/response` (1), `validation-runs/[attemptId]/file` (1), `[id]/validation-scenario-runs` (1), `[id]/validation-targets` (3) | L4 (routes supprimées, actions de flow) |
| Routes | `app/api/tasks/route.ts` (1) | L4 (`uses.board`) |
| Pages | `app/challenges/[slug]/ChallengeDetailClient.tsx` (13), `components/challenges/ChallengeManageView.tsx` (16) | L4 (slots d'onglets) |
| Composants | `components/admin/CreateChallengeDrawer.tsx` (28) | L4 (sections de formulaire) |
| Composants | `components/admin/ChallengeForm.tsx` (14) | L4 (supprimé) |
| Composants | `components/challenges/RewardRulesDrawer.tsx` (2), `ChallengeBrief.tsx` (2), `shared/ChallengeActivity.tsx` (3) | L4 (slots, descripteur), L5 (activité) |
| Composants | `components/admin/promotionRequestBody.ts` (1), `components/sandbox/CreateSandboxModal.tsx` (2) | L6 (sandbox) |
| Bibliothèques | `lib/challengeBrief.ts` (2), `lib/joinGate.ts` (2), `lib/public/challengeVisibility.ts` (2), `lib/server/home.ts` (2), `lib/server/seo.ts` (2) | L1 (descripteur) |
| Pages publiques | `app/about/page.tsx` (2) | L1 (descripteur) |
| Tests | `services/challenge/challengeRepos.test.ts` (2), `validation-mode.test.ts` (5) | L3/L4 (réécrits ou supprimés) |

Chemins relatifs à `apps/leaderboard-client/src/` pour `app/`, `components/` et `lib/`, et à `packages/` pour `services/`.
