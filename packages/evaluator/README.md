# evaluator

AI scoring engine for contributor work. Takes a contribution (metadata + code snapshot) and an evaluation grid, and returns per-criterion scores with a global score (0–100).

Used by `packages/services/task_evaluation` — not called directly from the app.

## What it does

The evaluator exposes one active agent:

- **Evaluate** (`openai/evaluate.agent.ts`) — reads the code snapshot, scores the contribution against the grid criteria, and returns an `Evaluation` object

> `openai/identify.agent.ts` and `openai/merge.agent.ts` are still present in the package but are **no longer used**. The old challenge-level identify/merge pipeline has been replaced by task-level evaluation in `packages/services/task_evaluation`.

## Structure

```
evaluator/
├── evaluator.ts           # OpenAIAgentEvaluator class
├── interfaces.ts          # AgentEvaluator interface
├── types.ts               # Contribution, Evaluation, EvaluateContext types
├── reward.ts              # CP reward distribution
├── grids/
│   ├── index.ts           # EvaluationGridRegistry
│   ├── code.grid.ts       # Code scoring grid
│   ├── model.grid.ts      # ML model scoring grid
│   ├── dataset.grid.ts    # Dataset scoring grid
│   └── docs.grid.ts       # Documentation scoring grid
└── openai/
    ├── evaluate.agent.ts  # Active: scores a contribution
    ├── identify.agent.ts  # Unused (old pipeline)
    └── merge.agent.ts     # Unused (old pipeline)
```

## Key types

```typescript
interface Contribution {
  title: string;
  type: 'code' | 'model' | 'dataset' | 'docs';
  description?: string;
  challenge_id: string;
  userId: string;
  commitShas: string[];
  tags?: string[];
}

interface Evaluation {
  scores: CriterionScore[];   // per-criterion scores (0–9 each)
  globalScore: number;         // weighted average (0–100)
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

The evaluator is instantiated and called by `TaskEvaluationService`:

```typescript
const evaluator = new OpenAIAgentEvaluator();

const evaluation = await evaluator.evaluate(isUpdate, contribution, {
  snapshot: preparedSnapshot,
  grid,
});
// evaluation.globalScore → 0–100
// evaluation.scores      → per-criterion breakdown
```

Each call is wrapped with 3-retry logic (1-second backoff between attempts).

## Evaluation grids

Grids define what is scored and how much each criterion is weighted.

### Built-in grids

**`code`** — weights across 6 categories:

| Category | Weight |
|----------|--------|
| Technical quality (complexity, duplication, test coverage) | 25% |
| Architecture & design (SRP, modularity, error handling, performance) | 18% |
| Business impact (problem resolution, functional scope) | 12% |
| Documentation & clarity | 12% |
| Security & robustness | 12% |
| Maintainability (tech debt, ease of change) | 18% |
| Documentation | 3% |

**`model`**, **`dataset`**, **`docs`** — similar structure, criteria adapted to each contribution type.

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
// ['code', 'model', 'dataset', 'docs']
```

The `DatabaseGridProvider` (set up by `TaskEvaluationService`) allows grids defined in the database via the admin panel to override the built-in ones.

## Reward distribution

```typescript
import { computeRewards } from './reward.js';

const rewards = computeRewards(evaluations, totalRewardPool);
// Returns: Array<{ userId, contributionTitle, score, reward }>
```

Formula: `reward = (contributionScore / totalScores) × rewardPool`

Edge case: if `totalScore = 0`, rewards are distributed equally. Rounding is adjusted on the last entry to ensure the exact pool is distributed.

## Environment variables

```env
OPENAI_API_KEY=sk-...
```
