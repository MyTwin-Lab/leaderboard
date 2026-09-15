# Onboarding

The onboarding system guides **new contributors** through a set of missions to get familiar with the platform. It is a product **module** (`modules/onboarding`), disabled by default, that an admin turns on from the Modules tab of `/contributors/me` (see [`admin-settings.md`](./admin-settings.md)).

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

A quest is **completed by a server-side event, never by the browser**. The flow is:

```
An action in the app (sign-in, POST /api/tasks, a successful evaluation, a click…)
        ↓
events.emit(type, { …, userId })   → platform_events (outbox), only if something subscribes
        ↓
/api/cron/tick → job core.events.distribute (every minute)
        ↓
subscription quests.<key> → onboarding questRecorder → onboarding_quest_progress
```

So a quest can take **up to about a minute** to show as done.

- **Quests are declared by their owner**, not by the onboarding module: a flow or a module adds `quests` to its definition, each naming the event that completes it and how to read the user from it (`userOf`). The platform turns each quest into a subscription of the one module that declares a `questRecorder` — here, onboarding.
- **Core events** (`CORE_EVENTS` in `packages/registry/platform.ts`): `user.created`, `task.created`, `contribution.evaluated`, `ui.challenge_opened`. Flows and modules declare their own (`evaluation.requested`, `ui.meeting_link_opened`).
- **UI events** go through `POST /api/events/ui`: signed-in accounts only, only declared `ui.*` types, only on a challenge or meeting the caller can see. The `userId` comes from the session, never from the body.
- **Disabled module:** nothing is consumed — events wait in the outbox (30 days), the drawer disappears and `GET /api/onboarding` answers 404. A quest whose owner is disabled (the meetings module, for instance) is not shown.

The app reads progress at:
- `GET /api/onboarding` — the installed quests, in order, and their state for the authenticated user
- `GET /api/onboarding/all` — admin-only; every contributor's completed quests

There is no write route: the former `PATCH /api/onboarding` and the client-side `trackOnboardingStep` are gone.

The drawer (`components/onboarding/OnboardingDrawer.tsx`) is rendered by `app/layout.tsx` when `modules.enabled('onboarding')` and at least one quest is still open.

---

## Quests

| Order | Quest key | Owner | Completing event |
|-------|-----------|-------|------------------|
| 1 | `clicked_challenge` | module onboarding | `ui.challenge_opened` — opening a challenge page while signed in |
| 2 | `assigned_task` | module onboarding | `task.created` — creating a task on a personal board |
| 3 | `evaluated_contribution` | module onboarding | `contribution.evaluated` — one of your contributions was evaluated successfully |
| 4 | `validated_task` | flow `code` | `evaluation.requested` — launching a project evaluation |
| 5 | `joined_meeting` | module meetings | `ui.meeting_link_opened` — clicking through to a sync meeting link (proves the click, not attendance) |

> The keys predate the personal-board model — `assigned_task` has nothing to do with assignment, and `validated_task` fires on a project evaluation. They were kept so existing progress carries over; read the event column, not the name.

---

## Data model

```
users
  └── onboarding_quest_progress (one row per completed quest)
        ├── user_id
        ├── quest_key
        └── completed_at
```

Recording is idempotent: a quest already completed is not written twice. The former `onboarding_progress` table (one boolean per quest) was copied into `onboarding_quest_progress` by `scripts/db-apply-schema.ts`; it is still initialised on `user.created` for a code rollback and is dropped in challenge 020, L7.

**Key files:**
- `modules/onboarding/index.ts`
- `packages/capabilities/events.ts`
- `packages/database-service/repositories/onboardingProgress.repo.ts`
- `apps/leaderboard-client/src/lib/server/onboarding.ts`
- `apps/leaderboard-client/src/app/api/onboarding/route.ts`
- `apps/leaderboard-client/src/app/api/onboarding/all/route.ts`
- `apps/leaderboard-client/src/app/api/events/ui/route.ts`
