# Slack Contribution Signals

Challenges can reward the collaboration that happens **outside the code** — in the team's Slack channel. A manager defines *contribution signals* (e.g. "Proposed an idea", "Helped a peer") with a fixed CP reward each, links the challenge to a Slack channel, and a daily AI pass detects those signals in new messages and credits the authors automatically.

---

## How it works

```
Vercel cron (daily, 06:00 UTC)
  → GET /api/cron/slack-signals            (Bearer CRON_SECRET)
    → for each active challenge with a Slack config:
        1. fetch new channel messages since the last cursor (conversations.history)
        2. resolve each author to a leaderboard user by email (users.info → users.email)
        3. send challenge + project + participants + signal definitions + messages to GPT-4o
        4. filter the returned detections (unknown signal/user/message → dropped)
        5. write one reward_entries row per detection (rule_key 'slack_signal')
           against a single 'discussion' contribution per participant
        6. advance the cursor (only on success)
```

Every attribution is auditable: the ledger row's `meta` carries the signal, the message `ts`, an excerpt, and the LLM's one-sentence justification — visible through the existing `GET /api/contributions/[id]/rewards` breakdown.

## Setting it up

1. **Connect Slack** — an admin pastes a bot token in the Integrations tab of `/contributors/me`. Scopes and app creation are covered in [`admin-settings.md`](./admin-settings.md#slack). Don't forget to invite the bot to the channel.
2. **Configure the challenge** — in the challenge edit drawer (admins and project managers), the **Discussion signals** section lets you pick the channel and define signals: an icon (from a predefined set), a label, a CP reward, and a written definition. The definition is what the AI matches against — the more precise, the better the detections.
3. **Wait for the cron** (or trigger it manually):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/slack-signals
```

## Rewards: fixed, out of the pool

Unlike task evaluations (pool distributed at close) and ML rules (pool consumed live), signal rewards are **fixed amounts outside the challenge pool**:

- Code challenges: the close-time distribution only touches contributions with an `evaluation` — discussion contributions are never overwritten.
- ML challenges: `MlRewardsService.remainingPool` excludes `slack_signal` ledger rows, so signals never eat the ML budget.
- Profile: signal CP counts in the contributor's total, but not in the challenge "share" bar (which measures the pool).

Each participant gets **one** `type: 'discussion'` contribution per challenge; its `reward` is the ledger aggregate, growing run after run. On the profile it renders as compact chips (one per signal, with its icon, ×count and CP), not as a contribution list. The icon catalogue lives in `apps/leaderboard-client/src/components/ui/signalIcons.tsx` — keys are stored in `challenge_signals.icon`.

## Author resolution

Slack authors are matched to leaderboard users **by email**, before the LLM call: `users.info` gives the Slack profile email, matched case-insensitively against the challenge team's `users.email`. Unresolved authors (different email, not a participant) stay in the context for conversational continuity but are never credited — they are logged in the cron output for diagnosis.

## Idempotence & failure

- The per-challenge cursor (`challenge_slack_configs.last_ts`) only advances after a fully successful run; a failure records `last_error` and leaves the window to be replayed.
- Replays are absorbed by deduplication against the ledger: a (user, signal, message) triple is only ever rewarded once.
- At most ~300 messages are analyzed per run; any excess waits for the next run (the cursor stops at the last analyzed message).

## Limitations (v1)

- Public channels only, and **thread replies are not fetched** (`conversations.history` returns top-level messages; `conversations.replies` support is a future extension).
- One channel per challenge.
- Detection quality depends on the written signal definitions; the prompt instructs the model to stay conservative (no match when in doubt).

## Key files

| File | Purpose |
|------|---------|
| `packages/connectors/implementation/Slack.connector.ts` | Slack Web API: messages, user profiles, channel list, rate-limit retry |
| `packages/slack-signal-agent/` | GPT-4o detection agent — prompt, Zod schemas, post-parse guards |
| `packages/services/slack/slack-signals.service.ts` | Per-challenge ingestion: cursor, resolution, dedup, ledger writes |
| `packages/services/slack/cron-slack-signals.ts` | Loops over configured challenges (one failure doesn't block the rest) |
| `packages/config/slackCredentials.ts` | Encrypted bot token access (DB, falls back to `SLACK_BOT_TOKEN`) |
| `packages/database-service/repositories/challengeSignal.repo.ts` | Signal definitions CRUD |
| `packages/database-service/repositories/challengeSlackConfig.repo.ts` | Channel config + cron cursor |
| `apps/leaderboard-client/src/app/api/cron/slack-signals/route.ts` | Cron entry point |
| `apps/leaderboard-client/src/components/admin/ChallengeSlackSignalsEditor.tsx` | Channel + signals editor in the challenge drawer |
| `apps/leaderboard-client/src/components/contributor/SlackConnectionCard.tsx` | Bot token connection card (Integrations tab) |
