# evaluator

AI scoring engine for contributor work. Takes a contribution (metadata + a prepared bundle of files) and an evaluation grid, and returns per-criterion scores (0–9 each) with a `globalScore` that is their weighted sum — since the grid's weights sum to ~1, `globalScore` lands on roughly that same 0–9 scale, not 0–100.

Called through the core capability `evaluate()` (`packages/capabilities/evaluation.ts`), which collects the bundle from an installed bundle source, loads the grid, calls the agent, cleans up and records an `evaluation_runs` row. The code rewards, the ML rewards and the formative sandbox evaluation all go through it. Only the grid test run of the admin panel calls the agent directly, on a draft grid.

## What it does

The evaluator exposes one agent:

- **Evaluate** (`openai/evaluate.agent.ts`) — reads the bundle through its `read_file` tool, scores the contribution against the grid criteria, and returns an `Evaluation` object

## Structure

```
evaluator/
├── evaluator.ts           # OpenAIAgentEvaluator class (3-retry wrapper)
├── interfaces.ts          # AgentEvaluator interface
├── types.ts               # Contribution, Evaluation, EvaluateContext, SnapshotInfo types
├── grids/
│   └── index.ts           # EvaluationGridRegistry, grid types
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
  snapshot: SnapshotInfo;   // prepared bundle (files written to a temporary workspace)
  grid: EvaluationGrid;     // the grid to score against
}
```

## Usage

Go through the capability rather than the agent:

```typescript
import { evaluate } from '../capabilities/evaluation.js';

const { runId, evaluation } = await evaluate({
  bundle: { source: 'github-snapshot', input: { slug: 'acme/widget', branch: 'main' } },
  gridSlug: 'code',
  subject: { title, type: 'code', description, ref: challengeId, userId },
  origin: { owner: 'code', handler: 'project', payload: { challengeId, userId }, challengeId, contributionId },
});
// evaluation.globalScore → ~0–9 (weighted sum, weights sum to ~1 — not 0–100)
// evaluation.scores      → per-criterion breakdown
```

Each agent call is wrapped with 3-retry logic (1-second backoff between attempts).

## Evaluation grids

Grids define what is scored and how much each criterion is weighted. The core ships none: the registry serves the grids of the provider the distribution installs — the database, for MyTwin.

```typescript
import { EvaluationGridRegistry } from './grids/index.js';

const grid = await EvaluationGridRegistry.getGrid('code');
// throws 'No published grid "code"' when no grid is published under that slug
```

`code`, `model` and `dataset` are content seeds (`content/grids/`), inserted into the database when absent by `npm run db:seed-grids` at deploy time. A grid already carrying the slug is never touched, so what an admin publishes from `/admin/evaluation-grids` is what gets used.

### Scoring scale

| Score | Meaning |
|-------|---------|
| 8–9 | Exceptional |
| 5–7 | Good — production-ready |
| 2–4 | Acceptable — needs revision |
| 0–1 | Problematic |

## Rewards

The reward math is not here any more: it belongs to the flow that pays it — `computeCodeAward` in `content/flows/code/reward.ts`, `computeMlAward` in `content/flows/ml/reward.ts` (see [`docs/ml-rewards.md`](../../docs/ml-rewards.md)). `splitShares` lives in the core domain (`database-service/domain/share.ts`).

## Environment variables

```env
OPENAI_API_KEY=sk-...
```

The OpenAI connection of the admin settings takes precedence over the env var.
