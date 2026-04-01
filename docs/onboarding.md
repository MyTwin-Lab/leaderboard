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

Onboarding progress is tracked per user in the `onboarding_progress` table. Each record stores which missions the user has completed.

The app reads this progress at:
- `GET /api/onboarding` — returns the user's current onboarding state
- `POST /api/onboarding` — marks a mission as completed

Progress is shown in the contributor's profile page (`/contributors/me`).

---

## Missions

The onboarding flow consists of sequential missions. Each mission is completed by taking a real action in the app:

| Mission | What the contributor does |
|---------|---------------------------|
| **Join a challenge** | Find an active challenge and join the team |
| **Pick a task** | Select an available task from a challenge |
| **Work on a task** | Use the task workspace to do the work |
| **Participate in evaluation** | Go through the evaluation process for a contribution |
| **Get your first reward** | Receive CP from an evaluated contribution |

Missions unlock progressively — completing one unlocks the next.

---

## Data model

```
users
  └── onboarding_progress
        ├── user_id
        ├── mission (string identifier)
        ├── completed_at
        └── metadata (optional JSON)
```

**Key files:**
- `packages/database-service/repositories/onboardingProgress.repo.ts`
- `apps/leaderboard-client/src/lib/onboarding-track.ts`
- `apps/leaderboard-client/src/lib/server/onboarding.ts`
- `apps/leaderboard-client/src/app/api/onboarding/route.ts`
