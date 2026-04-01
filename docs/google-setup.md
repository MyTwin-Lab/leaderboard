# Google Cloud & Workspace Setup Guide

Complete step-by-step guide to configure Google services for the Leaderboard application. This covers two distinct features:

- **Google OAuth 2.0 Login** — allows users to sign in with their Google account
- **Google Workspace Connector (Sync Meetings)** — creates Google Calendar events with Meet links, fetches transcripts, and runs AI analysis

Both features use the same Google Cloud project but require different credentials.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create a Google Cloud Project](#2-create-a-google-cloud-project)
3. [Configure the OAuth Consent Screen](#3-configure-the-oauth-consent-screen)
4. [Create OAuth 2.0 Credentials (User Login)](#4-create-oauth-20-credentials-user-login)
5. [Enable Required APIs](#5-enable-required-apis)
6. [Create a Service Account (Sync Meetings)](#6-create-a-service-account-sync-meetings)
7. [Enable Domain-Wide Delegation](#7-enable-domain-wide-delegation)
8. [Mark the Application as Trusted](#8-mark-the-application-as-trusted)
9. [Configure Environment Variables](#9-configure-environment-variables)
10. [Verify the Setup](#10-verify-the-setup)
11. [Production Deployment Checklist](#11-production-deployment-checklist)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

| Requirement | Why |
|---|---|
| A Google Workspace account (any plan) with Super Admin access | Required for domain-wide delegation and admin console settings |
| A verified domain in Google Workspace | The service account impersonates a Workspace user |
| Access to Google Cloud Console | To create the project, credentials, and enable APIs |

> **Note:** A standard Gmail account is not sufficient for the Sync Meetings feature (which requires domain-wide delegation). However, the OAuth Login feature works with any Google account if the consent screen is set to "External".

---

## 2. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google Workspace Super Admin account
3. Click the project selector (top-left) > **New Project**
4. Enter a project name (e.g. `leaderboard`)
5. Under **Organization**, select your Workspace domain
6. Click **Create**
7. Make sure the new project is selected in the project selector

---

## 3. Configure the OAuth Consent Screen

Before creating credentials, you must configure the consent screen that users will see when logging in.

1. In the Cloud Console, go to **APIs & Services > OAuth consent screen**
2. Choose **User Type**:
   - **Internal** — only users within your Google Workspace organization can log in (recommended for private/corporate use)
   - **External** — anyone with a Google account can log in (required for public-facing apps; requires verification for production)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: your application name
   - **User support email**: your admin email
   - **Developer contact information**: your admin email
5. Click **Save and Continue**
6. On the **Scopes** page, click **Add or Remove Scopes** and add:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
7. Click **Save and Continue**
8. If External: add test users during development (emails of people who can log in before verification)
9. Click **Save and Continue** > **Back to Dashboard**

> **Important:** If you chose "External", your app will be in **Testing** mode. Only users listed as test users can log in. To allow anyone, you must submit for Google verification (required when you have more than 100 users or use sensitive scopes).

---

## 4. Create OAuth 2.0 Credentials (User Login)

These credentials are used for the Google login flow (sign in with Google).

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. **Application type**: Web application
4. **Name**: e.g. `Leaderboard Web Client`
5. **Authorized JavaScript origins**: add your application URLs
   - For local development: `http://localhost:3000`
   - For production: `https://your-app-domain.com`
6. **Authorized redirect URIs**: add the OAuth callback URL
   - For local development: `http://localhost:3000/api/google-auth/callback`
   - For production: `https://your-app-domain.com/api/google-auth/callback`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret** — you will need them for the environment variables:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`

> **Tip:** You can add multiple redirect URIs for different environments (localhost, staging, production).

---

## 5. Enable Required APIs

In your Google Cloud project, go to **APIs & Services > Library** and enable the following APIs:

### Required for OAuth Login
| API | Purpose |
|---|---|
| **Google People API** | Fetch user profile information (name, email) |

### Required for Sync Meetings
| API | Purpose |
|---|---|
| **Google Calendar API** | Create/delete calendar events with Meet links |
| **Google Meet REST API** | Fetch conference records, participants, and transcripts |

To enable each API:
1. Search for the API name in the Library
2. Click on it
3. Click **Enable**

> **Note:** The "Google Meet REST API" is different from the legacy "Google+ Hangouts API". Make sure you enable the correct one — it should say "Google Meet REST API" with version `v2`.

---

## 6. Create a Service Account (Sync Meetings)

The service account is used for server-to-server communication to create Calendar events and fetch Meet data. This is only needed if you want the Sync Meetings feature.

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. **Name**: e.g. `sync-meeting-service`
4. **Role**: Project > Editor (or more granular: `roles/calendar.admin` + `roles/meet.viewer`)
5. Click **Done**
6. Click on the newly created service account
7. Go to the **Keys** tab
8. Click **Add Key > Create new key > JSON**
9. Download the JSON file — this is your `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY`

> **If key creation is blocked:** An organization policy (`iam.disableServiceAccountKeyCreation`) may be active. Go to **IAM & Admin > Organization Policies**, find the constraint, and set it to **Allow**.

### What's in the JSON key file

The downloaded file looks like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "sync-meeting-service@your-project-id.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

You will set the **entire JSON content** as the `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY` environment variable. The `client_email` value is your `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL`.

---

## 7. Enable Domain-Wide Delegation

Domain-wide delegation allows the service account to impersonate users in your Workspace domain (e.g., to create calendar events on behalf of the admin).

### Step A: Enable delegation on the service account

1. In **IAM & Admin > Service Accounts**, click on your service account
2. Check **Enable Google Workspace Domain-wide Delegation**
3. Note the **Client ID** (numeric, e.g. `123456789012345678901`)

### Step B: Authorize scopes in Google Admin Console

1. Go to [Google Admin Console](https://admin.google.com)
2. Navigate to **Security > Access and data control > API controls**
3. Click **Manage Domain Wide Delegation**
4. Click **Add new**
5. **Client ID**: paste the service account's Client ID from Step A
6. **OAuth scopes**: paste the following (comma-separated, no spaces):
   ```
   https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/meetings.space.readonly
   ```
7. Click **Authorize**

> **Important:** The admin email you set in `GOOGLE_WORKSPACE_ADMIN_EMAIL` must have an active Google Calendar license. This is the user the service account will impersonate when creating events.

---

## 8. Mark the Application as Trusted

This step prevents Google from blocking API calls from the service account.

1. In [Google Admin Console](https://admin.google.com), go to **Security > Access and data control > API controls**
2. Click **Manage third-party app access**
3. Click **Add app > OAuth App Name Or Client ID**
4. Search by the service account's **Client ID**
5. Select the app
6. Set access to **Trusted**
7. Click **Configure** > **Finish**

---

## 9. Configure Environment Variables

Add the following variables to your `.env` file (local development) or to your hosting provider's environment settings (production).

### OAuth Login (required for user authentication)

```env
# From Step 4 — OAuth Client ID and Secret
GOOGLE_OAUTH_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxx

# The callback URL — must match what you set in Step 4
# Local development:
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google-auth/callback
# Production:
# GOOGLE_OAUTH_REDIRECT_URI=https://your-app-domain.com/api/google-auth/callback
```

### Sync Meetings (required for Google Calendar/Meet integration)

```env
# From Step 6 — the entire JSON key content on a single line
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"...","client_id":"..."}

# The service account email (client_email from the JSON key)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=sync-meeting-service@your-project-id.iam.gserviceaccount.com

# A Workspace user email with Calendar license — the service account impersonates this user
GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@yourdomain.com
```

### Cron Security (for the meeting polling endpoint)

```env
# Secret token to protect the cron endpoint
CRON_SECRET=a-random-secret-string
```

### Summary of all Google-related variables

| Variable | Feature | Required |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth Login | Yes (for login) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth Login | Yes (for login) |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth Login | Yes (for login) |
| `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL` | Sync Meetings | Yes (for meetings) |
| `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY` | Sync Meetings | Yes (for meetings) |
| `GOOGLE_WORKSPACE_ADMIN_EMAIL` | Sync Meetings | Yes (for meetings) |
| `CRON_SECRET` | Sync Meetings | Recommended |

---

## 10. Verify the Setup

### Test OAuth Login

1. Start the application (`npm run dev`)
2. Navigate to the app in your browser
3. Click on the user avatar (top-right) or go to a protected page
4. You should be redirected to Google's login/consent screen
5. After granting access, you should be redirected back to the app and logged in

### Test Sync Meetings

1. Log in as an admin user
2. Go to the admin panel > Sync Meetings
3. Create a new meeting for a challenge with team members
4. Check Google Calendar — a new event with a Meet link should appear
5. After the meeting ends, trigger the cron endpoint:
   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-app-domain.com/api/cron/check-meetings
   ```
6. The meeting should transition through statuses: `scheduled` > `completed` > `processed`

---

## 11. Production Deployment Checklist

When deploying to production (e.g. Scalingo, Heroku, Vercel):

- [ ] Set all environment variables listed in [Section 9](#9-configure-environment-variables) in your hosting provider's dashboard
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://your-app.osc-fr1.scalingo.io`). This is used for post-login redirects — without it, the app may redirect to the container's internal host (e.g. `localhost:29069`) instead of the public URL.
- [ ] Update `GOOGLE_OAUTH_REDIRECT_URI` to your production URL (e.g. `https://your-app.osc-fr1.scalingo.io/api/google-auth/callback`)
- [ ] Add the production URL to **Authorized JavaScript origins** and **Authorized redirect URIs** in the [Google Cloud OAuth credentials](#4-create-oauth-20-credentials-user-login)
- [ ] If using an "External" consent screen, submit for Google verification if you expect more than 100 users
- [ ] Set up a cron job (e.g. Scalingo Scheduler, external cron service) to call `GET /api/cron/check-meetings` every 5-15 minutes with the `CRON_SECRET` as a Bearer token
- [ ] Ensure the `GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY` JSON is set as a single line (no newlines except within the `private_key` field which uses `\n`)
- [ ] Verify `GOOGLE_WORKSPACE_ADMIN_EMAIL` has an active Google Workspace license with Calendar enabled

---

## 12. Troubleshooting

### OAuth Login Issues

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | The redirect URI in the request doesn't match any URI registered in Cloud Console | Add the exact URI to **Authorized redirect URIs** in your OAuth credentials. Watch for trailing slashes and http vs https. |
| `access_denied` | User is not in the test users list (External consent screen in Testing mode) | Add the user's email to the test users list in the OAuth consent screen settings, or submit for verification. |
| `Google OAuth credentials not configured` | Missing `GOOGLE_OAUTH_CLIENT_ID` or `GOOGLE_OAUTH_CLIENT_SECRET` env vars | Set the variables and restart the application. |
| Login works but user has no access | User was created with `contributor` role | Manually update the user's role to `admin` in the database if needed. |

### Sync Meetings Issues

| Error | Cause | Fix |
|---|---|---|
| `unauthorized_client` when creating a meeting | Domain-wide delegation not configured or scopes not authorized | Follow [Step 7](#7-enable-domain-wide-delegation) again. Double-check the Client ID and scopes. |
| `Not Authorized to access this resource/api` | Google Meet REST API not enabled or scopes insufficient | Enable the API in [Step 5](#5-enable-required-apis) and check the delegation scopes include `meetings.space.readonly`. |
| `GOOGLE_WORKSPACE_ADMIN_EMAIL doesn't have Calendar` | The impersonated user has no Calendar license | Assign a Google Workspace license with Calendar to this user in the Admin Console (Directory > Users). |
| Calendar event created but no Meet link | `conferenceDataVersion` not set | This is handled automatically by the code. If it still happens, verify the Calendar API is enabled. |
| Transcripts empty after meeting | Google Meet transcription was not enabled during the meeting | The meeting organizer (or admin) must enable transcription in Google Meet settings. In Admin Console: **Apps > Google Workspace > Google Meet > Meet settings > Recording & transcripts > Allow transcription**. |
| Service account key JSON parse error | The env var contains malformed JSON or extra escape characters | Ensure the JSON is valid. On some hosting platforms, you may need to base64-encode the key and decode it at runtime. |

### Google Admin Console Navigation

Google frequently changes the Admin Console UI. If you can't find a setting:
- **Domain-wide delegation**: Security > Access and data control > API controls > Manage Domain Wide Delegation
- **Third-party app trust**: Security > Access and data control > API controls > Manage third-party app access
- **Meet transcription settings**: Apps > Google Workspace > Google Meet > Meet settings
- **User licenses**: Directory > Users > click user > Licenses

---

## Architecture Reference

For a deeper understanding of how the application uses these Google services:

```
OAuth Login Flow:
  Browser → /api/google-auth/authorize → Google Consent Screen
         → /api/google-auth/callback  → JWT tokens issued → User logged in

Sync Meetings Flow:
  Admin creates meeting → Service Account creates Calendar event + Meet link
  Cron polls endpoint   → Google Meet API returns conference record
  Ingestion             → Fetches participants + transcripts via Meet API
  Analysis              → OpenAI analyzes transcript → Results stored in DB
```

**Services involved:**
- `packages/services/google-workspace/google-auth.service.ts` — OAuth login
- `packages/services/google-workspace/google-calendar.service.ts` — Calendar events (Service Account)
- `packages/services/google-workspace/google-meet.service.ts` — Meet records & transcripts (Service Account)
- `packages/config/index.ts` — Environment variable validation
