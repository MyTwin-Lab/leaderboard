# Homepage Redesign — Design Spec
**Date:** 2026-07-12
**Branch:** challenge-010-ML_integration

---

## Goal

Replace the current homepage (`/`) — which is a full leaderboard — with a curated landing page combining three sections: about snippet, top 5 leaderboard preview, and trending challenges preview. The full leaderboard moves to `/leaderboard`.

---

## Routing Changes

| Before | After |
|--------|-------|
| `/` → Full leaderboard | `/` → New homepage |
| *(no route)* | `/leaderboard` → Full leaderboard (same as current `/`) |

**Navbar update:** Change `{ name: "Leaderboard", path: "/" }` to `{ path: "/leaderboard" }`.

---

## Layout — Homepage (`/`)

```
┌─────────────────────────────────────────────────┐
│  ABOUT SECTION (full width)                     │
│  2–3 phrases clés + bouton → /about             │
└─────────────────────────────────────────────────┘
┌────────────────────────┐ ┌──────────────────────┐
│  LEADERBOARD PREVIEW   │ │  CHALLENGES PREVIEW  │
│  Top 5 contributors    │ │  2–3 trending        │
│  (same DA as /lb)      │ │  (ChallengeCard)     │
│  bouton → /leaderboard │ │  bouton → /challenges│
└────────────────────────┘ └──────────────────────┘
```

On mobile: 3 sections stacked full-width.

---

## About Section

**Content** (extracted from `/about`):
1. *"A global movement to reinvent health. Together."* (h2 hero)
2. *"It's a movement — a collective uprising of students, engineers, clinicians, researchers, designers, startups, and citizens who refuse to wait for health innovation to happen to them. We build it together."* (condensed)
3. *"If you contribute, you exist. If you build, you shine."* (highlight quote with brandCP left border)

**CTA button:** `→ Learn more` linking to `/about`

Design: full-width card, same glass morphism style (`bg-white/[0.04] border border-white/10 rounded-2xl`), responsive padding.

---

## Leaderboard Preview Section

**Data:** `fetchTopLeaderboard(5)` — calls existing `fetchLeaderboard()`, slices top 5 entries.

**Component:** `components/home/HomeLeaderboardPreview.tsx`
- Server Component (static, no LeaderboardProvider)
- Replicates the DA of `LeaderboardTable`: rank badges (gold/silver/bronze for top 3), left accent bar, CP badge with shimmer on rank 1, hover arrow, `animate-fade-up` with stagger
- Links to `/contributors/[userId]` as usual
- No filters bar, no loading state

**Section header:** `"Top Contributors"` with a subtle CP counter or live dot

**CTA button:** `→ View full leaderboard` linking to `/leaderboard`

---

## Trending Challenges Preview Section

**Data:** `fetchTrendingChallenges(3)` — new server function in `lib/server/publicPages.ts`
- Fetches contributions from the last 7 days (filter on `submitted_at >= now - 7d`)
- Groups by `challenge_id`, counts contributions per challenge
- Returns top N challenges sorted by recent contribution count, with full challenge data (title, rewardPool, completion, teamMembers, startDate, endDate, projectName)
- Excludes `draft` challenges

**Component:** `components/home/HomeChallengesPreview.tsx`
- Server Component wrapper that renders existing `ChallengeCard` components
- `isAdmin={false}`, no admin interactions
- Grid: 1 col on mobile, up to 3 cols on larger screens (same as `/challenges`)

**CTA button:** `→ View all challenges` linking to `/challenges`

---

## New `/leaderboard` Route

File: `app/leaderboard/page.tsx`
- Exact copy/move of current `app/page.tsx` content
- Same `searchParams` signature, same `fetchLeaderboard()` call, same `LeaderboardLayout`

---

## Theme Compliance

All new components must use:
- `bg-background` / `bg-backgroundDark` (not hardcoded hex)
- `text-brandCP` for accent (not hardcoded teal)
- `bg-white/[x]` and `border-white/[x]` for glass morphism (light mode handled by globals.css)
- `text-white` / `text-white/80` for text (inverted automatically in light mode)

---

## Files Created / Modified

| Action | File |
|--------|------|
| Move content | `app/page.tsx` → becomes new homepage |
| Create | `app/leaderboard/page.tsx` |
| Create | `components/home/HomeLeaderboardPreview.tsx` |
| Create | `components/home/HomeChallengesPreview.tsx` |
| Modify | `lib/server/publicPages.ts` — add `fetchTrendingChallenges()` |
| Modify | `components/layout/Navbar.tsx` — update leaderboard path |

---

## Out of Scope

- No changes to `/about`, `/challenges`, or any admin pages
- No new DB queries beyond contribution filtering by date
- No changes to authentication or session handling
