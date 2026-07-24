# API

All API endpoints are implemented as **Next.js Route Handlers** under `apps/leaderboard-client/src/app/api/`. There is no separate API server.

All request bodies are JSON. All responses are JSON. Authentication is via HTTP-only JWT cookies (see [`auth.md`](./auth.md)).

---

## Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/google-auth/authorize` | Start the Google OAuth flow — redirects to Google's consent screen. | Public |
| `GET` | `/api/google-auth/callback` | OAuth callback — exchanges code for tokens, finds or creates user, sets JWT cookies. | Public |
| `POST` | `/api/auth/refresh` | Exchange a valid refresh token for a new access token. | Cookie |
| `POST` | `/api/auth/logout` | Clear auth cookies and revoke all refresh tokens for the user. | Cookie |

---

## Users

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/users` | List all users. | Authenticated |
| `POST` | `/api/users` | Create a user. | Admin |
| `GET` | `/api/users/:id` | Get a user by ID. | Authenticated |
| `PATCH` | `/api/users/:id` | Update a user (e.g. role). | Admin |
| `DELETE` | `/api/users/:id` | Delete a user. | Admin |

---

## Current user

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contributors/me` | Get the authenticated user's profile and stats. | Contributor+ |
| `GET` | `/api/contributors/me/tasks` | Get tasks assigned to the authenticated user. | Contributor+ |

---

## Leaderboard

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/leaderboard` | Get the ranked leaderboard with contributor scores and CP. | Public |

---

## Challenges

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/challenges` | List all challenges. Pass `?managed=true` to instead list all challenges (including drafts) belonging to projects the current user manages. | Public (managed filter requires auth) |
| `POST` | `/api/challenges` | Create a challenge. | Admin or project manager |
| `GET` | `/api/challenges/:id` | Get a challenge by ID. | Public |
| `PUT` | `/api/challenges/:id` | Update a challenge. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id` | Delete a challenge. | Admin |
| `POST` | `/api/challenges/:id/close` | Close a challenge (set status to closed). | Admin |
| `GET` | `/api/challenges/:id/context` | Get the full context for evaluation (commits, notes). | Admin |
| `POST` | `/api/challenges/:id/join` | Join a challenge as a contributor. | Contributor+ |
| `GET` | `/api/challenges/:id/repos` | Get repos linked to a challenge. | Public |
| `GET` | `/api/challenges/:id/repo-activity` | Live activity for each linked repo — GitHub commits/PRs/reviews, or Kaggle dataset/model info. Fetched on demand, not cached. | Admin/manager pages |
| `POST` | `/api/challenges/:id/sync` | Trigger the AI evaluation sync for a challenge. | Admin |
| `GET` | `/api/challenges/:id/team` | Get team members of a challenge. | Public |
| `PUT` | `/api/challenges/:id/team/:userId` | Add/update a team member. | Admin |
| `GET` | `/api/challenges/:id/documents` | List a challenge's markdown documents. | Public |
| `POST` | `/api/challenges/:id/documents` | Add a `.md` document (max 500KB). | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/documents/:docId` | Delete a document. | Admin or manager of its project |
| `GET` | `/api/challenges/:id/ml-workspace` | Get each contributor's submitted artifact URLs for an ML challenge. | Public |
| `PATCH` | `/api/challenges/:id/ml-workspace` | Submit/clear an artifact URL for one ML step (dataset, model, model code, or API packaging). Triggers scoring. | Contributor (self) |
| `GET` | `/api/challenges/:id/ml-rewards` | Pool state for an ML challenge (awarded, remaining, rules, per-user breakdown). | Public |
| `GET` | `/api/challenges/:id/signals` | List the challenge's discussion contribution signals. See [`slack-signals.md`](./slack-signals.md). | Public |
| `POST` | `/api/challenges/:id/signals` | Define a signal (label, description, CP reward, icon). | Admin or manager of its project |
| `PUT` | `/api/challenges/:id/signals/:signalId` | Update a signal. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/signals/:signalId` | Delete a signal. | Admin or manager of its project |
| `GET` | `/api/challenges/:id/slack-config` | Get the challenge's watched Slack channel + last run state. | Admin or manager of its project |
| `PUT` | `/api/challenges/:id/slack-config` | Set the watched Slack channel. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/slack-config` | Stop watching the channel. | Admin or manager of its project |

---

## Tasks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/tasks` | List all tasks (optionally filtered by challenge). | Public |
| `POST` | `/api/tasks` | Create a task. | Admin |
| `GET` | `/api/tasks/:id` | Get a task by ID. | Public |
| `PUT` | `/api/tasks/:id` | Update a task. | Admin |
| `DELETE` | `/api/tasks/:id` | Delete a task. | Admin |
| `GET` | `/api/tasks/:id/details` | Get full task details including assignees and workspaces. | Public |
| `POST` | `/api/tasks/:id/assign` | Assign a contributor to a task. | Admin |
| `GET` | `/api/tasks/:id/assignees` | List assignees for a task. | Public |
| `POST` | `/api/tasks/:id/complete` | Mark a task as complete. | Admin or assignee |
| `POST` | `/api/tasks/:id/evaluate` | Trigger AI evaluation for the task. Scores the contributor's work on the task's workspace branch and upserts a contribution record. See [`evaluation.md`](./evaluation.md). | Admin or assignee |

---

## Contributions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contributions` | List contributions. | Public |
| `POST` | `/api/contributions` | Create a contribution. | Admin |
| `GET` | `/api/contributions/challenge/:id` | Get all contributions for a specific challenge. | Public |
| `GET` | `/api/contributions/:id/rewards` | Ledger breakdown of a contribution's points (ML awards, reuse credits/deductions, Slack signals). See [`ml-rewards.md`](./ml-rewards.md). | Public |

---

## Evaluation Grids

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/evaluation-grids` | List all evaluation grids. | Admin |
| `POST` | `/api/evaluation-grids` | Create a grid. | Admin |
| `GET` | `/api/evaluation-grids/:id` | Get a grid by ID. | Admin |
| `PUT` | `/api/evaluation-grids/:id` | Update a grid. | Admin |
| `DELETE` | `/api/evaluation-grids/:id` | Delete a grid. | Admin |
| `GET` | `/api/evaluation-grids/:id/categories` | Get categories for a grid. | Admin |

## Evaluation Runs

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/evaluation-runs` | List evaluation runs, filterable by challenge and status. | Admin |
| `GET` | `/api/evaluation-runs/:id` | Get a single run's detail. | Admin |
| `DELETE` | `/api/evaluation-runs/:id` | Delete a run record. | Admin |
| `POST` | `/api/evaluation-runs/:id/retry` | Re-run evaluation for that run's challenge. | Admin |

---

## Projects & Repos

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/projects` | List all projects. | Public |
| `POST` | `/api/projects` | Create a project. | Admin |
| `GET` | `/api/projects/:id` | Get a project by ID. | Public |
| `PUT` | `/api/projects/:id` | Update a project (including assigning a manager). | Admin |
| `GET` | `/api/repos` | List all repositories. | Public |
| `POST` | `/api/repos` | Register a repository. | Admin or manager of its project |
| `GET` | `/api/repos/:id` | Get a repo by ID. | Public |
| `GET` | `/api/repos/:id/challenges` | List challenges linked to a repo. | Public |
| `GET` | `/api/repos/:id/workspaces` | List task workspaces provisioned on a repo. | Public |
| `GET` | `/api/repos/challenge-repos` | Get challenge↔repo links (with joined repo data). | Public |

---

## Sync Meetings

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sync-meetings` | List sync meetings. | Contributor+ |
| `POST` | `/api/sync-meetings` | Create a sync meeting in Google Workspace. | Admin or manager of the challenge's project |
| `GET` | `/api/sync-meetings/:id` | Get a meeting by ID. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/analysis` | Get the AI analysis for a meeting. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/participants` | List a meeting's participants. | Contributor+ |

---

## Onboarding

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/onboarding` | Get the authenticated user's onboarding progress. | Contributor+ |
| `POST` | `/api/onboarding` | Update onboarding mission progress. | Contributor+ |
| `GET` | `/api/onboarding/all` | List every contributor's onboarding progress. | Admin |

---

## Admin settings

See [`admin-settings.md`](./admin-settings.md) for what each of these controls.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `PATCH` | `/api/admin/theme` | Update the instance-wide theme. | Admin |
| `GET` | `/api/modules` | Get module visibility flags (meetings, onboarding). | Public |
| `PATCH` | `/api/modules` | Update module visibility flags. | Admin |
| `GET` | `/api/github-oauth/authorize` | Start the GitHub OAuth connection flow. | Admin |
| `GET` | `/api/github-oauth/callback` | OAuth callback — validates org admin/owner status, stores encrypted token. | Admin |
| `GET` | `/api/github-oauth/status` | Get GitHub connection state (never the token). | Admin |
| `DELETE` | `/api/github-oauth/connection` | Disconnect GitHub — falls back to `.env` `GITHUB_TOKEN`. | Admin |
| `GET` | `/api/kaggle/status` | Get Kaggle connection state. | Public |
| `POST` | `/api/kaggle/connection` | Connect a Kaggle account (verifies credentials, stores them encrypted). | Admin |
| `DELETE` | `/api/kaggle/connection` | Disconnect Kaggle — falls back to `.env` credentials. | Admin |
| `GET` | `/api/slack/status` | Get Slack connection state (and workspace name). | Public |
| `POST` | `/api/slack/connection` | Connect a Slack bot (verifies the token via `auth.test`, stores it encrypted). | Admin |
| `DELETE` | `/api/slack/connection` | Disconnect Slack — falls back to `.env` `SLACK_BOT_TOKEN`. | Admin |
| `GET` | `/api/slack/channels` | List public channels visible to the bot (for the challenge channel picker). | Admin or project manager |
| `GET` | `/api/openai/status` | Get OpenAI connection state. | Public |
| `POST` | `/api/openai/connection` | Connect an OpenAI API key (verified live, stored encrypted). | Admin |
| `DELETE` | `/api/openai/connection` | Disconnect OpenAI — falls back to `.env` `OPENAI_API_KEY`. | Admin |

---

## Cron

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/cron/check-meetings` | Polls for completed meetings and triggers analysis. Secured by `CRON_SECRET` header. | Cron secret |
| `GET` | `/api/cron/slack-signals` | Daily pass over each configured challenge's Slack channel: AI signal detection + CP awards. See [`slack-signals.md`](./slack-signals.md). | Cron secret |

These endpoints are designed to be called by an external cron scheduler (e.g. Vercel Cron, a server cron job). Set `CRON_SECRET` in your env and pass it as an `Authorization` header.

---

## Interactive API reference (development only)

In development, `GET /api/docs` serves a browsable API reference (via Scalar) generated from `src/app/api/openapi.yaml`, with `GET /api/openapi.json` as its backing spec. Both return `404` outside of `NODE_ENV=development` — this is a local exploration aid, not a production feature.
