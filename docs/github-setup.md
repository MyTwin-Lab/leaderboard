# GitHub Setup Guide

Complete step-by-step guide to configure GitHub for the Leaderboard application. There are two ways to give the app a GitHub token, and you only need one:

- **Static token (`.env`)** — a Fine-Grained Personal Access Token set as `GITHUB_TOKEN`. Simple, works everywhere, but shared by the whole instance and must be rotated manually.
- **In-app OAuth connection (recommended)** — an admin connects a GitHub organization account from the UI (`/contributors/me` → Appearance tab). The resulting token is encrypted and stored in the database, and can be swapped or disconnected without touching server config. See [`admin-settings.md`](./admin-settings.md) for how it behaves; this guide covers registering the GitHub OAuth App it needs.

If both are configured, the app prefers the in-app connection and only falls back to `GITHUB_TOKEN` when nothing is connected.

> **Note:** an earlier version of this app also processed GitHub webhooks to auto-evaluate merged PRs. That webhook route has since been removed — there is no `/api/webhooks/github` endpoint anymore, and `GITHUB_WEBHOOK_SECRET` is no longer used. If you configured a webhook for this app previously, you can safely delete it.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Option A — Fine-Grained Personal Access Token](#2-option-a--fine-grained-personal-access-token)
3. [Option B — In-App OAuth Connection](#3-option-b--in-app-oauth-connection)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Verify the Setup](#5-verify-the-setup)
6. [Production Deployment Checklist](#6-production-deployment-checklist)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| A GitHub account with admin access to the target repositories/organization | Required to create tokens with sufficient permissions, and (for the OAuth option) to authorize the org |
| The target repository (or organization) already exists on GitHub | The connector reads commits and manages branches on existing repos |

---

## 2. Option A — Fine-Grained Personal Access Token

Use this if you want a single static token for the whole instance, configured once via `.env`.

### Step A: Navigate to token creation

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**

### Step B: Configure the token

1. **Token name**: e.g. `leaderboard-connector`
2. **Expiration**: choose a duration (90 days recommended; set a reminder to rotate)
3. **Description**: e.g. `Token for Leaderboard app — commits, branches`

### Step C: Set repository access

| Option | When to use |
| ------ | ----------- |
| **All repositories** | If the app needs access to all current and future repos in your account/organization |
| **Only select repositories** | If you want to restrict access to specific repos (max 50). Recommended for security |

### Step D: Set repository permissions

Click **+ Add permissions** under the **Repositories** tab and enable:

| Permission | Access level | Why |
| ---------- | ------------ | --- |
| **Contents** | **Read and write** | Read commits, file contents, tree structures, and create git references (branches) |
| **Metadata** | **Read-only** (required, auto-selected) | Access repository metadata (name, default branch, etc.) |
| **Administration** | **Read and write** | Update branch protection rules (restrict push access per user). Required for task assignment |

> **Warning:** If Contents or Administration is **Read-only**, branch creation will fail with `Resource not accessible by personal access token` when assigning a task. Both must be **Read and write**.

### Step E: Generate and copy the token

1. Click **Generate token**
2. **Copy the token immediately** — it will not be shown again. This is your `GITHUB_TOKEN`.

---

## 3. Option B — In-App OAuth Connection

Use this if you want admins to connect/disconnect GitHub accounts from the UI, without editing server config. This is a one-time setup per instance; each admin's "Connect GitHub Account" click afterwards is self-service.

### Step A: Register a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Fill in:

| Field | Value |
|-------|-------|
| Homepage URL | `http://localhost:3000` (or your production URL) |
| Authorization callback URL | `http://localhost:3000/api/github-oauth/callback` (or your production URL + the same path) |

3. Click **Register application**
4. Copy the **Client ID**, then click **Generate a new client secret** and copy it too

### Step B: Generate an encryption key

The token is encrypted before being stored in the database — generate a key for that:

```bash
openssl rand -hex 32
```

### Step C: Add to `.env`

```env
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=<output of openssl rand -hex 32>
```

Copy to `apps/leaderboard-client/.env.local` as well.

### Step D: Connect via the UI

Log in as an admin → `/contributors/me` → **Appearance** tab → **Connect GitHub Account**. GitHub will ask you to authorize the app. The account must be an **owner or admin of a GitHub organization** — personal accounts without an org are rejected with a clear error.

---

## 4. Configure Environment Variables

### Static token option

```env
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### OAuth connection option

```env
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
GITHUB_TOKEN_ENCRYPTION_KEY=<64 hex chars>
```

Both sets of variables are optional at startup — the app runs fine with neither (GitHub-backed features simply won't have a token), and you can set up one, the other, or both.

---

## 5. Verify the Setup

### Test the Connector (either option)

1. Start the application (`npm run dev`)
2. Log in as an admin
3. Create a new challenge and link a GitHub repository (format: `owner/repo`)
4. Run a sync, or open the challenge's activity view — the application should fetch commits from the repository

### Test the OAuth Connection specifically

1. Log in as an admin, go to `/contributors/me` → Appearance
2. Click **Connect GitHub Account**, authorize on GitHub
3. You should be redirected back with the connection showing as active (org name, masked token, connected-by)
4. Click **Disconnect** — connectors should fall back to `GITHUB_TOKEN` (or fail gracefully if that isn't set either)

### Test the Branch Provisioner (optional)

1. Assign a task on a challenge with a linked GitHub repo
2. The application should automatically create a new branch on the GitHub repository
3. Verify the branch exists on GitHub

---

## 6. Production Deployment Checklist

- [ ] Set `GITHUB_TOKEN` (if using the static option) in your hosting provider's environment variables
- [ ] Or: set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_OAUTH_REDIRECT_URI` / `GITHUB_TOKEN_ENCRYPTION_KEY` (if using the OAuth option), with the redirect URI pointing at your production domain, and register that same URL as the OAuth App's callback URL on GitHub
- [ ] Ensure the PAT (if used) has not expired — set a calendar reminder for rotation
- [ ] If using "Only select repositories" for the PAT, ensure all repos linked to challenges are included
- [ ] Verify the `Administration` permission is granted if you use the branch provisioner

---

## 7. Troubleshooting

### Connector Issues

| Error | Cause | Fix |
| ----- | ----- | --- |
| `Failed to connect to GitHub repo owner/repo` | Invalid token or repo not accessible | Verify the active token (OAuth connection or `GITHUB_TOKEN`) is valid and has access to the repository |
| `Bad credentials` (401) | Token is invalid or revoked | Generate a new PAT, or reconnect via the OAuth flow |
| `Not Found` (404) | Repository doesn't exist or token lacks access | Check the repo exists and is included in the token's access scope |
| `Resource not accessible by personal access token` (403) | Missing permission on the PAT | Edit the token on GitHub and add the required permission (see [Step 2D](#2-option-a--fine-grained-personal-access-token)) |
| Branch creation fails | Missing `Administration` permission | Edit the PAT and grant **Administration: Read and write** |

### OAuth Connection Issues

| Error (`?github_error=`) | Cause | Fix |
| ------------------------- | ----- | --- |
| `no_org_admin` | The connected account has no organization where it's an admin/owner | Use an account that owns or administers a GitHub organization |
| `csrf` | The connection attempt expired or the state didn't match | Retry the "Connect GitHub Account" flow from scratch |
| `exchange_failed` | GitHub rejected the code exchange | Check `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are correct and not expired |
| Decryption fails after reconnecting on a new environment | `GITHUB_TOKEN_ENCRYPTION_KEY` changed or is missing | The key must stay the same across restarts/deploys — a changed key can't decrypt previously stored tokens; disconnect and reconnect in that case |

### Token Rotation

1. Create a new token (Option A, [Step 2](#2-option-a--fine-grained-personal-access-token)) or simply reconnect via the UI (Option B)
2. If using the static option, update `GITHUB_TOKEN` and restart the application

---

## Architecture Reference

```
Connector Flow:
  Admin creates challenge  → Links GitHub repo (owner/repo)
  Sync / activity view     → active token (DB connection, else GITHUB_TOKEN) authenticates via Octokit
  Commits fetched          → repos.listCommits() with date/author filters
  Activity fetched         → commits + PRs + PR reviews + branches, merged into a timeline

Branch Provisioner Flow:
  Task assigned            → git.getRef() on base branch
                            → git.createRef() creates new branch
                            → repos.updateBranchProtection() restricts push access

OAuth Connection Flow:
  Admin clicks Connect      → GET /api/github-oauth/authorize → GitHub consent screen
  GitHub authorizes         → GET /api/github-oauth/callback
                            → validates org admin/owner membership
                            → encrypts token, stores in app_settings
  Admin clicks Disconnect   → DELETE /api/github-oauth/connection → falls back to .env
```

**Key files:**

- `packages/connectors/implementation/Github.connector.ts` — commit/activity fetching & file content
- `packages/provisioner/src/providers/github-branch.provider.ts` — branch creation & protection
- `packages/connectors/registry.ts` — connector factory (maps repo type `github` to the connector)
- `packages/config/githubToken.ts` — token resolution (DB connection, falls back to `.env`)
- `apps/leaderboard-client/src/app/api/github-oauth/` — OAuth authorize/callback/status/connection routes
- `packages/config/index.ts` — environment variable validation
