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
| `GET` | `/api/challenges` | List all challenges. | Public |
| `POST` | `/api/challenges` | Create a challenge. | Admin |
| `GET` | `/api/challenges/:id` | Get a challenge by ID. | Public |
| `PUT` | `/api/challenges/:id` | Update a challenge. | Admin |
| `DELETE` | `/api/challenges/:id` | Delete a challenge. | Admin |
| `POST` | `/api/challenges/:id/close` | Close a challenge (set status to closed). | Admin |
| `GET` | `/api/challenges/:id/context` | Get the full context for evaluation (commits, notes). | Admin |
| `POST` | `/api/challenges/:id/join` | Join a challenge as a contributor. | Contributor+ |
| `GET` | `/api/challenges/:id/repos` | Get repos linked to a challenge. | Public |
| `POST` | `/api/challenges/:id/sync` | Trigger the AI evaluation sync for a challenge. | Admin |
| `GET` | `/api/challenges/:id/team` | Get team members of a challenge. | Public |
| `PUT` | `/api/challenges/:id/team/:userId` | Add/update a team member. | Admin |

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

---

## Projects & Repos

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/projects` | List all projects. | Public |
| `POST` | `/api/projects` | Create a project. | Admin |
| `GET` | `/api/repos` | List all repositories. | Public |
| `POST` | `/api/repos` | Register a repository. | Admin |

---

## Sync Meetings

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sync-meetings` | List sync meetings. | Contributor+ |
| `POST` | `/api/sync-meetings` | Create a sync meeting in Google Workspace. | Admin |

---

## Onboarding

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/onboarding` | Get the authenticated user's onboarding progress. | Contributor+ |
| `POST` | `/api/onboarding` | Update onboarding mission progress. | Contributor+ |

---

## Cron

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/cron/check-meetings` | Polls for completed meetings and triggers analysis. Secured by `CRON_SECRET` header. | Cron secret |

This endpoint is designed to be called by an external cron scheduler (e.g. Vercel Cron, a server cron job). Set `CRON_SECRET` in your env and pass it as an `Authorization` header.
