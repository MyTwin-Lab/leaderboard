# Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the full leaderboard from `/` to `/leaderboard` and create a new homepage combining an about snippet, a top-5 leaderboard preview, and 2–3 trending challenges.

**Architecture:** New `/leaderboard` route is an exact copy of the current `/` page. The new homepage is a Server Component that fetches data via two calls (`fetchLeaderboard` + `fetchTrendingChallenges`), then renders three sections using two new lightweight preview components. No existing components are modified.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Vitest

## Global Constraints

- All colors use CSS variable tokens: `bg-background`, `text-brandCP`, `bg-white/[x]`, `border-white/[x]` — never hardcoded hex
- Light mode compatibility: `text-white` classes are automatically inverted by `globals.css` when `data-mode="light"` is on `<html>` — do not add light-mode-specific overrides
- `animate-fade-up` class is defined in `globals.css` — use for list items with stagger via `style={{ animationDelay }}`
- `animate-shimmer` class is defined in `globals.css` — use for rank-1 CP badge shimmer
- Test runner: `cd apps/leaderboard-client && npx vitest run <path>`
- Type checker: `cd apps/leaderboard-client && npx tsc --noEmit`

---

### Task 1: Create `/leaderboard` route and update navbar

**Files:**
- Create: `apps/leaderboard-client/src/app/leaderboard/page.tsx`
- Modify: `apps/leaderboard-client/src/components/layout/Navbar.tsx:44-48`

**Interfaces:**
- Produces: `/leaderboard` route serving the same full leaderboard as the current `/`

- [ ] **Step 1: Create the leaderboard page**

Create `apps/leaderboard-client/src/app/leaderboard/page.tsx` with this exact content:

```tsx
import { LeaderboardLayout } from "@/components/leaderboard/LeaderboardLayout";
import { fetchLeaderboard } from "@/lib/server/leaderboard";

export const dynamic = 'force-dynamic';

type LeaderboardSearchParams = {
  projectId?: string;
  q?: string;
};

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<LeaderboardSearchParams> }) {
  const resolvedSearchParams = await searchParams;

  const initialProjectId = resolvedSearchParams.projectId ?? "all";
  const initialSearchTerm = resolvedSearchParams.q ?? "";

  const initialData = await fetchLeaderboard(initialProjectId);

  return (
    <div className="space-y-6">
      <LeaderboardLayout
        initialEntries={initialData.entries}
        initialProjectId={initialProjectId}
        initialSearchTerm={initialSearchTerm}
        projects={initialData.filters.projects}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update the navbar leaderboard link**

In `apps/leaderboard-client/src/components/layout/Navbar.tsx`, find the `navLinks` array (line ~44) and change the Leaderboard path from `"/"` to `"/leaderboard"`:

```tsx
const navLinks = [
  { name: "About", path: "/about" },
  { name: "Leaderboard", path: "/leaderboard" },
  { name: "Challenges", path: "/challenges" },
];
```

Also update the `isActive` helper — the old special case for `"/"` is no longer needed since the new homepage will not be "Leaderboard". Replace:

```tsx
const isActive = (path: string) => {
  if (path === "/") return pathname === "/";
  return pathname.startsWith(path);
};
```

With:

```tsx
const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));
```

- [ ] **Step 3: Type-check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/leaderboard/page.tsx apps/leaderboard-client/src/components/layout/Navbar.tsx
git commit -m "feat: add /leaderboard route and update navbar link"
```

---

### Task 2: Add `TrendingChallenge` type and `fetchTrendingChallenges` function

**Files:**
- Modify: `apps/leaderboard-client/src/lib/types.ts`
- Modify: `apps/leaderboard-client/src/lib/server/publicPages.ts`
- Create: `apps/leaderboard-client/src/lib/server/publicPages.test.ts`

**Interfaces:**
- Consumes: `repositories.contribution.findAll()`, `repositories.challenge.findAll()`, `repositories.project.findAll()`, `repositories.challengeTeam.findAll()`, `repositories.user.findAll()` — all already used in the same file
- Produces:
  ```ts
  export type TrendingChallenge = {
    id: string;
    index: number;
    title: string;
    type: string;
    projectName: string;
    description: string | null;
    rewardPool: number;
    completion: number; // 0–100, already multiplied
    teamMembers: TeamMember[];
    startDate: string; // ISO
    endDate: string;   // ISO
    recentContributions: number;
  };

  export async function fetchTrendingChallenges(limit: number): Promise<TrendingChallenge[]>
  ```

- [ ] **Step 1: Write the failing test**

Create `apps/leaderboard-client/src/lib/server/publicPages.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { repositories } from "@/lib/db";
import { fetchTrendingChallenges } from "./publicPages";

const NOW = new Date("2026-07-12T12:00:00Z");
const SIX_DAYS_AGO = new Date("2026-07-06T12:00:00Z");
const EIGHT_DAYS_AGO = new Date("2026-07-04T12:00:00Z");

describe("fetchTrendingChallenges", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("returns challenges sorted by recent contribution count, excluding drafts and stale challenges", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "contrib-1", challenge_id: "c1", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T1", type: "code" },
      { uuid: "contrib-2", challenge_id: "c1", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T2", type: "code" },
      { uuid: "contrib-3", challenge_id: "c2", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 10, title: "T3", type: "code" },
      // old contribution — should not count
      { uuid: "contrib-4", challenge_id: "c2", user_id: "u1", submitted_at: EIGHT_DAYS_AGO, reward: 10, title: "T4", type: "code" },
    ] as any);

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      {
        uuid: "c1", title: "Challenge Alpha", status: "active", type: "code",
        index: 1, contribution_points_reward: 500, completion: 0.4,
        project_id: "p1", start_date: new Date("2026-06-01"), end_date: new Date("2026-08-01"),
      },
      {
        uuid: "c2", title: "Challenge Beta", status: "active", type: "ml",
        index: 2, contribution_points_reward: 300, completion: 0.2,
        project_id: "p1", start_date: new Date("2026-06-01"), end_date: new Date("2026-08-01"),
      },
      // draft — should be excluded
      {
        uuid: "c3", title: "Challenge Draft", status: "draft", type: "code",
        index: 3, contribution_points_reward: 100, completion: 0,
        project_id: "p1", start_date: new Date("2026-06-01"), end_date: new Date("2026-08-01"),
      },
    ] as any);

    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "Project One", description: "Great project", created_at: new Date() },
    ] as any);

    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([
      { challenge_id: "c1", user_id: "u1" },
    ] as any);

    vi.spyOn(repositories.user, "findAll").mockResolvedValue([
      { uuid: "u1", full_name: "Alice", avatar_url: null },
    ] as any);

    const result = await fetchTrendingChallenges(3);

    // c1 has 2 recent contributions, c2 has 1, c3 excluded (draft)
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c1");
    expect(result[0].recentContributions).toBe(2);
    expect(result[0].completion).toBe(40); // 0.4 * 100
    expect(result[1].id).toBe("c2");
    expect(result[1].recentContributions).toBe(1);
    // Draft excluded
    expect(result.find(r => r.id === "c3")).toBeUndefined();
    // Team member mapped correctly
    expect(result[0].teamMembers).toEqual([{ id: "u1", fullName: "Alice", avatarUrl: undefined }]);
  });

  it("returns at most `limit` results", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "x1", challenge_id: "ca", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "x2", challenge_id: "cb", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "x3", challenge_id: "cc", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
      { uuid: "x4", challenge_id: "cd", user_id: "u1", submitted_at: SIX_DAYS_AGO, reward: 1, title: "T", type: "code" },
    ] as any);

    const makeChallenge = (id: string) => ({
      uuid: id, title: `C ${id}`, status: "active", type: "code", index: 1,
      contribution_points_reward: 100, completion: 0, project_id: "p1",
      start_date: new Date(), end_date: new Date(),
    });

    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue(
      ["ca", "cb", "cc", "cd"].map(makeChallenge) as any
    );
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "P", description: null, created_at: new Date() },
    ] as any);
    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([] as any);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([] as any);

    const result = await fetchTrendingChallenges(2);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no recent contributions exist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    vi.spyOn(repositories.contribution, "findAll").mockResolvedValue([
      { uuid: "old", challenge_id: "c1", user_id: "u1", submitted_at: EIGHT_DAYS_AGO, reward: 1, title: "T", type: "code" },
    ] as any);
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      { uuid: "c1", title: "C1", status: "active", type: "code", index: 1, contribution_points_reward: 100, completion: 0, project_id: "p1", start_date: new Date(), end_date: new Date() },
    ] as any);
    vi.spyOn(repositories.project, "findAll").mockResolvedValue([
      { uuid: "p1", title: "P", description: null, created_at: new Date() },
    ] as any);
    vi.spyOn(repositories.challengeTeam, "findAll").mockResolvedValue([] as any);
    vi.spyOn(repositories.user, "findAll").mockResolvedValue([] as any);

    const result = await fetchTrendingChallenges(3);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/leaderboard-client && npx vitest run src/lib/server/publicPages.test.ts
```

Expected: FAIL — `fetchTrendingChallenges` is not exported from `./publicPages`.

- [ ] **Step 3: Add `TrendingChallenge` type to `types.ts`**

Append to `apps/leaderboard-client/src/lib/types.ts`:

```ts
export type TrendingChallenge = {
  id: string;
  index: number;
  title: string;
  type: string;
  projectName: string;
  description: string | null;
  rewardPool: number;
  completion: number; // 0–100 (already multiplied)
  teamMembers: TeamMember[];
  startDate: string; // ISO string
  endDate: string;   // ISO string
  recentContributions: number;
};
```

- [ ] **Step 4: Add `fetchTrendingChallenges` to `publicPages.ts`**

Add this import at the top of `apps/leaderboard-client/src/lib/server/publicPages.ts` if not already present:

```ts
import type { TrendingChallenge } from "@/lib/types";
```

Then append the function at the end of the file:

```ts
export async function fetchTrendingChallenges(limit: number): Promise<TrendingChallenge[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [contributions, challenges, projects, allChallengeTeams, allUsers] = await Promise.all([
    repositories.contribution.findAll(),
    repositories.challenge.findAll(),
    repositories.project.findAll(),
    repositories.challengeTeam.findAll(),
    repositories.user.findAll(),
  ]);

  const recentCountByChallenge = contributions
    .filter((c) => c.submitted_at >= sevenDaysAgo)
    .reduce<Map<string, number>>((acc, c) => {
      acc.set(c.challenge_id, (acc.get(c.challenge_id) ?? 0) + 1);
      return acc;
    }, new Map());

  const usersMap = new Map(allUsers.map((u) => [u.uuid, u]));
  const projectsMap = new Map(projects.map((p) => [p.uuid, p]));

  const teamMembersByChallenge = allChallengeTeams.reduce<Map<string, { id: string; fullName: string; avatarUrl?: string }[]>>(
    (acc, ct) => {
      const user = usersMap.get(ct.user_id);
      if (user) {
        const members = acc.get(ct.challenge_id) ?? [];
        members.push({ id: user.uuid, fullName: user.full_name, avatarUrl: user.avatar_url ?? undefined });
        acc.set(ct.challenge_id, members);
      }
      return acc;
    },
    new Map()
  );

  return challenges
    .filter((c) => c.status !== "draft" && recentCountByChallenge.has(c.uuid))
    .sort((a, b) => (recentCountByChallenge.get(b.uuid) ?? 0) - (recentCountByChallenge.get(a.uuid) ?? 0))
    .slice(0, limit)
    .map((c) => {
      const project = projectsMap.get(c.project_id);
      return {
        id: c.uuid,
        index: c.index ?? 0,
        title: c.title,
        type: c.type ?? "code",
        projectName: project?.title ?? "Unknown project",
        description: project?.description ?? null,
        rewardPool: c.contribution_points_reward ?? 0,
        completion: Math.round((c.completion ?? 0) * 100),
        teamMembers: teamMembersByChallenge.get(c.uuid) ?? [],
        startDate: c.start_date.toISOString(),
        endDate: c.end_date.toISOString(),
        recentContributions: recentCountByChallenge.get(c.uuid) ?? 0,
      };
    });
}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd apps/leaderboard-client && npx vitest run src/lib/server/publicPages.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 6: Type-check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/leaderboard-client/src/lib/types.ts apps/leaderboard-client/src/lib/server/publicPages.ts apps/leaderboard-client/src/lib/server/publicPages.test.ts
git commit -m "feat: add TrendingChallenge type and fetchTrendingChallenges function"
```

---

### Task 3: Create `HomeLeaderboardPreview` component

**Files:**
- Create: `apps/leaderboard-client/src/components/home/HomeLeaderboardPreview.tsx`

**Interfaces:**
- Consumes: `LeaderboardEntry` from `@/lib/types`, `InitialsAvatar` from `@/components/ui/InitialsAvatar`, `formatCP` from `@/lib/formatters`
- Produces: `<HomeLeaderboardPreview entries={LeaderboardEntry[]} />` — Server Component

- [ ] **Step 1: Create the component**

Create `apps/leaderboard-client/src/components/home/HomeLeaderboardPreview.tsx`:

```tsx
import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatCP } from "@/lib/formatters";
import type { LeaderboardEntry } from "@/lib/types";

interface HomeLeaderboardPreviewProps {
  entries: LeaderboardEntry[];
}

const RANK_STYLES: Record<number, { badge: string; glow: string; leftBar: string }> = {
  1: {
    badge: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 shadow-md shadow-yellow-500/40",
    glow: "group-hover:shadow-[0_0_20px_rgba(234,179,8,0.15)]",
    leftBar: "bg-gradient-to-b from-yellow-400 to-yellow-600",
  },
  2: {
    badge: "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-900 shadow-md shadow-slate-400/30",
    glow: "group-hover:shadow-[0_0_20px_rgba(148,163,184,0.1)]",
    leftBar: "bg-gradient-to-b from-slate-300 to-slate-500",
  },
  3: {
    badge: "bg-gradient-to-br from-amber-500 to-amber-700 text-amber-100 shadow-md shadow-amber-600/30",
    glow: "group-hover:shadow-[0_0_20px_rgba(217,119,6,0.12)]",
    leftBar: "bg-gradient-to-b from-amber-500 to-amber-700",
  },
};

export function HomeLeaderboardPreview({ entries }: HomeLeaderboardPreviewProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
        Aucune contribution pour l'instant.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-md shadow-black/20">
      <ul className="divide-y divide-white/[0.04]">
        {entries.map((entry, index) => {
          const rankStyle = RANK_STYLES[entry.rank];
          const isTop3 = entry.rank <= 3;

          return (
            <li
              key={entry.userId}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index * 35, 500)}ms` }}
            >
              <Link
                href={`/contributors/${entry.userId}`}
                className={`group relative flex items-center gap-3 overflow-hidden px-4 py-3 transition-all duration-200
                  hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none
                  sm:gap-4 sm:px-5 md:px-6 md:py-3.5
                  ${rankStyle?.glow ?? ""}`}
              >
                {/* Top-3 left accent bar */}
                {isTop3 && (
                  <span
                    className={`absolute inset-y-0 left-0 w-[3px] rounded-r-full opacity-70 transition-opacity duration-200 group-hover:opacity-100 ${rankStyle.leftBar}`}
                  />
                )}

                {/* Rank badge */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold
                    transition-transform duration-200 group-hover:scale-110 sm:h-8 sm:w-8 sm:text-sm
                    ${rankStyle?.badge ?? "bg-white/8 text-white/40"}`}
                >
                  {entry.rank}
                </div>

                {/* Avatar */}
                <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                  <InitialsAvatar name={entry.displayName} size={36} avatarUrl={entry.avatarUrl} />
                </div>

                {/* Name + bio */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-white transition-colors duration-200 group-hover:text-brandCP sm:text-base">
                    {entry.displayName}
                  </span>
                  {entry.bio && (
                    <span className="hidden truncate text-xs text-white/35 transition-colors duration-200 group-hover:text-white/50 sm:block">
                      {entry.bio}
                    </span>
                  )}
                </div>

                {/* CP badge */}
                <span
                  className={`relative shrink-0 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold
                    transition-all duration-200 group-hover:scale-105 sm:px-3 sm:py-1 sm:text-sm
                    ${isTop3 ? "border-brandCP/30 bg-brandCP/10" : "border-white/10 bg-white/[0.06]"}`}
                >
                  {entry.rank === 1 && (
                    <span className="animate-shimmer pointer-events-none absolute inset-0 rounded-full" />
                  )}
                  <span className="relative text-white">{formatCP(entry.totalCP)}</span>{" "}
                  <span className="relative text-brandCP">CP</span>
                </span>

                {/* Hover arrow */}
                <svg
                  className="h-4 w-4 shrink-0 text-white/0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white/30"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/home/HomeLeaderboardPreview.tsx
git commit -m "feat: add HomeLeaderboardPreview component"
```

---

### Task 4: Create `HomeChallengesPreview` component

**Files:**
- Create: `apps/leaderboard-client/src/components/home/HomeChallengesPreview.tsx`

**Interfaces:**
- Consumes: `TrendingChallenge` from `@/lib/types`, `ChallengeCard` from `@/components/public/ChallengeCard`
- Produces: `<HomeChallengesPreview challenges={TrendingChallenge[]} />` — Server Component

- [ ] **Step 1: Create the component**

Create `apps/leaderboard-client/src/components/home/HomeChallengesPreview.tsx`:

```tsx
import { ChallengeCard } from "@/components/public/ChallengeCard";
import type { TrendingChallenge } from "@/lib/types";

interface HomeChallengesPreviewProps {
  challenges: TrendingChallenge[];
}

export function HomeChallengesPreview({ challenges }: HomeChallengesPreviewProps) {
  if (challenges.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/40">
        Aucun challenge actif cette semaine.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {challenges.map((challenge, i) => (
        <ChallengeCard
          key={challenge.id}
          index={i}
          challengeId={challenge.id}
          challengeIndex={challenge.index}
          challengeTitle={challenge.title}
          challengeType={challenge.type}
          projectName={challenge.projectName}
          description={challenge.description}
          rewardPool={challenge.rewardPool}
          completion={challenge.completion}
          isMember={false}
          isAdmin={false}
          teamMembers={challenge.teamMembers}
          startDate={challenge.startDate}
          endDate={challenge.endDate}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/home/HomeChallengesPreview.tsx
git commit -m "feat: add HomeChallengesPreview component"
```

---

### Task 5: Create the new homepage

**Files:**
- Modify: `apps/leaderboard-client/src/app/page.tsx`

**Interfaces:**
- Consumes:
  - `fetchLeaderboard(projectId?: string)` from `@/lib/server/leaderboard` — returns `{ entries: LeaderboardEntry[], filters: { projects: ProjectFilter[] } }`
  - `fetchTrendingChallenges(limit: number): Promise<TrendingChallenge[]>` from `@/lib/server/publicPages`
  - `HomeLeaderboardPreview` from `@/components/home/HomeLeaderboardPreview`
  - `HomeChallengesPreview` from `@/components/home/HomeChallengesPreview`

- [ ] **Step 1: Replace `app/page.tsx` content**

Replace the entire content of `apps/leaderboard-client/src/app/page.tsx` with:

```tsx
import Link from "next/link";
import { fetchLeaderboard } from "@/lib/server/leaderboard";
import { fetchTrendingChallenges } from "@/lib/server/publicPages";
import { HomeLeaderboardPreview } from "@/components/home/HomeLeaderboardPreview";
import { HomeChallengesPreview } from "@/components/home/HomeChallengesPreview";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [leaderboardData, trendingChallenges] = await Promise.all([
    fetchLeaderboard("all"),
    fetchTrendingChallenges(3),
  ]);

  const top5 = leaderboardData.entries.slice(0, 5);

  return (
    <div className="space-y-8 sm:space-y-10">

      {/* ── About section ─────────────────────────────────────────── */}
      <section className="animate-fade-up rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-md shadow-black/20 sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-white sm:text-2xl">
          A global movement to reinvent health.{" "}
          <span className="text-brandCP">Together.</span>
        </h2>

        <div className="space-y-3 text-sm text-white/70 sm:text-base">
          <p>
            We are a collective uprising of students, engineers, clinicians, researchers, and citizens
            who refuse to wait for health innovation to happen to them.{" "}
            <strong className="text-white">We build it together.</strong>
          </p>
          <blockquote className="rounded-sm border-l-4 border-brandCP py-1 pl-4 text-sm italic text-white/60 sm:text-base">
            If you contribute, you exist. If you build, you shine.
          </blockquote>
        </div>

        <div className="mt-6">
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2.5"
          >
            Learn more
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Leaderboard + Challenges grid ─────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-8">

        {/* Top 5 Leaderboard */}
        <div className="animate-fade-up flex flex-col gap-4" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Top Contributors</h2>
            <span className="flex items-center gap-1.5 text-xs text-white/35">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brandCP/70 animate-ping-slow" />
              Live
            </span>
          </div>

          <HomeLeaderboardPreview entries={top5} />

          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2.5"
          >
            View full leaderboard
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>

        {/* Trending Challenges */}
        <div className="animate-fade-up flex flex-col gap-4" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white sm:text-xl">Trending Challenges</h2>
            <span className="text-xs text-white/35">Last 7 days</span>
          </div>

          <HomeChallengesPreview challenges={trendingChallenges} />

          <Link
            href="/challenges"
            className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2.5"
          >
            View all challenges
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/leaderboard-client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd apps/leaderboard-client && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/page.tsx
git commit -m "feat: new homepage with about snippet, top-5 leaderboard preview, and trending challenges"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `/` → new homepage — Task 5
- ✅ `/leaderboard` → full leaderboard (current `/` content) — Task 1
- ✅ Navbar updated: `Leaderboard` → `/leaderboard` — Task 1
- ✅ About section: 2 sentences + 1 quote + "Learn more" CTA — Task 5
- ✅ Top 5 leaderboard preview, same DA as `LeaderboardTable` — Task 3 + 5
- ✅ 2–3 trending challenges (last 7 days) — Task 2 + 4 + 5
- ✅ Each section has a "view more" CTA button — Task 5
- ✅ Theme compliance: `bg-background`, `text-brandCP`, `bg-white/[x]` — all tasks
- ✅ No modifications to existing `/about`, `/challenges`, or admin pages

**Placeholder scan:** None found.

**Type consistency:**
- `TrendingChallenge` defined in Task 2, consumed in Tasks 4 and 5 ✅
- `HomeLeaderboardPreview` prop `entries: LeaderboardEntry[]` — `LeaderboardEntry` from `@/lib/types` ✅
- `fetchTrendingChallenges(limit: number): Promise<TrendingChallenge[]>` — called in Task 5 with `fetchTrendingChallenges(3)` ✅
- `ChallengeCard` props in Task 4 match the existing component signature ✅
