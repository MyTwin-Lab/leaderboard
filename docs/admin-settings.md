# Admin Settings

A handful of instance-wide settings — appearance, external integrations, and feature toggles — are controlled by admins from the **Appearance**, **Integrations** and **Modules** tabs on their own profile page (`/contributors/me`). All of them are stored in a single singleton database row (`app_settings`, `id = 1`) and take effect immediately for every user.

---

## Appearance: theme

Admins can pick a predefined color theme for the whole app (e.g. Blue, Purple, Green, Orange, Red, Teal). The choice is stored in `app_settings.theme_key` and read on every page load — the root layout injects the theme's colors as CSS variables server-side, so the change applies to every visitor on their next request, with no client-side flicker or per-user preference.

- `PATCH /api/admin/theme` — admin-only, sets `theme_key` (and optionally custom `primary_color` / `background_color` hex overrides, and `theme_mode`: `dark` or `light`).
- There is no per-user override — one theme for the whole instance.

---

## Integrations: GitHub, Kaggle, Slack, OpenAI & Scaleway

All integrations follow the same pattern: instead of relying solely on a static token in `.env`, an admin connects an account from the UI. The credential is encrypted (AES-256-GCM) and stored in `app_settings`; the encryption key itself never enters the database. Connectors automatically prefer the database credential and fall back to the `.env` value if nothing is connected.

### GitHub

Connecting a GitHub org account replaces the static `GITHUB_TOKEN` for all connector operations (commits, file contents, branch provisioning).

1. Admin clicks **Connect GitHub Account** in the Appearance tab.
2. `GET /api/github-oauth/authorize` redirects to GitHub's OAuth consent screen.
3. `GET /api/github-oauth/callback` exchanges the code for a token, then checks that the authorizing account is an **owner or admin of a GitHub organization** — personal accounts without an org membership are rejected with a clear error.
4. The token is encrypted and stored (`app_settings.github_token_enc` / `github_token_iv` / `github_org` / `github_connected_at` / `github_connected_by`).
5. `DELETE /api/github-oauth/connection` disconnects — connectors immediately revert to the `.env` `GITHUB_TOKEN`.
6. `GET /api/github-oauth/status` reports connection state (never the token itself).

Setting up the OAuth App itself (client ID/secret, callback URL) is covered in [`github-setup.md`](./github-setup.md).

### Kaggle

Kaggle datasets and models are used by `type: 'ml'` challenges (see [`ml-rewards.md`](./ml-rewards.md)). Connecting a Kaggle account lets the app read dataset metadata and model version metrics on the admin's behalf.

- `POST /api/kaggle/connection` (admin-only) — takes a Kaggle username + API key, verifies them live against Kaggle's API, then encrypts and stores them (`app_settings.kaggle_username` / `kaggle_key_enc` / `kaggle_key_iv` / `kaggle_connected_at` / `kaggle_connected_by`).
- `DELETE /api/kaggle/connection` — disconnects, falling back to the `KAGGLE_USERNAME` / `KAGGLE_KEY` env vars if set.
- `GET /api/kaggle/status` — public, returns whether a Kaggle connection is active.

### Slack

Slack powers **discussion contribution signals**: challenges can watch a channel and reward predefined signals detected by AI in the daily conversation (see [`slack-signals.md`](./slack-signals.md)).

Setting up the bot:

1. Create a Slack app on <https://api.slack.com/apps> for your workspace.
2. Under **OAuth & Permissions**, add the bot scopes `channels:read`, `channels:history`, `users:read` and `users:read.email`, then install the app to the workspace.
3. Copy the **Bot User OAuth Token** (`xoxb-…`) and paste it in the Slack card of the Integrations tab.
4. Invite the bot to every channel you want to track (`/invite @your-bot`).

Routes:

- `POST /api/slack/connection` (admin-only) — takes the bot token, verifies it live against Slack's `auth.test` (which also captures the workspace name), then encrypts and stores it (`app_settings.slack_token_enc` / `slack_token_iv` / `slack_team_name` / `slack_connected_at` / `slack_connected_by`).
- `DELETE /api/slack/connection` — disconnects, falling back to the `SLACK_BOT_TOKEN` env var if set.
- `GET /api/slack/status` — public, returns whether a Slack connection is active (and the workspace name).
- `GET /api/slack/channels` (admin/manager) — lists public, non-archived channels for the channel picker in the challenge edit drawer.

### OpenAI

The OpenAI key powers every AI feature: contribution evaluation, meeting analysis and Slack signal detection. Connecting it from the UI replaces the `OPENAI_API_KEY` env var — all agents resolve the key at call time (`getOpenAIApiKey()`), so a key pasted in the UI takes effect without a restart.

- `POST /api/openai/connection` (admin-only) — takes an API key, verifies it live against OpenAI's `/v1/models`, then encrypts and stores it (`app_settings.openai_key_enc` / `openai_key_iv` / `openai_connected_at` / `openai_connected_by`).
- `DELETE /api/openai/connection` — disconnects, falling back to the `OPENAI_API_KEY` env var if set.
- `GET /api/openai/status` — public, returns whether an OpenAI key is connected (never the key).

### Scaleway

Scaleway powers **GPU compute requests** on ML challenges: a contributor asks for a temporary GPU instance, a manager approves, and the platform provisions it (see [`compute-power.md`](./compute-power.md)).

Unlike the four integrations above, this one has **no `.env` fallback** — if no account is connected, the compute panel is hidden entirely rather than offering a button that cannot work.

- `POST /api/scaleway/connection` (admin-only) — takes a `secret_key`, a `project_id` and a `zone`, verifies them live against the Scaleway API, then encrypts and stores them (`app_settings.scaleway_secret_key_enc` / `scaleway_secret_key_iv` / `scaleway_project_id` / `scaleway_zone` / `scaleway_connected_at` / `scaleway_connected_by`).
- `DELETE /api/scaleway/connection` — **soft**-disconnect. It sets `scaleway_disconnect_requested_at` rather than wiping the key: from that point on, no new request or approval is allowed and the panel disappears, but an instance already running keeps living until its natural 24h expiry, and the crons can still reach Scaleway to poll and terminate it. Nothing is left orphaned. Two accessors encode this: `isScalewayUserFacingConnected()` for every gate, `getScalewayCredentials()` (which ignores the flag) for the crons.
- `GET /api/scaleway/status` — public, returns whether an account is connected plus the project ID (never the key).

---

## Modules: feature toggles

Two optional UI features can be turned off instance-wide from the **Modules** tab, without touching any code or env var:

| Toggle | Effect when off |
|--------|------------------|
| Meetings | The meetings sidebar is hidden from challenge pages for contributors and managers. |
| Onboarding | The onboarding drawer is hidden for all non-admin users. |

Turning a module off only hides the UI — onboarding progress keeps being tracked in the background either way, and admin pages are never affected by these flags.

- `GET /api/modules` — public, returns `{ meetings_enabled, onboarding_enabled }`.
- `PATCH /api/modules` — admin-only, updates either flag.

A related admin-only view, the **Onboarding** tab, lists every contributor's onboarding progress (5 quests) regardless of whether the module is enabled for others — backed by `GET /api/onboarding/all`. See [`onboarding.md`](./onboarding.md).

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/repositories/appSettings.repo.ts` | Singleton read/update for `app_settings` |
| `packages/config/githubToken.ts` | AES-256-GCM encrypt/decrypt + `getGithubToken()` (DB, falls back to `.env`) |
| `packages/config/kaggleCredentials.ts` | Same pattern for Kaggle credentials |
| `packages/config/slackCredentials.ts` | Same pattern for the Slack bot token |
| `packages/config/openaiCredentials.ts` | Same pattern for the OpenAI API key |
| `packages/config/scalewayCredentials.ts` | Same pattern for Scaleway — DB only, no `.env` fallback |
| `apps/leaderboard-client/src/lib/themes.ts` | Predefined theme palette definitions |
| `apps/leaderboard-client/src/app/api/admin/theme/route.ts` | Theme update endpoint |
| `apps/leaderboard-client/src/app/api/github-oauth/` | GitHub OAuth connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/kaggle/` | Kaggle connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/slack/` | Slack connect/disconnect/status/channels routes |
| `apps/leaderboard-client/src/app/api/openai/` | OpenAI connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/scaleway/` | Scaleway connect/disconnect/status routes |
| `apps/leaderboard-client/src/app/api/modules/route.ts` | Module toggle read/update |
| `apps/leaderboard-client/src/app/api/onboarding/all/route.ts` | Admin view of all contributors' onboarding progress |
