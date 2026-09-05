# MyTwin Leaderboard — Documentation

Welcome to the technical documentation for the MyTwin Leaderboard monorepo.

## Start here

- **New to the project?** → [`getting-started.md`](./getting-started.md) — local setup, env config, first run
- **Want to understand how everything fits?** → [`architecture.md`](./architecture.md)
- **Looking for a specific feature?** → use the index below

## Core docs

| File | Description |
|------|-------------|
| [`overview.md`](./overview.md) | What the project is, core concepts, and tech stack |
| [`architecture.md`](./architecture.md) | Monorepo structure, data flow, how packages connect |
| [`project-structure.md`](./project-structure.md) | Annotated directory tree — where everything lives |
| [`packages.md`](./packages.md) | What each package does, its role, and key files |
| [`database.md`](./database.md) | PostgreSQL schema, tables, migrations, and seeding |
| [`auth.md`](./auth.md) | Google OAuth login, JWT cookies, roles, and protected routes |
| [`api.md`](./api.md) | High-level overview of all API routes |

## Feature docs

| File | Description |
|------|-------------|
| [`challenges-and-tasks.md`](./challenges-and-tasks.md) | How challenges and tasks work — the core workflow |
| [`challenge-groups.md`](./challenge-groups.md) | Two or three contributors sharing one workspace, one contribution, and a split reward |
| [`evaluation.md`](./evaluation.md) | AI evaluation pipeline, scoring grids, rewards |
| [`ml-rewards.md`](./ml-rewards.md) | Reward rules for ML challenges — live scoring, reuse, and the point ledger |
| [`validation-challenges.md`](./validation-challenges.md) | Qualified reviewers testing a submitted ML API against ground-truth reference cases |
| [`compute-power.md`](./compute-power.md) | Temporary Scaleway GPU instances for ML challenge contributors |
| [`sync-meetings.md`](./sync-meetings.md) | Creating meetings in Google Workspace + AI analysis |
| [`slack-signals.md`](./slack-signals.md) | Slack contribution signals — AI-detected rewards from channel discussions |
| [`onboarding.md`](./onboarding.md) | New contributor onboarding missions |
| [`admin-settings.md`](./admin-settings.md) | Instance-wide theme, GitHub/Kaggle/Slack connections, and module toggles |
| [`digest.md`](./digest.md) | Periodic, frozen snapshots of platform activity, browsable by admins |

## Dev & ops

| File | Description |
|------|-------------|
| [`getting-started.md`](./getting-started.md) | Local development setup |
| [`deployment.md`](./deployment.md) | Production deployment with PM2 |
| [`testing.md`](./testing.md) | Running tests and ad-hoc scripts |

---

> The top-level `README.md` covers the quick-start — these docs go deeper.
