# Authentication

The app uses **Google OAuth** as the identity provider. After Google verifies the user, the app issues its own **JWT tokens stored as HTTP-only cookies** for subsequent requests. There is no password login.

---

## How login works

```
1. User clicks "Sign in with Google"
2. Browser redirects to GET /api/google-auth/authorize
3. Server redirects to Google's OAuth consent screen
4. User authenticates with Google
5. Google redirects back to GET /api/google-auth/callback?code=...
6. Server exchanges the code for a Google access token
7. Server fetches the user's Google profile (email, name, google_user_id)
8. Server finds or creates the user in the database:
   - If user exists by google_user_id → log in
   - If user exists by email → link Google account and log in
   - Otherwise → create new user (role: contributor) + init onboarding
9. Server issues JWT access + refresh tokens as HTTP-only cookies
10. User is redirected to the app
```

---

## JWT tokens

After Google OAuth completes, all subsequent requests are authenticated via JWT cookies — Google is not contacted again on each request.

| Cookie | Lifetime | Purpose |
|--------|----------|---------|
| `access_token` | 15 minutes | Authenticates each API request |
| `refresh_token` | 7 days | Used to get a new access token without re-logging in |

JWT payload contains: `userId`, `email`, `role`.

Refresh tokens are also stored **hashed** in the `refresh_tokens` table. On refresh, the old token is invalidated and a new pair is issued (token rotation).

---

## Token refresh

When the access token expires, the client calls `POST /api/auth/refresh`. The server:
1. Reads the `refresh_token` cookie
2. Verifies the JWT signature
3. Invalidates all existing refresh tokens for the user
4. Issues a new `access_token` + `refresh_token` pair

---

## Logout

`POST /api/auth/logout` clears both cookies and invalidates all refresh tokens for the user in the database.

---

## Route protection

The proxy at `apps/leaderboard-client/src/proxy.ts` (Next.js middleware, runs at the Edge) checks the `access_token` cookie on every request.

| Path | Who can access |
|------|----------------|
| `/admin/**` | `admin` only |
| `/contributors/me` | `admin`, `contributor`, `viewer`, `medical_pro` |
| `/challenges/**` | `admin`, `contributor`, `viewer`, `medical_pro` |
| `/api/google-auth/**` | Public (OAuth flow) |
| `/api/auth/refresh`, `/api/auth/logout` | Cookie (any authenticated user) |
| `GET /api/**` (most) | Public or authenticated depending on route |
| `POST/PUT/PATCH/DELETE /api/**` | Requires `admin`, **unless** the path matches one of the exceptions below |

The write exceptions, as encoded in `proxy.ts`:

| Exception | Covers |
|-----------|--------|
| Task self-service | `POST /api/tasks`, `PATCH`/`DELETE /api/tasks/:id` — your own board |
| ML contributor | any path containing `/ml-workspace` |
| Join | any path ending in `/join` |
| Challenge self-service | paths ending in `/project-evaluation` or `/workspace` |
| Own profile | `PATCH /api/contributors/me` |
| Manager-accessible | `PUT`/`PATCH /api/challenges/:id`, `POST /api/challenges`, `POST`/`PUT /api/repos*`, any path containing `/documents` |
| `medical_pro` validation | for that role only: paths containing `/validation-verdicts`, `/validation-targets`, `/validation-case-claims`, `/validation-reference-cases` |

Each exception only gets the request *past the proxy* — the route handler still runs its own check (ownership, project-manager status, role). The proxy is a coarse filter, not the authorization.

Since the proxy runs at the Edge, it cannot query the database — it only checks the JWT (role, user ID). Anything that depends on database state ("is this user the manager of this project?") is checked inside the route handler. The one exception is account validity: the proxy calls `GET /api/auth/check-session` to confirm the JWT's `userId` still exists, which covers merged and deleted accounts.

---

## Roles

Roles are stored in `users.role` (free-text in the schema) and changed by an admin from `/admin/users`. Four values are used:

| Role | Description |
|------|-------------|
| `admin` | Full access — manage challenges, tasks, contributions, users, evaluation grids, trigger evaluations, app-wide settings (theme, integrations, module toggles) |
| `contributor` | The default. Joins challenges, works a personal board, submits ML artifacts, requests GPU compute, participates in onboarding |
| `viewer` | Read-only participant: can reach the same pages as a contributor, but the proxy's write rule leaves them with no mutating route of their own |
| `medical_pro` | Qualified reviewer on validation challenges — the only role that can author reference cases, claim and test them, and cast verdicts. Not a superset of `contributor`; it is a qualification, not a permission level. See [`validation-challenges.md`](./validation-challenges.md#the-medical_pro-role) |

New users registered via Google OAuth get `contributor`. Any other role has to be set explicitly by an admin.

### Project managers (not a role)

A contributor can additionally be set as the **manager** of one or more projects (`projects.manager_id`, assigned by an admin in `/admin/projects`). This is a per-project relationship, not a value of `users.role` — a manager's `role` stays `contributor`.

Being the manager of a project's parent grants extra access to that project's challenges, without admin access anywhere else:

- Edit challenge details and status, and create challenges on their project
- Edit the task template of a code challenge
- Add/remove challenge documents, including the brief
- Create or update repos linked to their project
- Create sync meetings
- Configure discussion signals and the watched Slack channel
- Approve, reject or retry GPU compute requests
- Expose validation targets and read every reference case, run and reward on a validation challenge

Managers cannot open `/admin/**`, create or delete challenges, or manage users. They access their challenges through a dedicated `/challenges/[id]/manage` view (separate from the public `/challenges/[id]` page contributors see). See [`challenges-and-tasks.md`](./challenges-and-tasks.md) for how this fits into the challenge workflow.

---

## Required environment variables

```env
# JWT (always required)
JWT_SECRET=your-32+-character-secret-key
JWT_ACCESS_EXPIRY=15m        # optional, default: 15m
JWT_REFRESH_EXPIRY=7d        # optional, default: 7d

# Google OAuth (required for login)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback
```

`JWT_SECRET` must be **at least 32 characters**. The app will refuse to start with a shorter secret (enforced by `packages/config`).

---

## Key files

| File | Purpose |
|------|---------|
| `apps/leaderboard-client/src/lib/auth.ts` | JWT sign/verify helpers, cookie helpers |
| `apps/leaderboard-client/src/proxy.ts` | Route protection (Next.js middleware, Edge runtime) |
| `apps/leaderboard-client/src/lib/server/managerAuth.ts` | `isManagerOfChallenge()` — resolves project-manager status for a route handler |
| `apps/leaderboard-client/src/app/api/google-auth/authorize/route.ts` | Redirects to Google consent screen |
| `apps/leaderboard-client/src/app/api/google-auth/callback/route.ts` | Handles OAuth callback, creates/links user, issues JWT |
| `apps/leaderboard-client/src/app/api/auth/refresh/route.ts` | Token refresh handler |
| `apps/leaderboard-client/src/app/api/auth/logout/route.ts` | Logout handler |
| `packages/services/google-workspace/google-auth.service.ts` | Google OAuth client (getAuthUrl, getTokensFromCode, getUserInfo) |
| `apps/leaderboard-client/src/app/api/auth/check-session/route.ts` | Account-still-exists check called by the proxy |
| `apps/leaderboard-client/src/lib/server/publicPages.ts` | Which pages/routes bypass the proxy entirely |
| `packages/database-service/repositories/refresh-token.repo.ts` | Refresh token DB operations |
