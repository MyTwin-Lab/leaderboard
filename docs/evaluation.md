# Evaluation

The evaluation system uses OpenAI agents to automatically score a contributor's delivery and compute their Contribution Point (CP) reward.

**Package:** `packages/services/challenge/code-rewards.service.ts` + `packages/capabilities/evaluation.ts` + `packages/evaluator`
**Requires:** `OPENAI_API_KEY` + `GITHUB_TOKEN`

---

## Overview

For code challenges, evaluation is **project-scoped**, not per-task: tasks are a purely organizational personal kanban and never carry a score. A contributor triggers one evaluation of their whole delivery (branch or repo) once their board is fully `done`.

Triggered via: `POST /api/challenges/:id/flow/project-evaluation`

Called by the contributor themselves, once their personal board is complete and their workspace is ready. It's fire-and-forget: the route schedules the run and returns immediately; the UI polls the resulting contribution's `evaluation_status`.

> This pipeline applies to `type: 'code'` challenges. `type: 'ml'` challenges (datasets, models, packaging) follow the same live-ledger philosophy but through a separate submission flow — see [`ml-rewards.md`](./ml-rewards.md). Both share the same reward ledger (`reward_entries`) and the same `evaluate()` capability.

---

## Pipeline

```
POST /api/challenges/:id/flow/project-evaluation
        ↓
CodeRewardsService.evaluate({ challengeId, userId })
        ↓
1. Preconditions          → ≥1 personal task, all done, workspace ready, no run already in progress
        ↓
2. Resolve target         → challenge branch (provided_repo) or contributor's own repo (own_repo)
        ↓
3. evaluate()             → core capability (packages/capabilities/evaluation.ts), which:
                             - records an evaluation_runs row for the `code` flow
                             - loads the `code` grid (EvaluationGridRegistry, from the database)
                             - collects the bundle from the `github-snapshot` source:
                               up to 100 commits, aggregated, latest version of each file
                             - writes it to a temporary workspace, calls OpenAIAgentEvaluator,
                               cleans up and marks the run succeeded or failed
        ↓
4. toScore10              → the score normalized to /10
        ↓
5. computeCodeAward()     → fixed + cap×score/10, positive delta only, clamped to remaining pool
        ↓
6. RewardEntryRepository  → write ledger rows (code_fixed / code_quality), sync contribution.reward
        ↓
7. ContributionRepository → contribution (type 'project') flipped to evaluation_status 'done'
```

**Upsert logic:** if a `project` contribution already exists for `(challenge_id, user_id)`, it is updated with the new evaluation. Otherwise a new contribution record is created. This means running evaluation multiple times on the same project is safe — a lower score never claws back points already paid; a higher score pays the positive delta.

---

## The `evaluate()` capability

Every evaluation — code challenge, ML submission, sandbox — goes through `evaluate({ bundle, gridSlug, subject, origin })`:

- **`bundle`** names an installed **bundle source** and its input. The core does not know where files come from: the distribution registers the sources (`src/distribution/mytwin.server.ts`).
  - `github-snapshot` (`content/bundle-sources/github-snapshot`) — the last commits of a repository or branch, aggregated. Code challenges and sandboxes.
  - `kaggle-artifact` (`content/bundle-sources/kaggle-artifact`) — the latest item of a submitted artifact: a Kaggle dataset version, or the last commit of a model's code. ML submissions.
- **`gridSlug`** is loaded before anything is collected, so a missing grid fails without calling GitHub or Kaggle.
- **`subject`** is what the agent is told about: title, type, context, and what it belongs to.
- **`origin`** says who evaluates (`owner`: the flow, extension or module key) and how to replay it (`handler` + `payload`, declared by that owner as an evaluation handler).

The bundle is written to a temporary `eval_agent-*` workspace (`packages/capabilities/bundle.ts`), confined to that directory, and removed once the agent is done — whether it succeeded or threw.

---

## What the evaluator scores

The `OpenAIAgentEvaluator.evaluate()` method takes:
- The contribution metadata (title, type, description, commit SHAs)
- The prepared bundle (the file contents, read through the agent's `read_file` tool)
- The evaluation grid (`code`, for a project evaluation)

It produces an `Evaluation` object with:
- `scores` — per-criterion scores (0–9 each)
- `globalScore` — weighted sum of `score × weight` across criteria; since the grid's weights sum to ~1, this lands on roughly the same 0–9 scale as the individual criteria (not 0–100)

---

## Evaluation grids

Grids define the scoring criteria. A code project evaluation always uses the `code` grid; ML submissions use the grid matching their contribution type.

| Grid | Used for | Criteria |
|------|----------|------|
| `code` | Code challenge project evaluation, the ML `model code` and `API packaging` submissions, and sandboxes | Technical quality, architecture, security, maintainability, documentation, impact |
| `dataset` | ML `dataset` submissions | Data quality, coverage, labeling accuracy, documentation |
| `model` | **Currently unused** — a Kaggle model is scored from its reported metric, not by an agent (see [`ml-rewards.md`](./ml-rewards.md)) | Model architecture, training quality, performance metrics, reproducibility |

Grids live in the database and are served at runtime by `DatabaseGridProvider`; the core has no built-in grid. The three above are content seeds (`content/grids/`), listed by the distribution in `src/distribution/mytwin.grids.ts` and inserted when absent by `npm run db:seed-grids`, which runs at every deploy. A grid already carrying the slug — edited, drafted or archived from `/admin/evaluation-grids` — is never overwritten. If no grid is published under a slug, the evaluation fails with `No published grid "<slug>"` rather than falling back to a frozen copy.

`POST /api/evaluation-grids/:id/test-run` scores a sample against a grid, draft included, five times in a row so its consistency can be checked before it is put to work. It calls the agent directly and records no run.

### Scoring scale

Each criterion is scored 0–9:

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional — reference quality |
| 5–7 | Good — production-ready with minor improvements |
| 2–4 | Acceptable — needs revision |
| 0–1 | Problematic — major issues |

The `globalScore` is the weighted sum across all criteria (weights sum to ~1, so the result sits on roughly the same 0–9 scale, not 0–100). `evaluateGithubRepo` normalizes it to a /10 display score via `(globalScore / 9) * 10`, clamped to [0, 10] — see `toScore10` in `repo-score.ts`.

---

## Reward distribution

When the contributor belongs to a group, the award is multiplied by `1 + 0.4 × (n − 1)` before the clamp and then split into equal shares — see [`challenge-groups.md`](./challenge-groups.md).

Rewards are paid live, per run, from the challenge's `reward_rules` (`{ fixed, cap }`) rather than split at close time across all contributors. Pure calculation logic lives in `content/flows/code/reward.ts` (`computeCodeAward()`): fixed part on the first successful run, `cap × score/10` scaled by the agent score, paid as the positive delta over what was already awarded for that `rule_key`, clamped to the pool remaining. See [`challenges-and-tasks.md`](./challenges-and-tasks.md#rewards) for the full breakdown.

The ledger rows (`reward_entries`) are written by `RewardEntryRepository.createManyAndSyncRewards`, whose DB trigger keeps `contributions.reward` in sync — the same mechanism used by ML challenges.

---

## Reviewing past evaluation runs

Every call to `evaluate()` records an `evaluation_runs` row:

- `trigger_type` — the key of the flow, extension or module that evaluated (`code`, `ml`, `sandbox`);
- `trigger_payload` — `{ handler, payload }`, what a retry calls back;
- `challenge_id` — null for a sandbox, whose subject is kept in `meta.subject` instead;
- `meta` — grid slug, bundle source, duration, raw score;
- one `evaluation_run_contributions` row pointing to the evaluated contribution, when there is one.

Tracing never blocks an evaluation: if the run cannot be written, the evaluation still happens and the failure is logged. `window_start` / `window_end` belonged to the removed sync pipeline and stay empty.

Admins browse and retry runs from `/admin/evaluation-runs`, which shows the flow, handler, grid, status, duration and error:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/evaluation-runs` | List runs, filterable by challenge and status. Admin. |
| `GET` | `/api/evaluation-runs/:id` | Get a single run's detail. |
| `DELETE` | `/api/evaluation-runs/:id` | Delete a run record. |
| `POST` | `/api/evaluation-runs/:id/retry` | Replay a **failed** run: calls the handler its owner declares, with the recorded payload, and answers `202`. The evaluation restarts in the background and shows up as a new run. `409` when the run did not fail, when no installed flow or module declares its handler, or when the handler refuses (an evaluation already running, say). Admin. |

Only a failed run is replayed: a succeeded one has already produced its effects (ledger rows, a stored score), and replaying it could duplicate them depending on the flow.

---

## Shared with the sandbox

`packages/services/challenge/repo-evaluation.ts` evaluates a GitHub repository — `evaluate()` fed by the `github-snapshot` source, score brought back to /10 — so that a sandbox scores a repository exactly like a code challenge does.

A sandbox run uses the `code` grid for **both** its types, pays no CP and writes to no ledger — see [`sandbox.md`](./sandbox.md). One practical consequence of the sharing: the grid published in the database under the `code` slug serves challenges and sandboxes alike.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/challenge/code-rewards.service.ts` | Main pipeline — preconditions, evaluation, ledger, completion |
| `packages/capabilities/evaluation.ts` | `evaluate()`, bundle source registry, run recording, `retryEvaluationRun()` |
| `packages/capabilities/bundle.ts` | Writing a bundle to a confined temporary workspace, and removing it |
| `packages/capabilities/grid-seeds.ts` | Inserting the distribution's grids when absent |
| `content/bundle-sources/` | `github-snapshot`, `kaggle-artifact` |
| `packages/services/challenge/repo-evaluation.ts` | Evaluating a GitHub repository, shared by code challenges and sandboxes |
| `packages/services/challenge/repo-score.ts` | `toScore10` / `parseGithubRepoUrl` — kept apart so a client component can import them |
| `content/flows/code/reward.ts` | `computeCodeAward()` — pure fixed + capped-delta calculation |
| `packages/evaluator/evaluator.ts` | `OpenAIAgentEvaluator` — calls the OpenAI scoring agent |
| `packages/evaluator/openai/evaluate.agent.ts` | The OpenAI agent that produces scores |
| `content/grids/` | Grid seeds (code, model, dataset) |
| `packages/services/evaluation-grid.service.ts` | CRUD for database-stored grids |
| `packages/services/database-grid-provider.ts` | Fetches the published grid from the DB at runtime |
| `content/flows/code/actions/project-evaluation.ts` | The code flow's `project-evaluation` action, dispatched by `/api/challenges/[id]/flow/[...action]` |

---

> **Note on older pipelines:** the challenge-level identify/merge flow (`sync-evaluation.service.ts`, the `identify` / `merge` agents) and the task-level `TaskEvaluationService` pipeline have both been removed. The project-level `CodeRewardsService` described above is the only code evaluation path.
