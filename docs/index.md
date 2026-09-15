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
| [`writing-a-flow.md`](./writing-a-flow.md) | Writing a challenge flow: its declaration, config, actions, hooks and slots, installed without touching the core |
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
| [`validation-challenges.md`](./validation-challenges.md) | Checking a source challenge's deliverable actually works — reference cases against an ML API, or a scenario walkthrough of a code app |
| [`compute-power.md`](./compute-power.md) | Temporary Scaleway GPU instances for ML challenge contributors |
| [`sync-meetings.md`](./sync-meetings.md) | Creating meetings in Google Workspace + AI analysis |
| [`slack-signals.md`](./slack-signals.md) | Slack contribution signals — AI-detected rewards from channel discussions |
| [`onboarding.md`](./onboarding.md) | New contributor onboarding missions |
| [`admin-settings.md`](./admin-settings.md) | Instance-wide theme, integrations (GitHub, Kaggle, OpenAI, Slack, Scaleway), modules and qualifications |
| [`digest.md`](./digest.md) | Periodic, frozen snapshots of platform activity, browsable by admins |
| [`sandbox.md`](./sandbox.md) | Contributor-proposed open challenges, community stars, and promotion into official challenges |
| [`seo.md`](./seo.md) | What search engines may index, the MyTwin Lab entity linked to mytwin.care, the `/about` landing and legal pages |

## Dev & ops

| File | Description |
|------|-------------|
| [`getting-started.md`](./getting-started.md) | Local development setup |
| [`deployment.md`](./deployment.md) | Production deployment (Scalingo, PM2), postdeploy data takeovers and post-deploy steps |
| [`testing.md`](./testing.md) | Running the test suites |
| [`github-setup.md`](./github-setup.md) | GitHub OAuth app, organization and branch provisioning |
| [`google-setup.md`](./google-setup.md) | Google OAuth login, Calendar and Meet for the meetings module |

---

> The top-level `README.md` covers the quick-start — these docs go deeper.
