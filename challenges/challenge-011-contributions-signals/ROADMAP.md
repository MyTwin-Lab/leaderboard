# Challenge 011 – Contribution Signals (Slack)

## ROADMAP

### Phase 0 — Modèle de données

- 0.1 Tables `challenge_signals` et `challenge_slack_configs`, colonnes Slack sur `app_settings`.
- 0.2 Entités, schémas Zod (`'slack_signal'` dans `rewardRuleKeySchema`), mappers, repositories, `sumByChallenge` avec `excludeRuleKeys`.

---

### Phase 1 — Intégration Slack

- 1.1 Credentials chiffrés (`slackCredentials.ts`) + routes `POST/DELETE /api/slack/connection`, `GET /api/slack/status`.
- 1.2 Carte `SlackConnectionCard` dans l'onglet Integrations de `/contributors/me`.
- 1.3 Connecteur `Slack.connector.ts` (messages, résolution email, canaux) branché dans le registry + `GET /api/slack/channels`.

---

### Phase 2 — Détection des signaux

- 2.1 Package `slack-signal-agent` (prompt, schémas Zod, agent OpenAI, garde-fous).
- 2.2 Service d'ingestion `slack-signals.service.ts` (curseur, résolution, dédup, contribution `discussion`, ledger).
- 2.3 Exclusion des CP Slack du pool ML (`remainingPool`) et label dans l'endpoint rewards.
- 2.4 Cron `GET /api/cron/slack-signals` + entrée `vercel.json`.

---

### Phase 3 — UI challenge

- 3.1 Routes `challenges/[id]/slack-config` et `challenges/[id]/signals`.
- 3.2 `ChallengeSlackSignalsEditor` (canal + signaux) dans le drawer d'édition du challenge (code et ml).

---

### Phase 4 — UI profil

- 4.1 Agrégat `discussion` dans `fetchContributorProfile` (hors `contributionShare`).
- 4.2 Bloc « Discussion » en chips par signal dans `ChallengeList`.
- 4.3 (Bonus) Indicateur Slack (canal, dernier run) dans la manage view.

---

### Phase 5 — Documentation

- 5.1 `docs/slack-signals.md` + mises à jour `admin-settings`, `api`, `database`, `packages`, `deployment`, `challenges-and-tasks`, `ml-rewards`, `index`.
