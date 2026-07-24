# Sync Meetings

Sync meetings are team synchronization meetings that are **created directly from the leaderboard app** in Google Workspace, then **automatically analyzed by AI** after they conclude.

**Requires:** Google Workspace service account credentials + `OPENAI_API_KEY`

---

## What it does

1. An admin, or the manager of the challenge's project, creates a sync meeting from the app — this provisions a Google Calendar event with a Google Meet link for the team.
2. The team meets using that Google Meet link.
3. After the meeting, the system (via cron or manual trigger) detects that the meeting has ended and ingests the content.
4. The AI analysis agent processes the meeting and produces a structured report.

---

## Full flow

```
Admin or project manager creates meeting in app
        ↓
Google Calendar event created (via service account)
Google Meet link provisioned
        ↓
Team holds the meeting
        ↓
Cron job: /api/cron/check-meetings
        ↓
MeetingPollingService: detect completed meetings
        ↓
MeetingIngestionService: fetch transcript / content
        ↓
MeetingAnalysisService → sync-meeting-agent (OpenAI)
        ↓
Analysis stored in meeting_analyses table
        ↓
Available in the leaderboard UI
```

---

## AI analysis output

The `packages/sync-meeting-agent` produces a structured analysis with:

- **Summary** — concise overview of what was discussed
- **Decisions** — key decisions made during the meeting
- **Action items** — follow-up tasks with assignees
- **Contribution signals** — who contributed what, useful for the evaluation pipeline

Output is validated with Zod schemas before being stored.

---

## Services involved

| Service | Responsibility |
|---------|----------------|
| `google-calendar.service.ts` | Creates and manages Google Calendar events |
| `google-meet.service.ts` | Provisions Google Meet links |
| `google-auth.service.ts` | Manages Google OAuth2 tokens |
| `sync-meeting.service.ts` | Orchestrates meeting creation (calendar + meet + DB record) |
| `meeting-polling.service.ts` | Periodically checks which meetings have finished |
| `meeting-ingestion.service.ts` | Fetches the meeting content after it ends |
| `meeting-analysis.service.ts` | Calls the sync-meeting-agent and stores results |
| `cron-check-meetings.ts` | Entry point for the cron job |

---

## Database tables

| Table | Purpose |
|-------|---------|
| `sync_meetings` | The meeting record: title, Google Meet link, event ID, status, scheduled time |
| `meeting_participants` | Users invited to / present in the meeting |
| `meeting_analyses` | AI analysis results (summary, decisions, actions, contribution signals) |

---

## Cron job

`GET /api/cron/check-meetings` is the endpoint that drives the polling. It should be called on a schedule (e.g. every 5–15 minutes) by an external cron scheduler.

Secure it with `CRON_SECRET`:
```env
CRON_SECRET=your-secret-value
```

The request must include the header:
```
Authorization: Bearer your-secret-value
```

---

## Hiding the meetings module

An admin can hide the meetings sidebar from challenge pages instance-wide, from the Modules tab in `/contributors/me` — see [`admin-settings.md`](./admin-settings.md). This only affects visibility; meetings can still be created and accessed directly.

---

## Required environment variables

```env
# Google Workspace service account (for creating meetings)
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY=...
GOOGLE_WORKSPACE_ADMIN_EMAIL=...

# Google OAuth (for user-level access)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=...

# AI analysis
OPENAI_API_KEY=...

# Cron security
CRON_SECRET=...
```

---

## Key files

| File | Purpose |
|------|---------|
| `packages/services/sync-meeting/` | All sync meeting services |
| `packages/sync-meeting-agent/meeting-analyzer.ts` | AI analysis agent |
| `packages/sync-meeting-agent/prompts.ts` | System and user prompts for the agent |
| `packages/sync-meeting-agent/schemas.ts` | Zod output validation |
| `apps/leaderboard-client/src/app/api/sync-meetings/` | API routes |
| `apps/leaderboard-client/src/app/api/cron/check-meetings/` | Cron endpoint |
