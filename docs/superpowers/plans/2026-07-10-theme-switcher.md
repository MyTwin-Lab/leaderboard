# Theme Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin contributors to pick a predefined app-wide theme (primary color + background) from a new "Appearance" tab in their profile page, persisted in DB and applied globally via SSR CSS variable injection.

**Architecture:** A singleton `app_settings` row in Postgres stores the active `theme_key`. The root `layout.tsx` (already a Server Component) reads it on every request and injects a `<style>` block overriding `:root` CSS variables — no caching, no client state, no WebSockets needed. The admin sees the Appearance tab only if `session.role === "admin"`; clicking a palette calls `PATCH /api/admin/theme` then `router.refresh()` which triggers a full SSR re-render for the current user, and all other users see it on their next navigation.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + PostgreSQL, Tailwind CSS v4 (CSS custom properties), Zod, TypeScript

## Global Constraints

- Follow existing Drizzle schema conventions in `packages/database-service/db/drizzle.ts`
- Follow existing repo class pattern: class with methods, import `db` and table from drizzle, use mapper for domain conversion
- API routes: instantiate repo at module level, use Zod for body validation, return `NextResponse.json`
- Client components: `"use client"` directive, `useRouter` from `next/navigation` for refresh
- No new npm packages — use only what's already installed
- Theme keys: `"default" | "purple-dark" | "green-dark" | "orange-dark" | "red-dark" | "teal-dark"`
- All file paths are relative to the monorepo root: `C:\Users\alixc\Desktop\LEADER\leaderboard_new\leaderboard`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/database-service/db/drizzle.ts` | Add `app_settings` table (singleton, id=1) |
| Modify | `packages/database-service/domain/entities.ts` | Add `AppSettings` interface |
| Modify | `packages/database-service/db/mappers.ts` | Add `toDomainAppSettings` mapper |
| Create | `packages/database-service/repositories/appSettings.repo.ts` | `AppSettingsRepository` with `get()` and `setTheme()` |
| Modify | `packages/database-service/repositories/index.ts` | Export `AppSettingsRepository` |
| Create | `apps/leaderboard-client/src/lib/themes.ts` | `THEMES` constant + `ThemeKey` type |
| Modify | `apps/leaderboard-client/src/app/layout.tsx` | Read active theme from DB, inject `<style>:root{...}</style>` |
| Create | `apps/leaderboard-client/src/app/api/admin/theme/route.ts` | `PATCH` — admin-only, updates DB theme_key |
| Create | `apps/leaderboard-client/src/components/contributor/ThemeSettings.tsx` | Grid of palette swatches, calls PATCH + router.refresh() |
| Modify | `apps/leaderboard-client/src/app/contributors/me/page.tsx` | Add "Appearance" tab conditionally for admins |

---

### Task 1: DB Layer — `app_settings` table + entity + mapper + repo

**Files:**
- Modify: `packages/database-service/db/drizzle.ts`
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/db/mappers.ts`
- Create: `packages/database-service/repositories/appSettings.repo.ts`
- Modify: `packages/database-service/repositories/index.ts`

**Interfaces:**
- Produces: `AppSettingsRepository` class with `get(): Promise<AppSettings>` and `setTheme(key: string): Promise<AppSettings>`
- Produces: `AppSettings` entity `{ theme_key: string }`

---

- [ ] **Step 1: Add `app_settings` table to drizzle.ts**

In `packages/database-service/db/drizzle.ts`, add the table definition after the `onboarding_progress` table (around line 409), and add it to the `db` schema object at the bottom:

```ts
// --- APP SETTINGS (singleton) ---
export const app_settings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  theme_key: varchar("theme_key", { length: 64 }).notNull().default("default"),
  updated_at: timestamp("updated_at").defaultNow(),
  updated_by: uuid("updated_by").references(() => users.uuid),
});
```

Also add `integer` to the existing import at line 3 if not already present:
```ts
import { pgTable, text, varchar, timestamp, uuid, integer, json, date, serial, real, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
```
(`integer` is already imported — no change needed there.)

Then add `app_settings` to the `db` schema object at the bottom of the file (inside the `drizzle(pool, { schema: { ... } })` call):
```ts
app_settings,
```

- [ ] **Step 2: Add `AppSettings` entity**

In `packages/database-service/domain/entities.ts`, append at the end:

```ts
// --- APP SETTINGS ---
export interface AppSettings {
  theme_key: string;
  updated_at?: Date;
}
```

- [ ] **Step 3: Add mapper**

In `packages/database-service/db/mappers.ts`, add `app_settings` to the existing import from `./drizzle.js`, then add `AppSettings` to the import from `../domain/entities`, then append the mapper function at the end of the file:

Add to the drizzle import list: `app_settings`
Add to the entities import list: `AppSettings`

Append at the end of the file:
```ts
export function toDomainAppSettings(row: InferSelectModel<typeof app_settings>): AppSettings {
  return {
    theme_key: row.theme_key,
    updated_at: row.updated_at ?? undefined,
  };
}
```

- [ ] **Step 4: Create `AppSettingsRepository`**

Create `packages/database-service/repositories/appSettings.repo.ts`:

```ts
import { db, app_settings } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainAppSettings } from "../db/mappers";
import type { AppSettings } from "../domain/entities";

export class AppSettingsRepository {
  async get(): Promise<AppSettings> {
    const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
    if (row) return toDomainAppSettings(row);
    // Auto-initialize singleton if missing
    const [inserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default" })
      .returning();
    return toDomainAppSettings(inserted);
  }

  async setTheme(theme_key: string, updated_by?: string): Promise<AppSettings> {
    const [upserted] = await db
      .insert(app_settings)
      .values({ id: 1, theme_key, updated_by: updated_by ?? null, updated_at: new Date() })
      .onConflictDoUpdate({
        target: app_settings.id,
        set: { theme_key, updated_by: updated_by ?? null, updated_at: new Date() },
      })
      .returning();
    return toDomainAppSettings(upserted);
  }
}
```

- [ ] **Step 5: Export from index**

In `packages/database-service/repositories/index.ts`, append:

```ts
export { AppSettingsRepository } from "./appSettings.repo.js";
```

- [ ] **Step 6: Run DB migration**

```bash
cd C:\Users\alixc\Desktop\LEADER\leaderboard_new\leaderboard
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: A new migration file is generated in `./drizzle/` and applied. The `app_settings` table now exists in the database.

- [ ] **Step 7: Verify DB layer manually**

Start a Node REPL or a quick test script to confirm the repo works:

```bash
cd C:\Users\alixc\Desktop\LEADER\leaderboard_new\leaderboard
node -e "
  require('dotenv/config');
  const { AppSettingsRepository } = require('./packages/database-service/repositories/index.js');
  const repo = new AppSettingsRepository();
  repo.get().then(s => { console.log('get:', s); return repo.setTheme('purple-dark'); })
    .then(s => console.log('setTheme:', s))
    .catch(console.error);
"
```

Expected output:
```
get: { theme_key: 'default', updated_at: ... }
setTheme: { theme_key: 'purple-dark', updated_at: ... }
```

- [ ] **Step 8: Commit**

```bash
git add packages/database-service/
git commit -m "feat: add app_settings table, entity, mapper, and repo for global theme"
```

---

### Task 2: Theme definitions constant

**Files:**
- Create: `apps/leaderboard-client/src/lib/themes.ts`

**Interfaces:**
- Produces: `ThemeKey` type (union string literal)
- Produces: `THEMES` map: `Record<ThemeKey, { label, primary100, primary200, primary300, brandCP, background, backgroundDark }>`
- Produces: `DEFAULT_THEME_KEY = "default"` constant

---

- [ ] **Step 1: Create `themes.ts`**

Create `apps/leaderboard-client/src/lib/themes.ts`:

```ts
export type ThemeKey =
  | "default"
  | "purple-dark"
  | "green-dark"
  | "orange-dark"
  | "red-dark"
  | "teal-dark";

export interface ThemeTokens {
  label: string;
  primary100: string;
  primary200: string;
  primary300: string;
  brandCP: string;
  background: string;
  backgroundDark: string;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  "default": {
    label: "Blue",
    primary100: "#8ad0ff",
    primary200: "#52c1ff",
    primary300: "#1ba5ff",
    brandCP: "#0af7c1",
    background: "#0a0a0a",
    backgroundDark: "#030208",
  },
  "purple-dark": {
    label: "Purple",
    primary100: "#d8b4fe",
    primary200: "#c084fc",
    primary300: "#a855f7",
    brandCP: "#f472b6",
    background: "#09060f",
    backgroundDark: "#04020a",
  },
  "green-dark": {
    label: "Green",
    primary100: "#86efac",
    primary200: "#4ade80",
    primary300: "#22c55e",
    brandCP: "#84cc16",
    background: "#060a06",
    backgroundDark: "#020502",
  },
  "orange-dark": {
    label: "Orange",
    primary100: "#fdba74",
    primary200: "#fb923c",
    primary300: "#f97316",
    brandCP: "#fbbf24",
    background: "#0a0700",
    backgroundDark: "#050300",
  },
  "red-dark": {
    label: "Red",
    primary100: "#fca5a5",
    primary200: "#f87171",
    primary300: "#ef4444",
    brandCP: "#fb7185",
    background: "#0a0606",
    backgroundDark: "#050202",
  },
  "teal-dark": {
    label: "Teal",
    primary100: "#99f6e4",
    primary200: "#5eead4",
    primary300: "#14b8a6",
    brandCP: "#22d3ee",
    background: "#040a0a",
    backgroundDark: "#010505",
  },
};

export const DEFAULT_THEME_KEY: ThemeKey = "default";

export function isValidThemeKey(key: string): key is ThemeKey {
  return key in THEMES;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/leaderboard-client
npx tsc --noEmit --project tsconfig.json 2>&1 | grep themes
```

Expected: no errors for `themes.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/lib/themes.ts
git commit -m "feat: add predefined theme palette constants"
```

---

### Task 3: Root layout — SSR theme injection

**Files:**
- Modify: `apps/leaderboard-client/src/app/layout.tsx`

**Interfaces:**
- Consumes: `AppSettingsRepository` with `get(): Promise<AppSettings>`
- Consumes: `THEMES`, `DEFAULT_THEME_KEY`, `isValidThemeKey` from `@/lib/themes`
- Produces: `<style>` tag in `<head>` overriding CSS custom properties for the active theme

---

- [ ] **Step 1: Modify `layout.tsx` to inject theme**

The current `layout.tsx` is already `async` and a Server Component. Add the theme fetch and style injection.

Replace the full file content of `apps/leaderboard-client/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GradientBackground } from "@/components/layout/GradientBackground";
import { Navbar } from "@/components/layout/Navbar";
import { OnboardingDrawer } from "@/components/onboarding/OnboardingDrawer";
import { fetchContributorSession } from "@/lib/contributor";
import { fetchOnboardingProgress } from "@/lib/server/onboarding";
import { AppSettingsRepository } from "../../../../packages/database-service/repositories";
import { THEMES, DEFAULT_THEME_KEY, isValidThemeKey } from "@/lib/themes";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyTwin Leaderboard",
  description: "Visualisez le classement des contributeurs du Lab",
};

const appSettingsRepo = new AppSettingsRepository();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, settings] = await Promise.all([
    fetchContributorSession(),
    appSettingsRepo.get(),
  ]);
  const onboarding = session ? await fetchOnboardingProgress(session.id) : null;

  const themeKey = isValidThemeKey(settings.theme_key) ? settings.theme_key : DEFAULT_THEME_KEY;
  const theme = THEMES[themeKey];

  const themeStyle = `
    :root {
      --color-primary-100: ${theme.primary100};
      --color-primary-200: ${theme.primary200};
      --color-primary-300: ${theme.primary300};
      --color-brandCP: ${theme.brandCP};
      --background: ${theme.background};
      --background-dark: ${theme.backgroundDark};
    }
  `;

  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GradientBackground>
          <Navbar session={session} />
          <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24">
            {children}
          </main>
          {session && onboarding && !onboarding.completed_at && (
            <OnboardingDrawer initialProgress={onboarding} />
          )}
        </GradientBackground>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/leaderboard-client
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Start dev server and visually verify**

```bash
cd C:\Users\alixc\Desktop\LEADER\leaderboard_new\leaderboard
npm run dev
```

Open the app in browser. Manually set `theme_key = 'purple-dark'` directly in the DB:
```sql
INSERT INTO app_settings (id, theme_key) VALUES (1, 'purple-dark')
ON CONFLICT (id) DO UPDATE SET theme_key = 'purple-dark';
```

Reload the page. Expected: the entire UI switches to purple primary colors. Revert to `default` after testing.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/layout.tsx
git commit -m "feat: inject active theme CSS variables in root layout via SSR"
```

---

### Task 4: PATCH `/api/admin/theme` route

**Files:**
- Create: `apps/leaderboard-client/src/app/api/admin/theme/route.ts`

**Interfaces:**
- Consumes: `AppSettingsRepository.setTheme(key: string, userId?: string): Promise<AppSettings>`
- Consumes: `fetchContributorSession()` from `@/lib/contributor`
- Consumes: `isValidThemeKey(key: string): key is ThemeKey` from `@/lib/themes`
- Request body: `{ theme_key: string }`
- Response 200: `{ theme_key: string }`
- Response 401: `{ error: "Unauthorized" }`
- Response 403: `{ error: "Forbidden" }`
- Response 400: `{ error: "Invalid theme_key" }`

---

- [ ] **Step 1: Create the route**

Create `apps/leaderboard-client/src/app/api/admin/theme/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { AppSettingsRepository } from "../../../../../../packages/database-service/repositories";
import { fetchContributorSession } from "@/lib/contributor";
import { isValidThemeKey } from "@/lib/themes";

const appSettingsRepo = new AppSettingsRepository();

export async function PATCH(request: NextRequest) {
  const session = await fetchContributorSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { theme_key } = body;

  if (typeof theme_key !== "string" || !isValidThemeKey(theme_key)) {
    return NextResponse.json({ error: "Invalid theme_key" }, { status: 400 });
  }

  const settings = await appSettingsRepo.setTheme(theme_key, session.id);
  return NextResponse.json({ theme_key: settings.theme_key });
}
```

- [ ] **Step 2: Test with curl**

Start the dev server, then:

```bash
# Should return 401 (not authenticated in curl)
curl -X PATCH http://localhost:3000/api/admin/theme \
  -H "Content-Type: application/json" \
  -d '{"theme_key":"purple-dark"}'
```

Expected: `{"error":"Unauthorized"}`

```bash
# Test invalid key (after logging in as admin and using real cookie)
curl -X PATCH http://localhost:3000/api/admin/theme \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"theme_key":"nonexistent"}'
```

Expected: `{"error":"Invalid theme_key"}`

```bash
# Test valid key as admin
curl -X PATCH http://localhost:3000/api/admin/theme \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"theme_key":"purple-dark"}'
```

Expected: `{"theme_key":"purple-dark"}`

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/app/api/admin/theme/
git commit -m "feat: add PATCH /api/admin/theme route (admin only)"
```

---

### Task 5: `ThemeSettings` client component

**Files:**
- Create: `apps/leaderboard-client/src/components/contributor/ThemeSettings.tsx`

**Interfaces:**
- Consumes: `THEMES`, `ThemeKey` from `@/lib/themes`
- Props: `{ currentTheme: ThemeKey }`
- Calls: `PATCH /api/admin/theme { theme_key }` then `router.refresh()`

---

- [ ] **Step 1: Create `ThemeSettings.tsx`**

Create `apps/leaderboard-client/src/components/contributor/ThemeSettings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Palette } from "lucide-react";
import { THEMES, type ThemeKey } from "@/lib/themes";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ThemeSettings({ currentTheme }: { currentTheme: ThemeKey }) {
  const router = useRouter();
  const [active, setActive] = useState<ThemeKey>(currentTheme);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const applyTheme = async (key: ThemeKey) => {
    if (key === active || status === "saving") return;
    setActive(key);
    setStatus("saving");

    const res = await fetch("/api/admin/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme_key: key }),
    });

    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2500);
    } else {
      setActive(currentTheme); // revert optimistic update
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div className="animate-fade-up space-y-8 py-2">

      {/* Header */}
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Palette className="h-3.5 w-3.5" />
          App Theme
        </h2>
        <p className="text-xs text-white/25">
          Changes apply immediately for all users.
        </p>
      </div>

      {/* Palette grid */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, tokens]) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => applyTheme(key)}
              disabled={status === "saving"}
              className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 focus-visible:outline-none disabled:opacity-50 ${
                isActive
                  ? "border-white/30 bg-white/[0.07]"
                  : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              {/* Swatch */}
              <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                {/* Background color */}
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: tokens.background }}
                />
                {/* Primary color arc */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-5 rounded-t-full"
                  style={{ backgroundColor: tokens.primary300 }}
                />
                {/* Accent dot */}
                <div
                  className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tokens.brandCP }}
                />
              </div>

              {/* Label */}
              <span className={`text-[10px] font-medium ${isActive ? "text-white" : "text-white/40 group-hover:text-white/60"}`}>
                {tokens.label}
              </span>

              {/* Active checkmark */}
              {isActive && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-white/80" />
              )}
            </button>
          );
        })}
      </div>

      {/* Status */}
      <div className="flex items-center justify-end h-5">
        {status === "saving" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-white/35">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Applying…
          </span>
        )}
        {status === "saved" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Theme applied
          </span>
        )}
        {status === "error" && (
          <span className="animate-slide-in flex items-center gap-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed to apply
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/leaderboard-client
npx tsc --noEmit --project tsconfig.json 2>&1 | grep ThemeSettings
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/contributor/ThemeSettings.tsx
git commit -m "feat: add ThemeSettings palette picker component"
```

---

### Task 6: Wire Appearance tab into `me/page.tsx`

**Files:**
- Modify: `apps/leaderboard-client/src/app/contributors/me/page.tsx`

**Interfaces:**
- Consumes: `ThemeSettings` from `@/components/contributor/ThemeSettings`
- Consumes: `AppSettingsRepository.get(): Promise<AppSettings>`
- Consumes: `isValidThemeKey`, `DEFAULT_THEME_KEY` from `@/lib/themes`
- The tab is appended only when `session.role === "admin"`

---

- [ ] **Step 1: Update `me/page.tsx`**

Replace the full file content of `apps/leaderboard-client/src/app/contributors/me/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { ContributionHeatmap } from "@/components/contributor/ContributionHeatmap";
import { ContributionDashboard } from "@/components/contributor/ContributionDashboard";
import { ContributorTabs } from "@/components/contributor/ContributorTabs";
import { MyTasks } from "@/components/contributor/MyTasks";
import { ThemeSettings } from "@/components/contributor/ThemeSettings";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";
import { LogoutButton } from "@/components/contributor/LogoutButton";
import { AdminButton } from "@/components/contributor/AdminButton";
import { ProfileEditForm } from "@/components/contributor/ProfileEditForm";
import { AppSettingsRepository } from "../../../../../packages/database-service/repositories";
import { isValidThemeKey, DEFAULT_THEME_KEY } from "@/lib/themes";

const appSettingsRepo = new AppSettingsRepository();

export default async function ContributorSelfPage() {
  const session = await fetchContributorSession();

  if (!session) {
    redirect("/api/google-auth/authorize?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id);

  if (!profile) {
    redirect("/");
  }

  const [firstName, ...lastNameParts] = session.fullName.split(" ");
  const lastName = lastNameParts.join(" ");

  const tabs = [
    {
      label: "Overview",
      panel: (
        <div className="space-y-4 sm:space-y-6">
          <ContributionHeatmap challenges={profile.challenges} />
          <ContributionDashboard challenges={profile.challenges} />
        </div>
      ),
    },
    {
      label: "My Tasks",
      panel: <MyTasks />,
    },
    {
      label: "Contributions",
      panel: <ChallengeList challenges={profile.challenges} />,
    },
    {
      label: "Profile",
      panel: (
        <div className="mx-auto max-w-sm py-2">
          <ProfileEditForm
            initialValues={{
              firstName,
              lastName,
              githubUsername: session.githubUsername,
            }}
          />
        </div>
      ),
    },
  ];

  if (session.role === "admin") {
    const settings = await appSettingsRepo.get();
    const themeKey = isValidThemeKey(settings.theme_key) ? settings.theme_key : DEFAULT_THEME_KEY;
    tabs.push({
      label: "Appearance",
      panel: (
        <div className="mx-auto max-w-lg py-2">
          <ThemeSettings currentTheme={themeKey} />
        </div>
      ),
    });
  }

  return (
    <div className="mx-auto mt-4 max-w-4xl px-4 sm:mt-6">
      <div className="flex items-start justify-between mb-6">
        <ContributorHeader
          displayName={profile.displayName}
          githubUsername={profile.githubUsername}
          totalCP={profile.totalCP}
        />
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {session.role === "admin" && <AdminButton />}
          <LogoutButton />
        </div>
      </div>

      <ContributorTabs tabs={tabs} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/leaderboard-client
npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Full end-to-end manual test**

1. Start dev server: `npm run dev` from repo root
2. Log in as an admin user
3. Navigate to `/contributors/me`
4. Verify "Appearance" tab appears as the last tab to the right
5. Click "Purple" palette → verify the entire UI switches to purple immediately
6. Reload page → verify purple theme persists
7. Open an incognito window to any page → verify it also shows purple theme
8. Switch back to "Blue" (default) from the Appearance tab → verify all users see blue again
9. Log in as a non-admin user → verify "Appearance" tab does NOT appear

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/contributors/me/page.tsx
git commit -m "feat: add Appearance tab to admin contributor profile for global theme switching"
```
