# Google Workspace Setup Guide

This document condenses everything we configured (and debugged) while wiring MyTwin Leaderboard to Google Workspace for calendar + Meet ingestion.

## 0. Prerequisites

1. **Google Workspace domain** (Business/Enterprise) with super admin access.
2. **Google Cloud account** with billing enabled (required even for free APIs).
3. Local tooling: Node 18+, npm, PostgreSQL (see `README.md`).

## 1. Create and configure Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. **Enable billing** for the project (Menu → Billing).
4. **Enable required APIs**:
   - Go to **Menu → More products → Google Workspace → Product Library**
   - Enable **Google Calendar API**
   - Enable **Google Meet API** (search for `meet.googleapis.com`)
5. **Configure OAuth consent screen** (required for domain-wide delegation):
   - Go to **Menu → Google Auth platform → Branding**
   - If not configured, click **Get Started**
   - **App name**: Enter a name (e.g., "MyTwin Leaderboard")
   - **User support email**: Select your email
   - Click **Next**
   - **Audience**: Select **Internal** (for Workspace organization only)
   - Click **Next**
   - **Contact email**: Enter your email
   - Click **Next**
   - Review and accept the **Google API Services User Data Policy**
   - Click **Continue**, then **Create**

## 2. Create the service account

1. In Google Cloud Console → **IAM & Admin → Service Accounts** → **Create Service Account**.
2. **Service account name**: Enter a name (e.g., `mytwin-sync-meetings`).
3. **Service account ID**: Auto-generated, you can customize if needed.
4. Click **Create and Continue**.
5. **Grant roles** (optional): Skip this step for domain-wide delegation (no specific IAM roles needed).
6. Click **Continue**, then **Done**.
7. Click on the newly created service account to open its details.
8. Go to the **Details** tab and note the **Unique ID** (21-digit number) — this is your **Client ID** for domain-wide delegation.
9. **Enable domain-wide delegation**:
   - Scroll down to **Advanced settings**
   - Check **Enable Google Workspace Domain-wide Delegation**
   - Click **Save**
10. Go to the **Keys** tab → **Add Key → Create new key**.
11. Select **JSON** format and click **Create**.
12. Download and save the JSON file securely — we'll use its contents in `.env`.

## 3. Configure domain-wide delegation scopes

1. Sign in to the [Workspace Admin Console](https://admin.google.com/) as a super-admin.
2. Navigate to **Menu → Security → Access and data control → API controls**.
3. In the **Domain wide delegation** section, click **Manage Domain Wide Delegation**.
4. Click **Add new**.
5. **Client ID**: Paste the service account's **Unique ID** (21-digit number from step 2.8).
6. **OAuth scopes**: Add the following scopes (comma-separated or one per line):
   ```
   https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/meetings.space.created,https://www.googleapis.com/auth/meetings.space.readonly
   ```
   **Recommended scopes explained**:
   - `calendar` + `calendar.events`: Create events and add participants
   - `meetings.space.created`: Create Meet spaces and access their artifacts
   - `meetings.space.readonly`: Read conference records and transcripts
7. Click **Authorize**.
8. Verify the scopes are listed correctly by clicking **View details** on the newly added client.

## 4. Decide which human account will be impersonated

The service account never owns calendars by itself. We impersonate one admin/robot user (e.g. `bot@mydomain.com`).

Requirements for that user:
- It must have Google Calendar enabled.
- It will be the **organizer** of all meetings that sync through the system.
- It needs access to the calendars you want to control (usually its own, but share others if necessary).

Note the email address; we’ll store it as `GOOGLE_WORKSPACE_ADMIN_EMAIL`.

## 5. Environment variables

Configure them **in both** the repo root `.env` and `apps/leaderboard-client/.env.local` (copy after editing).

```env
# Service account credentials (from step 2)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}  # raw JSON, one line

# User to impersonate (from step 4)
GOOGLE_WORKSPACE_ADMIN_EMAIL=bot@mydomain.com

# OAuth credentials (REQUIRED for Next.js API routes and user authentication)
# Create these in Google Cloud Console → APIs & Services → Credentials → Create OAuth Client ID
# Application type: Web application
# Authorized redirect URIs: http://localhost:3000/api/auth/callback/google (local) + your production URL
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret

# Cron security
CRON_SECRET=your-random-secret-token-here
```

Tips:
- Keep the JSON key as a single line. To format: `cat key.json | jq -c`
- Do **not** commit this file. Add `.env` and `.env.local` to `.gitignore`.

## 6. Running locally vs. Vercel

### Local dev

- `npm run dev` launches Next.js. Cron endpoints (`/api/cron/check-meetings`) **do not self-trigger locally**.
- To run the cron manually:
  ```bash
  curl -X GET http://localhost:3000/api/cron/check-meetings \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- Logs come through your terminal (Next.js output). Look for `[Cron] ...` or `[MeetingIngestion] ...` prefixes.

### Vercel cron

- `vercel.json` schedules `/api/cron/check-meetings` with `*/1 * * * *` (every minute).
- Vercel automatically injects the `Authorization` header with the secret you configure in the project settings (match `CRON_SECRET`).