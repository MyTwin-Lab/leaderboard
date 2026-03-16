# Evaluation

The evaluation system uses OpenAI agents to automatically assess the quality of contributions and compute Contribution Point (CP) rewards.

**Package:** `packages/evaluator`
**Requires:** `OPENAI_API_KEY`

---

## Overview

When an admin triggers a challenge sync (`POST /api/challenges/:id/sync`), the evaluation pipeline runs in three sequential steps:

```
1. Identify  →  2. Merge  →  3. Evaluate
```

Each step is an OpenAI agent call, wrapped with 3-retry logic (1-second backoff between attempts).

---

## Step 1: Identify

**Agent:** `packages/evaluator/openai/identify.agent.ts`

Takes the full challenge context (GitHub commits, Google Drive files, meeting notes assembled by `challenge-context.service.ts`) and extracts a list of individual contributions.

Each identified contribution includes:
- Title and description
- Type (`code`, `docs`, `model`, `dataset`)
- Attributed contributor(s)
- Supporting evidence (commit hashes, file references)

---

## Step 2: Merge

**Agent:** `packages/evaluator/openai/merge.agent.ts`

Compares newly identified contributions with existing contributions already stored in the database. Decides for each new contribution whether to:
- **Create** it as a new record
- **Update** an existing record it corresponds to

This prevents duplicate contributions from being created when a challenge is synced multiple times.

---

## Step 3: Evaluate

**Agent:** `packages/evaluator/openai/evaluate.agent.ts`

Scores each contribution against the appropriate **evaluation grid** based on its type. Produces an `Evaluation` object with:
- A score per criterion (0–9)
- A final aggregated score (0–100)
- Justification text for each criterion

Results are stored in `contributions.evaluation` (JSON) and `contributions.reward` (computed CP).

---

## Evaluation grids

Grids define the scoring criteria. Each grid is structured into weighted categories, each with subcriteria that have explicit scoring guides.

There are four built-in grid types:

### `code` — Code contributions

| Category | Weight |
|----------|--------|
| Technical quality (cyclomatic complexity, duplication, test coverage) | 25% |
| Architecture & design (SRP, modularity, error handling, performance) | 18% |
| Business impact (problem resolution, functional scope) | 12% |
| Documentation & clarity (readability, docstrings) | 12% |
| Security & robustness (input validation, secrets management) | 12% |
| Maintainability (technical debt, ease of evolution) | 18% |
| Documentation | 3% |

### `model` — ML model contributions
Evaluates model architecture, training quality, performance metrics, and reproducibility.

### `dataset` — Dataset contributions
Evaluates data quality, coverage, labeling accuracy, and documentation.

### `docs` — Documentation contributions
Evaluates completeness, clarity, accuracy, and structure.

---

## Scoring scale

Each criterion is scored 0–9:

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional — reference quality |
| 5–7 | Good — production-ready with minor improvements |
| 2–4 | Acceptable — needs revision before merge |
| 0–1 | Problematic — major refactoring needed |

The final score (0–100) is a weighted average across all criteria.

---

## Custom grids in the database

In addition to the built-in code grids, evaluation grids can be defined and stored in the database via the admin panel (`/admin/evaluation-grids`). The `packages/services/evaluation-grid.service.ts` handles CRUD and versioning of these DB-stored grids.

The `database-grid-provider.ts` in services retrieves the appropriate active grid from the DB for a given contribution type.

---

## Reward distribution

After evaluation, CP rewards are distributed by `packages/evaluator/reward.ts` based on:
- Each contributor's evaluation score relative to the challenge total
- The challenge's total reward pool (CP)

Formula: `contributor_reward = (contributor_score / total_scores) × reward_pool`

Results are written to `contributions.reward`.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/evaluator/evaluator.ts` | `OpenAIAgentEvaluator` class — orchestrates the 3 agents |
| `packages/evaluator/openai/identify.agent.ts` | Contribution identification agent |
| `packages/evaluator/openai/merge.agent.ts` | Merge / dedup agent |
| `packages/evaluator/openai/evaluate.agent.ts` | Scoring agent |
| `packages/evaluator/grids/code.grid.ts` | Code evaluation grid definition |
| `packages/evaluator/reward.ts` | CP reward distribution logic |
| `packages/services/sync-evaluation.service.ts` | Wires context + evaluator together |
| `packages/services/challenge-context.service.ts` | Assembles context for evaluation |
