# GitHub OAuth Connection — Design Spec

**Date:** 2026-07-10
**Branch:** challenge-010-ML_integration
**Status:** Approved

---

## Overview

Allow an admin to connect their GitHub account (org owner/admin) to the platform via GitHub OAuth App. The resulting OAuth token replaces the static `GITHUB_TOKEN` in `.env`, is stored encrypted in DB (`app_settings`), and is used by all connectors. Other teams/companies can connect their own org. Non-org or non-admin accounts are rejected with a clear UI error.

Individual contributor GitHub usernames are already handled by the existing `github_username` field in `ProfileEditForm` — no change needed there.

---

## Architecture

### OAuth Flow

```
Admin → "Connect GitHub" button (admin-only, in Appearance tab)
  → GET /api/github-oauth/authorize
      Sets CSRF state cookie (httpOnly, 10min TTL)
      Redirects to: https://github.com/login/oauth/authorize
        ?client_id=GITHUB_CLIENT_ID
        &redirect_uri=GITHUB_OAUTH_REDIRECT_URI
        &scope=repo%20read:org
        &state=<csrf_token>

GitHub authorizes
  → GET /api/github-oauth/callback?code=...&state=...
      1. Validates state against cookie (anti-CSRF) — mismatch → 400
      2. POST https://github.com/login/oauth/access_token → access_token
      3. GET https://api.github.com/user/memberships/orgs?role=admin
         Filter: state === "active" AND role === "admin" OR "owner"
         None found → redirect /contributors/me?github_error=no_org_admin
      4. Pick first org (alphabetically) if multiple
      5. Encrypt token (AES-256-GCM)
      6. Upsert app_settings: github_token_enc, github_token_iv, github_org,
         github_connected_at, github_connected_by
      7. Redirect → /contributors/me (tab=Appearance auto-opens via query param)

DELETE /api/github-oauth/connection  (admin only)
      Sets github_token_enc = NULL, github_token_iv = NULL, github_org = NULL
      → token resolution falls back to .env
```

### Token Resolution

`packages/config/githubToken.ts` exports `getGithubToken(): Promise<string | null>`:
1. Read `app_settings` from DB
2. If `github_token_enc` + `github_token_iv` present → decrypt with `GITHUB_TOKEN_ENCRYPTION_KEY`
3. Fallback: `config.github.token` from `.env`

`ConnectorRegistry.createConnector()` calls `getGithubToken()` instead of reading `config.github.token` directly.

---

## DB Changes — `app_settings` table

New columns (migration via `drizzle-kit push`):

```ts
github_token_enc:    text("github_token_enc")                    // AES-256-GCM ciphertext, base64
github_token_iv:     varchar("github_token_iv", { length: 64 })  // IV hex (12 bytes = 24 hex chars)
github_org:          varchar("github_org", { length: 255 })      // validated org slug
github_connected_at: timestamp("github_connected_at")
github_connected_by: uuid("github_connected_by").references(() => users.uuid)
```

`AppSettings` entity gains:
```ts
github_org?: string | null
github_connected_at?: Date | null
github_connected_by?: string | null
github_is_connected: boolean  // derived: !!github_token_enc
```

`AppSettingsRepository.updateGithubConnection(data)` and `AppSettingsRepository.clearGithubConnection()` added.

---

## Encryption

Node.js native `crypto` (no new dependency):

```ts
// packages/config/githubToken.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY = Buffer.from(process.env.GITHUB_TOKEN_ENCRYPTION_KEY!, 'hex'); // 32 bytes

export function encryptToken(token: string): { enc: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: Buffer.concat([encrypted, tag]).toString('base64'),
    iv: iv.toString('hex'),
  };
}

export function decryptToken(enc: string, ivHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(enc, 'base64');
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export async function getGithubToken(): Promise<string | null> {
  try {
    const { AppSettingsRepository } = await import('../database-service/repositories/index.js');
    const repo = new AppSettingsRepository();
    const settings = await repo.get();
    if (settings.github_token_enc && settings.github_token_iv) {
      return decryptToken(settings.github_token_enc, settings.github_token_iv);
    }
  } catch {
    // DB unavailable — fall through to .env
  }
  return config.github.token ?? null;
}
```

The token is **never** returned raw in API responses. UI shows masked form: `ghp_****...****` (first 4 + last 4 chars visible).

---

## New Environment Variables

```bash
# GitHub OAuth App (register once at github.com/settings/developers)
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback

# AES-256 key for token encryption (generate: openssl rand -hex 32)
GITHUB_TOKEN_ENCRYPTION_KEY=<64 hex chars>
```

Added to `packages/config/index.ts` as optional (system works without them, falls back to `GITHUB_TOKEN`).

---

## API Routes

### `GET /api/github-oauth/authorize`
- Auth: admin only (verifyAdmin middleware)
- Generates `crypto.randomBytes(16).toString('hex')` as CSRF token
- Stores in httpOnly cookie `gh_oauth_state` (10min, SameSite=lax)
- Redirects to GitHub OAuth URL

### `GET /api/github-oauth/callback`
- Validates `state` query param against `gh_oauth_state` cookie — mismatch → redirect with `?github_error=csrf`
- Exchanges `code` for token via `POST https://github.com/login/oauth/access_token`
- Calls `GET https://api.github.com/user/memberships/orgs?state=active`
- Filters for roles `admin` or `owner`
- No valid org → redirect `/contributors/me?github_error=no_org_admin`
- Valid org → encrypt token, upsert `app_settings`, redirect `/contributors/me`
- Clears `gh_oauth_state` cookie on completion

### `DELETE /api/github-oauth/connection`
- Auth: admin only
- Calls `AppSettingsRepository.clearGithubConnection()`
- Returns `{ ok: true }`

### `GET /api/github-oauth/status`
- Auth: admin only
- Returns `{ connected: boolean, org: string | null, connected_at: string | null }`
- Never returns the token

---

## UI — Admin "Appearance" tab (or new "Integrations" section within it)

Added as a card below the theme settings in the existing **Appearance** tab (admin-only).

### Connected state:
```
┌─────────────────────────────────────────────────────┐
│ GitHub Integration                    ✓ Connected   │
│                                                     │
│ Organization   MyTwin-Lab                           │
│ Token          ghp_****...****                      │
│ Connected      Jul 10, 2026 by Alix                 │
│                                                     │
│                              [Disconnect]           │
└─────────────────────────────────────────────────────┘
```

### Disconnected state:
```
┌─────────────────────────────────────────────────────┐
│ GitHub Integration                                  │
│                                                     │
│ Connect a GitHub org admin account to enable        │
│ repository operations (branches, commits, PRs).     │
│                                                     │
│                         [Connect GitHub Account]    │
└─────────────────────────────────────────────────────┘
```

### Error states (via `?github_error=` query param):
- `no_org_admin` → "The connected GitHub account has no organization where you are an admin or owner. An organization account is required."
- `csrf` → "Connection attempt expired or was tampered with. Please try again."
- `exchange_failed` → "Failed to obtain GitHub token. Please try again."

Client component `GitHubConnectionCard` — fetches `/api/github-oauth/status` on mount, handles disconnect via DELETE.

---

## Config Update

`ConnectorRegistry.createConnector()` becomes async, calling `getGithubToken()`:

```ts
static async createConnector(repo: Repo, options?: { branch?: string }): Promise<ExternalConnector | null> {
  switch (repo.type) {
    case 'github':
      const token = await getGithubToken();
      if (!token) { console.error('No GitHub token available'); return null; }
      // ... rest unchanged
  }
}
```

All callers of `createConnector` that are already async (Next.js route handlers) need `await`.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| CSRF mismatch | Redirect `/contributors/me?github_error=csrf` |
| Code exchange fails | Redirect `/contributors/me?github_error=exchange_failed` |
| No org or not admin | Redirect `/contributors/me?github_error=no_org_admin` |
| Decryption fails (bad key) | `getGithubToken()` returns null → connector logs error, returns null |
| DB unavailable | Falls back to `.env` token |
| Token revoked on GitHub | 401 from API → connector's `.catch()` returns empty, no crash |

---

## Security Notes

- Token stored AES-256-GCM encrypted — compromise of DB alone is insufficient
- `GITHUB_TOKEN_ENCRYPTION_KEY` must be kept out of version control (`.env` only)
- CSRF state is single-use (cleared after callback)
- Token never logged, never returned in API responses
- Disconnect is immediate — next connector call uses `.env` fallback or fails gracefully
- `read:org` scope is needed to verify org membership; `repo` scope for private repo access
