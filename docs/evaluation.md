# Evaluation

The evaluation system uses OpenAI agents to automatically score a contributor's work on a task and compute their Contribution Point (CP) reward.

**Package:** `packages/services/task_evaluation` + `packages/evaluator`
**Requires:** `OPENAI_API_KEY` + `GITHUB_TOKEN`

---

## Overview

Evaluation is **task-scoped** — one evaluation per contributor per task. Since the contributor and task are already known, there is no identification or deduplication step. The pipeline goes directly from context to score.

Triggered via: `POST /api/tasks/:id/evaluate`

Can be called by an admin or the contributor assigned to the task.

---

## Pipeline

```
POST /api/tasks/:id/evaluate
        ↓
TaskEvaluationService.evaluateTask({ taskId, userId })
        ↓
1. TaskContextService     → load task, parent challenge, workspace branches
        ↓
2. ConnectorsOrchestrator → connect to each workspace (e.g. GitHub branch)
        ↓
3. fetch commits          → up to 100 commits across all workspaces
        ↓
4. SnapshotService        → build aggregated code snapshot from commits
        ↓
5. EvaluationGridRegistry → load the grid matching the task type
        ↓
6. OpenAIAgentEvaluator   → score the contribution against the grid
        ↓
7. ContributionRepository → upsert: create contribution or update existing one
        ↓
8. RunLogger              → log the evaluation run result
```

**Upsert logic:** if a contribution already exists for `(task_id, user_id)`, it is updated with the new evaluation. Otherwise a new contribution record is created. This means running evaluation multiple times on the same task is safe — it just refreshes the score.

---

## What the evaluator scores

The `OpenAIAgentEvaluator.evaluate()` method takes:
- The contribution metadata (title, type, description, commit SHAs)
- A code snapshot (the actual diff/file contents from the branch commits)
- The evaluation grid for the task type

It produces an `Evaluation` object with:
- `scores` — per-criterion scores (0–9 each)
- `globalScore` — final weighted score (0–100)

---

## Evaluation grids

Grids define the scoring criteria. The grid used is selected automatically based on `task.type`.

| Task type | Grid |
|-----------|------|
| `code` | Technical quality, architecture, security, maintainability, documentation, impact |
| `model` | Model architecture, training quality, performance metrics, reproducibility |
| `dataset` | Data quality, coverage, labeling accuracy, documentation |
| `docs` | Completeness, clarity, accuracy, structure |

Grids can also be defined and stored in the database via the admin panel (`/admin/evaluation-grids`), and are loaded at runtime by `DatabaseGridProvider`.

### Scoring scale

Each criterion is scored 0–9:

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional — reference quality |
| 5–7 | Good — production-ready with minor improvements |
| 2–4 | Acceptable — needs revision |
| 0–1 | Problematic — major issues |

The `globalScore` (0–100) is a weighted average across all criteria.

---

## Reward distribution

After evaluation, CP rewards are computed from the contribution score and the challenge's reward pool. Distribution logic lives in `packages/evaluator/reward.ts`.

Formula: `contributor_reward = (contributor_score / total_challenge_scores) × reward_pool`

The result is written to `contributions.reward`.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/task_evaluation/task-evaluation.service.ts` | Main pipeline — orchestrates context, snapshot, evaluation, upsert |
| `packages/services/task_evaluation/task-context.service.ts` | Loads task, challenge, assignees, and workspace branches |
| `packages/evaluator/evaluator.ts` | `OpenAIAgentEvaluator` — calls the OpenAI scoring agent |
| `packages/evaluator/openai/evaluate.agent.ts` | The OpenAI agent that produces scores |
| `packages/evaluator/grids/` | Built-in grid definitions (code, model, dataset, docs) |
| `packages/evaluator/reward.ts` | CP reward distribution logic |
| `packages/services/evaluation-grid.service.ts` | CRUD for database-stored grids |
| `packages/services/database-grid-provider.ts` | Fetches the active grid from the DB at runtime |
| `apps/leaderboard-client/src/app/api/tasks/[id]/evaluate/route.ts` | API endpoint that triggers evaluation |

---

> **Note on the old challenge-level pipeline:** The codebase still contains `packages/services/challenge/sync-evaluation.service.ts` and `packages/evaluator/openai/identify.agent.ts` / `merge.agent.ts`. These are **no longer used** — the challenge-level identify/merge/evaluate flow has been replaced by task-level evaluation via `TaskEvaluationService`.
