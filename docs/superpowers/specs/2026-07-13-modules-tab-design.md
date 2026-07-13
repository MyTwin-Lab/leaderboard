# Spec: Modules Tab — Meetings & Onboarding toggles

**Date:** 2026-07-13
**Branch:** challenge-010-ML_integration

---

## Goal

Add an admin-only "Modules" tab in `contributor/me` to toggle the visibility of two features:
- **Meetings** — hides the meetings sidebar in challenge views for contributors/managers
- **Onboarding** — hides the onboarding drawer for all non-admin users (tracking continues silently in DB)

Add a second admin-only "Onboarding" tab in `contributor/me` showing each contributor's onboarding progress (5 quests).

---

## Data Model

### Migration: add 2 columns to `app_settings`

```sql
ALTER TABLE app_settings
  ADD COLUMN modules_meetings_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN modules_onboarding_enabled boolean NOT NULL DEFAULT true;
```

File: `drizzle/0015_modules_flags.sql`

### Layer changes

| File | Change |
|------|--------|
| `packages/database-service/db/drizzle.ts` | Add 2 boolean columns to `app_settings` table definition |
| `packages/database-service/domain/entities.ts` | Add `modules_meetings_enabled` and `modules_onboarding_enabled` to `AppSettings` |
| `packages/database-service/db/mappers.ts` | Map the 2 new columns |
| `packages/database-service/repositories/appSettings.repo.ts` | Add fields to `AppSettingsUpdate`, include in `update()` upsert defaults |

---

## API

### GET `/api/modules` (new)
Returns the module flags for client-side consumption.

```json
{ "meetings_enabled": true, "onboarding_enabled": true }
```

No auth required (public flags — same as theme).

### PATCH `/api/modules` (new)
Admin-only. Body: `{ meetings_enabled?: boolean, onboarding_enabled?: boolean }`.
Returns updated flags.

### GET `/api/onboarding/all` (new, admin-only)
Returns all contributors with their onboarding progress.

```json
[
  {
    "user_id": "...",
    "full_name": "Alice Martin",
    "avatar_url": "...",
    "clicked_challenge": true,
    "assigned_task": true,
    "evaluated_contribution": false,
    "validated_task": false,
    "joined_meeting": false,
    "completed_at": null
  }
]
```

---

## UI

### Tab: Modules (admin-only, in contributor/me)

Two module cards with a toggle switch each:

```
[ Video icon ] Meetings
  Show meetings sidebar in challenge views for contributors
  [toggle ON/OFF]

[ Compass icon ] Onboarding
  Show the onboarding drawer for contributors
  [toggle ON/OFF]
```

Toggle fires PATCH `/api/modules` with optimistic update. Reuses existing card style (`border border-white/10 bg-white/[0.03]`).

Server component passes current flag values; a `ModulesSettings` client component handles toggle interaction.

### Tab: Onboarding (admin-only, in contributor/me)

Table listing all contributors with a row per user. 5 quest columns shown as check/cross icons. Completed users are visually distinguished (row slightly brighter, "Done" badge).

Columns: Avatar + Name | Explore | Assign | Evaluate | Validate | Join | Status

Fetched server-side via `AppSettingsRepository` + new onboarding repo query.

### Challenge page `/challenges/[id]/page.tsx`

Client component. On mount, fetches `/api/modules` alongside existing calls.
If `meetings_enabled === false`: skip `fetchMeetings()`, render tasks full-width (no sidebar grid), hide `MeetingsSidebar`.

### Root layout `layout.tsx`

Already server-side reads `app_settings`. Check `modules_onboarding_enabled`: if false, don't render `<OnboardingDrawer>`.

---

## Scope boundaries

- Admin views (`/admin/*`) are never affected by module flags
- Onboarding tracking (writing `onboarding_progress` rows) continues regardless of the flag
- The "Join a meeting" onboarding quest tracking call in the challenge page is preserved even when meetings are hidden (tracking is independent of display)
- No per-user override — flags are global

---

## Testing

- TypeScript: `cd apps/leaderboard-client && npx tsc --noEmit`
- Manual: toggle meetings off → challenge page shows full-width tasks, no meetings sidebar
- Manual: toggle onboarding off → OnboardingDrawer absent from layout for non-admin users
