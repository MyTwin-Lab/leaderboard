# Sync Meetings

Sync meetings are team synchronization meetings that are **created directly from the leaderboard app** in Google Workspace, then **automatically analyzed by AI** after they conclude.

They are a product **module** (`modules/meetings`), **disabled by default** because they need a Google Workspace service account. An admin turns it on from the Modules tab of `/contributors/me` (see [`admin-settings.md`](./admin-settings.md)).

**Requires:** Google Workspace service account credentials + `OPENAI_API_KEY`

---

## What it does

1. An admin, or the manager of the challenge's project, creates a sync meeting from the app — this provisions a Google Calendar event with a Google Meet link for the team.
2. The team meets using that Google Meet link.
3. After the meeting, the module's job (or a manual trigger) detects that the meeting has ended and ingests the content.
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
/api/cron/tick → job meetings.check (every minute)
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
| `google-workspace/google-calendar.service.ts` | Creates and manages Google Calendar events |
| `google-workspace/google-meet.service.ts` | Provisions Google Meet links |
| `sync-meeting/sync-meeting.service.ts` | Orchestrates meeting creation (calendar + meet + DB record) |
| `sync-meeting/meeting-polling.service.ts` | Periodically checks which meetings have finished |
| `sync-meeting/meeting-ingestion.service.ts` | Fetches the meeting content after it ends |
| `sync-meeting/meeting-analysis.service.ts` | Calls the sync-meeting-agent and stores results |
| `sync-meeting/cron-check-meetings.ts` | `checkCompletedMeetings`, run by the `meetings.check` job |

Google sign-in (`GoogleAuthService`) is not part of the module: it belongs to the core identity capability (`packages/capabilities/identity/google-auth.ts`).

---

## Database tables

| Table | Purpose |
|-------|---------|
| `sync_meetings` | The meeting record: title, Google Meet link, event ID, status, scheduled time |
| `meeting_participants` | Users invited to / present in the meeting |
| `meeting_analyses` | AI analysis results (summary, decisions, actions, contribution signals) |

---

## The module

**Disabled** means gone, not hidden:

- `/api/sync-meetings/**` and `GET /api/challenges/[id]/meetings` answer 404;
- the `/admin/meetings` and `/sync-meetings` pages answer 404 (their layouts call `notFound()`);
- its UI slots disappear and the tick skips `meetings.check`.

**Routes.** The challenge overview no longer returns meetings. A challenge page and its manage view read `GET /api/challenges/[id]/meetings` — admins, managers and challenge members only.

**UI slots** (`apps/leaderboard-client/src/distribution/modules/meetings.tsx`, listed in `mytwin.modules.tsx`): the meetings section of a challenge page (`ChallengeSection`) and of the manage view (`ManageSection`), the "Meetings" entry of the admin menu, a stat card and a tab on the admin home.

**Proxy** (`distribution/modules/meetings.proxy.ts`): `/api/sync-meetings` is a protected API route, and `POST /api/sync-meetings` is open to non-admins — the handler checks that the caller manages the challenge.

**Onboarding quest.** The module declares the `ui.meeting_link_opened` event, emitted through `POST /api/events/ui` when someone clicks "Join", and the `joined_meeting` quest it completes (see [`onboarding.md`](./onboarding.md)).

---

## Cron job

The module declares the job `meetings.check` (every minute). It runs from the single scheduler entry `GET /api/cron/tick`, which runs due jobs one at a time under their `cron_runs` lock.

`GET /api/cron/check-meetings` still exists as a wrapper around the same job; it is removed in challenge 020, L7, once the scheduler calls only the tick.

Secure the tick with `CRON_SECRET`:
```env
CRON_SECRET=your-secret-value
```

The request must include the header:
```
Authorization: Bearer your-secret-value
```

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
| `modules/meetings/index.ts` | Module definition: default state, event, quest, job |
| `packages/services/sync-meeting/` | Sync meeting services |
| `packages/services/google-workspace/` | Google Calendar and Meet |
| `packages/sync-meeting-agent/meeting-analyzer.ts` | AI analysis agent |
| `packages/sync-meeting-agent/prompts.ts` | System and user prompts for the agent |
| `packages/sync-meeting-agent/schemas.ts` | Zod output validation |
| `apps/leaderboard-client/src/app/api/sync-meetings/` | API routes |
| `apps/leaderboard-client/src/app/api/challenges/[id]/meetings/route.ts` | A challenge's meetings |
| `apps/leaderboard-client/src/distribution/modules/meetings.tsx` | UI slots |
| `apps/leaderboard-client/src/distribution/modules/meetings.proxy.ts` | Proxy rules |
