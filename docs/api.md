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
| `POST` | `/api/challenges` | Create a challenge. Optional `slug`, derived from the title when omitted; `409 { field: 'slug', suggestion }` when taken. | Admin or project manager |
| `GET` | `/api/challenges/slug-availability` | `?slug=&exclude=<uuid>` → `{ available, problem, suggestion }`. What the form checks while typing; reserves nothing. | Admin or project manager |
| `GET` | `/api/challenges/:id` | Get a challenge by ID. | Public |
| `PUT` | `/api/challenges/:id` | Update a challenge. A changed `slug` keeps the old one as a redirect; `409` when taken. | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id` | Delete a challenge (also terminates any GPU instance it owns). | Admin |
| `GET` | `/api/challenges/:id/overview` | **Aggregated read** — challenge, team, tasks, repos, contributions, participants in one response (meetings are read from the meetings module's own route). Backs both the public detail page and the manage view. Anonymous callers get a reduced, allowlisted payload (`lib/public/overview.ts`). | Public |
| `POST` | `/api/challenges/:id/close` | Close a challenge — flips the status, then runs the flow's and extensions' `onClose` hooks (e.g. stopping GPU instances). | Admin |
| `GET` | `/api/challenges/:id/brief` | The challenge's `brief.md`, readable before joining. | Public |
| `GET` | `/api/challenges/:id/rewards` | Pool state (pool, distributed, remaining, breakdown) plus what the flow's `rewards` declaration adds. Anonymous callers get only the fields the flow declares public. | Public |
| `GET` | `/api/challenges/:id/meetings` | The challenge's meetings. `404` while the meetings module is disabled. | Admin, manager or member |
| `POST` | `/api/challenges/:id/join` | Join a challenge — creates the participation, copies the task template, provisions the personal branch. Optional body: `{ mode: 'group' }` creates a group and returns its invite token, `{ group: <uuid> }` joins one (no board copy, no provisioning). | Contributor+ |
| `GET` | `/api/challenges/:id/group/:token` | Who holds an invited group and whether it can still be joined. Answers only on an exact token, lists nothing. | Contributor+ |
| `POST` | `/api/challenges/:id/group/invite` | Drop a `group_invite` notification, carrying the group's token, into a contributor's profile. Body `{ userId }`. Idempotent per (recipient, group). **The caller must already be in a group on this challenge** — the server hands out the token here, so without that check any account could broadcast any group's. | Group member |
| `GET` | `/api/contributors/search?q=&challenge=` | Contributor picker for the join modal. At most 10 rows of `uuid` / `full_name` / `avatar_url` plus a `blocked_reason`, and **never** an email — unlike `GET /api/users`, which returns whole rows. | Contributor+ |
| `GET` | `/api/notifications` | Your notifications, newest first, capped at 50, plus an unread count. | Self |
| `PATCH` | `/api/notifications` | Mark all of yours read. | Self |
| `PATCH` | `/api/notifications/:id` | Mark one of yours read. 404 covers "not found", "not yours" and "already read" alike — a 403 would confirm the row exists. | Self |
| `DELETE` | `/api/notifications/:id` | Remove one of yours — declining a group invitation, or clearing one a successful join has spent. **Revokes nothing**: the group token stays valid and a link shared elsewhere still works. | Self |
| `GET` | `/api/challenges/:id/repos` | Repos linked to a challenge. | Public |
| `GET` | `/api/challenges/:id/repo-activity` | Live activity per linked repo — GitHub commits/PRs/reviews, or Kaggle dataset/model info. Fetched on demand, never cached. | Public |
| `GET` | `/api/challenges/:id/team` | Team members of a challenge. | Public |
| `POST` | `/api/challenges/:id/team` | Add a team member. | Admin |
| `DELETE` | `/api/challenges/:id/team/:userId` | Remove a team member. | Admin |
| `GET` | `/api/challenges/:id/documents` | List a challenge's markdown documents — including its `brief.md` (see [`challenges-and-tasks.md`](./challenges-and-tasks.md#the-brief)). | Public |
| `POST` | `/api/challenges/:id/documents` | Add a `.md` document (max 500KB). Idempotent for `brief.md`: re-posting replaces the existing brief (`200`) instead of stacking a second one (`201`). | Admin or manager of its project |
| `DELETE` | `/api/challenges/:id/documents/:docId` | Delete a document. | Admin or manager of its project |

### Flow and extension actions

What a challenge type adds lives behind two generic routes. The core dispatcher (`packages/capabilities/challenge-actions.ts`) matches the path against the actions the challenge's flow declares (`content/flows/*/index.ts`, with `content/kits/validation/actions/index.ts` for both validation flows) or an extension attached to that flow declares (`content/extensions/*/index.ts`):

| Path | Dispatched to |
|------|---------------|
| `/api/challenges/:id/flow/<action>` | an action of the challenge's flow |
| `/api/challenges/:id/ext/<key>/<action>` | an action of extension `<key>`, when it applies to the challenge's flow |

Every action needs a session. Its declared access is met by **any one** of its conditions: a role, being the manager of the challenge's project, being a member of the challenge, or holding the qualification the challenge's `flow_config` names. "Signed in" below means no condition — the handler does the finer check. Answers: `404` (unknown challenge, action, or extension not attached), `405` (wrong method), `401`, `403`, and `500 { error: "Action failed" }` on an unexpected error. An action can return raw bytes. Writes pass the proxy through a single exception (see [`auth.md`](./auth.md#route-protection)).

#### `code` flow

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `PATCH` | `flow/workspace` | `own_repo` mode: declare or change your public GitHub repo URL. | Member |
| `POST` | `flow/project-evaluation` | Trigger the evaluation of your own delivery (or your group's). Fire-and-forget; poll the contribution's `evaluation_status`. | Signed in — board, workspace and group checked by the service |

#### `ml` flow

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `GET` | `flow/workspace` | Each contributor's submitted artifact URLs. | Signed in |
| `PATCH` | `flow/workspace` | Submit/clear an artifact URL for one step (dataset, model, model code, API packaging). Triggers scoring, and makes the submitter a challenge member. | Signed in (self) |

#### Validation flows (see [`validation-challenges.md`](./validation-challenges.md))

Common to `endpoint-validation` and `journey-validation` (validation kit):

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `GET` | `flow/targets` | Exposed targets + pool state. `?eligible=true` lists the source challenge's deliverables not yet exposed (admin/manager, checked in the handler). | Signed in |
| `POST` | `flow/targets` | Expose a submission and record its deployed URL. | Admin or manager |
| `DELETE` | `flow/targets/:targetId` | Remove a target (409 once verdicts exist). | Admin or manager |
| `GET` | `flow/rewards` | Pool state + per-validator breakdown. | Admin or manager |

`endpoint-validation` — "Reviewer" is a holder of the challenge's `reviewer_qualification`:

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `GET` | `flow/targets/:targetId/claimable-cases` | Reference cases still claimable on this target, plus the caller's unfinished claims. | Reviewer |
| `POST` | `flow/targets/:targetId/claim` | Claim a case **and** test it against the live endpoint in one gesture. Returns the raw response, `X-Validation-Status`, `X-Claim-Id`. | Reviewer |
| `GET` | `flow/reference-cases` | Every case (admin/manager) or only your own (reviewer). | Admin, manager or reviewer |
| `POST` | `flow/reference-cases` | Author a ground-truth case (`multipart`: input + expected_output). No admin override. | Reviewer |
| `DELETE` | `flow/reference-cases/:caseId` | Delete a case (409 once claimed). | Its author, or admin (handler) |
| `GET` | `flow/reference-cases/:caseId/input` | Stream the known-input bytes. There is deliberately no equivalent for the expected output. | Admin, manager, or the case's author (handler) |
| `POST` | `flow/case-claims/:claimId/observation` | Record what you saw in the live response — required before any reveal. | Reviewer (claim owner) |
| `POST` | `flow/case-claims/:claimId/reveal` | Return the expected output. Refused until an observation exists. | Reviewer (claim owner) |
| `POST` | `flow/verdicts` | Cast the verdict for a revealed claim; resolves the target and pays the majority once quorum is reached. | Reviewer |
| `GET` | `flow/runs` | Every verdict cast on the challenge — metadata only. | Admin or manager |
| `GET` | `flow/runs/:attemptId/file` | The exact input bytes for one run. | Admin or manager |
| `GET` | `flow/runs/:attemptId/response` | The exact endpoint response for one run. | Admin or manager |

`journey-validation`:

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `GET` | `flow/scenario-steps` | The scenario, in order, plus `frozen`. It is the protocol, not a secret. | Signed in |
| `POST` | `flow/scenario-steps` | Append a step. 409 once any walkthrough exists. | Admin or manager |
| `PATCH` | `flow/scenario-steps/:stepId` | Retitle, re-instruct or reorder a step (a reorder renumbers every sibling). 409 once any walkthrough exists. | Admin or manager |
| `DELETE` | `flow/scenario-steps/:stepId` | Delete a step and renumber the rest. 409 once any walkthrough exists. | Admin or manager |
| `POST` | `flow/scenario-runs` | Open **or resume** a walkthrough on one application — idempotent, returns the full state. 403 on your own (or your group's) application, or outside the challenge's `eligible_roles`. | Signed in |
| `GET` | `flow/scenario-runs` | Every walkthrough on the challenge: per application, who walked it, each step result, the comments, the expert opinions and the overall feedback. | Admin or manager |
| `PUT` | `flow/scenario-runs/:runId/steps/:stepId` | Save one step: `result` (`passed`/`failed`/`blocked`), `comment`, `medical_comment`. 403 on `medical_comment` without the challenge's `expert_comment_qualification`. | The walkthrough's owner (handler) |
| `POST` | `flow/scenario-runs/:runId/complete` | Close the walkthrough and pay `cp_per_validation`, clamped to the pool. 400 with `missingStepIds` while a step has no result. | The walkthrough's owner (handler) |

#### `compute` extension — `ml` flow (see [`compute-power.md`](./compute-power.md))

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `GET` | `ext/compute/request` | The caller's own compute request on this challenge, if any. | Signed in (self) |
| `POST` | `ext/compute/request` | Request a temporary GPU instance. One per contributor per challenge. | Signed in (self) |
| `POST` | `ext/compute/request/reveal-token` | Return the JupyterLab URL + access token. Re-readable while the instance is `ready`. | Owning contributor (handler) |
| `GET` | `ext/compute/requests` | Every request on the challenge — never includes access tokens. | Admin or manager |
| `POST` | `ext/compute/requests/:requestId/decision` | `{ decision: 'approve' \| 'reject' \| 'retry' }`. | Admin or manager |

#### `slack-signals` extension — every flow (see [`slack-signals.md`](./slack-signals.md))

| Method | Path | Description | Access |
|--------|------|-------------|--------|
| `GET` | `ext/slack-signals/signals` | The challenge's discussion contribution signals. | Signed in |
| `POST` | `ext/slack-signals/signals` | Define a signal (label, description, CP reward, icon). | Admin or manager |
| `PUT` | `ext/slack-signals/signals/:signalId` | Update a signal. | Admin or manager |
| `DELETE` | `ext/slack-signals/signals/:signalId` | Delete a signal. | Admin or manager |
| `GET` | `ext/slack-signals/config` | The watched Slack channel + last run state. | Admin or manager |
| `PUT` | `ext/slack-signals/config` | Set the watched Slack channel. | Admin or manager |
| `DELETE` | `ext/slack-signals/config` | Stop watching the channel. | Admin or manager |

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

## Events

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/events/ui` | `{ type, payload }` — an interface event (`ui.challenge_opened { challengeId }`, `ui.meeting_link_opened { meetingId }`) written to the event outbox. Only `ui.*` types the platform declares and the route knows how to check, and only on a challenge or meeting the caller can see. The user always comes from the session, never from the body. | Signed in |

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

Every route below answers `404` while the `meetings` module is disabled (the default).

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sync-meetings` | List sync meetings. | Contributor+ |
| `POST` | `/api/sync-meetings` | Create a meeting in Google Workspace. | Admin or manager of the challenge's project |
| `GET` | `/api/sync-meetings/:id` | Get a meeting. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/analysis` | The AI analysis for a meeting. | Contributor+ |
| `GET` | `/api/sync-meetings/:id/participants` | A meeting's participants. | Contributor+ |

---

## Onboarding

Quests complete server-side, from the platform events that complete them (see [`onboarding.md`](./onboarding.md)); there is no write route.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/onboarding` | The installed quests and their state for the authenticated user. | Contributor+ |
| `GET` | `/api/onboarding/all` | Every contributor's completed quests. `404` while the `onboarding` module is disabled. | Admin |

---

## Sandbox

Contributor-proposed open challenges. See [`sandbox.md`](./sandbox.md).

Listing and detail are **public** — this is what lets a newsletter link to a sandbox and have its reader star it. `/api/sandboxes/**` sits outside the proxy matcher, like `/api/admin/*`, so every handler runs its own check. Every route below answers `404` while the `sandbox` module is disabled. The star tiers and the promotion bonus are the module's settings (`PATCH /api/modules/sandbox`, `settings.star_tiers` and `settings.promotion_bonus_cp`).

A sandbox's `type` is the key of a flow that declares `proposable`; its fields (`repo_url`, `dataset_urls`…) are validated by that flow's schema, `400` with `details` otherwise. A sandbox whose flow is no longer installed or proposable answers `409` to promotion and to field edits.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/api/sandboxes` | List sandboxes with star counts, the caller's star state, the configured tiers and the promotion bonus. Archived ones only for their author and admins. | Public |
| `POST` | `/api/sandboxes` | Create a sandbox. Goes live as `open` immediately. Optional `slug`, as for challenges. | `admin`, `contributor` |
| `GET` | `/api/sandboxes/slug-availability` | `?slug=&exclude=<uuid>`, in the sandbox namespace. | `admin`, `contributor` |
| `GET` | `/api/sandboxes/:id` | Detail. The evaluation score is present only for the author and admins. | Public |
| `PATCH` | `/api/sandboxes/:id` | Edit title, slug, sections, repo, model, datasets. `{ status: 'archived' }` archives it. `type` is immutable. | Author (archive: author or admin) |
| `POST` | `/api/sandboxes/:id/promote` | Turn the sandbox into a challenge. Optional `slug`, the sandbox's own when omitted and free; `409` when taken. | Admin |
| `PUT` | `/api/sandboxes/:id/star` | Star. Idempotent, checks the tiers, and issues the anonymous cookie when the request carries none. `403` for the author, `409` if not `open`, `429` past the rate limit. | Public |
| `DELETE` | `/api/sandboxes/:id/star` | Unstar. Soft delete — never reverses a paid tier. | Public |
| `GET` | `/api/admin/sandboxes/:id/stars` | Audit: stars grouped by origin, hashed-IP prefix and day. Never the full hash or the `anon_id`. | Admin |
| `DELETE` | `/api/admin/sandboxes/:id/stars` | Delete stars by id, by hashed IP or by time window. | Admin |
| `DELETE` | `/api/admin/sandbox-rewards/:id` | Delete a paid reward. Lowers the leaderboard total immediately — there is no cache. | Admin |

Star responses carry `paid_tier_thresholds` alongside the count. Paid milestones are **read from the ledger, never derived from the count**: attaching anonymous stars on sign-in can drop a count back below a threshold that was already paid.

---

## Admin settings

See [`admin-settings.md`](./admin-settings.md) for what each of these controls.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `PATCH` | `/api/admin/theme` | Update the instance-wide theme. | Admin |
| `GET` | `/api/modules` | The installed modules and whether each is enabled — no settings. | Public |
| `GET` | `/api/modules/:key` | A module's state and validated settings. | Admin |
| `PATCH` | `/api/modules/:key` | `{ enabled?, settings? }` — settings are merged into the current ones, then validated by the module's schema (`400` otherwise). | Admin |
| `GET` | `/api/qualifications` | The qualifications the distribution declares. | Admin |
| `PUT` / `DELETE` | `/api/users/:id/qualifications` | Grant / revoke a qualification; audited in `qualification_changes`. | Admin |
| `GET` | `/api/integrations` | The installed integrations, their fields and state. | Admin |
| `GET` | `/api/integrations/:key/status` | `{ connected }`; admins also get `connected_at` and the public details (never a secret). | Public |
| `POST` | `/api/integrations/:key/connection` | Connect an API-key integration (`kaggle`, `slack`, `openai`, `scaleway`): one body field per declared field, verified live with the provider, stored encrypted in `integration_credentials`. | Admin |
| `DELETE` | `/api/integrations/:key/connection` | Disconnect, by the integration's rule — deletion, or a deferred disconnect for Scaleway (see [`compute-power.md`](./compute-power.md)). | Admin |
| `GET` | `/api/integrations/:key/authorize` | Start an OAuth integration (`github`): random state in a cookie, then the provider's consent page. | Admin |
| `GET` | `/api/integrations/:key/callback` | OAuth return — for GitHub, validates org admin/owner status and stores the encrypted token. `/api/github-oauth/callback` remains as an alias until challenge 020 L7. | Admin |
| `GET` | `/api/integrations/:key/extras/:action` | A side read an integration declares, with the access it declares — e.g. `slack/extras/channels`, the public channels visible to the bot (admin or project manager). | Declared |
| `GET` | `/api/admin/digests` | Digest history, newest first (paginated; counts, not payloads). `404` while the digest module is disabled, like the two below. | Admin |
| `GET` | `/api/admin/digests/:id` | One digest's full payload. | Admin |
| `POST` | `/api/admin/digests/generate` | Generate a digest now. Optional `{ period_start }` forces the lower bound (ISO or `YYYY-MM-DD`, read as midnight UTC, must be past); without it, the last `period_end` is used. | Admin |

---

## Cron

One route, `GET /api/cron/tick`, secured by `Authorization: Bearer $CRON_SECRET` and called **every minute** by the scheduler. It runs the jobs that are due, one after the other, each under its lock in `cron_runs`; a failing job is recorded there and does not stop the next. Jobs are declared by their owner — the core, a flow, an extension or a module — and collected by `packages/capabilities/cron.ts`. A disabled module's jobs are skipped.

| Job | Owner | Schedule (UTC) | Purpose |
|-----|-------|----------------|---------|
| `core.events.distribute` | core | every minute | Deliver platform events to their subscribers (quests…). |
| `core.events.purge` | core | daily, 05:30 | Purge events older than 30 days. |
| `core.refresh-tokens.cleanup` | core | daily, 05:00 | Delete expired refresh tokens. |
| `compute.provisioning` | `compute` extension | every minute | Poll GPU instances still provisioning and flip them to `ready`. |
| `compute.expiration` | `compute` extension | every minute | Terminate GPU instances past their 24h window. |
| `slack-signals.detect` | `slack-signals` extension | daily, 06:00 | Slack signal detection + CP awards. See [`slack-signals.md`](./slack-signals.md). |
| `endpoint-validation.evidence.purge` | `endpoint-validation` flow | daily, 05:00 | Purge the evidence (inputs, responses) of challenges closed for 12 months. |
| `meetings.check` | `meetings` module | every minute | Detect completed meetings and trigger analysis. |
| `digest.generate` | `digest` module | daily, 05:00 | Generate an activity digest when one is due. See [`digest.md`](./digest.md). |
| `sandbox.ip-hashes.purge` | `sandbox` module | daily, 05:00 | Purge star IP hashes older than 30 days. |

The former routes `/api/cron/check-meetings`, `/api/cron/slack-signals`, `/api/cron/compute-provisioning`, `/api/cron/compute-expiration` and `/api/cron/digest` are wrappers that run just their job; they remain until the scheduler switch is verified (challenge 020 L7). See [`deployment.md`](./deployment.md).

---

## Interactive API reference (development only)

In development, `GET /api/docs` serves a browsable API reference (via Scalar) generated from `src/app/api/openapi.yaml`, with `GET /api/openapi.json` as its backing spec. Both return `404` outside `NODE_ENV=development` — a local exploration aid, not a production feature.

> The OpenAPI spec is maintained by hand and lags behind this document; treat the route tables above as the reference.
