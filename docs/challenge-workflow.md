# Challenge workflow

This document describes the conceptual lifecycle of a challenge: from collecting context, to evaluating contributions, to distributing rewards (CP).

## Typical lifecycle

1. **Challenge is created**
   - Defines dates, a reward pool, and links to a project.
2. **Contributions are collected**
   - From code repositories, sync notes, and/or manual input (depending on the tooling you use).
3. **Contributions are evaluated**
   - Each contribution gets an evaluation (often a 0–100 score + justification).
4. **Rewards are distributed**
   - Contribution Points (CP) are allocated proportionally to scores, from the challenge’s reward pool.
5. **Leaderboard is updated**
   - The UI shows rankings and stats based on stored contributions + rewards.

## Data model touchpoints

The main tables involved (see `packages/database-service/db/drizzle.ts`) are:

- `projects`
- `challenges`
- `users`
- `contributions` (stores `evaluation` JSON and `reward`)
- `challenge_teams` (challenge ↔ user membership)
- (optional) `repos`, `challenge_repos`

## Optional “AI evaluation” pipeline

When enabled, the evaluation pipeline typically looks like:

- **Connectors** fetch external context (GitHub, Google Drive, etc.)
- **Evaluator** identifies contributions and scores them using grids
- Results are stored as contribution `evaluation` + computed `reward`

See:

- `packages/connectors`
- `packages/evaluator`
- `packages/services`


