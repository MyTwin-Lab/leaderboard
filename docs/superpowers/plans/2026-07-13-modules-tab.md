# Modules Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Modules" tab (admin-only) in `/contributors/me` to toggle meetings and onboarding visibility globally, plus an "Onboarding" tab showing per-contributor quest progress.

**Architecture:** Two boolean flags (`modules_meetings_enabled`, `modules_onboarding_enabled`) are added to the `app_settings` singleton. A new `/api/modules` route exposes them for client-side consumption. The root layout (server) reads the flag directly from DB to gate the OnboardingDrawer. The challenge page (client) fetches `/api/modules` on mount to gate the meetings sidebar.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (pg), Tailwind CSS v4.

## Global Constraints

- Theme: use `bg-background`, `text-brandCP`, `bg-white/[x]`, `border-white/10` — never hardcoded hex.
- Type checker: `cd apps/leaderboard-client && npx tsc --noEmit`
- No `Co-Authored-By` in commit messages.
- Admin panel (`/admin/*`) is never affected by module flags.
- Onboarding progress continues to be tracked regardless of the `modules_onboarding_enabled` flag.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `drizzle/0015_modules_flags.sql` | Create | Migration: 2 boolean columns on `app_settings` |
| `packages/database-service/db/drizzle.ts` | Modify | Add columns to `app_settings` table definition |
| `packages/database-service/domain/entities.ts` | Modify | Add fields to `AppSettings`; add `OnboardingProgressWithUser` interface |
| `packages/database-service/db/mappers.ts` | Modify | Map new columns in `toDomainAppSettings` |
| `packages/database-service/repositories/appSettings.repo.ts` | Modify | Add fields to `AppSettingsUpdate`, handle in `update()` |
| `packages/database-service/repositories/onboardingProgress.repo.ts` | Modify | Add `findAllWithUsers()` |
| `apps/leaderboard-client/src/app/api/modules/route.ts` | Create | GET + PATCH module flags |
| `apps/leaderboard-client/src/app/api/onboarding/all/route.ts` | Create | GET all contributors' onboarding progress (admin-only) |
| `apps/leaderboard-client/src/components/contributor/ModulesSettings.tsx` | Create | Toggle cards UI for modules |
| `apps/leaderboard-client/src/components/contributor/OnboardingProgressTable.tsx` | Create | Table of contributor onboarding status |
| `apps/leaderboard-client/src/app/contributors/me/page.tsx` | Modify | Add Modules + Onboarding admin tabs |
| `apps/leaderboard-client/src/app/layout.tsx` | Modify | Gate OnboardingDrawer on flag |
| `apps/leaderboard-client/src/app/challenges/[id]/page.tsx` | Modify | Fetch modules flag, gate meetings sidebar |

---

### Task 1: DB migration + data layer

**Files:**
- Create: `drizzle/0015_modules_flags.sql`
- Modify: `packages/database-service/db/drizzle.ts`
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/db/mappers.ts`
- Modify: `packages/database-service/repositories/appSettings.repo.ts`

**Interfaces:**
- Produces: `AppSettings.modules_meetings_enabled: boolean`, `AppSettings.modules_onboarding_enabled: boolean`
- Produces: `AppSettingsUpdate.modules_meetings_enabled?: boolean`, `AppSettingsUpdate.modules_onboarding_enabled?: boolean`

- [ ] **Step 1: Create migration file**

```sql
-- drizzle/0015_modules_flags.sql
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS modules_meetings_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modules_onboarding_enabled boolean NOT NULL DEFAULT true;
```

- [ ] **Step 2: Add columns to drizzle table definition**

In `packages/database-service/db/drizzle.ts`, find the `app_settings` table definition (around line 438) and add two columns after `kaggle_connected_by`:

```typescript
// add after kaggle_connected_by line:
modules_meetings_enabled: boolean("modules_meetings_enabled").notNull().default(true),
modules_onboarding_enabled: boolean("modules_onboarding_enabled").notNull().default(true),
```

- [ ] **Step 3: Update AppSettings entity**

In `packages/database-service/domain/entities.ts`, in the `AppSettings` interface (around line 298), add after `kaggle_is_connected`:

```typescript
modules_meetings_enabled: boolean;
modules_onboarding_enabled: boolean;
```

Also add the `OnboardingProgressWithUser` interface at the end of the file:

```typescript
// --- ONBOARDING PROGRESS WITH USER ---
export interface OnboardingProgressWithUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  clicked_challenge: boolean;
  assigned_task: boolean;
  evaluated_contribution: boolean;
  validated_task: boolean;
  joined_meeting: boolean;
  completed_at?: Date;
}
```

- [ ] **Step 4: Update mapper**

In `packages/database-service/db/mappers.ts`, in `toDomainAppSettings` (around line 624), add after `kaggle_is_connected`:

```typescript
modules_meetings_enabled: row.modules_meetings_enabled ?? true,
modules_onboarding_enabled: row.modules_onboarding_enabled ?? true,
```

- [ ] **Step 5: Update AppSettingsRepository**

In `packages/database-service/repositories/appSettings.repo.ts`:

Replace the `AppSettingsUpdate` interface:
```typescript
export interface AppSettingsUpdate {
  theme_key?: string;
  primary_color?: string | null;
  background_color?: string | null;
  theme_mode?: string;
  modules_meetings_enabled?: boolean;
  modules_onboarding_enabled?: boolean;
}
```

In the `update()` method, add after the `theme_mode` conditional:
```typescript
if (patch.modules_meetings_enabled !== undefined) set.modules_meetings_enabled = patch.modules_meetings_enabled;
if (patch.modules_onboarding_enabled !== undefined) set.modules_onboarding_enabled = patch.modules_onboarding_enabled;
```

- [ ] **Step 6: Run migration against DB**

```bash
cd apps/leaderboard-client
npx drizzle-kit push
```

Expected: no error, columns added.

- [ ] **Step 7: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add drizzle/0015_modules_flags.sql packages/database-service/db/drizzle.ts packages/database-service/domain/entities.ts packages/database-service/db/mappers.ts packages/database-service/repositories/appSettings.repo.ts
git commit -m "feat: add modules_meetings_enabled and modules_onboarding_enabled to app_settings"
```

---

### Task 2: OnboardingProgressRepository.findAllWithUsers()

**Files:**
- Modify: `packages/database-service/repositories/onboardingProgress.repo.ts`

**Interfaces:**
- Consumes: `OnboardingProgressWithUser` from `../domain/entities`
- Produces: `findAllWithUsers(): Promise<OnboardingProgressWithUser[]>`

- [ ] **Step 1: Add the method**

In `packages/database-service/repositories/onboardingProgress.repo.ts`, add the import for `users` table and `ne` operator, then add the method to the class:

Full updated file:
```typescript
import { db } from "../db/drizzle";
import { onboarding_progress, users } from "../db/drizzle";
import { eq, ne } from "drizzle-orm";
import { toDomainOnboardingProgress } from "../db/mappers";
import type { OnboardingProgress, OnboardingProgressWithUser, OnboardingStep } from "../domain/entities";

const ALL_STEPS: OnboardingStep[] = [
  'clicked_challenge',
  'assigned_task',
  'evaluated_contribution',
  'validated_task',
  'joined_meeting',
];

export class OnboardingProgressRepository {
  async findByUserId(userId: string): Promise<OnboardingProgress | null> {
    const [row] = await db.select().from(onboarding_progress).where(eq(onboarding_progress.user_id, userId));
    return row ? toDomainOnboardingProgress(row) : null;
  }

  async findAllWithUsers(): Promise<OnboardingProgressWithUser[]> {
    const rows = await db
      .select({
        user_id: users.uuid,
        full_name: users.full_name,
        avatar_url: users.avatar_url,
        clicked_challenge: onboarding_progress.clicked_challenge,
        assigned_task: onboarding_progress.assigned_task,
        evaluated_contribution: onboarding_progress.evaluated_contribution,
        validated_task: onboarding_progress.validated_task,
        joined_meeting: onboarding_progress.joined_meeting,
        completed_at: onboarding_progress.completed_at,
      })
      .from(users)
      .leftJoin(onboarding_progress, eq(onboarding_progress.user_id, users.uuid))
      .where(ne(users.role, 'admin'))
      .orderBy(users.full_name);

    return rows.map(r => ({
      user_id: r.user_id,
      full_name: r.full_name,
      avatar_url: r.avatar_url ?? null,
      clicked_challenge: r.clicked_challenge ?? false,
      assigned_task: r.assigned_task ?? false,
      evaluated_contribution: r.evaluated_contribution ?? false,
      validated_task: r.validated_task ?? false,
      joined_meeting: r.joined_meeting ?? false,
      completed_at: r.completed_at ?? undefined,
    }));
  }

  async initForUser(userId: string): Promise<OnboardingProgress> {
    const [inserted] = await db.insert(onboarding_progress).values({
      user_id: userId,
    }).returning();
    return toDomainOnboardingProgress(inserted);
  }

  async markStepComplete(userId: string, step: OnboardingStep): Promise<OnboardingProgress | null> {
    const [updated] = await db.update(onboarding_progress)
      .set({
        [step]: true,
        updated_at: new Date(),
      })
      .where(eq(onboarding_progress.user_id, userId))
      .returning();

    if (!updated) return null;

    const allComplete = ALL_STEPS.every((s) => updated[s] === true);
    if (allComplete && !updated.completed_at) {
      const [final] = await db.update(onboarding_progress)
        .set({
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(onboarding_progress.user_id, userId))
        .returning();
      return toDomainOnboardingProgress(final);
    }

    return toDomainOnboardingProgress(updated);
  }
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/database-service/repositories/onboardingProgress.repo.ts
git commit -m "feat: add findAllWithUsers to OnboardingProgressRepository"
```

---

### Task 3: API route /api/modules

**Files:**
- Create: `apps/leaderboard-client/src/app/api/modules/route.ts`

**Interfaces:**
- Consumes: `AppSettingsRepository` from `@packages/database-service/repositories`
- Consumes: `fetchContributorSession` from `@/lib/contributor`
- Produces: `GET /api/modules` → `{ meetings_enabled: boolean, onboarding_enabled: boolean }`
- Produces: `PATCH /api/modules` body `{ meetings_enabled?: boolean, onboarding_enabled?: boolean }` → same shape

- [ ] **Step 1: Create the route**

```typescript
// apps/leaderboard-client/src/app/api/modules/route.ts
import { NextResponse } from "next/server";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

const appSettingsRepo = new AppSettingsRepository();

export async function GET() {
  const settings = await appSettingsRepo.get();
  return NextResponse.json({
    meetings_enabled: settings.modules_meetings_enabled,
    onboarding_enabled: settings.modules_onboarding_enabled,
  });
}

export async function PATCH(request: Request) {
  const session = await fetchContributorSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const patch: { modules_meetings_enabled?: boolean; modules_onboarding_enabled?: boolean } = {};

  if (typeof body.meetings_enabled === "boolean") {
    patch.modules_meetings_enabled = body.meetings_enabled;
  }
  if (typeof body.onboarding_enabled === "boolean") {
    patch.modules_onboarding_enabled = body.onboarding_enabled;
  }

  const updated = await appSettingsRepo.update(patch, session.id);
  return NextResponse.json({
    meetings_enabled: updated.modules_meetings_enabled,
    onboarding_enabled: updated.modules_onboarding_enabled,
  });
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/app/api/modules/route.ts
git commit -m "feat: add GET/PATCH /api/modules route"
```

---

### Task 4: API route /api/onboarding/all

**Files:**
- Create: `apps/leaderboard-client/src/app/api/onboarding/all/route.ts`

**Interfaces:**
- Consumes: `OnboardingProgressRepository.findAllWithUsers()` from `@packages/database-service/repositories`
- Consumes: `fetchContributorSession` from `@/lib/contributor`
- Produces: `GET /api/onboarding/all` → `OnboardingProgressWithUser[]`

- [ ] **Step 1: Create the route**

```typescript
// apps/leaderboard-client/src/app/api/onboarding/all/route.ts
import { NextResponse } from "next/server";
import { OnboardingProgressRepository } from "@packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";

const onboardingRepo = new OnboardingProgressRepository();

export async function GET() {
  const session = await fetchContributorSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await onboardingRepo.findAllWithUsers();
  return NextResponse.json(all);
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/app/api/onboarding/all/route.ts
git commit -m "feat: add GET /api/onboarding/all admin route"
```

---

### Task 5: ModulesSettings component

**Files:**
- Create: `apps/leaderboard-client/src/components/contributor/ModulesSettings.tsx`

**Interfaces:**
- Consumes: `GET /api/modules`, `PATCH /api/modules`
- Produces: `<ModulesSettings meetingsEnabled={boolean} onboardingEnabled={boolean} />`

- [ ] **Step 1: Create the component**

```typescript
// apps/leaderboard-client/src/components/contributor/ModulesSettings.tsx
"use client";

import { useState } from "react";
import { Video, Compass } from "lucide-react";

interface Props {
  meetingsEnabled: boolean;
  onboardingEnabled: boolean;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40 ${
        enabled ? "bg-brandCP/80" : "bg-white/15"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function ModulesSettings({ meetingsEnabled: initialMeetings, onboardingEnabled: initialOnboarding }: Props) {
  const [meetingsEnabled, setMeetingsEnabled] = useState(initialMeetings);
  const [onboardingEnabled, setOnboardingEnabled] = useState(initialOnboarding);
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (key: "meetings_enabled" | "onboarding_enabled", value: boolean) => {
    setSaving(key);
    if (key === "meetings_enabled") setMeetingsEnabled(value);
    else setOnboardingEnabled(value);

    try {
      await fetch("/api/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      // revert on error
      if (key === "meetings_enabled") setMeetingsEnabled(!value);
      else setOnboardingEnabled(!value);
    } finally {
      setSaving(null);
    }
  };

  const modules = [
    {
      key: "meetings_enabled" as const,
      label: "Meetings",
      description: "Show the meetings sidebar in challenge views for contributors",
      icon: <Video className="h-4 w-4 text-white/50" />,
      enabled: meetingsEnabled,
    },
    {
      key: "onboarding_enabled" as const,
      label: "Onboarding",
      description: "Show the onboarding quest drawer for contributors",
      icon: <Compass className="h-4 w-4 text-white/50" />,
      enabled: onboardingEnabled,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
        Modules
      </h2>
      {modules.map((mod) => (
        <div
          key={mod.key}
          className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            {mod.icon}
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{mod.label}</p>
              <p className="text-xs text-white/35 mt-0.5">{mod.description}</p>
            </div>
          </div>
          <div className={`shrink-0 transition-opacity ${saving === mod.key ? "opacity-50" : ""}`}>
            <Toggle enabled={mod.enabled} onChange={(v) => toggle(mod.key, v)} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/contributor/ModulesSettings.tsx
git commit -m "feat: add ModulesSettings toggle component"
```

---

### Task 6: OnboardingProgressTable component

**Files:**
- Create: `apps/leaderboard-client/src/components/contributor/OnboardingProgressTable.tsx`

**Interfaces:**
- Consumes: `OnboardingProgressWithUser` from `@packages/database-service/domain/entities`
- Produces: `<OnboardingProgressTable rows={OnboardingProgressWithUser[]} />`

- [ ] **Step 1: Create the component**

```typescript
// apps/leaderboard-client/src/components/contributor/OnboardingProgressTable.tsx
import { Check, X } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import type { OnboardingProgressWithUser } from "@packages/database-service/domain/entities";

const QUESTS: { key: keyof Pick<OnboardingProgressWithUser, 'clicked_challenge' | 'assigned_task' | 'evaluated_contribution' | 'validated_task' | 'joined_meeting'>; label: string }[] = [
  { key: "clicked_challenge",       label: "Explore" },
  { key: "assigned_task",           label: "Assign" },
  { key: "evaluated_contribution",  label: "Evaluate" },
  { key: "validated_task",          label: "Validate" },
  { key: "joined_meeting",          label: "Meeting" },
];

interface Props {
  rows: OnboardingProgressWithUser[];
}

export function OnboardingProgressTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-white/30 py-8 text-center">No contributors yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8">
            <th className="pb-2 text-left text-xs font-semibold uppercase tracking-widest text-white/30 pr-4">
              Contributor
            </th>
            {QUESTS.map((q) => (
              <th key={q.key} className="pb-2 text-center text-xs font-semibold uppercase tracking-widest text-white/30 px-2">
                {q.label}
              </th>
            ))}
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-widest text-white/30 pl-4">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const completedCount = QUESTS.filter((q) => row[q.key]).length;
            const isDone = !!row.completed_at;
            return (
              <tr
                key={row.user_id}
                className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${isDone ? "opacity-60" : ""}`}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={row.full_name} size={28} avatarUrl={row.avatar_url ?? undefined} />
                    <span className="text-sm text-white/80 truncate max-w-[140px]">{row.full_name}</span>
                  </div>
                </td>
                {QUESTS.map((q) => (
                  <td key={q.key} className="py-3 px-2 text-center">
                    {row[q.key] ? (
                      <Check className="h-3.5 w-3.5 text-brandCP mx-auto" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-white/20 mx-auto" />
                    )}
                  </td>
                ))}
                <td className="py-3 pl-4 text-right">
                  {isDone ? (
                    <span className="inline-flex items-center rounded-full bg-brandCP/10 px-2 py-0.5 text-[11px] font-medium text-brandCP">
                      Done
                    </span>
                  ) : (
                    <span className="text-xs text-white/30">{completedCount}/5</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Check InitialsAvatar signature**

`InitialsAvatar` is at `apps/leaderboard-client/src/components/ui/InitialsAvatar.tsx`. Verify it accepts `{ name, size, avatarUrl? }`. If the prop name differs, adjust the call accordingly.

- [ ] **Step 3: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/components/contributor/OnboardingProgressTable.tsx
git commit -m "feat: add OnboardingProgressTable component"
```

---

### Task 7: Add Modules + Onboarding tabs to contributor/me

**Files:**
- Modify: `apps/leaderboard-client/src/app/contributors/me/page.tsx`

**Interfaces:**
- Consumes: `ModulesSettings` from `@/components/contributor/ModulesSettings`
- Consumes: `OnboardingProgressTable` from `@/components/contributor/OnboardingProgressTable`
- Consumes: `OnboardingProgressRepository` from `@packages/database-service/repositories`

- [ ] **Step 1: Update the page**

In `apps/leaderboard-client/src/app/contributors/me/page.tsx`:

1. Add imports at the top:
```typescript
import { ModulesSettings } from "@/components/contributor/ModulesSettings";
import { OnboardingProgressTable } from "@/components/contributor/OnboardingProgressTable";
import { OnboardingProgressRepository } from "@packages/database-service/repositories";
```

2. Add repository instantiation near the top (after `appSettingsRepo`):
```typescript
const onboardingProgressRepo = new OnboardingProgressRepository();
```

3. Replace the admin-only block (lines 81–113) with this expanded version:
```typescript
if (session.role === "admin") {
  const [settings, onboardingRows] = await Promise.all([
    appSettingsRepo.get(),
    onboardingProgressRepo.findAllWithUsers(),
  ]);
  const themeKey = isValidThemeKey(settings.theme_key) ? settings.theme_key : DEFAULT_THEME_KEY;
  tabs.push({
    label: "Appearance",
    panel: (
      <div className="mx-auto max-w-lg py-2">
        <ThemeSettings
          currentTheme={themeKey}
          currentPrimaryColor={settings.primary_color ?? null}
          currentBackgroundColor={settings.background_color ?? null}
          currentThemeMode={settings.theme_mode}
        />
      </div>
    ),
  });
  tabs.push({
    label: "Integrations",
    panel: (
      <div className="mx-auto max-w-lg py-2 space-y-8">
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
            Integrations
          </h2>
          <div className="space-y-3">
            <GitHubConnectionCard initialError={githubError} />
            <KaggleConnectionCard />
          </div>
        </div>
      </div>
    ),
  });
  tabs.push({
    label: "Modules",
    panel: (
      <div className="mx-auto max-w-lg py-2">
        <ModulesSettings
          meetingsEnabled={settings.modules_meetings_enabled}
          onboardingEnabled={settings.modules_onboarding_enabled}
        />
      </div>
    ),
  });
  tabs.push({
    label: "Onboarding",
    panel: (
      <div className="mx-auto max-w-2xl py-2">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
          Onboarding Progress
        </h2>
        <OnboardingProgressTable rows={onboardingRows} />
      </div>
    ),
  });
}
```

Note: the existing block fetches `settings` for Appearance. The new code fetches it once with `Promise.all` alongside `onboardingRows`. Remove the old `const settings = await appSettingsRepo.get()` that was inside the if block.

- [ ] **Step 2: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/app/contributors/me/page.tsx
git commit -m "feat: add Modules and Onboarding admin tabs to contributor/me"
```

---

### Task 8: Gate OnboardingDrawer in layout

**Files:**
- Modify: `apps/leaderboard-client/src/app/layout.tsx`

**Interfaces:**
- Consumes: `AppSettings.modules_onboarding_enabled` (already read via `appSettingsRepo.get()`)

- [ ] **Step 1: Update the layout condition**

In `apps/leaderboard-client/src/app/layout.tsx`, find line 75:
```typescript
{session && onboarding && !onboarding.completed_at && (
  <OnboardingDrawer initialProgress={onboarding} />
)}
```

Replace with:
```typescript
{session && onboarding && !onboarding.completed_at && settings.modules_onboarding_enabled && (
  <OnboardingDrawer initialProgress={onboarding} />
)}
```

- [ ] **Step 2: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/app/layout.tsx
git commit -m "feat: gate OnboardingDrawer on modules_onboarding_enabled flag"
```

---

### Task 9: Gate meetings sidebar in challenge page

**Files:**
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/modules` → `{ meetings_enabled: boolean, onboarding_enabled: boolean }`

- [ ] **Step 1: Add state + fetch**

In `ChallengeDetailPage`, add state after existing state declarations:
```typescript
const [meetingsEnabled, setMeetingsEnabled] = useState(true);
```

Add fetch function before `fetchAll`:
```typescript
const fetchModules = async () => {
  const res = await fetch('/api/modules');
  if (res.ok) {
    const data = await res.json();
    setMeetingsEnabled(data.meetings_enabled !== false);
  }
};
```

In `fetchAll`, add `fetchModules()` to the `Promise.all`:
```typescript
await Promise.all([fetchChallenge(), fetchTeam(), fetchTasks(), fetchMeetings(), fetchRepos(), fetchRepoActivity(), fetchModules()]);
```

- [ ] **Step 2: Pass flag to tabs and update tab rendering**

In the `ContributorTabs` call, pass `meetingsEnabled` to both tab panels.

For ML tabs:
```typescript
<ContributorTabs tabs={isML ? [
  {
    label: 'Submission',
    panel: <TabMLSubmission challengeId={challengeId} meetings={meetings} upcomingMeetings={upcomingMeetings} pastMeetings={pastMeetings} router={router} meetingsEnabled={meetingsEnabled} />,
  },
  // ...
```

For code tabs:
```typescript
{
  label: 'Tasks',
  panel: (
    <TabTasks
      // ... existing props ...
      meetingsEnabled={meetingsEnabled}
    />
  ),
},
```

- [ ] **Step 3: Update TabTasks signature and rendering**

Update `TabTasks` props interface to add `meetingsEnabled: boolean`.

Change the grid and sidebar rendering:
```typescript
function TabTasks({
  tasks, parentTasks, doneTasks, completion,
  meetings, upcomingMeetings, pastMeetings,
  assigningTaskId, onAssign, router, meetingsEnabled,
}: {
  // ... existing types ...
  meetingsEnabled: boolean;
}) {
  return (
    <div className={meetingsEnabled ? "grid gap-8 lg:grid-cols-[300px_1fr]" : "space-y-4"}>
      {meetingsEnabled && (
        <div className="min-w-0">
          <MeetingsSidebar meetings={meetings} upcomingMeetings={upcomingMeetings} pastMeetings={pastMeetings} router={router} />
        </div>
      )}

      {/* Tasks — existing JSX unchanged */}
      <div className="min-w-0 space-y-3">
        {/* ... all existing task content ... */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update TabMLSubmission signature and rendering**

Update `TabMLSubmission` props interface to add `meetingsEnabled: boolean`.

Change the grid and sidebar:
```typescript
function TabMLSubmission({
  challengeId, meetings, upcomingMeetings, pastMeetings, router, meetingsEnabled,
}: {
  // ... existing types ...
  meetingsEnabled: boolean;
}) {
  return (
    <div className={meetingsEnabled ? "grid gap-8 lg:grid-cols-[300px_1fr]" : "space-y-4"}>
      {meetingsEnabled && (
        <div className="min-w-0">
          <MeetingsSidebar meetings={meetings} upcomingMeetings={upcomingMeetings} pastMeetings={pastMeetings} router={router} />
        </div>
      )}
      <div className="min-w-0 space-y-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <BrainCircuit className="h-3.5 w-3.5 text-primary-100/35" />
          ML Submission
        </h2>
        <MLChallengeFlow challengeId={challengeId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/leaderboard-client/src/app/challenges/[id]/page.tsx
git commit -m "feat: gate meetings sidebar on modules_meetings_enabled flag"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full type check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Manual test — Modules tab**

1. Log in as admin, go to `/contributors/me`
2. Verify "Modules" tab appears between "Integrations" and "Onboarding"
3. Toggle Meetings off → PATCH `/api/modules` fires, toggle shows off state
4. Navigate to any challenge → meetings sidebar should be gone, tasks take full width
5. Toggle Meetings back on → sidebar reappears
6. Toggle Onboarding off → `/contributors/me` page reload shows no OnboardingDrawer for non-admin
7. Toggle Onboarding back on → drawer reappears

- [ ] **Step 3: Manual test — Onboarding tab**

1. Go to "Onboarding" tab in contributor/me
2. Verify table shows contributors (non-admin users) with 5 quest columns
3. Verify "Done" badge for completed users, "x/5" for partial

- [ ] **Step 4: Verify admin is never affected**

Navigate to `/admin/meetings` → meetings list still shows regardless of meetings flag.
