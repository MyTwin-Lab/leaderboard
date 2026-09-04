# Onboarding

The onboarding system guides **new contributors** through a set of missions to get familiar with the platform. It's a lightweight, progressive experience built into the app.

---

## Purpose

When a new contributor joins, they don't immediately have full context on how challenges, tasks, and evaluations work. The onboarding missions provide a structured first experience:

1. Get oriented in the platform
2. Start your own board
3. Follow your work
4. Deliver and trigger an evaluation
5. Join the team's sync meeting

---

## How it works

Onboarding progress is tracked per user in a single `onboarding_progress` row — one boolean per quest, flipped to `true` as the contributor completes each step.

The app reads and writes this progress at:
- `GET /api/onboarding` — returns the authenticated user's onboarding state
- `PATCH /api/onboarding` — marks a quest as completed
- `GET /api/onboarding/all` — admin-only; returns every contributor's progress in one list, for the "Onboarding" tab in `/contributors/me`

Progress is shown in the contributor's own profile page (`/contributors/me`) via the onboarding drawer. An admin can hide this drawer instance-wide from the Modules tab (see [`admin-settings.md`](./admin-settings.md)) — tracking still happens in the background even when the drawer is hidden.

---

## Quests

The onboarding flow is five quests. Each is completed by taking a real action in the app, and each maps to one boolean column on `onboarding_progress`:

| Quest | Column | What actually flips it |
|-------|--------|------------------------|
| Explore | `clicked_challenge` | Opening a challenge page while signed in |
| Get to work | `assigned_task` | Creating your first task on a personal board |
| Review | `evaluated_contribution` | Opening your "My tasks" view |
| Deliver | `validated_task` | Launching a project evaluation |
| Join | `joined_meeting` | Clicking through to a sync meeting link |

> The column names predate the personal-board model — `assigned_task` no longer has anything to do with assignment, and `validated_task` fires on a project evaluation, not a task. They were kept rather than migrated; read the right-hand column, not the name.

When all five are done, `completed_at` is set and the onboarding drawer stops appearing for that user.

---

## Data model

```
users
  └── onboarding_progress (one row per user)
        ├── user_id
        ├── clicked_challenge: boolean
        ├── assigned_task: boolean
        ├── evaluated_contribution: boolean
        ├── validated_task: boolean
        ├── joined_meeting: boolean
        └── completed_at: timestamp | null
```

**Key files:**
- `packages/database-service/repositories/onboardingProgress.repo.ts`
- `apps/leaderboard-client/src/lib/onboarding-track.ts`
- `apps/leaderboard-client/src/lib/server/onboarding.ts`
- `apps/leaderboard-client/src/app/api/onboarding/route.ts`
- `apps/leaderboard-client/src/app/api/onboarding/all/route.ts`
