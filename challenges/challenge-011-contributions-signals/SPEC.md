# Challenge 011 – Contribution Signals (Slack) — Spécification technique

## 0. Vue d'ensemble

Pipeline quotidien : **cron** → pour chaque challenge actif avec canal Slack configuré → **fetch des nouveaux messages** (curseur `last_ts`) → **résolution des auteurs par email** → **agent LLM** (signaux définis + contexte challenge/projet/participants) → **détections** → **ledger `reward_entries`** (une ligne par signal détecté) alimentant **une contribution `discussion` par participant et par challenge** → affichage **chips** dans le profil.

Décisions structurantes :

- `rule_key = 'slack_signal'` (constante — `rule_key` est `varchar(40)` + enum Zod). L'identité du signal vit dans `meta : { signal_id, signal_label, message_ts, channel_id, excerpt, justification }`.
- CP **hors pool** : la clôture code ne touche que les contributions avec `evaluation` (aucun impact) ; côté ML, `remainingPool` exclut `slack_signal` de `sumByChallenge`. `contributionShare` du profil est calculé hors CP discussion.
- Config canal dans une table dédiée `challenge_slack_configs` (le curseur est un état opérationnel, pas un attribut du challenge).
- Chiffrement du token : réutilisation de `GITHUB_TOKEN_ENCRYPTION_KEY` via `encryptToken`/`decryptToken` (même pattern que Kaggle).

---

## 1. Modèle de données

### 1.1 Table `challenge_signals`

```sql
challenge_signals (
  uuid          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
  label         VARCHAR(120) NOT NULL,
  description   TEXT,                -- définition écrite envoyée au LLM
  reward_cp     INTEGER NOT NULL DEFAULT 0,
  icon          VARCHAR(32),         -- clé d'icône lucide (catalogue prédéfini côté client)
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT now()
)
```

### 1.2 Table `challenge_slack_configs`

```sql
challenge_slack_configs (
  challenge_id  UUID PRIMARY KEY REFERENCES challenges(uuid) ON DELETE CASCADE,
  channel_id    VARCHAR(32) NOT NULL,
  channel_name  VARCHAR(120),
  last_ts       VARCHAR(32),         -- ts Slack = string décimale, jamais converti en number
  last_run_at   TIMESTAMP,
  last_error    TEXT,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
)
```

### 1.3 Colonnes `app_settings` (pattern Kaggle)

`slack_token_enc TEXT`, `slack_token_iv VARCHAR(64)`, `slack_team_name VARCHAR(255)`, `slack_connected_at TIMESTAMP`, `slack_connected_by UUID REFERENCES users(uuid)`.

### 1.4 Domaine

- Entités `ChallengeSignal`, `ChallengeSlackConfig` ; extension `AppSettings` (champs slack + `slack_is_connected` dérivé).
- `'slack_signal'` ajouté à `RewardRuleKey` (entities) **et** à `rewardRuleKeySchema` (Zod) — critique : sinon `createManyAndSyncRewards` rejette tout le batch au parse.
- Mappers + repositories : `challengeSignal.repo.ts` (findByChallenge/create/update/delete), `challengeSlackConfig.repo.ts` (findByChallenge, findAllConfigured, upsert, updateCursor), `appSettings.repo.ts` (updateSlackConnection/clearSlackConnection), `rewardEntry.repo.ts` : `sumByChallenge(challengeId, opts?: { excludeRuleKeys?: string[] })`.
- Migration via `npm run db:push`.

---

## 2. Intégration Slack (credentials)

### 2.1 `packages/config/slackCredentials.ts`

Calqué sur `kaggleCredentials.ts` : `getSlackToken(): Promise<string | null>` — lit `app_settings.slack_token_enc/iv` (import dynamique db, try/catch), fallback `config.slack.botToken` (`SLACK_BOT_TOKEN` optionnel dans `packages/config/index.ts`).

### 2.2 API

- `POST /api/slack/connection` (admin) : body `{ bot_token }`. Validation via Slack `auth.test` — attention, Slack répond HTTP 200 avec `{ ok: false }` en cas d'échec : tester `data.ok`. Stocke `team` → `slack_team_name`, chiffre le token, enregistre `connected_at`/`connected_by`.
- `DELETE /api/slack/connection` (admin) : efface les colonnes slack.
- `GET /api/slack/status` : `{ connected, team_name, connected_at }` — jamais le token.
- `GET /api/slack/channels` (admin/manager) : `conversations.list` → `[{ id, name }]` ; 400 si non connecté.

### 2.3 UI

`SlackConnectionCard.tsx` (pattern `KaggleConnectionCard.tsx`) dans l'onglet **Integrations** de `/contributors/me` : état connecté (team, date, bouton disconnect) / formulaire token sinon. Instructions de création de l'app Slack + scopes requis : `channels:read`, `channels:history`, `users:read`, `users:read.email` (+ bot invité dans le canal).

---

## 3. Connecteur Slack

`packages/connectors/implementation/Slack.connector.ts` (le `case 'slack'` du registry existe déjà en stub) :

- `fetchItems({ channelId, oldest })` → `conversations.history` (`oldest` exclusif — parfait pour le curseur ; pagination `response_metadata.next_cursor`, `limit: 200`/page). Filtre les messages avec `subtype` (channel_join, bot_message…).
- `resolveUserEmail(slackUserId)` → `users.info`, cache `Map` interne.
- `listChannels()` → `conversations.list` (`types=public_channel`, `exclude_archived=true`, paginé).
- Rate limits : sur HTTP 429, attendre `Retry-After` puis rejouer (1 retry).
- `registry.ts` : `case 'slack'` → `getSlackToken()` + `new SlackConnector(...)`, `null` sinon.

---

## 4. Agent LLM — `packages/slack-signal-agent`

Package miroir de `packages/sync-meeting-agent` (dep `openai ^6.2.0`, `OPENAI_API_KEY`, `gpt-4o`, `response_format: json_object`, `temperature: 0.3`).

**Entrée** (`SlackSignalContext`) :

```ts
{
  challenge: { title, description, roadmap },
  project_title: string,
  participants: [{ user_id, full_name }],          // identités déjà résolues
  signals: [{ signal_id, label, description, reward_cp }],
  messages: [{ ts, author_user_id: string | null, author_name, text }]  // ordre chronologique
}
```

**Prompt** (`buildDetectionPrompt`, calqué sur `buildAnalysisPrompt`) : détection **conservatrice** (« only when the message clearly matches the signal definition »), un couple (signal, message, user) une seule fois, auteurs `author_user_id: null` ignorés pour l'attribution.

**Sortie** (Zod) : `{ detections: [{ signal_id: uuid, user_id: uuid, message_ts: string, justification: string }] }`.

**Garde-fous post-parse** : filtrer `signal_id` inconnu, `user_id` hors participants, `message_ts` absent du batch. Cap ~300 messages/run : tronquer les plus récents au run suivant en n'avançant le curseur que jusqu'au dernier message réellement envoyé au LLM.

---

## 5. Service d'ingestion — `packages/services/slack/`

### 5.1 `slack-signals.service.ts` — `processChallenge(challengeId)`

1. Skip si challenge non `active`, sans config canal, sans signaux, ou Slack non connecté (warn).
2. `fetchItems({ channelId, oldest: config.last_ts })` ; si vide → `updateCursor({ last_run_at })`, fin.
3. Résolution : `ChallengeTeamRepository.findTeamMembers(challengeId)` ; chaque auteur Slack distinct → `resolveUserEmail` → match insensible à la casse contre les emails de l'équipe → `author_user_id` (`null` si non résolu ou hors équipe ; le message reste dans le contexte, les non-résolus sont loggés).
4. Appel `runDetectAgent(context)` → détections filtrées.
5. **Déduplication** contre le ledger existant : `findByChallenge` filtré `rule_key='slack_signal'`, clé `${user_id}|${meta.signal_id}|${meta.message_ts}` — protège du rejeu si un run précédent a crashé entre l'écriture ledger et l'avancement du curseur.
6. Find-or-create de la contribution par participant détecté : `{ title: 'Slack discussion — #<channel_name>', type: 'discussion', description: 'Contribution signals detected in Slack discussions', reward: 0, user_id, challenge_id, evaluation_status: 'done', submitted_at: now }` (pas de `task_id`).
7. `createManyAndSyncRewards(drafts)` : `{ challenge_id, user_id, contribution_id, rule_key: 'slack_signal', points: signal.reward_cp, meta: { signal_id, signal_label, message_ts, channel_id, excerpt, justification } }`.
8. Succès → `updateCursor({ last_ts: maxTs(messages envoyés au LLM), last_run_at, last_error: null })`. Échec → `updateCursor({ last_error })` **sans toucher `last_ts`**, rethrow.

### 5.2 `cron-slack-signals.ts`

Pattern `cron-check-meetings.ts` : `findAllConfigured()` → boucle avec try/catch par challenge (un échec ne bloque pas les suivants), logs.

### 5.3 Impacts sur l'existant

- `ml-rewards.service.ts` : `remainingPool` → `sumByChallenge(id, { excludeRuleKeys: ['slack_signal'] })`.
- `GET /api/contributions/[id]/rewards` : label du rule_key `slack_signal` = `meta.signal_label`.

---

## 6. Cron

- `GET /api/cron/slack-signals` : copie de `cron/check-meetings` (Bearer `CRON_SECRET`), délègue à `runSlackSignalsCron()`.
- `vercel.json` : `{ "path": "/api/cron/slack-signals", "schedule": "0 6 * * *" }` (1×/jour).
- Scalingo : pas de cron natif — Scheduler addon ou déclencheur externe qui curl l'URL avec le Bearer (documenté dans `docs/deployment.md`).

---

## 7. UI création/édition du challenge

### 7.1 `ChallengeSlackSignalsEditor.tsx`

Nouveau composant `src/components/admin/ChallengeSlackSignalsEditor.tsx`, structure identique à `ChallengeTasksEditor.tsx` (refetch à l'ouverture via ref `wasOpen`, CRUD immédiat, fetch natif) :

- Si Slack non connecté (`/api/slack/status`) : message « Connect Slack in Integrations first ».
- **Canal** : `SelectDropdown` peuplé par `/api/slack/channels`, sauvegarde immédiate `PUT /api/challenges/[id]/slack-config`, bouton retirer (`DELETE`).
- **Signaux** : liste + formulaire (icône choisie dans un catalogue lucide prédéfini, label, description, CP) sur `GET/POST /api/challenges/[id]/signals` et `PUT/DELETE /api/challenges/[id]/signals/[signalId]`.

Intégration dans `CreateChallengeDrawer.tsx` : **mode édition seulement** (comme les tasks — nécessite un `challengeId`), mais pour **les deux types** (code et ml).

`ChallengeForm.tsx` legacy (`/admin/challenges`) : non modifié.

### 7.2 Routes API

`/api/challenges/[id]/slack-config` (GET/PUT/DELETE) et `/api/challenges/[id]/signals` (+ `[signalId]`) : validation Zod, garde admin/manager (même pattern que `/api/tasks` et `challenges/[id]/repos`).

---

## 8. Profil — bloc « Discussion » en chips

- `src/lib/types.ts` : `ContributorChallenge` gagne `discussion?: { contributionId, totalCp, signals: [{ signalId, label, icon, count, totalCp }] }`.
- `fetchContributorProfile` (`src/lib/server/leaderboard.ts`) : les contributions `type === 'discussion'` sont routées vers `entry.discussion` (hors liste `contributions`, mais comptées dans `entry.reward` et `totalCP`). Agrégat par `meta.signal_id` via `rewardEntry.findByContribution` ; labels/icônes via `challengeSignal.findByChallenge` (fallback `meta.signal_label` si le signal a été supprimé). `contributionShare` = `(entry.reward − discussionCp) / pool`.
- `ChallengeList.tsx` : dans le panneau déplié, sous les contributions, bloc titré « Discussion · X CP » avec chips `{icône} {label} ×{count} · {cp} CP` (flex-wrap, CP en `text-brandCP`, icônes du catalogue `signalIcons.tsx`). Pas de liste, pas de `ContributionRewardBreakdown`.

### 8.1 Manage view (bonus)

`ChallengeManageView.tsx`, Overview (manager) : ligne « Slack · #channel · last run {date} {⚠ si last_error} » via `GET /api/challenges/[id]/slack-config`.

---

## 9. Documentation & env

- Docs à mettre à jour : `docs/admin-settings.md` (carte Slack, app, scopes), `docs/api.md`, `docs/database.md`, `docs/packages.md`, `docs/deployment.md` (cron), `docs/challenges-and-tasks.md`, `docs/ml-rewards.md` (hors-pool). Nouveau `docs/slack-signals.md` + lien dans `docs/index.md`.
- Env : aucune nouvelle clé de chiffrement (réutilise `GITHUB_TOKEN_ENCRYPTION_KEY`) ; `SLACK_BOT_TOKEN` optionnel (fallback dev) ; `OPENAI_API_KEY` et `CRON_SECRET` existants.

---

## 10. Vérification end-to-end

1. App Slack de test (scopes §2.3), bot invité dans un canal, token `xoxb-…` collé dans Integrations → `/api/slack/status` OK.
2. Emails Slack des testeurs = `users.email` en base.
3. Éditer un challenge actif : canal + 2-3 signaux (ex. « Entraide », 5 CP) ; poster des messages correspondants.
4. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/slack-signals`.
5. Vérifier : lignes `reward_entries` (`rule_key='slack_signal'`), contribution `discussion` avec `reward` synchronisé, `last_ts` avancé.
6. **Rejouer le curl** → aucune nouvelle ligne (dédup + curseur).
7. Profil : chips Discussion, `totalCP` incrémenté, `contributionShare` inchangé.
8. Challenge ML : `remainingPool` non impacté par les CP Slack.
