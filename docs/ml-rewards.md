# ML Rewards

`type: 'ml'` challenges (datasets, models, packaging work) use a different reward system than regular `type: 'code'` challenges.

**Requires:** `OPENAI_API_KEY` (for code/dataset scoring) + a connected Kaggle account (see [`admin-settings.md`](./admin-settings.md))

---

## Why a separate system

Code challenges distribute a **fixed pool proportionally to scores, once the challenge closes** (see [`evaluation.md`](./evaluation.md)): everyone's share depends on everyone else's score, and nothing is final until the end.

ML challenges need the opposite: contributors submit a dataset, a model, and packaging work as separate steps, and each step should award **points immediately** as it's evaluated — not wait for a challenge close. So ML challenges use a live, event-driven system with its own fixed budget per step, instead of a single end-of-challenge split.

**ML challenges never have tasks.** There is no kanban, no task assignment — contributors submit their work directly through a dedicated ML workspace flow on the challenge page.

---

## The submission flow

An ML challenge has up to four submission slots, each backed by a linked repo:

| Step | What's submitted | How it's scored |
|------|-------------------|------------------|
| Dataset | A Kaggle dataset URL | AI-scored against the dataset grid |
| Model (metric) | A Kaggle model URL | Scored from the model's reported metric (AUC / F1 / accuracy) — no AI call |
| Model (code) | A GitHub repo with the model's training code | AI-scored against the code grid |
| API packaging | A GitHub repo packaging the model as an API | AI-scored against the code grid |

Contributors submit a URL for each step from the challenge's ML workspace view (`PATCH /api/challenges/:id/ml-workspace`). Each submission upserts a contribution and triggers scoring for that step — AI scoring runs asynchronously since it can take longer than a single request.

---

## How points are awarded

Each ML challenge defines its own **reward rules** (a JSON config on `challenges.reward_rules`, editable by admins and project managers when creating or configuring the challenge): a points cap for each step, and how the model's cap splits between "the metric itself" and "the code quality."

- **Dataset / API packaging / model code** — points scale with the AI score (0–100%) against that step's cap.
- **Model metric** — points scale with how far the reported metric is above a configurable baseline (e.g. an AUC of 0.5 — pure chance — earns nothing).
- **Taking the lead** — a bonus is awarded the moment a contributor's model overtakes the previous best on the metric. It fires once per genuine overtake and is never revoked, even if someone else later retakes the lead.

The pool for a challenge is finite: it's set at creation and drains as points are awarded, in the order submissions arrive. If a computed award would exceed what's left in the pool, it's reduced to whatever remains.

### Reusing someone else's dataset or model

If a contributor points their model or packaging step at a dataset or model that someone else already submitted in the same challenge, that's treated as **reuse**, not a duplicate: the reuser doesn't pay the AI-scoring cost again (same artifact, same score), and a share of their new points is redirected to the original author as a "reuse" credit. This can happen repeatedly — every time the reuser's model improves, the original author's share updates too. A contributor's points can never be pushed to zero by reuse deductions; a minimum share is always protected.

### The point ledger

Every award or deduction is recorded as its own row in an append-only ledger (`reward_entries`) rather than updating a running total — so a contribution's reward is always the sum of its ledger rows, and a contributor can see exactly where their points (or someone else's reuse credit) came from. `GET /api/contributions/:id/rewards` returns this breakdown for one contribution; `GET /api/challenges/:id/ml-rewards` returns the pool's overall state (awarded, remaining, and the rules in effect) for a challenge.

The regular leaderboard needs no special handling for this — each ledger entry belongs to a specific contribution, and a contribution's total reward is just the sum of its ledger entries.

> The same ledger also stores Slack discussion signal awards (`rule_key: 'slack_signal'` — see [`slack-signals.md`](./slack-signals.md)). Those are **out of pool**: `remainingPool` excludes them, so signal rewards never drain the ML budget.

---

## Known limitations (v1)

- **Metrics are self-reported.** The model's metric is read from the Kaggle model card, which the contributor writes — nothing currently verifies it independently.
- **Concurrent submissions can race.** Two contributors submitting within the same instant could both be scored against the same "remaining pool" or "current best" snapshot, occasionally causing a small pool overshoot or two people briefly getting credit for the same lead. Self-correcting on the next submission, but not fully locked.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/domain/mlRewardRules.ts` | Reward rules shape and validation |
| `packages/evaluator/ml-reward.ts` | Pure scoring functions (cap, baseline, lead bonus, reuse deductions) |
| `packages/services/challenge/ml-rewards.service.ts` | Orchestrates scoring + the Kaggle metric read + ledger writes |
| `packages/services/challenge/artifactUrl.ts` | Normalizes submitted URLs (the key used to detect reuse) |
| `packages/services/challenge/lineage.ts` | Determines who originally authored a reused artifact |
| `packages/database-service/repositories/rewardEntry.repo.ts` | Ledger writes, keeps `contributions.reward` in sync |
| `apps/leaderboard-client/src/app/api/challenges/[id]/ml-workspace/route.ts` | Submission endpoint (triggers scoring) |
| `apps/leaderboard-client/src/app/api/challenges/[id]/ml-rewards/route.ts` | Pool state for a challenge |
| `apps/leaderboard-client/src/app/api/contributions/[id]/rewards/route.ts` | Ledger breakdown for one contribution |
| `apps/leaderboard-client/src/components/admin/MlRewardRulesEditor.tsx` | Reward rules editor (challenge creation/config) |
