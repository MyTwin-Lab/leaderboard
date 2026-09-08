# Spec — Digest de l'activité de la plateforme

Document de décisions pour implémentation.

Compagnon de `digest.md`, qui décrivait l'intention. Ce document tranche ce que la relecture du code a fait apparaître : trois colonnes de datation manquantes, une section aveugle aux ré-évaluations, et l'attribution des contributions de groupe. Les écarts avec `digest.md` sont listés en fin de document.

## Objectif

Donner à un admin un historique consultable de l'activité de la plateforme, découpé en périodes figées, généré automatiquement à intervalle configurable.

Le digest rapporte des faits, pas d'analyse. Pas d'agent, pas d'intégration externe : de l'agrégation SQL et une table. Il tourne sur une instance `prod:min`.

## Décisions actées

### 1. Finalité : un historique admin, rien de plus

Le digest se consulte depuis un onglet **Digest** sur `/contributors/me`, à côté de Appearance / Integrations / Evaluation Grids / Modules / Onboarding. Il n'alimente ni Slack, ni mail, ni résumé IA.

Ça n'affaiblit pas le choix du snapshot figé, ça le motive : sans consommateur externe, le seul intérêt du digest est de dire ce qui était vrai à un instant donné. Une vue filtrée sur les données vivantes dirait ce qui est vrai maintenant, ce qui est déjà lisible ailleurs dans l'admin.

### 2. Trois colonnes de datation à ajouter — *nouveau*

Deux des quatre sections de `digest.md` n'étaient pas calculables : `challenges` n'a ni date de création ni date de fermeture, et `contributions.submitted_at` ne veut pas dire ce qu'on croit.

**`contributions.created_at`** (`timestamp defaultNow() notNull`)

`submitted_at` est réécrit à chaque ré-évaluation d'un challenge `code` (`code-rewards.service.ts:217`), donc il signifie « dernière soumission ». Une nouvelle colonne porte la date de création réelle.

Aucun des six points de création de contributions ne change (`code-rewards`, `ml-workspace`, `ml-rewards`, `validation-challenge`, `slack-signals`, `POST /api/contributions`) : le défaut suffit.

Backfill : `created_at = submitted_at`. Exact pour toute contribution jamais ré-évaluée, majorant borné sinon.

**`challenges.created_at`** (`timestamp defaultNow() notNull`)

Backfill **explicite obligatoire** : `COALESCE(start_date::timestamp, '2020-01-01')`. Un simple `DEFAULT now()` daterait tous les challenges existants du jour du déploiement, et le premier digest les listerait tous comme nouveaux.

**`challenges.closed_at`** (`timestamp`, nullable)

Posée dans `ChallengeRepository.update()`, seul point d'étranglement : les deux chemins de fermeture y passent (`POST /api/challenges/:id/close` ligne 17, et le `PUT` du drawer où `status` est un `z.string()` libre).

- Posée uniquement sur la bascule vers **`completed`**. `archived` retire des listings, ça ne termine pas un travail — et un challenge passé directement `active → archived` n'apparaîtra donc dans aucun digest, ce qui est assumé.
- **Réécrite** à chaque bascule vers `completed`. Sinon un challenge fermé, rouvert, refermé n'apparaîtrait que dans le digest de sa première fermeture, alors que l'événement intéressant est la dernière.
- Pas de backfill : les challenges déjà `completed` restent à `null` et n'apparaissent dans aucun digest.

> Les trois colonnes vont aussi dans `scripts/db-apply-schema.ts`, backfills compris — le déploiement ne fait pas `drizzle-kit push` (cf. `database.md#migrations`).

### 3. `submitted_at` n'est pas touché — *nouveau*

Tentation écartée : uniformiser `submitted_at` pour qu'il soit réécrit sur tous les types, et filtrer dessus.

Deux raisons de ne pas le faire.

**Le comportement actuel est incohérent selon le type** — et le sens de l'incohérence est contre-intuitif :

| Type de contribution | `submitted_at` à la re-soumission |
|---|---|
| `project` (code) | **mis à jour** — `code-rewards.service.ts:217` |
| `dataset` / `model` / `api_packaging` (ML) | **figé** — l'update de `ml-workspace/route.ts:279` ne le touche pas |
| `discussion` (Slack) | **figé** — créé une fois, le reward grandit à chaque run du cron |
| `validation` | **figé** — créé une fois, le reward grandit à chaque verdict |

Le cas « j'améliore mon modèle » est précisément celui où `submitted_at` ne bouge pas.

**`submitted_at` porte déjà une seconde responsabilité.** `lineage.ts:84` compare les `submitted_at` pour déterminer qui a soumis un artefact en premier, ce qui décide qui touche le crédit de réutilisation. Le mettre à jour à chaque re-soumission ML ferait perdre son antériorité à l'auteur original — un bug de reward, au service d'un digest.

### 4. Cinq sections, pas quatre — *révisé*

Le digest couvre `[period_start, period_end]`.

| Section | Source | Contenu |
|---|---|---|
| `new_contributions` | `contributions.created_at` | Contributions créées dans la période — tous les contributeurs, titre, challenge, CP au moment du snapshot |
| `new_challenges` | `challenges.created_at` | Challenges créés dans la période |
| `completed_challenges` | `challenges.closed_at` | Challenges passés à `completed` dans la période |
| `new_contributors` | `users.created_at` | Utilisateurs créés dans la période |
| `cp_distributed` | `reward_entries.created_at` | **Nouveau.** CP réellement distribués dans la période |

**Pourquoi la cinquième.** Les quatre premières sont des sections d'*apparition* : elles ne voient un objet qu'une fois. Une contribution `project` créée en semaine 1, ré-évaluée en semaine 4 avec +200 CP, n'apparaît que dans le digest de semaine 1 — où elle valait presque rien. Sur un challenge `code`, où le principe même est d'itérer et de relancer l'évaluation, ça peut représenter l'essentiel de l'activité.

`reward_entries` est la seule source **uniforme sur les quatre types de contribution et immuable** : append-only, `created_at NOT NULL`, jamais réécrite. Un modèle amélioré y écrit son delta, un verdict de validation sa ligne, un signal Slack la sienne.

Les deux ne se recouvrent pas : `new_contributions` dit ce qui est apparu, `cp_distributed` dit où les points sont partis. Un digest se lit comme les deux moitiés d'une même phrase.

**Agrégation de `cp_distributed`.** Une ligne par `(user, challenge)`, avec le total et le détail par `rule_key`. Le ledger brut serait illisible sur une période de plusieurs semaines ; l'agrégat garde la nature de l'attribution (évaluation code, métrique modèle, crédit de réutilisation, signal Slack, validation) sans lister chaque row.

**Limite assumée.** Une contribution créée en toute fin de période et évaluée après la génération apparaît à 0 CP dans `new_contributions`. Le digest suivant la rattrape via `cp_distributed`.

### 5. Groupes : tous les membres, reward global — *nouveau*

Une contribution de groupe porte `contributions.user_id = le porteur` ; les parts réelles vivent dans `contribution_members.share_cp` (cf. `challenge-groups.md`).

- `new_contributions` liste **tous les membres** du groupe et le **reward global** de la contribution — pas la part individuelle, pas le seul porteur.
- Une contribution sans row `contribution_members` est solo : `contributions.user_id`, comportement inchangé. L'absence de rows est le cas normal, pas une anomalie.
- `cp_distributed` reste au niveau du ledger, donc sous le `user_id` du porteur — c'est déjà la sémantique du ledger et elle ne change pas ici.

Comme le payload est dénormalisé, le digest fige la composition du groupe telle qu'elle était pendant la période.

### 6. Sémantique du curseur

```
period_end du dernier digest  =  curseur
si now - curseur >= digest_frequency_days  →  générer sur [curseur, now]
sinon                                      →  no-op
```

La table `digests` est son propre curseur : pas de champ « dernière génération » dans `app_settings`, et `period_start` vaut toujours le `period_end` précédent — ni trou ni recouvrement possible entre deux digests consécutifs.

Le tout premier digest utilise la fréquence comme fenêtre de rattrapage : `[now - frequency, now]`.

### 7. Comparaison sur des frontières de jour — *nouveau*

L'écart ne se compare pas sur des timestamps exacts. Un `period_end` posé à 06:00:03 et un cron qui repasse à 06:00:00 sept jours plus tard donnent 6 j 23 h 59 min 57 s — donc no-op, et le digest glisse d'un jour. À chaque cycle : au bout de deux mois, un « digest hebdomadaire » tombe un autre jour de la semaine.

La comparaison se fait sur des journées UTC entières :

```
joursÉcoulés = (débutJourUTC(now) − débutJourUTC(dernierPeriodEnd)) / 1 jour
dû  ⟺  joursÉcoulés >= digest_frequency_days
```

`period_start` et `period_end` restent des timestamps exacts — seule la décision « est-ce dû ? » se prend en jours.

### 8. Génération manuelle

Le bouton **Generate now** appelle le même chemin de génération, en sautant uniquement le contrôle de fréquence. Il génère sur `[dernier period_end, now]` comme n'importe quel run, donc le curseur reste vrai : le digest automatique suivant repart d'où le manuel s'est arrêté. Un digest manuel sur une période très courte est valide, avec des sections majoritairement vides.

Il fonctionne même quand `digest_enabled` est à `false`.

### 9. Immuabilité

Un digest n'est **jamais** régénéré ni mis à jour après création. Le payload stocke des données dénormalisées (noms, titres, montants tels qu'ils étaient), pas des IDs seuls : une contribution supprimée, un cache de reward reconstruit par `db-resync-rewards` au déploiement, un compte fusionné par `POST /api/users/merge` — rien de tout ça ne doit rendre un digest passé faux ou illisible.

### 10. Modèle de données

**Table `digests`**

| Colonne | Type |
|---|---|
| `uuid` | `uuid` PK |
| `period_start` | `timestamp not null` |
| `period_end` | `timestamp not null` |
| `generated_at` | `timestamp not null default now()` |
| `trigger_source` | `varchar(10) not null` — `cron` / `manual` |
| `payload` | `jsonb not null` — les cinq sections |

`trigger_source` plutôt que `trigger` : le mot est non réservé en Postgres mais ambigu à la lecture, et `evaluation_runs` porte déjà une notion de « trigger type » distincte.

Index sur `period_end DESC` — c'est l'ordre de la liste et la lecture du curseur.

**`app_settings`** (singleton, `id = 1`)

| Colonne | Type |
|---|---|
| `digest_enabled` | `boolean not null default false` |
| `digest_frequency_days` | `integer not null default 7` |

Défaut à `false` : une feature d'admin ne s'active pas toute seule sur les instances existantes.

### 11. API

| Méthode | Chemin | Description | Auth |
|---|---|---|---|
| `GET` | `/api/admin/digests` | Liste, plus récent d'abord (paginée). | Admin |
| `GET` | `/api/admin/digests/:id` | Payload complet d'un digest. | Admin |
| `POST` | `/api/admin/digests/generate` | Génération manuelle sur `[dernier period_end, now]`. | Admin |
| `PATCH` | `/api/admin/digest-settings` | `digest_enabled` / `digest_frequency_days`. | Admin |
| `GET` | `/api/cron/digest` | Contrôle quotidien + génération si dû. | `Bearer $CRON_SECRET` |

Tout est sous `/api/admin/` : la feature est admin de bout en bout, et `/api/admin/theme` fournit déjà le précédent. `digest.md` plaçait les trois premières à la racine.

**Rien à changer dans `proxy.ts`.** `POST` et `PATCH` sous `/api/**` exigent déjà `admin` par la règle générale, et aucune exception n'est à ajouter — la liste est déjà longue.

Le cron suit le pattern de `slack-signals` : `Bearer $CRON_SECRET`, déclaré dans `vercel.json`, ou curlé par un ordonnanceur externe sur Scalingo / PM2 (cf. `deployment.md#cron-jobs`).

### 12. UI

Un onglet **Digest** sur `/contributors/me`, admin uniquement, dans le même style que `ModulesSettings` :

- l'historique, plus récent d'abord, chaque entrée dépliable sur ses cinq sections ;
- le toggle `digest_enabled` et le champ `digest_frequency_days` ;
- le bouton **Generate now**, désactivé pendant la requête.

### 13. Concurrence : non traitée — *assumé*

Deux générations simultanées (deux admins, ou un clic manuel pendant le cron) liraient le même curseur et produiraient deux digests qui se recouvrent. Aucun garde-fou en base pour l'instant : décision explicite, pas un oubli. Si le besoin apparaît, un index unique sur `period_start` suffit.

### 14. Rattrapage après une longue désactivation — *assumé*

`digest_enabled` à `false` pendant trois mois puis réactivé : le curseur n'a pas bougé, le digest suivant couvre trois mois d'un coup dans un seul `jsonb`. C'est cohérent avec l'invariant « pas de trou », et c'est accepté tel quel — pas de fenêtre de rattrapage sur la reprise.

## Rejeté

- **Filtrer les sections sur `submitted_at`** : incohérent selon le type de contribution, et la colonne est intouchable — `lineage.ts` s'en sert pour l'antériorité de réutilisation (cf. §3).
- **Quatre sections seulement, CP = `contributions.reward` cumulé** : un digest sous-estime l'activité d'un challenge `code`, où les contributeurs itèrent (cf. §4).
- **Faire du CP de période le contenu de `new_contributions`** : la section changerait de sens (activité plutôt que nouveautés) sans que son nom le dise.
- **Un champ « dernière génération » dans `app_settings`** : la table `digests` est déjà son propre curseur, un second état ne pourrait que diverger.
- **Un cron à fréquence dynamique** : rien dans le projet ne le permet, et la décision « est-ce dû ? » vit très bien dans l'endpoint.
- **Régénérer ou mettre à jour un digest** : contredit la raison d'être d'un snapshot.
- **Section « signaux Slack » / « runs d'évaluation » / « analyses de réunion » / « mouvements du leaderboard »** : le digest rapporte des faits, pas d'analyse. Les CP des signaux Slack apparaissent déjà dans `cp_distributed` via leur `rule_key`.

## Questions ouvertes

- **Pagination de la liste.** Taille de page à fixer à l'implémentation ; l'historique croît d'une row par période, donc lentement.
- **Purge.** Aucune rétention prévue. À trancher le jour où la table gêne, pas avant.
- **`db_data/seed.ts`** vide les tables en ordre de dépendance. `digests` n'a aucune FK, donc un seed laisse des digests orphelins pointant vers des données regénérées — sans conséquence fonctionnelle (payload figé), mais surprenant en local. À ajouter au nettoyage ou à assumer.

## Ce qui a changé depuis `digest.md`

| Point de `digest.md` | Statut |
|---|---|
| « Requires: nothing beyond the database » | **Tenu.** Aucun agent, aucune intégration. |
| Quatre sections | **Cinq.** `cp_distributed` capte les ré-évaluations, invisibles autrement (§4). |
| `new_contributions` filtré sur les contributions « créées » | **Précisé.** La colonne n'existait pas — `contributions.created_at` est ajoutée (§2). |
| `new_challenges` / `completed_challenges` | **Non calculables en l'état.** `challenges.created_at` et `closed_at` sont ajoutées (§2). |
| « contributor name » au singulier | **Corrigé.** Tous les membres d'un groupe, reward global (§5). |
| `now - cursor >= digest_frequency_days` | **Précisé** en frontières de jour UTC, sinon dérive d'un jour par cycle (§7). |
| Routes `/api/digests*` | **Déplacées** sous `/api/admin/` (§11). |
| Colonne `trigger` | **Renommée** `trigger_source` (§10). |
| « Generate now disabled while a generation is in progress » | **État client uniquement.** Aucun garde-fou en base, assumé (§13). |
| Onglet « alongside Appearance / Integrations / Modules » | **Cinq onglets admin existent** déjà, Evaluation Grids et Onboarding compris (§12). |
