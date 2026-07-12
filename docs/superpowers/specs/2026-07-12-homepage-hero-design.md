# Homepage Hero Redesign — Design Spec
**Date:** 2026-07-12

## Goal
Replace the flat about-card on the homepage with a cinematic hero section that has visual impact comparable to mytwinlab.io. Keep the leaderboard + challenges grid below.

## Hero Section

**Background:** `bg-backgroundDark` (theme CSS variable, respects dynamic theming)
**Layout:** Quasi full-bleed via `-mx-4 sm:-mx-6`, rounded bottom corners `rounded-b-3xl`
**Radial glow:** Overlay div with `radial-gradient(ellipse at top, var(--theme-primary), transparent)` at ~6% opacity
**Padding:** `py-20 sm:py-28` vertical, `px-6 sm:px-12` horizontal
**Alignment:** Centered content, `max-w-3xl mx-auto text-center`

**Text content:**
1. Eyebrow pill: `#WeAreNotWaiting` — brandCP color, small, tracking-widest, uppercase
2. H1: `"Building the world's most advanced health digital twin."` — `text-4xl sm:text-5xl lg:text-6xl font-bold`
3. Subtitle: `"We are students, clinicians, engineers and researchers building what institutions can't. Open. Global. Now."` — `text-base sm:text-lg text-white/70`
4. Two CTAs: `Explore the movement →` (→ /about) + `View leaderboard →` (→ /leaderboard)

**Navbar:** unchanged — already fixed above the content via `pt-20 md:pt-24` on `<main>`

## Below Hero (unchanged)
Two-column grid: Top Contributors | Trending Challenges — same components as currently implemented.
The about card is removed (its content lives in the hero now).

## Files Changed
- Modify only: `apps/leaderboard-client/src/app/page.tsx`

## Theme Compliance
- `bg-backgroundDark` → CSS var `--background-dark`
- `text-brandCP` → CSS var `--theme-primary`
- `bg-white/[x]`, `border-white/[x]` — light mode handled by globals.css
