# Overview

MyTwin Leaderboard is a system that **tracks contributions**, **evaluates work quality** (optionally with AI), and **distributes rewards** to contributors — producing a community, competitive leaderboard.

## Core concepts

- **Project**: A top-level product/initiative that contains repositories and challenges.
- **Challenge**: A time-bounded sprint with a reward pool (Contribution Points / CP).
- **Contribution**: A unit of work attributed to a contributor (e.g. a code change, docs update, dataset work).
- **Evaluation**: The quality assessment of a contribution (stored as JSON on the contribution).
- **Reward (CP)**: Contribution Points distributed based on evaluations and the challenge’s reward pool.

## What this repo provides

- A **Next.js web app** (`apps/leaderboard-client`) that renders the leaderboard and admin pages.
- A **PostgreSQL + Drizzle** data model and repositories (`packages/database-service`).
- Optional building blocks:
  - **Evaluator** (AI agents + scoring grids): `packages/evaluator`
  - **External connectors** (GitHub, Google Drive): `packages/connectors`
  - **REST API** (Express): `packages/api` (optional)
  - Legacy admin UI: `apps/admin` (optional)


