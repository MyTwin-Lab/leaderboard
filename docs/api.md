# API

All API endpoints are implemented as **Next.js Route Handlers** under `apps/leaderboard-client/src/app/api/`. There is no separate API server.

All request bodies are JSON unless noted (a few validation routes take `multipart/form-data` or return raw bytes). Authentication is via HTTP-only JWT cookies (see [`auth.md`](./auth.md)).

> The "Auth" column is the *effective* requirement, combining the Edge proxy's blanket rule (any `POST`/`PUT`/`PATCH`/`DELETE` needs `admin` unless explicitly excepted — see [`auth.md`](./auth.md#route-protection)) with the route handler's own check.

---

## Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/google-auth/authorize` | Start the Google OAuth flow — redirects to Google's consent screen. | Public |
| `GET` | `/api/google-auth/callback` | OAuth callback — exchanges code for tokens, finds or creates user, sets JWT cookies. | Public |
| `POST` | `/api/auth/refresh` | Exchange a valid refresh token for a new access token. | Cookie |
| `POST` | `/api/auth/logout` | Clear auth cookies and revoke all refresh tokens for the user. | Cookie |
| `GET` | `/api/auth/check-session` | Internal: `proxy.ts` runs at the Edge and cannot reach Postgres, so it calls this to confirm the JWT's `userId` still exists (covers merged and deleted accounts). | Internal |

---

## Users

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/users` | List all users. | Authenticated |
| `POST` | `/api/users` | Create a user. | Admin |
| `GET` | `/api/users/:id` | Get a user by ID. | Authenticated |
| `PATCH` | `/api/users/:id` | Update a user (e.g. `role`). | Admin |
| `DELETE` | `/api/users/:id` | Delete a user. | Admin |
| `POST` | `/api/users/merge` | Merge a placeholder account into a Google account — the placeholder's history moves over and the absorbed row is deleted. | Admin |

---

## Current user

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contributors/me` | The authenticated user's profile, role, and the projects they manage. | Contributor+ |
| `PATCH` | `/api/contributors/me` | Update your own profile (name, GitHub username, avatar). | Self |
| `GET` | `/api/contributors/me/tasks` | Tasks on the authenticated user's personal boards. | Contributor+ |

---

## Leaderboard

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/leaderboard` | Ranked leaderboard with contributor scores and CP. | Public |

---

## Challenges

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/challenges` | List challenges. `?managed=true` instead lists all challenges (drafts included) of projects the caller manages. | Public (managed filter requires auth) |
| `POST` | `/api/challenges` | Create a challenge. | Admin or project manager |
| `GET` | `/api/challenges/:id` | Get a challenge by ID. | Public |
| `PUT` | `/api/challenges/:id` | Update a challenge. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id` | Delete a challenge (also terminates any GPU instance it owns). | Admin |
| `GET` | `/api/challenges/:id/overview` | **Aggregated read** — challenge, team, tasks, meetings, repos, contributions, participants in one response. Backs both the public detail page and the manage view. Anonymous callers get a reduced, allowlisted payload (`lib/public/overview.ts`). | Public |
| `POST` | `/api/challenges/:id/close` | Close a challenge — flips the status only, nothing is computed. | Admin |
| `GET` | `/api/challenges/:id/context` | Full evaluation context (commits, notes). Legacy — belongs to the retired challenge-level pipeline. | Admin |
| `POST` | `/api/challenges/:id/sync` | Legacy challenge-level evaluation sync. Superseded by per-contributor project evaluation. | Admin |
| `POST` | `/api/challenges/:id/join` | Join a challenge — creates the participation, copies the task template, provisions the personal branch. Optional body: `{ mode: 'group' }` creates a group and returns its invite token, `{ group: <uuid> }` joins one (no board copy, no provisioning). | Contributor+ |
| `GET` | `/api/challenges/:id/group/:token` | Who holds an invited group and whether it can still be joined. Answers only on an exact token, lists nothing. | Contributor+ |
| `PATCH` | `/api/challenges/:id/workspace` | `own_repo` mode: declare or change your public GitHub repo URL. | Contributor (self) |
| `POST` | `/api/challenges/:id/project-evaluation` | Trigger the evaluation of your own delivery. Fire-and-forget; poll the contribution's `evaluation_status`. | Contributor (self) |
| `GET` | `/api/challenges/:id/repos` | Repos linked to a challenge. | Public |
| `GET` | `/api/challenges/:id/repo-activity` | Live activity per linked repo — GitHub commits/PRs/reviews, or Kaggle dataset/model info. Fetched on demand, never cached. | Public |
| `GET` | `/api/challenges/:id/team` | Team members of a challenge. | Public |
| `POST` | `/api/challenges/:id/team` | Add a team member. | Admin |
| `DELETE` | `/api/challenges/:id/team/:userId` | Remove a team member. | Admin |
| `GET` | `/api/challenges/:id/documents` | List a challenge's markdown documents — including its `brief.md` (see [`challenges-and-tasks.md`](./challenges-and-tasks.md#the-brief)). | Public |
| `POST` | `/api/challenges/:id/documents` | Add a `.md` document (max 500KB). Idempotent for `brief.md`: re-posting replaces the existing brief (`200`) instead of stacking a second one (`201`). | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/documents/:docId` | Delete a document. | Admin or manager of its project |
| `GET` | `/api/challenges/:id/signals` | The challenge's discussion contribution signals. See [`slack-signals.md`](./slack-signals.md). | Public |
| `POST` | `/api/challenges/:id/signals` | Define a signal (label, description, CP reward, icon). | Admin or manager |
| `PUT` | `/api/challenges/:id/signals/:signalId` | Update a signal. | Admin or manager |
| `DELETE` | `/api/challenges/:id/signals/:signalId` | Delete a signal. | Admin or manager |
| `GET` | `/api/challenges/:id/slack-config` | The watched Slack channel + last run state. | Admin or manager |
| `PUT` | `/api/challenges/:id/slack-config` | Set the watched Slack channel. | Admin or manager |
| `DELETE` | `/api/challenges/:id/slack-config` | Stop watching the channel. | Admin or manager |

### ML challenges

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/challenges/:id/ml-workspace` | Each contributor's submitted artifact URLs. | Public |
| `PATCH` | `/api/challenges/:id/ml-workspace` | Submit/clear an artifact URL for one step (dataset, model, model code, API packaging). Triggers scoring, and makes the submitter a challenge member. | Contributor (self) |
| `GET` | `/api/challenges/:id/ml-rewards` | Pool state (awarded, remaining, rules, per-user breakdown). Serves `code` challenges too. | Public |

### GPU compute (see [`compute-power.md`](./compute-power.md))

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/challenges/:id/compute-request` | The caller's own compute request on this challenge, if any. | Contributor (self) |
| `POST` | `/api/challenges/:id/compute-request` | Request a temporary GPU instance. One per contributor per challenge. | Contributor (self) |
| `POST` | `/api/challenges/:id/compute-request/reveal-token` | Return the JupyterLab URL + access token. Re-readable while the instance is `ready`. | Owning contributor |
| `GET` | `/api/challenges/:id/compute-requests` | Every request on the challenge — never includes access tokens. | Admin or manager |
| `POST` | `/api/challenges/:id/compute-requests/:requestId/decision` | `{ decision: 'approve' \| 'reject' \| 'retry' }`. | Admin or manager |

### Validation challenges (see [`validation-challenges.md`](./validation-challenges.md))

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/challenges/:id/validation-targets` | Exposed targets + pool state. `?eligible=true` lists `api_packaging` submissions not yet exposed. | Public (`eligible` = admin/manager) |
| `POST` | `/api/challenges/:id/validation-targets` | Expose a submission and record its deployed endpoint URL. | Admin or manager |
| `DELETE` | `/api/challenges/:id/validation-targets/:targetId` | Remove a target (409 once verdicts exist). | Admin or manager |
| `GET` | `/api/challenges/:id/validation-targets/:targetId/claimable-cases` | Reference cases still claimable on this target, plus the caller's unfinished claims. | `medical_pro` |
| `POST` | `/api/challenges/:id/validation-targets/:targetId/claim` | Claim a case **and** test it against the live endpoint in one gesture. Returns the raw response, `X-Validation-Status`, `X-Claim-Id`. | `medical_pro` |
| `GET` | `/api/challenges/:id/validation-reference-cases` | Every case (admin/manager) or only your own (`medical_pro`). | Admin, manager or `medical_pro` |
| `POST` | `/api/challenges/:id/validation-reference-cases` | Author a ground-truth case (`multipart`: input + expected_output). No admin override. | `medical_pro` |
| `DELETE` | `/api/challenges/:id/validation-reference-cases/:caseId` | Delete a case (409 once claimed). | Its author, or admin |
| `GET` | `/api/challenges/:id/validation-reference-cases/:caseId/input` | Stream the known-input bytes. There is deliberately no equivalent for the expected output. | Admin, manager, or the case's author |
| `POST` | `/api/challenges/:id/validation-case-claims/:claimId/observation` | Record what you saw in the live response — required before any reveal. | `medical_pro` (claim owner) |
| `POST` | `/api/challenges/:id/validation-case-claims/:claimId/reveal` | Return the expected output. Refused until an observation exists. | `medical_pro` (claim owner) |
| `POST` | `/api/challenges/:id/validation-verdicts` | Cast the verdict for a revealed claim; resolves the target and pays the majority once quorum is reached. | `medical_pro` |
| `GET` | `/api/challenges/:id/validation-runs` | Every verdict cast on the challenge — metadata only. | Admin or manager |
| `GET` | `/api/challenges/:id/validation-runs/:attemptId/file` | The exact input bytes for one run. | Admin or manager |
| `GET` | `/api/challenges/:id/validation-runs/:attemptId/response` | The exact endpoint response for one run. | Admin or manager |
| `GET` | `/api/challenges/:id/validation-rewards` | Pool state + per-validator breakdown. | Admin or manager |

---

## Tasks

Tasks are personal boards on `code` challenges (see [`challenges-and-tasks.md`](./challenges-and-tasks.md)). A task with `user_id = NULL` is a **template** task owned by the challenge.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/tasks` | List tasks. `?challenge_id=…&scope=mine\|template\|all`. | Public |
| `POST` | `/api/tasks` | Create a task — a personal one on your own board, or a template one. | Member (personal) / admin or manager (template) |
| `GET` | `/api/tasks/:id` | Get a task. | Public |
| `PATCH` | `/api/tasks/:id` | Update a task (this is what a board drag does). Optional `from_status` makes the write conditional and answers `409` if someone else moved the card first. | Owner / admin or manager (template) |
| `DELETE` | `/api/tasks/:id` | Delete a task. | Owner / admin or manager (template) |
| `GET` | `/api/tasks/:id/details` | A task with its sub-tasks. | Public |

> There is no per-task assignment, completion, or evaluation endpoint any more — `assign`, `assignees`, `complete` and `evaluate` were removed with the shared-board model.

---

## Contributions

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/contributions` | List contributions. | Public |
| `POST` | `/api/contributions` | Create a contribution. | Admin |
| `GET` | `/api/contributions/:id` | One contribution. The AI evaluation detail is returned only to its author; title, reward and date stay public. | Public |
| `PATCH` | `/api/contributions/:id` | Update a contribution. | Admin |
| `DELETE` | `/api/contributions/:id` | Delete a contribution. | Admin |
| `GET` | `/api/contributions/challenge/:id` | All contributions for a challenge. | Public |
| `GET` | `/api/contributions/:id/rewards` | Ledger breakdown (ML awards, reuse credits/deductions, Slack signals, validation). See [`ml-rewards.md`](./ml-rewards.md). | Public |

---

## Evaluation grids & runs

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` / `POST` | `/api/evaluation-grids` | List / create grids. | Admin |
| `GET` / `PUT` / `DELETE` | `/api/evaluation-grids/:id` | Read / update / delete a grid. | Admin |
| `GET` / `POST` | `/api/evaluation-grids/:id/categories` | List / add categories. | Admin |
| `PUT` / `DELETE` | `/api/evaluation-grids/:id/categories/:catId` | Update / remove a category. | Admin |
| `GET` / `POST` | `/api/evaluation-grids/:id/categories/:catId/subcriteria` | List / add sub-criteria. | Admin |
| `PUT` / `DELETE` | `/api/evaluation-grids/:id/categories/:catId/subcriteria/:subId` | Update / remove a sub-criterion. | Admin |
| `POST` | `/api/evaluation-grids/:id/test-run` | Score a sample against the grid to sanity-check it before use. | Admin |
| `GET` | `/api/evaluation-runs` | List runs, filterable by challenge and status. | Admin |
| `GET` / `DELETE` | `/api/evaluation-runs/:id` | Read / delete a run record. | Admin |
| `POST` | `/api/evaluation-runs/:id/retry` | Re-run evaluation for that run's challenge. | Admin |

---

## Projects & Repos

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/projects` | List projects. | Public |
| `POST` | `/api/projects` | Create a project. | Admin |
| `GET` | `/api/projects/:id` | Get a project. | Public |
| `PUT` | `/api/projects/:id` | Update a project (including assigning a manager). | Admin |
| `DELETE` | `/api/projects/:id` | Delete a project. | Admin |
| `GET` | `/api/repos` | List repositories. | Public |
| `POST` | `/api/repos` | Register a repository. | Admin or manager of its project |
| `DELETE` | `/api/repos/:id` | Delete a repository. | Admin |
| `GET` | `/api/repos/:id/challenges` | Challenges linked to a repo. | Public |
| `GET` | `/api/repos/challenge-repos` | Challenge↔repo links, with joined repo data. | Public |

---

## Sync Meetings

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sync-meetings` | List sync meetings. | Contributor+ |
| `POST` | `/api/sync-meetings` | Create a meeting in Google Workspace. | Admin or manager of the challenge's project |
| `GET` | `/api/sync-meetings/:id` | Get a meeting. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/analysis` | The AI analysis for a meeting. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/participants` | A meeting's participants. | Contributor+ |

---

## Onboarding

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/onboarding` | The authenticated user's onboarding progress. | Contributor+ |
| `PATCH` | `/api/onboarding` | Mark a quest as completed (idempotent). | Contributor+ |
| `GET` | `/api/onboarding/all` | Every contributor's progress. | Admin |

---

## Admin settings

See [`admin-settings.md`](./admin-settings.md) for what each of these controls.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `PATCH` | `/api/admin/theme` | Update the instance-wide theme. | Admin |
| `GET` | `/api/modules` | Module visibility flags (meetings, onboarding). | Public |
| `PATCH` | `/api/modules` | Update module visibility flags. | Admin |
| `GET` | `/api/github-oauth/authorize` | Start the GitHub OAuth connection flow. | Admin |
| `GET` | `/api/github-oauth/callback` | Callback — validates org admin/owner status, stores the encrypted token. | Admin |
| `GET` | `/api/github-oauth/status` | GitHub connection state (never the token). | Admin |
| `DELETE` | `/api/github-oauth/connection` | Disconnect GitHub — falls back to `.env` `GITHUB_TOKEN`. | Admin |
| `GET` | `/api/kaggle/status` | Kaggle connection state. | Public |
| `POST` | `/api/kaggle/connection` | Connect a Kaggle account (verified live, stored encrypted). | Admin |
| `DELETE` | `/api/kaggle/connection` | Disconnect Kaggle — falls back to `.env`. | Admin |
| `GET` | `/api/slack/status` | Slack connection state (and workspace name). | Public |
| `POST` | `/api/slack/connection` | Connect a Slack bot (verified via `auth.test`, stored encrypted). | Admin |
| `DELETE` | `/api/slack/connection` | Disconnect Slack — falls back to `.env` `SLACK_BOT_TOKEN`. | Admin |
| `GET` | `/api/slack/channels` | Public channels visible to the bot. | Admin or project manager |
| `GET` | `/api/openai/status` | OpenAI connection state. | Public |
| `POST` | `/api/openai/connection` | Connect an OpenAI API key (verified live, stored encrypted). | Admin |
| `DELETE` | `/api/openai/connection` | Disconnect OpenAI — falls back to `.env` `OPENAI_API_KEY`. | Admin |
| `GET` | `/api/scaleway/status` | Scaleway connection state (connected, project ID, date — never the key). | Public |
| `POST` | `/api/scaleway/connection` | Connect Scaleway (`secret_key`, `project_id`, `zone` — verified live, stored encrypted). | Admin |
| `DELETE` | `/api/scaleway/connection` | Request disconnection — see [`compute-power.md`](./compute-power.md). | Admin |
| `GET` | `/api/admin/digests` | Digest history, newest first (paginated; counts, not payloads). | Admin |
| `GET` | `/api/admin/digests/:id` | One digest's full payload. | Admin |
| `POST` | `/api/admin/digests/generate` | Generate a digest now. Optional `{ period_start }` forces the lower bound (ISO or `YYYY-MM-DD`, read as midnight UTC, must be past); without it, the last `period_end` is used. Works even when the schedule is off. | Admin |
| `PATCH` | `/api/admin/digest-settings` | Update `digest_enabled` / `digest_frequency_days`. | Admin |

---

## Cron

All five are secured by `Authorization: Bearer $CRON_SECRET` and declared in `vercel.json`.

| Method | Path | Schedule | Purpose |
|--------|------|----------|---------|
| `GET` | `/api/cron/check-meetings` | every minute | Detect completed meetings and trigger analysis. |
| `GET` | `/api/cron/slack-signals` | daily, 06:00 UTC | Slack signal detection + CP awards. See [`slack-signals.md`](./slack-signals.md). |
| `GET` | `/api/cron/compute-provisioning` | every minute | Poll GPU instances still provisioning and flip them to `ready`. |
| `GET` | `/api/cron/compute-expiration` | every minute | Terminate GPU instances past their 24h window. |
| `GET` | `/api/cron/digest` | daily, 05:00 UTC | Generate an activity digest when one is due. See [`digest.md`](./digest.md). |

Outside Vercel there is no built-in scheduler — see [`deployment.md`](./deployment.md#cron-jobs).

---

## Interactive API reference (development only)

In development, `GET /api/docs` serves a browsable API reference (via Scalar) generated from `src/app/api/openapi.yaml`, with `GET /api/openapi.json` as its backing spec. Both return `404` outside `NODE_ENV=development` — a local exploration aid, not a production feature.

> The OpenAPI spec is maintained by hand and lags behind this document; treat the route tables above as the reference.
