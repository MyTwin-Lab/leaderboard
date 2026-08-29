# Evaluation

The evaluation system uses OpenAI agents to automatically score a contributor's delivery and compute their Contribution Point (CP) reward.

**Package:** `packages/services/challenge/code-rewards.service.ts` + `packages/evaluator`
**Requires:** `OPENAI_API_KEY` + `GITHUB_TOKEN`

---

## Overview

For code challenges, evaluation is **project-scoped**, not per-task: tasks are a purely organizational personal kanban and never carry a score. A contributor triggers one evaluation of their whole delivery (branch or repo) once their board is fully `done`.

Triggered via: `POST /api/challenges/:id/project-evaluation`

Called by the contributor themselves, once their personal board is complete and their workspace is ready. It's fire-and-forget: the route schedules the run and returns immediately; the UI polls the resulting contribution's `evaluation_status`.

> This pipeline applies to `type: 'code'` challenges. `type: 'ml'` challenges (datasets, models, packaging) follow the same live-ledger philosophy but through a separate submission flow — see [`ml-rewards.md`](./ml-rewards.md). Both share the same reward ledger (`reward_entries`) and evaluator package.

---

## Pipeline

```
POST /api/challenges/:id/project-evaluation
        ↓
CodeRewardsService.evaluate({ challengeId, userId })
        ↓
1. Preconditions          → ≥1 personal task, all done, workspace ready, no run already in progress
        ↓
2. Resolve target         → challenge branch (provided_repo) or contributor's own repo (own_repo)
        ↓
3. ConnectorRegistry      → connect to the GitHub branch/repo
        ↓
4. fetch commits          → up to 100 commits
        ↓
5. SnapshotService        → build aggregated code snapshot from commits
        ↓
6. EvaluationGridRegistry → load the `code` grid
        ↓
7. OpenAIAgentEvaluator   → score the delivery against the grid, normalized to a score /10
        ↓
8. computeCodeAward()     → fixed + cap×score/10, positive delta only, clamped to remaining pool
        ↓
9. RewardEntryRepository  → write ledger rows (code_fixed / code_quality), sync contribution.reward
        ↓
10. ContributionRepository → contribution (type 'project') flipped to evaluation_status 'done'
```

**Upsert logic:** if a `project` contribution already exists for `(challenge_id, user_id)`, it is updated with the new evaluation. Otherwise a new contribution record is created. This means running evaluation multiple times on the same project is safe — a lower score never claws back points already paid; a higher score pays the positive delta.

---

## What the evaluator scores

The `OpenAIAgentEvaluator.evaluate()` method takes:
- The contribution metadata (title, type, description, commit SHAs)
- A code snapshot (the actual diff/file contents from the branch commits)
- The evaluation grid (`code`, for a project evaluation)

It produces an `Evaluation` object with:
- `scores` — per-criterion scores (0–9 each)
- `globalScore` — weighted sum of `score × weight` across criteria; since the grid's weights sum to ~1, this lands on roughly the same 0–9 scale as the individual criteria (not 0–100)

---

## Evaluation grids

Grids define the scoring criteria. A code project evaluation always uses the `code` grid; ML submissions use the grid matching their contribution type.

| Grid | Used for | Criteria |
|------|----------|------|
| `code` | Code challenge project evaluation | Technical quality, architecture, security, maintainability, documentation, impact |
| `model` | ML `model` submissions | Model architecture, training quality, performance metrics, reproducibility |
| `dataset` | ML `dataset` submissions | Data quality, coverage, labeling accuracy, documentation |

Grids can also be defined and stored in the database via the admin panel (`/admin/evaluation-grids`), and are loaded at runtime by `DatabaseGridProvider`.

### Scoring scale

Each criterion is scored 0–9:

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional — reference quality |
| 5–7 | Good — production-ready with minor improvements |
| 2–4 | Acceptable — needs revision |
| 0–1 | Problematic — major issues |

The `globalScore` is the weighted sum across all criteria (weights sum to ~1, so the result sits on roughly the same 0–9 scale, not 0–100). `CodeRewardsService` normalizes it to a /10 display score via `(globalScore / 9) * 10`, clamped to [0, 10] — see `runAgentDefault` in `code-rewards.service.ts`.

---

## Reward distribution

Rewards are paid live, per run, from the challenge's `reward_rules` (`{ fixed, cap }`) rather than split at close time across all contributors. Pure calculation logic lives in `packages/evaluator/code-reward.ts` (`computeCodeAward()`): fixed part on the first successful run, `cap × score/10` scaled by the agent score, paid as the positive delta over what was already awarded for that `rule_key`, clamped to the pool remaining. See [`challenges-and-tasks.md`](./challenges-and-tasks.md#rewards) for the full breakdown.

The ledger rows (`reward_entries`) are written by `RewardEntryRepository.createManyAndSyncRewards`, whose DB trigger keeps `contributions.reward` in sync — the same mechanism used by ML challenges.

---

## Reviewing past evaluation runs

Every sync/evaluation triggers an `evaluation_runs` record (trigger type, time window, status, error details if it failed). Admins can browse and retry these from the admin panel:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/evaluation-runs` | List runs, filterable by challenge and status. Admin. |
| `GET` | `/api/evaluation-runs/:id` | Get a single run's detail. |
| `DELETE` | `/api/evaluation-runs/:id` | Delete a run record. |
| `POST` | `/api/evaluation-runs/:id/retry` | Re-run the evaluation for that run's challenge. Admin. |

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/challenge/code-rewards.service.ts` | Main pipeline — preconditions, snapshot, evaluation, ledger, completion |
| `packages/evaluator/code-reward.ts` | `computeCodeAward()` — pure fixed + capped-delta calculation |
| `packages/evaluator/evaluator.ts` | `OpenAIAgentEvaluator` — calls the OpenAI scoring agent |
| `packages/evaluator/openai/evaluate.agent.ts` | The OpenAI agent that produces scores |
| `packages/evaluator/grids/` | Built-in grid definitions (code, model, dataset) |
| `packages/services/evaluation-grid.service.ts` | CRUD for database-stored grids |
| `packages/services/database-grid-provider.ts` | Fetches the active grid from the DB at runtime |
| `apps/leaderboard-client/src/app/api/challenges/[id]/project-evaluation/route.ts` | API endpoint that triggers a project evaluation |

---

> **Note on older pipelines:** The codebase still contains `packages/services/challenge/sync-evaluation.service.ts` and `packages/evaluator/openai/identify.agent.ts` / `merge.agent.ts`, from an earlier challenge-level identify/merge flow — **no longer used**. The task-level `TaskEvaluationService` / `packages/services/task_evaluation` pipeline that superseded it has itself been removed and replaced by the project-level `CodeRewardsService` described above.
