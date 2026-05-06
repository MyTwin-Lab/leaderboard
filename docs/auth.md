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

The middleware at `apps/leaderboard-client/src/middleware.ts` checks the `access_token` cookie on every request.

| Path | Who can access |
|------|----------------|
| `/admin/**` | `admin` role only |
| `/contributors/me` | `admin` or `contributor` |
| `/api/google-auth/**` | Public (OAuth flow) |
| `/api/auth/refresh` | Cookie (any authenticated user) |
| `/api/auth/logout` | Cookie (any authenticated user) |
| `GET /api/**` (most) | Public or authenticated depending on route |
| `POST/PUT/DELETE /api/**` | Generally requires `admin` role |

---

## Roles

Roles are stored in `users.role` and set when the user is created.

| Role | Description |
|------|-------------|
| `admin` | Full access — manage challenges, tasks, contributions, users, evaluation grids, trigger evaluations |
| `contributor` | View leaderboard and profile, participate in onboarding, work on tasks |

New users registered via Google OAuth get the `contributor` role by default. Admins must be promoted manually in the database.

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
| `apps/leaderboard-client/src/middleware.ts` | Route protection middleware |
| `apps/leaderboard-client/src/app/api/google-auth/authorize/route.ts` | Redirects to Google consent screen |
| `apps/leaderboard-client/src/app/api/google-auth/callback/route.ts` | Handles OAuth callback, creates/links user, issues JWT |
| `apps/leaderboard-client/src/app/api/auth/refresh/route.ts` | Token refresh handler |
| `apps/leaderboard-client/src/app/api/auth/logout/route.ts` | Logout handler |
| `packages/services/google-workspace/google-auth.service.ts` | Google OAuth client (getAuthUrl, getTokensFromCode, getUserInfo) |
| `packages/database-service/repositories/refresh-token.repo.ts` | Refresh token DB operations |
