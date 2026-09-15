# evaluator

AI scoring engine for contributor work. Takes a contribution (metadata + code snapshot) and an evaluation grid, and returns per-criterion scores (0–9 each) with a `globalScore` that is their weighted sum — since the grid's weights sum to ~1, `globalScore` lands on roughly that same 0–9 scale, not 0–100.

Used by the code rewards (`services/challenge/code-rewards.service.ts`), the ML rewards (`services/challenge/ml-rewards.service.ts`) and the formative sandbox evaluation (`services/sandbox/sandbox-evaluation.service.ts`), through `services/challenge/repo-evaluation.ts` for the GitHub-based ones. Not called directly from the app, except the grid test run of the admin panel.

## What it does

The evaluator exposes one agent:

- **Evaluate** (`openai/evaluate.agent.ts`) — reads the code snapshot, scores the contribution against the grid criteria, and returns an `Evaluation` object

## Structure

```
evaluator/
├── evaluator.ts           # OpenAIAgentEvaluator class (3-retry wrapper)
├── interfaces.ts          # AgentEvaluator interface
├── types.ts               # Contribution, Evaluation, EvaluateContext, SnapshotInfo types
├── code-reward.ts         # computeCodeAward — CP of a code challenge project
├── ml-reward.ts           # computeMlAward, normalizeMetric — CP of ML submissions
├── share.ts               # splitShares — CP split between group members
├── grids/
│   ├── index.ts           # EvaluationGridRegistry
│   ├── code.grid.ts       # Code scoring grid
│   ├── model.grid.ts      # ML model scoring grid
│   └── dataset.grid.ts    # Dataset scoring grid
└── openai/
    ├── client.ts          # OpenAI client, key resolved at call time
    └── evaluate.agent.ts  # Scores a contribution
```

## Key types

```typescript
interface Contribution {
  title: string;
  type: string;
  description?: string;
  challenge_id: string;
  userId: string;
  commitShas: string[];
  tags?: string[];
}

interface Evaluation {
  scores: CriterionScore[];   // per-criterion scores (0–9 each)
  globalScore: number;         // sum(score × weight); weights sum to ~1, so this is ~0–9, not 0–100
  contribution?: Contribution;
}

interface CriterionScore {
  criterion: string;
  score: number;    // 0–9
  weight: number;   // 0.0–1.0
  comment?: string;
}

interface EvaluateContext {
  snapshot: SnapshotInfo;   // prepared code snapshot
  grid: EvaluationGrid;     // the grid to score against
}
```

## Usage

```typescript
const evaluator = new OpenAIAgentEvaluator();

const evaluation = await evaluator.evaluate(isUpdate, contribution, {
  snapshot: preparedSnapshot,
  grid,
});
// evaluation.globalScore → ~0–9 (weighted sum, weights sum to ~1 — not 0–100)
// evaluation.scores      → per-criterion breakdown
```

Each call is wrapped with 3-retry logic (1-second backoff between attempts).

## Evaluation grids

Grids define what is scored and how much each criterion is weighted.

### Built-in grids

**`code`**, **`model`**, **`dataset`** — categories of weighted criteria, adapted to each contribution type.

### Scoring scale

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional |
| 5–7 | Good — production-ready |
| 2–4 | Acceptable — needs revision |
| 0–1 | Problematic |

### Grid registry

```typescript
import { EvaluationGridRegistry } from './grids/index.js';

// Sync (built-in grids only)
const grid = EvaluationGridRegistry.getGrid('code');

// Async (checks DB-stored grids first via DatabaseGridProvider)
const grid = await EvaluationGridRegistry.getGridAsync('code');

const types = EvaluationGridRegistry.getAvailableTypes();
// ['code', 'model', 'dataset']
```

The `DatabaseGridProvider` (`packages/services/database-grid-provider.ts`) lets grids defined in the database via the admin panel override the built-in ones.

## Rewards

The reward math is pure and lives next to the agent. The services call it and write the result to the reward ledger:

- `computeCodeAward` — fixed part plus a quality part proportional to the score, as a positive delta clamped to the remaining pool. See [`docs/challenges-and-tasks.md`](../../docs/challenges-and-tasks.md).
- `computeMlAward` — dataset, model metric, model code, API packaging, reuse and lead bonus. See [`docs/ml-rewards.md`](../../docs/ml-rewards.md).
- `splitShares` — splits a group contribution's CP between its members.

## Environment variables

```env
OPENAI_API_KEY=sk-...
```

The OpenAI connection of the admin settings takes precedence over the env var.
