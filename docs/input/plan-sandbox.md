# Plan d'implémentation — Sandbox (challenge-017)

**Date :** 2026-09-09
**Branche :** `challenge-017-sandbox`
**Spec :** [spec-sandbox.md](spec-sandbox.md) — sa section 0 liste les écarts arbitrés et fait foi en cas de contradiction.
**Maquette :** projet Claude Design « Redesign page principale leaderboard », fichier `Sandbox Redesign.dc.html`.

Ce document est le plan de référence. Il est écrit pour être suivi palier par palier,
chacun donnant lieu à un commit de code et un commit de doc séparés.

---

## 1. Décisions transverses

### 1.1 Description structurée

`context text`, `goals jsonb string[]` (défaut `[]`), `why text` — trois champs distincts
plutôt qu'un markdown unique, parce que c'est ce que rend la page détail de la maquette et
que ça guide l'auteur vers une proposition exploitable.

À la promotion, une description markdown est composée pour `challenges.description`
(`## Context` / `## What I want to build` en liste / `## Why it matters`), et les `goals`
pré-remplissent les template tasks du drawer.

### 1.2 Entrées ML : datasets en tableau, modèle optionnel

`dataset_urls jsonb string[]` — au moins une URL requise pour un sandbox `ml`, `max(10)`.
Le tableau plutôt qu'un champ simple parce qu'un challenge ML stocke déjà
`workspace_meta.datasetUrls[userId]` sous cette forme : la promotion pré-remplit sans
conversion. **Le formulaire V1 n'expose qu'un seul champ** (comme la maquette), mappé sur
`dataset_urls[0]` ; un bouton « + » pourra venir plus tard sans migration.

`model_url` reste nullable : un sandbox ML peut démarrer sans artefact.

### 1.3 Grille d'évaluation : `code` pour les deux types

**Les deux types de sandbox sont évalués avec la grille de slug `code`.**

C'est ce que fait déjà un challenge ML pour le code, comme le montre la table des rôles de
`packages/services/challenge/ml-rewards.service.ts` :

| Rôle ML | Grille |
|---|---|
| `dataset` | `dataset` |
| `model` | `null` — scoré sur une métrique Kaggle, pas sur une grille |
| `model_code` | **`code`** |
| `api` | `code` |

La grille `model` (`packages/evaluator/grids/model.grid.ts` : performance, innovation,
reproductibilité) n'évalue donc jamais de code — elle n'est pas utilisée par le pipeline de
scoring. La retenir pour un sandbox ML aurait noté un repo avec une grille pensée pour un
artefact.

Conséquence utile : si une grille personnalisée est publiée en base sous le slug `code`,
`DatabaseGridProvider` la sert automatiquement — le sandbox hérite du réglage de l'instance
sans code supplémentaire.

Ce qui distingue un sandbox `ml` d'un sandbox `code` à l'évaluation n'est donc pas la
grille, mais le **contexte textuel** passé à l'agent : les URLs de datasets et de modèle
sont injectées dans la `description` du sujet évalué (`Model artifact: …` / `Datasets: …`).
Ce qui est snapshoté reste, dans les deux cas, le repo GitHub — seul artefact que le
pipeline sait capturer.

### 1.4 CP sandbox et leaderboard : table dédiée

`reward_entries` n'est pas touché. Une table `sandbox_rewards` porte les CP du sandbox :
`rule_key ∈ {star_tier, promotion}`, `tier_stars`, `points`, `user_id` dénormalisé.

**Pourquoi une table à part.** `reward_entries.challenge_id` est `NOT NULL` avec une FK vers
`challenges`, et tout le leaderboard agrège par contribution (`aggregateUsersByContribution`).
Même `slack_signal`, l'exemple « hors pool » cité par la spec, passe par un `challenge_id`
et une contribution `discussion`. Un sandbox n'a ni l'un ni l'autre et n'a pas à en simuler :
sandbox et challenge sont deux objets délibérément séparés.

**Idempotence** portée par deux index uniques partiels :
`(sandbox_id, tier_stars) WHERE rule_key='star_tier'` — un palier payé une seule fois par
sandbox, donc les cycles star/unstar ne peuvent pas payer deux fois ;
`(sandbox_id) WHERE rule_key='promotion'` — un sandbox promu, et payé, une seule fois.
Les index sont **partiels** parce que `tier_stars` est NULL pour une promotion : un index
unique global ne bloquerait rien, Postgres considérant deux NULL comme distincts.

**Aucune colonne de cache** — pas d'équivalent de `contributions.reward`. Le total sandbox
d'un contributeur est toujours un `SUM(points)` en direct. Deux bénéfices : rien à ajouter à
`scripts/db-resync-rewards.ts`, et supprimer une ligne (action admin) *est* la reprise de CP.

**Injection dans l'agrégation — un seul point d'entrée.**
`aggregateUsersByContribution()` (`apps/leaderboard-client/src/lib/leaderboard.ts`) reçoit un
paramètre optionnel `sandboxRewards?: SandboxReward[]` et, après la boucle sur les
contributions, ajoute `points` aux totaux **sans toucher `counts`** — exactement le traitement
réservé aux contributions `discussion` : des CP, pas une contribution de plus.

- `timePeriod` s'applique sur `sandbox_rewards.created_at` ;
- `projectId` non nul → **CP sandbox exclus** (un sandbox n'a pas de projet) ; documenté ;
- `rankEntries`, les rangs et `rankGap` en découlent sans modification.

Appelants à alimenter, tous lisant déjà `contributionMember.findAll()` — même geste :
`fetchLeaderboard` et le calcul de rang global de `fetchContributorProfile`
(`lib/server/leaderboard.ts`), `fetchHomeOverview` (`lib/server/home.ts`). Dans le profil,
`totalCP` = somme des challenges + `sandboxReward.findByUser(userId)` ; `contributionShare`
reste par challenge, intouché. `home.ts` : la stat « CP distributed » ajoute la somme
sandbox, sinon le podium afficherait plus de CP que la stat globale.

**Fusion de comptes** (`repositories/accountMerge.repo.ts`) : sans réassignation, le
`ON DELETE CASCADE` sur `users` effacerait sandboxes, stars et rewards du compte absorbé.
À ajouter dans la transaction existante : `sandboxes.user_id`, `sandbox_rewards.user_id`,
`sandbox_stars.user_id` — avec dédoublonnage préalable si les deux comptes ont staré le même
sandbox (la ligne du compte absorbé est supprimée).

### 1.5 Stars anonymes : identité, unicité, débit, rattachement

Un visiteur non connecté peut starer. C'est ce qui permettra, plus tard, de liker un sandbox
directement depuis une newsletter. **Les stars anonymes comptent et paient les paliers** au
même titre que celles des comptes.

#### Schéma `sandbox_stars`

```
uuid        uuid PK default gen_random_uuid()
sandbox_id  uuid NOT NULL FK sandboxes ON DELETE CASCADE
user_id     uuid NULL     FK users     ON DELETE CASCADE
anon_id     varchar(64) NULL      -- identifiant porté par le cookie signé
origin      varchar(10) NOT NULL  -- 'account' | 'anonymous', figé à la création (audit)
ip_hash     varchar(64) NULL      -- HMAC-SHA256, purgé à 30 jours
created_at  timestamp NOT NULL default now()
removed_at  timestamp NULL        -- unstar = soft-delete ; re-star = réactivation
attached_at timestamp NULL        -- star anonyme rattachée à un compte à la connexion

CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL)
UNIQUE (sandbox_id, user_id) WHERE user_id IS NOT NULL   -- idx_sandbox_stars_unique_user
UNIQUE (sandbox_id, anon_id) WHERE user_id IS NULL       -- idx_sandbox_stars_unique_anon
INDEX  (sandbox_id) WHERE removed_at IS NULL             -- comptage
INDEX  (ip_hash, created_at)                             -- rate-limit
INDEX  (anon_id)                                         -- rattachement
```

**Soft-delete plutôt que suppression.** Un palier payé n'est jamais repris ; une vague
star → unstar doit donc laisser une trace exploitable. `removed_at` conserve la ligne (audit,
et le rate-limit continue de compter sur `created_at`), et le compteur ne lit que
`removed_at IS NULL`. Une identité n'a jamais qu'une ligne par sandbox : starer est un
`INSERT … ON CONFLICT (…) DO UPDATE SET removed_at = NULL`.

#### Cookie signé

`sb_anon` : JWT HS256 signé avec `config.auth.jwtSecret` via `jose` — exactement le mécanisme
de `lib/auth.ts`. Payload `{ aid: <uuid> }`, `exp` un an, `httpOnly`, `sameSite: 'lax'`,
`secure` en production, `path: '/'` (les options de `google-auth/callback/route.ts`).

Émis **uniquement** par `PUT /star` quand la requête n'en porte pas — jamais sur un GET, pour
ne pas poser de cookie à un simple lecteur. Helper `lib/server/anonVisitor.ts` :
`readAnonId(request)`, `issueAnonCookie(response)`.

#### L'IP sert au débit, jamais à l'unicité

`lib/server/clientIp.ts` : premier élément de `x-forwarded-for`, sinon `x-real-ip`, sinon
`127.0.0.1` en dev. `hashIp(ip)` = `HMAC-SHA256(key = JWT_SECRET, "sandbox-ip:" + ip)` — pas
de nouvelle variable d'environnement ; une rotation du secret invalide les hachés, ce qui est
indolore vu la rétention.

**L'unicité ne doit surtout pas reposer sur l'IP** : une université ou une entreprise sort
derrière une seule adresse, et de vrais utilisateurs se bloqueraient mutuellement.

Aucun rate-limit n'existe dans le projet (seuls des 429 reçus de Slack et GitHub sont gérés).
Le plus léger qui tienne en multi-instance est fondé sur la table :
`count(*) FROM sandbox_stars WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`
≥ `STAR_RATE_LIMIT_PER_HOUR` (**30**) → `429`. Appliqué aux stars anonymes seulement — un
compte est déjà borné à une star par sandbox. `ip_hash` est stocké pour toutes, pour l'audit.

Le message d'erreur du 429 invite à se connecter : c'est la sortie pour un vrai utilisateur
derrière une IP partagée qui atteindrait le plafond.

#### RGPD

Jamais d'IP en clair, sel côté serveur, **rétention 30 jours** du `ip_hash`, purge
opportuniste à chaque écriture de star
(`UPDATE … SET ip_hash = NULL WHERE ip_hash IS NOT NULL AND created_at < now() - interval '30 days'`)
— pas de cron supplémentaire. `anon_id` est un aléa sans lien avec la personne, conservé.
Pas de user-agent stocké.

#### Rattachement à la connexion

**Où.** `apps/leaderboard-client/src/app/api/google-auth/callback/route.ts`, après
`storeRefreshToken(user.uuid, refreshToken)` et avant la construction de la redirection :
le `user.uuid` est connu, la requête entrante porte encore le cookie anonyme, et les trois
chemins (connexion, liaison par email, inscription) convergent là. Enveloppé dans un
`try/catch` avec `console.warn` : **un échec de rattachement ne doit jamais casser une
connexion**. `/api/auth/refresh` n'est pas un point de connexion (rotation de jetons) et
n'est pas touché.

**Comment.** `SandboxStarRepository.attachAnonToUser(anonId, userId)` dans une
`db.transaction` (motif de `accountMerge.repo.ts`) :

1. lecture des lignes anonymes de cet `anon_id`, des lignes de compte de `userId` sur les
   mêmes sandboxes, et des sandboxes dont `userId` est l'auteur ;
2. décision par une fonction pure `planAnonAttach(anonRows, accountRows, ownedSandboxIds)
   → { toDelete, toAttach }` ;
3. `DELETE` **puis** `UPDATE … SET user_id, attached_at`.

Les suppressions précèdent la migration : l'index `(sandbox_id, user_id)` ne peut donc jamais
être violé. Au rejeu, il ne reste plus aucune ligne `user_id IS NULL` pour cet `anon_id` — les
deux étapes sont des no-ops. Une connexion interrompue laisse tout ou rien.

**Les deux cas de suppression :**

- l'utilisateur avait déjà staré ce sandbox avec son compte → la ligne anonyme est supprimée
  (la ligne de compte porte déjà la relation), jamais migrée ;
- le sandbox appartient à l'utilisateur → suppression, on ne star pas son propre sandbox.

Les lignes soft-removed de l'identité anonyme sont migrées elles aussi : la trace d'audit
suit la personne, et une re-star ultérieure réactive cette ligne au lieu d'en créer une
seconde.

**Effet sur les compteurs.** Le rattachement ne crée aucune ligne : le total ne monte
**jamais**, et il baisse de 1 par conflit ou auto-star résolu. Un compteur peut donc repasser
sous un seuil déjà payé — état normal et prévu, puisqu'un palier n'est jamais repris.

**Conséquence sur l'API, à ne pas manquer :** l'état « palier payé » ne se déduit donc plus du
compteur. La vue publique expose `paid_tier_thresholds: number[]` (donnée non sensible), lu
depuis `sandbox_rewards` ; `StarMilestonesPanel` l'utilise pour l'état payé, et garde le
compteur pour la progression vers le palier suivant.

#### Après rattachement, une identité anonyme ne voit plus les stars du compte

Le cookie est **conservé** après le rattachement — l'invalider produirait une nouvelle
identité à la prochaine star anonyme, donc plus de doublons, pas moins.

Mais le lookup d'une identité anonyme ne considère que les lignes **non rattachées** :
`(sandbox_id, anon_id) AND user_id IS NULL`. Dès qu'une star est rattachée à un compte, elle
devient invisible et intouchable pour l'identité anonyme du même navigateur.

Ce que ça garantit : **personne ne peut dé-starer les stars d'un compte sans être connecté à
ce compte**, ce qui couvre le poste partagé (laboratoire, poste familial).

Ce que ça coûte : une personne déconnectée sur son propre navigateur verra « non starré » sur
un sandbox qu'elle avait staré, et pourra le re-starer — un doublon de +1, borné par le
rate-limit et par le fait qu'il faut être déconnecté. Compromis assumé dans ce sens : mieux
vaut compter une star en trop que laisser quelqu'un en effacer une qui ne lui appartient pas.

Une star faite en étant connecté s'écrit toujours sous `user_id`, jamais sous `anon_id` :
aucune ligne anonyme ne peut donc se créer pendant une session.

#### Audit et annulation

Les paliers payés n'étant jamais repris automatiquement, une vague frauduleuse doit pouvoir
être défaite à la main :

- `GET /api/admin/sandboxes/:id/stars` — lignes groupées par `origin`, `ip_hash` et jour, avec
  `removed_at` / `attached_at` ;
- `DELETE` sur la même route — par liste d'`uuid`, par `ip_hash`, ou par fenêtre temporelle ;
- `DELETE /api/admin/sandbox-rewards/:id` — le total du leaderboard baisse immédiatement,
  puisqu'il n'y a pas de cache.

À documenter : si, après nettoyage, le compteur reste au-dessus d'un seuil, le palier sera
**re-payé à la prochaine star** — l'index unique empêche le doublon, pas la re-création. C'est
le comportement voulu : le palier est alors légitime.

### 1.6 Rôles

**Un manager n'a aucun droit particulier sur un sandbox.** Un manager est rattaché à un projet
(`projects.manager_id`) ; un sandbox n'a pas de projet. Sur un sandbox, un manager est un
contributeur ordinaire.

| Action | Qui |
|---|---|
| Voir le listing et le détail | tout le monde, connecté ou non |
| Starer | tout le monde sauf l'auteur |
| Créer un sandbox | `admin`, `contributor`, `medical_pro` (pas `viewer` : aucun droit d'écriture) |
| Éditer, lancer une évaluation | l'auteur |
| Voir le score d'évaluation | l'auteur et les admins |
| Archiver | l'auteur pour le sien, l'admin pour n'importe lequel |
| Promouvoir | l'admin |

### 1.7 Traduction du thème

La maquette est en clair, l'application tourne sur des tokens avec un mode sombre par défaut
et un mode clair commutable. On traduit, on ne copie pas les couleurs en dur.

| Maquette | Projet |
|---|---|
| fond `#f8fafc`, cartes `#fff`, bordures `rgba(17,17,17,.08)` | `bg-white/[0.04] border border-white/10` (retournés en clair par `globals.css`) |
| `#0d9488` / `#0d7469` / `rgba(13,148,136,.1)` | `text-brandCP` / `bg-brandCP/10` / `border-brandCP/40` |
| `#0b1a15`, `#3f4f49`, `#566761`, `#4f605a`, `#8a978f` | `text-white`, `text-white/70`, `text-white/50`, `text-white/40`, `text-white/25` |
| CTA sombre `#0b1a15` | `bg-white text-black` (bouton « Reward rules » de la page challenge) |
| étoile `#eab308` | `text-yellow-400 fill-yellow-400` |
| promu `#6d28d9` | `text-violet-400 bg-violet-500/10 border-violet-500/20` |
| halos radiaux, animations | `GradientBackground`, `animate-fade-up`, `animate-pop-in` existants |

---

## 2. Paliers

Chaque palier donne **un commit de code** (`feat(sandbox): …`) et **un commit de doc**
(`docs(sandbox): …`), séparés.

Tests colocalisés en `*.test.ts`. Ceux de `packages/` se lancent depuis la racine
(`npx vitest run packages/...`), ceux de l'application depuis `apps/leaderboard-client`
(`npx vitest run`), et `npx tsc --noEmit` est la porte d'entrée.

### Palier 0 — Documentation d'entrée *(ce document)*

`docs/input/spec-sandbox.md` (spec validée + encart des écarts arbitrés) et
`docs/input/plan-sandbox.md`. Commit doc seul.

### Palier 1 — Schéma, migration, entités, repositories

Un début de schéma existe déjà dans le working tree (tables `sandboxes`, `sandbox_stars`,
`sandbox_rewards`, schémas Zod, `appSettings.repo.ts` étendu, exports). Il est repris et
corrigé — `sandbox_stars` y est en `user_id NOT NULL` avec PK composite, donc antérieur à la
décision sur les stars anonymes et **à réécrire** selon §1.5.

**Code**

- `packages/database-service/db/drizzle.ts` : conserver `sandboxes` (+ `evaluated_at`) et
  `sandbox_rewards` ; réécrire `sandbox_stars` ; ajouter à `app_settings`
  `sandbox_star_tiers jsonb $type<SandboxStarTier[]> NOT NULL DEFAULT []` et
  `sandbox_promotion_bonus_cp integer NOT NULL DEFAULT 0` — défauts inertes, dans l'esprit de
  `digest_enabled = false` : la fonctionnalité ne paie rien tant que l'admin n'a rien
  configuré.
- `drizzle/0020_sandbox.sql` — suivant de `0019_challenge_groups.sql` (le `_journal.json`
  s'arrête à 0005, les fichiers ≥ 0013 sont manuels). Commentaires en français à la manière de
  0019, `--> statement-breakpoint`, trois `CREATE TABLE IF NOT EXISTS`, les index (uniques
  partiels avec leur `WHERE`), deux `ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS`.
- `scripts/db-apply-schema.ts` : mêmes instructions, section
  `// --- Sandbox (docs/input/spec-sandbox.md) ---`.
- `domain/entities.ts` : `SandboxType`, `SandboxStatus`, `SandboxEvaluationStatus`, `Sandbox`,
  `SandboxStarOrigin`, `SandboxStar`, `SandboxRewardRuleKey`, `SandboxReward`,
  `SandboxStarTier` ; `AppSettings` complété.
- `domain/schemas_zod.ts` : compléter par `sandboxSchema`, `sandboxStarSchema`,
  `sandboxRewardSchema`, `sandboxSettingsPatchSchema`.
- `db/mappers.ts` : `toDomainSandbox`, `toDomainSandboxStar`, `toDomainSandboxReward` ;
  `toDomainAppSettings` complété (`?? []`, `?? 0`).
- `repositories/sandbox.repo.ts` : `findAll({ includeArchived? })`, `findById`, `findByUser`,
  `findIdsOwnedBy`, `create`, `update`, `setEvaluationStatus`, `storeEvaluation`, `archive`.
- `repositories/sandboxStar.repo.ts` : `upsertUserStar`, `upsertAnonStar`, `softRemove`,
  `findActiveForUser`, `findActiveForAnon` (avec `user_id IS NULL`, §1.5), `countActive`,
  `countActiveBySandboxIds → Map`, `countCreatedByIpSince`, `attachAnonToUser` (transaction),
  `purgeIpHashesOlderThan`, `findForAudit`, `hardDelete`.
- `repositories/sandboxReward.repo.ts` : `findAll`, `findByUser`, `findBySandbox`,
  `paidTierThresholdsBySandboxIds → Map`, `insertTierIfAbsent(row) → SandboxReward | null`
  (`onConflictDoNothing` sur l'index partiel + `.returning()` — vide = déjà payé), `delete`.
- `repositories/accountMerge.repo.ts` : réassignations (§1.4).
- `db_data/seed.ts` `resetAll()` : supprimer rewards, stars puis sandboxes avant `users`.

**Tests** — `domain/schemas_zod.sandbox.test.ts` : `code` refuse modèle et datasets, `ml`
exige au moins un dataset, une URL non http est refusée, paliers strictement croissants et
plafonnés, `type` absent de l'update.

**Doc** — `docs/database.md` (domaine Sandbox : trois tables, colonnes `app_settings`,
relations) ; création de `docs/sandbox.md` avec « Concept », « Data model » et
« Stars, identities and abuse controls ».

### Palier 2 — Service sandbox, paliers, politique des stars

**Code** (`packages/services/sandbox/`)

- `starTiers.ts` (pur) : `tiersToPay(activeCount, tiers, paidThresholds)`, `nextTier`,
  `tierProgress → { pct, hint }` (la logique `tierPct` / `tierHint` de la maquette).
- `starPolicy.ts` : `STAR_RATE_LIMIT_PER_HOUR = 30`, `IP_HASH_RETENTION_DAYS = 30`, `hashIp`,
  `pickClientIp`, `isRateLimited`.
- `starAttach.ts` (pur) : `planAnonAttach(anonRows, accountRows, ownedSandboxIds)
  → { toDelete, toAttach }` (§1.5).
- `sandbox.service.ts`, dépendances injectables sur le motif de `CodeRewardsDeps` :
  `create`, `update` (auteur ; refusé si `promoted` ou `archived` ; `type` immuable),
  `archive`, `star` (403 auteur, 409 non-open, 429 débit anonyme, upsert, purge opportuniste,
  puis `payCrossedTiers` : `countActive` → `tiersToPay` → `insertTierIfAbsent`), `unstar`
  (soft, rien de repris), `attachAnonStars`.

**Tests** — `starTiers.test.ts` (palier exactement franchi, déjà payé ignoré, liste vide,
palier ajouté après coup payé au passage suivant) ; `starPolicy.test.ts` (haché déterministe
et dépendant du secret, `x-forwarded-for` multi-valeurs) ; `starAttach.test.ts` (migration
simple, conflit → suppression, auteur → suppression, ligne soft-removed migrée, rejeu → plan
vide) ; `sandbox.service.test.ts` avec doublures (auteur refusé, star idempotent,
star → unstar → star = un seul paiement, paliers 5 et 15 payés d'un coup à 15 stars,
rate-limit sur les anonymes seulement, purge appelée).

**Doc** — `docs/sandbox.md` : « Star tiers economy », « Anonymous stars and sign-in ».

### Palier 3 — Routes API, allowlist publique, réglages admin, hook de connexion

**Code**

- `lib/server/anonVisitor.ts`, `lib/server/clientIp.ts`, `lib/server/sandboxAuth.ts`
  (`starIdentity(request)`, `canSeeScore`, `isAuthor`).
- `lib/public/sandbox.ts` : `toSandboxView(...)` — **seul** endroit où `evaluation*` et
  `rewards` sont ajoutés ou non, construit champ par champ à la manière d'`overview.ts`.
- `api/sandboxes/route.ts` : `GET` public → `{ sandboxes, tiers, promotion_bonus_cp }` (les
  archivés seulement pour leur auteur et les admins) ; `POST` selon les rôles du §1.6.
- `api/sandboxes/[id]/route.ts` : `GET` public ; `PATCH` auteur ; archivage auteur ou admin.
- `api/sandboxes/[id]/star/route.ts` : `PUT` / `DELETE` publics ; identité = session, sinon
  cookie (émis sur `PUT` s'il manque) ; réponse
  `{ star_count, my_star, paid_tier_thresholds }` ; 403 / 409 / 429.
- `api/google-auth/callback/route.ts` : hook de rattachement, non fatal (§1.5).
- `api/admin/sandbox-settings/route.ts` (`PATCH`, calqué sur `digest-settings`) ;
  `api/admin/sandboxes/[id]/stars/route.ts` (`GET` / `DELETE`) ;
  `api/admin/sandbox-rewards/[id]/route.ts` (`DELETE`).
- `proxy.ts` : **rien à changer**. Les pages `/sandbox/**` sont publiques, et
  `/api/sandboxes/**` reste hors matcher comme `/api/admin/*` — chaque handler fait sa propre
  authentification. À noter en commentaire dans la route de listing.

**Point d'attention** — les pages client utilisent le même `meQuery` (`/api/contributors/me`)
que `challenges/[id]/page.tsx` : c'est ce fetch, lui dans le matcher, qui déclenche le refresh
silencieux d'une session expirée. Sans lui, un utilisateur connecté au token expiré passerait
pour un anonyme sur une page publique.

**Tests** — `lib/public/sandbox.test.ts` (anonyme : ni score ni email ; auteur et admin : score ;
manager : pas de score ; `paid_tier_thresholds` public ; `my_star` résolu par cookie) ;
`lib/server/sandboxAuth.test.ts`.

**Doc** — `docs/api.md` (section Sandbox, colonne Auth explicite) ; `docs/auth.md`
(`/sandbox/**` public, `/api/sandboxes/**` hors proxy, `viewer` exclu de la création, mention
du rattachement au callback) ; `docs/admin-settings.md` ; `docs/sandbox.md` § API.

### Palier 4 — CP sandbox dans le classement, le profil et le digest

**Code**

- `lib/leaderboard.ts` : paramètre `sandboxRewards?` (§1.4).
- `lib/server/leaderboard.ts` : `fetchLeaderboard`, rang global et `totalCP` du profil ;
  `ContributorProfile.sandboxes` dans `lib/types.ts`.
- `lib/server/home.ts` : agrégation + stat « CP distributed ».
- `components/contributor/SandboxRewardsList.tsx` : bloc « Sandbox » dans l'onglet
  Contributions de `contributors/me/page.tsx` et `contributors/[id]/page.tsx`.
- **Digest** : les CP sandbox n'entrent pas dans `cp_distributed` (agrégé par
  `(user, challenge)` depuis `reward_entries`), mais le digest gagne une section **« nouveaux
  sandbox »** listant ceux créés sur la période, avec leur auteur et leur compteur de stars.
  Ajout dans `packages/services/digest/digest-payload.ts` (`DigestSource.sandboxes`), rendu
  dans `DigestTab.tsx`, `version` du payload incrémentée — les digests passés doivent rester
  lisibles.

**Tests** — `lib/leaderboard.test.ts`, bloc « sandbox rewards » : ajoute au total sans compter
une contribution ; exclus sous filtre projet ; `timePeriod: week` sur `created_at` ; un
contributeur sans contribution mais avec des CP sandbox est classé ; utilisateur inconnu
ignoré. `lib/server/home.test.ts` : la stat CP inclut le sandbox.
`digest-payload.test.ts` : section « nouveaux sandbox » remplie sur la période, absente si
aucun, et `cp_distributed` inchangé.

**Doc** — `docs/sandbox.md` § « Reading CP back » ; `docs/architecture.md` (décision de
conception : sandbox ≠ challenge, ledger séparé sommé en direct) ; `docs/digest.md` (nouvelle
section, et pourquoi les CP sandbox n'y sont pas).

### Palier 5 — UI : listing, détail, création, navigation, hero, réglages admin

**Code** (`apps/leaderboard-client/src/`)

- `app/sandbox/page.tsx` (serveur, rend `SandboxExplorer`) ; `app/sandbox/[id]/page.tsx`
  (client, motif de `challenges/[id]/page.tsx` : `meQuery` + `useQuery`).
- `components/sandbox/` : `SandboxExplorer.tsx` (recherche, tri « Most starred / Newest »,
  pills `Open / Promoted / Mine` avec compteurs, statistiques d'en-tête, bouton « New sandbox »
  selon le rôle, état vide) ; `SandboxCard.tsx` ; `SandboxTypeBadge.tsx` ; `StarButton.tsx`
  (optimiste, 429 → invitation à se connecter) ; `SandboxDetail.tsx` (`context` et `why` via
  `components/ui/Markdown`, `goals` en puces) ; `StarMilestonesPanel.tsx` (état payé depuis
  `paid_tier_thresholds`, progression depuis le compteur) ; `PromotedBanner.tsx` ;
  `CreateSandboxModal.tsx` (portail ; type d'abord ; `title`, `context`, `goals` — une ligne
  par but —, `why` ; bloc « Starting point » : repo, puis pour `ml` dataset requis et modèle
  optionnel ; enfin le teaser **« Start from a dev kit / SOON »** désactivé, sans logique
  derrière ; réutilisé en édition avec `type` verrouillé).
- Navigation : dans `components/layout/Navbar.tsx` et `components/layout/Navigation.tsx`,
  `About → /about` devient `Sandbox → /sandbox`. **La route `/about` est conservée.**
- `components/home/HomeHero.tsx` : le paragraphe et un lien vers `/about` dans une rangée
  `flex flex-wrap items-end justify-between gap-4`. Le lien reprend **tel quel** le style des
  liens « voir tout » de `HomeChallengesPreview.tsx` et `HomeLeaderboardPreview.tsx` —
  `inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all
  duration-200 hover:gap-2` — avec la même flèche, à extraire en `components/home/ArrowIcon.tsx`
  plutôt que de la dupliquer une troisième fois. En mobile, il passe sous le paragraphe.
  *À faire valider visuellement : c'est le premier élément cliquable de ce hero.*
- `components/contributor/SandboxSettings.tsx` : onglet admin « Sandbox » (après « Digest »)
  dans `contributors/me/page.tsx` — lignes de paliers avec ajout et suppression, validation de
  la croissance stricte, champ bonus, `PATCH /api/admin/sandbox-settings` ; puis l'audit :
  sélection d'un sandbox → tableau des stars (origine, jour, haché tronqué, statut, rattachée)
  et suppression de stars ou d'une reward.

**Tests** — logique pure extraite pour rester testable en environnement `node` :
`sandboxFilters.ts` (`filterAndSort`), `goalsField.ts` (`parseGoals` / `formatGoals`),
`validateTiers` — un test chacun.

**Doc** — `docs/sandbox.md` § UI ; `docs/project-structure.md` ; `docs/index.md` ;
`docs/admin-settings.md`.

### Palier 6 — Évaluation formative

**Code**

- **Extraction** dans `packages/services/challenge/repo-evaluation.ts` :
  `parseGithubRepoUrl` (le `parseGithubUrl` privé de `code-rewards.service.ts`, rendu public —
  distinct de `githubUrl.ts` qui traite PR et commits), `toScore10(globalScore)` (le `/9 × 10`
  borné), et `evaluateGithubRepo({ slug, branch?, gridSlug, subject, hasPriorEvaluation,
  maxCommits = 100 }, deps?)`. Le corps est le `runAgentDefault` actuel, repris sans
  modification ; `deps` optionnels (`createConnector`, `snapshotService`, `loadGrid`,
  `evaluator`) pour les tests.
- `code-rewards.service.ts` : `runAgentDefault` devient un appel à `evaluateGithubRepo`.
  **Non-régression** : `code-rewards.service.test.ts` injecte `runAgent` et ne touche pas la
  fonction déplacée — il reste vert sans modification.
- `packages/services/sandbox/sandbox-evaluation.service.ts` : `canEvaluate`,
  `scheduleEvaluation` (fire-and-forget), `evaluate` — relecture du statut juste avant le
  passage à `running` (la fenêtre de course fermée comme dans `CodeRewardsService.evaluate`),
  **grille `code` quel que soit le type** (§1.3), `description = buildEvaluationContext(sandbox)`
  (context + why, plus `Model artifact:` et `Datasets:` s'ils existent), stockage du résultat,
  `failed` en cas d'exception. **Aucune écriture** dans `reward_entries`, `sandbox_rewards` ou
  `contributions`.
- `api/sandboxes/[id]/evaluation/route.ts` : `POST` auteur, `202`, `409` si déjà en cours.
- **Composant de présentation extrait** : `components/contributor/EvaluationScorePanel.tsx`,
  props `{ globalScore?, scores?, subtitle?, footer? }` — exactement le bloc « Global Score »
  et la liste des critères d'`EvaluationModal.tsx`. Ce dernier garde son fetch, son portail,
  son en-tête et ses états, et rend le nouveau composant : comportement inchangé.
- `components/sandbox/FormativeEvaluationPanel.tsx` (auteur) : score sur 10, badge « 0 CP »,
  `EvaluationScorePanel`, bouton Run / Evaluating… / Re-run, `refetchInterval` de 3 s tant que
  le statut est `pending` ou `running` ; `AdminReadPanel.tsx` pour l'admin non-auteur.

**Tests** — `repo-evaluation.test.ts` (`toScore10` aux bornes, `parseGithubRepoUrl` sur racine,
`.git` et `tree`, `evaluateGithubRepo` avec doublures : zéro commit → erreur, plafond à 100,
grille chargée par slug, `disconnect` appelé même en erreur) ;
`sandbox-evaluation.service.test.ts` (auteur seul, `running` → ignoré, transitions
`running → done` et `failed`, un `ml` sans modèle produit un contexte sans ligne
`Model artifact`, aucun appel aux repositories de reward) ; `code-rewards.service.test.ts`
inchangé et vert.

**Doc** — `docs/sandbox.md` § « Formative evaluation » (ce qui est snapshoté, pourquoi la
grille `code` dans les deux cas) ; `docs/evaluation.md` (`repo-evaluation.ts` comme cœur
partagé) ; `docs/architecture.md` ; `docs/project-structure.md`.

### Palier 7 — Promotion

**Code**

- `packages/services/challenge/challengeRepos.ts` : `buildRepoDefinitions(...)`, extrait de
  `api/challenges/route.ts`, que la route importe ensuite — parité garantie par test.
- `packages/services/sandbox/promotion.ts` (pur) : `buildPromotedChallengeDraft` (type
  **hérité**, `workspace_mode: 'own_repo'` forcé pour `code`, description composée §1.1) ;
  `buildAuthorParticipation` ; `seedMlWorkspaceMeta`.
- `packages/services/sandbox/sandbox-promotion.service.ts` : `promote(...)` dans **une**
  `db.transaction`, sur les tables Drizzle directement (les repositories n'acceptent pas de
  `tx`) :
  1. `UPDATE sandboxes SET status='promoted', promoted_challenge_id=$new, promoted_at=now()
     WHERE uuid=$id AND status='open' RETURNING` — zéro ligne → exception → rollback. C'est ce
     qui ferme la double promotion concurrente (verrou de ligne) ; l'index unique `promotion`
     est la ceinture.
  2. `INSERT challenges` ;
  3. `repos` et `challenge_repos` via `buildRepoDefinitions`, avec `workspace_meta`
     pré-rempli ;
  4. `INSERT challenge_teams` — l'auteur devient membre, avec son repo en `own_repo` ;
  5. `INSERT sandbox_rewards { rule_key: 'promotion', points: bonus }`, **même si le bonus
     est nul** : la ligne est la trace de la promotion et l'index unique s'appuie dessus.
- **Reprise du travail de l'auteur.** Après le commit, les contributions correspondant au
  travail déposé dans le sandbox sont créées et le scoring normal est déclenché — c'est le
  comportement d'un challenge : y déposer un dataset, un modèle ou du code est une
  contribution créditée, et il n'y a aucune raison d'imposer à l'auteur de re-soumettre ce
  qu'il a déjà fourni. Pour un sandbox `ml`, cela couvre `dataset` (grille `dataset`) et
  `model_code` (grille `code`). Le rôle `model` n'a pas de grille — il se score sur une
  métrique Kaggle, que le sandbox ne porte pas ; il sera crédité quand l'auteur soumettra sa
  métrique depuis le challenge. Pour un sandbox `code`, le repo de l'auteur est déjà rattaché
  en `own_repo` et suit le cycle d'évaluation du challenge.
- `api/sandboxes/[id]/promote/route.ts` : `POST` admin ; corps = `createChallengeSchema` moins
  `type`, `workspace_mode`, `github_repo` et les champs propres aux challenges de validation ;
  `201`, `409` si déjà promu.
- `components/admin/CreateChallengeDrawer.tsx` : nouvelle prop `promotion?` (exclusive de
  `challenge`). Pré-remplit titre, description, type, `pendingTasks` depuis les `goals`,
  `workspace_mode` et statut ; verrouille le sélecteur de type (réutiliser la branche `isEdit`
  via un `typeLocked = isEdit || !!promotion`) ; masque le bloc `provided_repo` et le toggle de
  mode ; laisse projet, statut, dates, pool, `reward_rules`, compute, API packaging et brief
  éditables ; poste vers `/api/sandboxes/:id/promote`. `flushTemplateTasks`, `flushBrief` et
  `onCreated` sont inchangés. Un encart en tête liste les effets de l'opération.
- `SandboxDetail` : « Promote to challenge » ouvre le drawer, monté hors du conteneur animé
  (cf. le commentaire de `ChallengeManageView.tsx`).

**Tests** — `challengeRepos.test.ts` (parité sur les quatre combinaisons) ; `promotion.test.ts`
(type hérité même si l'entrée dit autre chose, `own_repo` forcé, markdown composé sans les
sections vides, participation avec `workspace_url`, meta ML sans modèle) ;
`CreateChallengeDrawer.promotion.test.ts` sur un helper pur `buildPromotionRequestBody`
extrait du drawer, comme `templateTasksFlush.ts`. La transaction elle-même est couverte par un
test manuel documenté (promotion → challenge visible, auteur membre, contributions créées et
scorées, sandbox `promoted`, second `POST` → 409).

**Doc** — `docs/sandbox.md` § Promotion (ordre des opérations, garde `status='open'`, reprise
du travail) ; `docs/api.md` ; `docs/challenges-and-tasks.md` (un challenge peut naître d'un
sandbox) ; `docs/auth.md`.

---

## 3. Courses concurrentes et transactions

| Risque | Couverture |
|---|---|
| Deux `PUT /star` de la même identité | index uniques partiels + `ON CONFLICT DO UPDATE SET removed_at = NULL` → une seule ligne |
| Deux stars concurrentes franchissent le même palier | chaque appel compte après son propre insert (au moins l'un voit le seuil atteint) ; `insertTierIfAbsent` en `ON CONFLICT … DO NOTHING` sur l'index partiel → **exactement une** ligne par `(sandbox, palier)` |
| Unstar puis re-star | ligne réactivée ; palier ni repris, ni re-payé |
| Rattachement à la connexion | transaction : suppressions **avant** migration, l'index `(sandbox_id, user_id)` ne peut pas être violé ; rejeu sans effet ; le compteur ne monte jamais |
| Connexion interrompue | `try/catch` autour du rattachement — la session est émise quoi qu'il arrive ; la transaction laisse tout ou rien ; la connexion suivante rejoue |
| Deux `POST /evaluation` | relecture du statut juste avant le passage à `running` — même fenêtre résiduelle que l'existant |
| Deux `POST /promote` | `UPDATE … WHERE status='open' RETURNING` en tête de transaction, plus l'index unique `promotion` |
| Promotion partielle | une seule transaction couvrant sandbox, challenge, repos, participation et bonus ; template tasks et brief restent hors transaction, non fatals, comme aujourd'hui |
| Paliers reconfigurés | un seuil nouvellement inférieur au compteur est payé **à la prochaine star**, sans rattrapage rétroactif |

---

## 4. Questions ouvertes

Les points ci-dessous sont tranchés par défaut comme indiqué, et signalés au moment de coder.

1. **`viewer`** — exclu de la création de sandbox (cohérent avec `auth.md` : aucun droit
   d'écriture), mais peut starer avec son compte.
2. **Paliers ajoutés a posteriori** — pas de rattrapage automatique à l'enregistrement, pour
   éviter un paiement en masse involontaire. Un bouton admin « Recheck tiers » serait trivial
   si le besoin apparaît.
3. **Purge des stars soft-removed** — conservées pour l'audit ; si le volume devient un sujet,
   une purge au-delà de 90 jours peut rejoindre la purge opportuniste des hachés.
4. **`check()` de Drizzle et `targetWhere` de `onConflict*`** — à vérifier contre la version
   installée ; repli sur la contrainte en SQL brut avec un commentaire.
5. **Tri « Most starred »** — calculé côté client sur le payload complet, sans pagination.
   Acceptable au volume attendu, à revoir au-delà de quelques centaines de sandboxes.
6. **Lien du hero** — premier élément cliquable de `HomeHero`, à valider visuellement en mode
   sombre et en mode clair.
