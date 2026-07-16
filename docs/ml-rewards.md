# ML Rewards

Reward system for `type: 'ml'` challenges — the dataset / model / API packaging flow.

**Status:** implemented.
**Packages:** `packages/evaluator/ml-reward.ts` (scoring, pure) + `packages/services/challenge/ml-rewards.service.ts` (orchestration)
**Migration:** `drizzle/0016_ml_rewards.sql`

---

## Why a separate system

Code challenges distribute a **fixed pool proportionally to scores, at close** (`packages/evaluator/reward.ts`): `reward = (score / totalScore) × contribution_points_reward`. It is relative and zero-sum, and nothing is known until the challenge ends.

ML challenges need the opposite: **absolute points, awarded live**, each rule with its own cap. The two cannot share a code path, so `RewardsService` dispatches on `challenge.type` and `computeRewards` stays untouched for `type: 'code'`.

Three properties drive the whole design:

- **Live and event-driven.** A point is awarded at submission time, based on the state of the world at that instant. Never recomputed, never revoked.
- **Append-only.** Every award is an immutable row. "B improves their model" is a new delta row, not an update.
- **Finite pool, clamped.** The pool is set at creation and drains in arrival order. When a computed award exceeds what remains, it is clamped to the remainder.

Reuse is a **deduction, not a bonus**: it redistributes B's points rather than minting new ones. That is what keeps a finite pool coherent with live awarding.

---

## The rules — `challenges.reward_rules`

New nullable `reward_rules json` column on `challenges`, populated only for `type: 'ml'`.

JSON rather than columns because these rules will churn; versioned so they can be migrated; Zod-validated at the API boundary because the form posts arbitrary JSON (see `packages/database-service/domain/schemas_zod.ts` for the existing pattern).

```ts
// packages/database-service/domain/mlRewardRules.ts
export const MlRewardRulesV1 = z.object({
  version: z.literal(1),

  dataset: z.object({
    cap: z.number().int().nonnegative(),              // e.g. 300
  }),

  model: z.object({
    cap: z.number().int().nonnegative(),              // e.g. 500
    kaggleShare: z.number().min(0).max(1).default(0.5),
    metric: z.object({
      name: z.enum(['auc', 'f1', 'accuracy']),
      baseline: z.number().min(0).max(1).default(0),  // e.g. 0.5 for AUC
    }),
    beatBestBonus: z.number().int().nonnegative(),    // e.g. 50
  }),

  apiPackaging: z.object({
    cap: z.number().int().nonnegative(),              // e.g. 200
  }),

  reuse: z.object({
    datasetShare: z.number().min(0).max(1),           // e.g. 0.2
    modelShare: z.number().min(0).max(1),             // e.g. 0.2
    minKeepShare: z.number().min(0).max(1).default(0.5),
  }),
});
```

`minKeepShare` is a guard floor: B never drops below this fraction of their gross points regardless of stacked deductions. Unreachable with two 20% rules, but the rules editor will eventually allow 60% + 60%.

### Scoring formulas

```
dataset        = cap_dataset × agentScore                         // dataset.grid
model_metric   = cap_model × kaggleShare × normalize(metricValue) // no agent
model_code     = cap_model × (1 − kaggleShare) × agentScore       // code.grid; 0 if no GitHub
api_packaging  = cap_api × agentScore                             // code.grid
beat_best      = beatBestBonus                                    // if best at submission time

normalize(m)   = clamp01((m − baseline) / (1 − baseline))
```

Applied in order: compute, clamp to remaining pool, apply reuse deductions, apply `minKeepShare` floor.

**The metric modulates the Kaggle half — it is not a separate rule.** The 50% is *reserved* for Kaggle, not granted: a model with a poor metric earns a small fraction of it, a model at metric = 1.0 earns all of it. "Beat the best on a metric" and "100% on the metric yields a cap" are therefore the same rule, whose cap is that 50% share, plus the discrete `beatBestBonus`.

**Normalization is absolute, not relative.** Points depend on your own metric value, not on your rank. Relative scoring would force a recompute of everyone's points each time a new best lands, which contradicts live awarding and the append-only ledger. The competitive dimension is carried entirely by `beatBestBonus`, awarded at the moment the lead changes hands, and never taken back.

**The bonus rewards taking the lead, not self-improvement.** It fires only when a contributor overtakes *someone else* — hence the two separate inputs, `bestOtherMetricValue` and `myBestMetricValue`. Comparing against the challenge best including your own entries would make the bonus farmable: submit 0.1, then 0.2, then 0.3, and collect it every time, since nothing is ever revoked. It can still fire more than once for the same person when a lost lead is taken back, which is a genuine second exploit.

**`baseline` prevents free points.** With raw `f(m) = m`, an AUC of 0.5 — pure chance — would earn 25% of the model cap for nothing. Setting `baseline: 0.5` makes a coin-flip model worth 0.

**Metric scope is deliberately narrow.** `parseMetrics` (`packages/connectors/implementation/Kaggle.connector.ts:15`) only knows `auc`, `f1`, and `accuracy` — all in [0,1], all higher-is-better, so the formula holds as written. RMSE or loss are unbounded and lower-is-better; supporting them means adding a direction and normalization bounds. Keep v1 to a closed list of three.

---

## The ledger — `reward_entries`

```ts
export const reward_entries = pgTable("reward_entries", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }),
  rule_key: varchar("rule_key", { length: 40 }).notNull(),
  points: integer("points").notNull(),               // negative for a deduction
  source_user_id: uuid("source_user_id").references(() => users.uuid),
  meta: json("meta"),                                // { metricValue, agentScore, rawPoints, clampedTo, ... }
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  challengeIdx: index("idx_reward_entries_challenge").on(t.challenge_id),
  userIdx: index("idx_reward_entries_user").on(t.user_id),
  contributionIdx: index("idx_reward_entries_contribution").on(t.contribution_id),
}));
```

`rule_key` ∈ `dataset | model_metric | model_code | beat_best | api_packaging | reuse_dataset | reuse_model`.

### Writing a deduction

When B earns 500 on their model and owes 40 to Alice for reusing her dataset, write **three rows**, not two:

| user | rule_key | points | source_user_id |
|------|----------|--------|----------------|
| B | `model_metric` | +500 | — |
| B | `reuse_dataset` | −40 | Alice |
| Alice | `reuse_dataset` | +40 | B |

Two reasons over the compact form (B +460, Alice +40). First, legibility: the UI can tell B "you earned 500, of which 40 went to Alice for her dataset", whereas the compact form shows B a bare 460 with no explanation — a deduction rule that isn't visible will be experienced as a bug. Second, pool arithmetic: the two reuse rows cancel exactly, so `remaining = pool − sum(points)` stays correct with no special-casing.

### Reuse follows over time

Alice's share is emitted **every time B is credited on their model**, not once. B improves their model → metric rises → a delta row for B → a matching deduction pair. Alice's bonus tracks B's without any recompute. This is the mechanism that makes "live, never recomputed" and "X% of what the reuser earns" compatible.

---

## The pure function

All scoring lives in a DB-free, independently testable function (`packages/evaluator/test/computeRewards.test.ts` is the precedent):

```ts
// packages/evaluator/ml-reward.ts
export function computeMlAward(input: {
  rule: 'dataset' | 'model_metric' | 'model_code' | 'api_packaging';
  rules: MlRewardRules;
  agentScore?: number;    // 0..1 — dataset.grid or code.grid
  metricValue?: number;   // 0..1 — parseMetrics
  isBest?: boolean;
  remainingPool: number;
  lineage?: { datasetAuthorId?: string; modelAuthorId?: string };
  userId: string;
}): RewardEntryDraft[]
```

Locking the formulas, the clamp, and the deduction stacking here — before wiring anything — is what makes step 3 below survivable.

---

## Trigger points

| Event | Trigger | Effect |
|---|---|---|
| Dataset submitted | `PATCH ml-workspace`, role `dataset` | URL already seen → record lineage, 0 points, **agent not run**. Otherwise → agent job (`dataset.grid`) → `dataset` entry |
| Kaggle model submitted | `PATCH`, role `model` | `fetchRepoActivity()` → `parseMetrics` → `model_metric` entry, plus `beat_best` if it is a record |
| Model GitHub submitted | `PATCH`, role `model_code` | agent job (`code.grid`) → `model_code` entry |
| API packaging submitted | `PATCH`, role `api` | agent job (`code.grid`) → `api_packaging` entry |
| Any model entry for B | after insert | if lineage → `reuse_*` entries (deduction + credit) |

Reusing a dataset skips the agent entirely: same artifact, same score, no reason to pay for the call. The reuser earns 0 on step 1 — their reward for reusing is not having had to build the dataset, and the author is compensated out of the reuser's model points.

---

## Changes to existing code

### a. `challenge_repos.role` — the prerequisite for step 2

Today a repo's role is inferred from its **type**, positionally. `MLChallengeFlow.tsx:32-42` sends *every* GitHub repo to step 3 as soon as a `kaggle_model` exists, and `ml-workspace/route.ts:5-9` maps `github → api_packaging` unconditionally. While that holds, **a GitHub repo at step 2 is impossible** — its URL lands on the API packaging contribution and overwrites it.

Add `role varchar(20)` (`dataset | model | model_code | api`), drop the positional heuristic, and fix the three inference sites on the ML path:

| Site | What it does |
|---|---|
| `components/challenges/MLChallengeFlow.tsx` | `assignReposToSteps` — positional heuristic |
| `api/challenges/[id]/ml-workspace/route.ts` | `REPO_TYPE_TO_CONTRIBUTION` |
| `api/challenges/[id]/ml-validate/route.ts` | `REPO_TYPE_CONFIG` — **route since deleted**, see below |

Plus **both** manage pages, which group ML submissions by repo type and would otherwise collapse the model's GitHub into the API section — `challenges/[id]/manage/page.tsx` and `admin/challenges/[id]/page.tsx` are near-duplicates that have genuinely drifted (only the former has the `meetingsEnabled` gate).

`components/admin/RepoForm.tsx` does **not** need the role: it creates project-level repos, whereas the role lives on the `challenge_repos` join, which `POST /api/challenges` populates.

`task-evaluation.service.ts` also infers grid from repo type, but is unreachable on the ML path and its Kaggle entries have been removed — see [below](#removed-kaggle-via-task-code). Do not migrate it to roles.

`userUrls: Record<string, string>` does **not** need to change: step 2 becomes two repo rows, each keeping its single URL per user.

### b. `contributions.artifact_url` — the prerequisite for reuse detection

The URL is currently dumped into free-text `description` (`ml-workspace/route.ts:126`). Add an indexed, normalized `artifact_url varchar(500)`: lowercased, trailing slash and query/fragment stripped, Kaggle `owner/slug` canonicalized.

Detection: *same challenge + same `artifact_url` + different user + earlier `submitted_at` → the earliest submitter is the author.* Reuse is within a single challenge only — never cross-challenge. `description` stays as-is for display.

### c. `contributions.evaluation_status` — the agent is async

`pending | running | done | failed | skipped_reuse`. An OpenAI call cannot run inside the PATCH (latency, Scalingo timeout). The PATCH returns immediately and a job runs the agent. The `evaluation_runs` table already has this exact status pattern and serves as the model.

### d. Leaderboard aggregation — no change needed

A reuse credit attaches to the **author's own contribution**, not to the reuser's. Alice's +40 for Bob reusing her dataset points at *Alice's dataset contribution* — semantically correct, since that is the asset which generated the points.

The consequence is that every ledger row's `user_id` is always the owner of the contribution it references:

| user | rule_key | points | contribution_id |
|---|---|---|---|
| B | `model_metric` | +500 | B's model |
| B | `reuse_dataset` | −40 | B's model |
| Alice | `reuse_dataset` | +40 | **Alice's dataset** |

So `contributions.reward = SUM(entries WHERE contribution_id = c.uuid)` holds, and `aggregateUsersByContribution` — which groups by `contributions.user_id` — already produces the right totals. **No change to the leaderboard, no branch on `challenge.type`.**

The ledger is a detail and audit layer, not the source of truth for rankings. `contributions.reward` stays the aggregate that both the leaderboard and the profile read.

### e. Profile — reward breakdown on click

The profile (`lib/server/leaderboard.ts:50-127`) lists contributions with their aggregate reward. Two rows read as "soft" and need the ledger to make sense:

- **The author's contribution grows on its own.** Alice submits her dataset for 240 CP. As B, C and D reuse it, the row climbs to 280, 320, 360 with no action from her.
- **The reuser's dataset contribution is worth 0.** `ml-workspace` still creates it — it anchors the lineage and records which artifact was used — but it earns nothing, so it displays as a bare `0 CP` and reads like a failure.

**Decision: the list shows the aggregate; clicking a contribution reveals the ledger breakdown.** Alice's row expands to `240 base + 40 reuse (B) + 40 reuse (C) + 40 reuse (D)`. B's model row expands to `500 gross − 40 to Alice`. B's 0-CP dataset row expands to `reused from Alice — 0 CP`, which turns a bare zero into a legible fact.

Needs: `GET /api/contributions/[id]/rewards` returning the ledger rows for one contribution, and a expandable/drawer view on the profile.

### f. Repo creation

`api/challenges/route.ts:95-102` already creates the three ML repos at challenge creation (`kaggle_dataset`, `kaggle_model`, `github` for the API). Single clean site: set `role` here, and add the fourth repo (`model_code` GitHub) for step 2.

### g. Pool remainder + manager UI

`GET /api/challenges/[id]/ml-rewards` → `{ pool, distributed, remaining, breakdown }`, shown in `MLChallengeFlow` for contributors ("X CP left to claim") and in the manage view.

Rules editor (`MlRewardRulesEditor`) shown when `type === 'ml'`, plus a simulation: *"with 5 contributors, this configuration can distribute up to 4,200 CP against a pool of 2,000."* It's a pure function over the rules — cheap, and it makes cap overshoot visible instead of something to watch for by hand.

**It has to live in two forms.** Challenge creation has two entirely separate UIs, and only one of them is reachable by a project manager:

| Form | Reachable by | Can edit later? |
|---|---|---|
| `CreateChallengeDrawer` (project page) | managers + admins | no — the manage view has no challenge-edit UI at all |
| `ChallengeForm` (`/admin/challenges`) | admins only (`proxy.ts` gates `/admin` on the `admin` role) | yes |

Putting the editor only in `ChallengeForm` would leave managers unable to set any rules — and an ML challenge without rules awards **nothing**, silently, since the service has nothing to score against. Both forms therefore render the same editor and post `reward_rules`; the drawer passes `dense` because Tailwind breakpoints track the viewport, not the container, so a `md:` grid would still split into three columns inside a 512px drawer.

**Gap:** a manager cannot change the rules after creation. This is not specific to rewards — the manage view has no PATCH to `/api/challenges` at all. Closing it means a Settings tab there.

---

## Constraint: ML challenges never have tasks

**ML challenges have no `tasks` rows, by design.** The challenge-scoped ML flow (`MLChallengeFlow` → `PATCH ml-workspace`) is therefore the only submission path, and `PATCH ml-workspace` is the only place rewards need to hook. There is no double-firing risk.

This also means `contributions.task_id` is always null for ML contributions — already the case, since `ml-workspace/route.ts` never sets it.

The consequence is larger than it looks: **`TaskEvaluationService` is unreachable on the ML path**, because it only ever runs against a task. The task-scoped pipeline described in [`evaluation.md`](./evaluation.md) applies to `type: 'code'` only.

### Removed: Kaggle-via-task code

The codebase used to contain a complete parallel implementation of Kaggle submission through tasks, unreachable under this constraint. It was **deleted** — recoverable from git history if ever needed:

| Site | What it did |
|---|---|
| `task-evaluation.service.ts` | `REPO_TYPE_TO_GRID` entries for `kaggle_dataset` / `kaggle_model` (now `github` only) |
| `api/tasks/[id]/assign/route.ts` | Provisioned `workspace_provider: 'kaggle'` task workspaces |
| `api/tasks/[id]/workspace/route.ts` | `PATCH` route for user-submitted URLs — whole file, its only caller was the UI below |
| `tasks/[id]/page.tsx` | Kaggle URL entry UI, its state, handler, and prefill |

This also defuses the `resolveGridSlug` / `workspaces[0]` concern: no task ever points at a Kaggle repo, so grid selection never sees a two-workspace step.

### Removed: `POST /api/challenges/[id]/ml-validate`

Also deleted. It had no caller: the "contribution on URL submit" change moved contribution creation into `PATCH ml-workspace`, and since that route already upserts a contribution per step, calling `ml-validate` would have created a **second** set of contributions for the same user. Its proxy allowance in `proxy.ts` went with it.

**The invariant is UI-enforced, not enforced in the API.** `POST /api/tasks` (`api/tasks/route.ts:8-13`) accepts any `challenge_id` with no check on challenge type; what actually prevents ML tasks is that the manage view exposes no Kanban tab for ML challenges (`manage/page.tsx:882-895`). A task created against an ML challenge through the API directly would now hit `resolveGridSlug` and throw on an unmapped repo type. Adding a guard to `POST /api/tasks` would turn the convention into a real invariant.

---

## Residual gaming surface

The metric is **self-declared** in the Kaggle model card — nothing prevents writing `{"auc": 0.99}`. This is a known, accepted tradeoff for v1. Keeping extraction in `parseMetrics` (deterministic, single choke point, already unit-tested in `test/connectors/parseKaggleMetrics.test.ts`) is precisely what makes verification cheap to bolt on later; routing it through the agent instead would make it non-deterministic and unauditable.

Collusion (A and B reusing each other) nets to roughly zero when symmetric. Multi-account is out of scope.

**Concurrent submissions race.** Awarding reads the remaining pool and the current best metric, then writes — without a lock. Two contributors submitting within the same second can both read the same state, so the pool may overshoot slightly and two "records" may both collect `beatBestBonus`. Tolerable at team scale and self-limiting (the next award sees the true totals), but it is a real gap: closing it means computing and writing inside one transaction with a row lock on the challenge.

---

## Where things live

| Concern | File |
|---|---|
| Rule shape + defaults | `packages/database-service/domain/mlRewardRules.ts` |
| Scoring (pure, tested) | `packages/evaluator/ml-reward.ts` |
| Orchestration, agent, Kaggle metric | `packages/services/challenge/ml-rewards.service.ts` |
| URL normalization (reuse key) | `packages/services/challenge/artifactUrl.ts` |
| Reuse detection (pure, tested) | `packages/services/challenge/lineage.ts` |
| Ledger writes + `reward` cache sync | `packages/database-service/repositories/rewardEntry.repo.ts` |
| Trigger | `api/challenges/[id]/ml-workspace` (PATCH) |
| Pool state | `api/challenges/[id]/ml-rewards` (GET) |
| Contribution breakdown | `api/contributions/[id]/rewards` (GET) |
| Rules editor + simulation | `components/admin/MlRewardRulesEditor.tsx` |
| Breakdown on click | `components/contributor/ContributionRewardBreakdown.tsx` |

The leaderboard needed no work — see [(d)](#d-leaderboard-aggregation--no-change-needed).

`contributions.reward` is kept in sync by `createManyAndSyncRewards`, which recomputes it from the ledger inside the insert transaction rather than incrementing — an increment would drift from the ledger the first time a write partially failed.

## Tests

| File | Kind | Covers |
|---|---|---|
| `packages/evaluator/test/computeMlAward.test.ts` | unit, pure | formulas, baseline, lead bonus, deductions, floor, pool clamp |
| `packages/services/challenge/artifactUrl.ts` → `src/test/artifactUrl.test.ts` | unit, pure | url normalization — the reuse key |
| `packages/services/challenge/lineage.ts` → `src/test/lineage.test.ts` | unit, pure | artifact authorship, tie-breaking |
| `src/test/mlRewards.integration.test.ts` | integration, in-memory DB | the assembly — role dispatch, agent skipped on reuse, ledger writes, reward cache, pool draining, points moving between contributors |

`MlRewardsService` takes its repositories and its two network calls (`readMetric`, `runAgent`) through an optional `MlRewardsDeps`, defaulting to the real ones. The integration test injects an in-memory database that mirrors the real repositories — including recomputing the reward cache from the ledger rather than incrementing it.

**What the tests do not cover:** the SQL itself. `createManyAndSyncRewards`' transaction, the `MAX((meta->>'metricValue')::float)` aggregate, and the migration's role backfill are only exercised against a real Postgres. The connectors and the agent are stubbed at the `MlRewardsDeps` boundary.

### Dropped

`model.grid.ts` is now unused — the Kaggle model card is scored by its metric, not by an agent. Its only reference was `REPO_TYPE_TO_GRID['kaggle_model']`, removed above. The grid file and its registration at `grids/index.ts:139` are deliberately **kept**: it is idle, not deleted, pending a decision on whether to score the model card qualitatively later.
