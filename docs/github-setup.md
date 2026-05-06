# GitHub Setup Guide

Complete step-by-step guide to configure GitHub for the Leaderboard application. This covers two distinct features:

- **GitHub Connector (Commits & Code)** — fetches commits, file contents, and manages branches on GitHub repositories
- **GitHub Webhooks (PR Evaluation)** — automatically evaluates contributions when a Pull Request is merged

Both features use a GitHub Personal Access Token (PAT) but serve different purposes.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a Fine-Grained Personal Access Token](#2-create-a-fine-grained-personal-access-token)
3. [Configure the Webhook (PR Evaluation)](#3-configure-the-webhook-pr-evaluation)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Verify the Setup](#5-verify-the-setup)
6. [Production Deployment Checklist](#6-production-deployment-checklist)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Requirement                                                      | Why                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A GitHub account with admin access to the target repositories    | Required to create tokens with sufficient permissions and configure webhooks |
| The target repository (or organization) already exists on GitHub | The connector reads commits and manages branches on existing repos           |
| Your application is accessible via a public URL (for webhooks)   | GitHub must be able to send HTTP POST requests to your server                |

> **Note:** For local development, you can use a tunneling service like [ngrok](https://ngrok.com) or [localtunnel](https://localtunnel.me) to expose your local server to GitHub webhooks.

---

## 2. Create a Fine-Grained Personal Access Token

The application uses a **Fine-Grained Personal Access Token (PAT)** to interact with the GitHub API. This token type allows you to grant only the permissions needed, scoped to specific repositories.

### Step A: Navigate to token creation

1. Go to [GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**

### Step B: Configure the token

1. **Token name**: e.g. `leaderboard-connector`
2. **Expiration**: choose a duration (90 days recommended; set a reminder to rotate)
3. **Description**: e.g. `Token for Leaderboard app — commits, branches, webhooks`

### Step C: Set repository access

Select one of the following:

| Option                       | When to use                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **All repositories**         | If the app needs access to all current and future repos in your account/organization |
| **Only select repositories** | If you want to restrict access to specific repos (max 50). Recommended for security  |

> **Tip:** If you manage challenges across multiple repos, "All repositories" is more convenient. Otherwise, select only the repos that will be linked to challenges.

### Step D: Set repository permissions

Click **+ Add permissions** under the **Repositories** tab and enable the following:

| Permission         | Access level                            | Why                                                                                          |
| ------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Contents**       | **Read and write**                      | Read commits, file contents, tree structures, and create git references (branches).          |
| **Metadata**       | **Read-only** (required, auto-selected) | Access repository metadata (name, default branch, etc.)                                      |
| **Administration** | **Read and write**                      | Update branch protection rules (restrict push access per user). Required for task assignment |

> **Warning:** If you set Contents or Administration to **Read-only**, branch creation will fail with `Resource not accessible by personal access token` when assigning a task. Both must be set to **Read and write**.

> **Note:** No organization permissions are required unless you need to manage organization-level settings.

### Step E: Generate and copy the token

1. Click **Generate token**
2. **Copy the token immediately** — it will not be shown again
3. This value will be used as `GITHUB_TOKEN` in your environment variables

> **Important:** If you lose the token, you will need to generate a new one. Store it securely (e.g. in a password manager).

---

## 3. Configure the Webhook (PR Evaluation)

Webhooks allow GitHub to notify your application when a Pull Request is merged, triggering automatic contribution identification and evaluation.

### Step A: Generate a webhook secret

Generate a random string (at least 20 characters) to be used as the shared secret between GitHub and your application:

```bash
openssl rand -hex 20
```

Save this value — it will be used as `GITHUB_WEBHOOK_SECRET`.

### Step B: Add the webhook on GitHub

1. Go to your repository on GitHub (or the organization settings if you want a single webhook for all repos)
2. Navigate to **Settings > Webhooks**
3. Click **Add webhook**

### Step C: Configure the webhook

Fill in the following fields:

| Field            | Value                                                    |
| ---------------- | -------------------------------------------------------- |
| **Payload URL**  | `https://your-app-domain.com/api/webhooks/github`        |
| **Content type** | `application/json`                                       |
| **Secret**       | The secret generated in Step A (`GITHUB_WEBHOOK_SECRET`) |

### Step D: Select events

Choose **Let me select individual events** and check:

- [x] **Pull requests** — triggers when a PR is opened, closed, merged, etc.

Uncheck everything else (especially "Pushes" which is selected by default).

> **Note:** The application only processes `pull_request` events with `action: closed` and `merged: true`. All other events are ignored.

### Step E: Activate the webhook

1. Ensure **Active** is checked
2. Click **Add webhook**
3. GitHub will send a `ping` event to verify the URL is reachable

> **Tip:** If you have multiple repositories linked to challenges, you need to add the webhook to **each repository** (or use an organization-level webhook).

---

## 4. Configure Environment Variables

Add the following variables to your `.env` file (local development) or to your hosting provider's environment settings (production).

### GitHub Connector (required for commit fetching and branch management)

```env
# From Step 2 — Fine-Grained Personal Access Token
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### GitHub Webhooks (required for automatic PR evaluation)

```env
# From Step 3A — shared secret for webhook signature validation
GITHUB_WEBHOOK_SECRET=your-random-secret-at-least-20-characters
```

### Summary of all GitHub-related variables

| Variable                | Feature                       | Required                       |
| ----------------------- | ----------------------------- | ------------------------------ |
| `GITHUB_TOKEN`          | Connector (commits, branches) | Yes (for GitHub repos)         |
| `GITHUB_WEBHOOK_SECRET` | Webhook (PR evaluation)       | Yes (for automatic evaluation) |

---

## 5. Verify the Setup

### Test the GitHub Connector

1. Start the application (`npm run dev`)
2. Log in as an admin
3. Create a new challenge and link a GitHub repository (format: `owner/repo`)
4. Run a sync — the application should fetch commits from the repository
5. Verify that commits appear with author, message, and date

### Test the Webhook

1. Ensure the webhook is configured on the GitHub repository (Step 3)
2. Create a branch, make a commit, and open a Pull Request
3. Merge the Pull Request
4. Check your application logs — you should see:
   ```
   🔔 [WebhookService] Pull Request event received
      - Action: closed
      - Merged: true
   ```
5. The contributions should be automatically identified and evaluated

### Test the Branch Provisioner (optional)

1. Create a challenge with the branch provisioner enabled
2. The application should automatically create a new branch on the GitHub repository
3. Verify the branch exists on GitHub

---

## 6. Production Deployment Checklist

When deploying to production (e.g. Scalingo, Heroku, Vercel):

- [ ] Set `GITHUB_TOKEN` in your hosting provider's environment variables
- [ ] Set `GITHUB_WEBHOOK_SECRET` in your hosting provider's environment variables
- [ ] Update the webhook **Payload URL** to your production URL (e.g. `https://your-app.osc-fr1.scalingo.io/api/webhooks/github`)
- [ ] Verify the webhook is **Active** and shows a green checkmark (recent delivery with `200` response)
- [ ] Ensure the PAT has not expired — set a calendar reminder for rotation
- [ ] If using "Only select repositories" for the PAT, ensure all repos linked to challenges are included
- [ ] Verify that the `Administration` permission is granted if you use the branch provisioner

---

## 7. Troubleshooting

### Connector Issues

| Error                                                    | Cause                                          | Fix                                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Failed to connect to GitHub repo owner/repo`            | Invalid token or repo not accessible           | Verify `GITHUB_TOKEN` is valid and has access to the repository. Check the token hasn't expired.              |
| `Bad credentials` (401)                                  | Token is invalid or revoked                    | Generate a new Fine-Grained PAT following [Step 2](#2-create-a-fine-grained-personal-access-token).           |
| `Not Found` (404)                                        | Repository doesn't exist or token lacks access | Check the repo exists and is included in the token's repository access scope.                                 |
| `Resource not accessible by personal access token` (403) | Missing permission on the PAT                  | Edit the token on GitHub and add the required permission (see [Step 2D](#step-d-set-repository-permissions)). |
| Branch creation fails                                    | Missing `Administration` permission            | Edit the PAT and grant **Administration: Read and write**.                                                    |

### Webhook Issues

| Error                                                    | Cause                                      | Fix                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Webhook shows `red X` on GitHub                          | Payload URL is unreachable                 | Verify your application is running and accessible at the configured URL. Check for HTTPS issues.                           |
| `Invalid signature`                                      | Secret mismatch between GitHub and the app | Ensure `GITHUB_WEBHOOK_SECRET` matches exactly the secret configured in the GitHub webhook settings.                       |
| PR merged but no evaluation triggered                    | Webhook not configured on this repo        | Add the webhook to the repository following [Step 3](#3-configure-the-webhook-pr-evaluation).                              |
| PR merged but `No active challenges for this repository` | Repo not linked to an active challenge     | In the admin panel, link the repository to an active challenge. The `external_repo_id` must match the `owner/repo` format. |
| Webhook delivers but app returns 404                     | Wrong Payload URL path                     | Ensure the URL ends with `/api/webhooks/github`.                                                                           |
| Duplicate evaluations on same PR                         | Idempotence check not yet implemented      | This is a known limitation (Phase 1 pending). Avoid re-delivering webhooks manually.                                       |

### Token Rotation

Fine-Grained PATs have an expiration date. When rotating:

1. Create a new token following [Step 2](#2-create-a-fine-grained-personal-access-token)
2. Update `GITHUB_TOKEN` in your environment variables
3. Restart the application
4. The old token will be automatically revoked once it expires (or you can revoke it manually)

---

## Architecture Reference

For a deeper understanding of how the application uses GitHub:

```
Connector Flow:
  Admin creates challenge → Links GitHub repo (owner/repo)
  Sync triggered          → GITHUB_TOKEN authenticates via Octokit
  Commits fetched         → repos.listCommits() with date/author filters
  File content fetched    → repos.getCommit() + git.getBlob() for modified files

Branch Provisioner Flow:
  Challenge provisioned   → git.getRef() on base branch
                          → git.createRef() creates new branch
                          → repos.updateBranchProtection() restricts push access

Webhook Flow:
  PR merged on GitHub     → POST /api/webhooks/github (signed with HMAC SHA-256)
  Signature validated     → x-hub-signature-256 header verified with GITHUB_WEBHOOK_SECRET
  Repo & challenges found → DB lookup by external_repo_id (owner/repo)
  Commits fetched         → All commits from the PR branch
  Contributions evaluated → OpenAI identifies and scores contributions
  Results saved           → Evaluations stored in database
```

**Services involved:**

- `packages/connectors/implementation/Github.connector.ts` — commit fetching & file content
- `packages/provisioner/src/providers/github-branch.provider.ts` — branch creation & protection
- `packages/services/webhook.service.ts` — PR webhook handling & evaluation pipeline
- `packages/connectors/registry.ts` — connector factory (maps repo type `github` to the connector)
- `packages/config/index.ts` — environment variable validation
