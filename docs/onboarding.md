# Onboarding

The onboarding system guides **new contributors** through a set of missions to get familiar with the platform. It's a lightweight, progressive experience built into the app.

---

## Purpose

When a new contributor joins, they don't immediately have full context on how challenges, tasks, and evaluations work. The onboarding missions provide a structured first experience:

1. Get oriented in the platform
2. Pick a task and work on it
3. Participate in an evaluation
4. Validate your first contribution

---

## How it works

Onboarding progress is tracked per user in a single `onboarding_progress` row — one boolean per quest, flipped to `true` as the contributor completes each step.

The app reads and writes this progress at:
- `GET /api/onboarding` — returns the authenticated user's onboarding state
- `POST /api/onboarding` — marks a quest as completed
- `GET /api/onboarding/all` — admin-only; returns every contributor's progress in one list, for the "Onboarding" tab in `/contributors/me`

Progress is shown in the contributor's own profile page (`/contributors/me`) via the onboarding drawer. An admin can hide this drawer instance-wide from the Modules tab (see [`admin-settings.md`](./admin-settings.md)) — tracking still happens in the background even when the drawer is hidden.

---

## Quests

The onboarding flow is five quests. Each is completed by taking a real action in the app, and each maps to one boolean column on `onboarding_progress`:

| Quest | Column | What the contributor does |
|-------|--------|---------------------------|
| Explore | `clicked_challenge` | Open a challenge for the first time |
| Assign | `assigned_task` | Get assigned to a task |
| Evaluate | `evaluated_contribution` | Have a contribution go through evaluation |
| Validate | `validated_task` | Have a task marked complete |
| Join | `joined_meeting` | Join a sync meeting |

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
