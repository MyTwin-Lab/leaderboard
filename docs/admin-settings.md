# Admin Settings

Instance-wide settings — appearance, external integrations and product modules — are controlled by admins from the **Appearance**, **Integrations** and **Modules** tabs on their own profile page (`/contributors/me`). They take effect immediately for every user. The theme lives in the `app_settings` singleton row; connections live in `integration_credentials`, module states and settings in `module_settings`.

---

## Appearance: theme

Admins can pick a predefined color theme for the whole app (e.g. Blue, Purple, Green, Orange, Red, Teal). The choice is stored in `app_settings.theme_key` and read on every page load — the root layout injects the theme's colors as CSS variables server-side, so the change applies to every visitor on their next request, with no client-side flicker or per-user preference.

- `PATCH /api/admin/theme` — admin-only, sets `theme_key` (and optionally custom `primary_color` / `background_color` hex overrides, and `theme_mode`: `dark` or `light`).
- There is no per-user override — one theme for the whole instance.
- A fresh instance starts on the **MyTwin** preset in light mode: accent `#0d9488`, background `#f8fafc`.

---

## Integrations

Every integration is declared by its content package (connector or extension) and registered by the distribution; the Integrations tab renders one generic card per installed integration (`IntegrationCard`). A declaration gives its authentication mode (`oauth`, or `api_key` with its fields), a live check against the provider, what can be shown of a connection, and optional extras.

The credential is encrypted (AES-256-GCM, key `GITHUB_TOKEN_ENCRYPTION_KEY`) and stored in `integration_credentials` (`key`, `secret_enc`, `secret_iv`, `meta`, `connected_at`, `connected_by`); the encryption key never enters the database. Consumers resolve the credential at call time, so a connection takes effect without a restart.

| Integration | Declared in | Auth | Fallback when not connected |
|-------------|-------------|------|------------------------------|
| `github` | `content/connectors/github/integration.ts` | OAuth — the account must own or administer a GitHub organization | `GITHUB_TOKEN` |
| `kaggle` | `content/connectors/kaggle/integration.ts` | Username + API key | `KAGGLE_USERNAME` / `KAGGLE_KEY` |
| `slack` | `content/connectors/slack/integration.ts` | Bot token (`xoxb-…`) | `SLACK_BOT_TOKEN` |
| `openai` | `content/integrations/openai/integration.ts` | API key | `OPENAI_API_KEY` |
| `scaleway` | `content/extensions/compute/integration.ts` | Secret key, project ID, zone | none — the compute panel is hidden |

Routes (`apps/leaderboard-client/src/app/api/integrations/`):

- `GET /api/integrations` — admin-only, the installed integrations with their fields, state and connection details.
- `POST` / `DELETE /api/integrations/[key]/connection` — admin-only, connect with an API key (verified live before it is stored) or disconnect.
- `GET /api/integrations/[key]/authorize` and `/callback` — the OAuth flow. `/api/github-oauth/callback` remains as an alias of the GitHub callback (see [`deployment.md`](./deployment.md#integrations)).
- `GET /api/integrations/[key]/status` — `{ connected }` for any signed-in account; the date and details for an admin.
- `/api/integrations/[key]/extras/[action]` — actions an integration adds, each with its own access. Slack declares `channels` (admin or manager), the channel picker of the challenge edit drawer.

Scaleway disconnects **softly**: it sets `meta.disconnect_requested_at` instead of wiping the key. No new request or approval is allowed and the panel disappears, but a running instance lives until its 24h expiry and the compute jobs can still poll and terminate it (see [`compute-power.md`](./compute-power.md)).

Setting up the Slack bot: create an app on <https://api.slack.com/apps>, add the bot scopes `channels:read`, `channels:history`, `users:read` and `users:read.email`, install it, paste the **Bot User OAuth Token** in the Slack card, and invite the bot to every tracked channel. Setting up the GitHub OAuth App is covered in [`github-setup.md`](./github-setup.md).

---

## Modules

Product modules — **meetings**, **onboarding**, **digest** and **sandbox** — are listed on the **Modules** tab (`ModulesPanel`), one toggle each, with a settings editor for the modules that have settings (`apps/leaderboard-client/src/distribution/modules/settings.tsx`). A module without a row in `module_settings` takes the default it declares: sandbox is on, the others are off.

A disabled module disappears entirely, not only from the UI: its routes and pages answer 404, its jobs are skipped by the cron tick, its event subscriptions consume nothing, and its UI slots (challenge sections, admin menu entries, public navigation) are hidden.

- `GET /api/modules` — public, the installed modules and whether each is enabled (never their settings).
- `GET /api/modules/[key]` — admin-only, a module's state and validated settings.
- `PATCH /api/modules/[key]` — admin-only, `{ enabled?, settings? }`. Settings are merged into the stored ones and validated by the module's schema (400 on invalid settings, 404 for a module the distribution does not install).

### Digest settings

| Setting | Purpose |
|---------|---------|
| `frequency_days` | Days between two automatic digests (default `7`, range 1–365). |

The module toggle governs the daily `digest.generate` job; while the module is on, **Generate now** on the **Digest** tab works regardless of the schedule. The tab and the `admin/digests` routes go away with the module. See [`digest.md`](./digest.md).

### Sandbox settings

Both **inert by default** — the sandbox pays nothing until an admin configures it.

| Setting | Purpose |
|---------|---------|
| `star_tiers` | Ordered `{ stars, cp }` milestones, strictly increasing thresholds. Crossing one credits the author once, out of any pool. Lowering a threshold below a sandbox's star count does not pay retroactively: it is paid on the next star. |
| `promotion_bonus_cp` | CP credited to the author when their sandbox becomes an official challenge. |

The same editor carries the **star audit**: a sandbox's stars grouped by origin, hashed-IP prefix and day, with the ability to delete stars or a paid reward. Deleting a reward lowers the leaderboard total immediately. If the count is still above a threshold after a cleanup, the milestone is paid again on the next star. See [`sandbox.md`](./sandbox.md).

### Onboarding

The admin-only **Onboarding** tab lists every contributor's quest progress, backed by `GET /api/onboarding/all`. Quests are declared by their owners and completed from platform events, up to a minute after the action. See [`onboarding.md`](./onboarding.md).

---

## Qualifications

`users.role` is one of `admin`, `contributor`, `viewer`. What a role does not say — being a medical professional, for instance — is a **qualification**, declared by the distribution (MyTwin declares `medical_pro`) and granted per user. Flows read them from their configuration: a validation challenge's `reviewer_qualification`, `eligible_roles` and `expert_comment_qualification`.

- `GET /api/qualifications` — admin-only, the qualifications the distribution declares.
- `PUT` / `DELETE /api/users/[id]/qualifications` — admin-only, grant or revoke one, with an optional note.

Grants live in `user_qualifications`; every grant and revocation is logged in `qualification_changes`. The admin user list (`components/admin/UserList.tsx`) edits them.

---

## Key files

| File | Purpose |
|------|---------|
| `packages/database-service/repositories/appSettings.repo.ts` | Singleton read/update for the theme in `app_settings` |
| `packages/capabilities/crypto.ts` | AES-256-GCM encrypt/decrypt |
| `packages/capabilities/credentials.ts` | The credentials store (`integration_credentials`) |
| `packages/connectors/integrations.ts` | Integration contract and `IntegrationRegistry` |
| `packages/config/githubToken.ts` | `getGithubToken()` — store, then `GITHUB_TOKEN` |
| `packages/config/{kaggle,slack,openai,scaleway}Credentials.ts` | Same accessors for the other integrations |
| `packages/capabilities/modules.ts` | Module states and settings (`module_settings`) |
| `apps/leaderboard-client/src/lib/themes.ts` | Predefined theme palette definitions |
| `apps/leaderboard-client/src/app/api/admin/theme/route.ts` | Theme update endpoint |
| `apps/leaderboard-client/src/app/api/integrations/` | Generic integration routes |
| `apps/leaderboard-client/src/components/contributor/IntegrationCard.tsx` | Generic integration card |
| `apps/leaderboard-client/src/distribution/mytwin.integrations.tsx` | Integration icons and OAuth error messages |
| `apps/leaderboard-client/src/app/api/modules/` | Module list, state and settings routes |
| `apps/leaderboard-client/src/components/contributor/ModulesPanel.tsx` | Modules tab |
| `apps/leaderboard-client/src/app/api/qualifications/route.ts` | Declared qualifications |
| `apps/leaderboard-client/src/app/api/users/[id]/qualifications/route.ts` | Grant and revoke a qualification |
| `apps/leaderboard-client/src/app/api/onboarding/all/route.ts` | Admin view of all contributors' onboarding progress |
