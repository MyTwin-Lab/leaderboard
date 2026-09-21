# Landing (`/`)

The root page is the first thing a hospital, a partner or a future contributor sees. It tells the vision of MyTwin Lab, then hands over to the web app through one call to action, **Enter the Lab**, which leads to `/home`. Landing and web app are two separate worlds: the landing has its own art direction and does not use the Lab's theme system.

## How it leaves the Lab chrome

The root layout wraps every page in the Lab chrome (themed background, navbar, centred container, footer, onboarding drawer). `components/layout/LabShell.tsx` is a client switch on the pathname: on `/` it renders the page alone, everywhere else it renders exactly the tree the layout rendered before.

This is a deliberate conditional, not route groups: route groups would move every page of the web app into a `(lab)/` folder. The rule for this work is that the landing must not touch the web app.

## Art direction

Everything lives in `components/landing/`, styled by `landing.css`:

- every rule is scoped under `.landing` and every class is prefixed `l-`, so nothing leaks into the web app;
- its own tokens (`--l-bg`, `--l-ink`, `--l-accent`…) and its own fonts (`fonts.ts`), none of the theme variables set on `<html>`. Titles use Plus Jakarta Sans, the heading family of the MyTwin Health landing (`.l-heading`); text uses Hanken Grotesk. The serif, Instrument Serif (`.l-display`), is kept for a single sentence, the statement under the hero: its rarity is what gives it weight;
- no Tailwind `text-white`, `border-white` or `bg-white/…` utilities: `globals.css` rewrites them when the instance is in light mode. The same stylesheet forces the colour of every SVG in light mode, which `.landing.landing svg` undoes;
- its own logos, PNGs in `public/landing/logo/`: `mytwin-lab-logo-dark.png` (white "MyTwin", for dark backgrounds) under the H1 of the hero, `mytwin-lab-logo-light.png` (black "MyTwin") in the footer. The web app keeps `MyTwinLogo`, the landing no longer uses it.

Motion is slow and quiet (one easing, `--l-ease`), and `prefers-reduced-motion` turns it off.

## Sections

| Section | Component | Notes |
|---------|-----------|-------|
| Hero | `LandingHero` | The H1, then the MyTwin Lab logo centred under it, over four images that cross-fade every 7 s. No navbar: the landing has nowhere else to send a visitor. Scrolling sets `--p` (0 → 1) on the section; CSS derives the rounded `clip-path` that reveals the light background, and a light parallax |
| Community | `LandingCommunity` | "Join our Community", the contributors carousel ported from the MyTwin Health landing (`/patients`), then the first **Enter the Lab**. The carousel is decorative; a visually hidden list carries the names. The list (`src/content/community.ts`) and the motion (`lib/useDragMarquee.ts`) are shared with `/home`, which shows the same section in the Lab's look, without the CTA (`HomeCommunity`) |
| News | `LandingNews` | The title "MyTwin Lab News" and nothing else above the stories. One main story (the Leaderboard) and three secondary ones (the accessibility challenge, MyKine, the i-Virtual integration). They are chosen, not "the latest": each carries one dimension of the Lab. The copy is written for the landing, and each overview has its own visual. "Read more" is not a link yet |
| Statement | `LandingStatement` | "Health innovation, built in the open", centred, in the serif, with the last **Enter the Lab**. It closes the page |
| Footer | `LandingFooter` | The logo and the two legal pages, nothing else |

### The top 3

The Leaderboard story shows the top 3 contributors (`LandingTopContributors`) on a light panel, next to the story's dark text. For now it is a **hand-written snapshot** of the `/leaderboard` ranking (names, bios, CP), so it can show the contributors' photos from `public/landing/contributors/`, which the accounts don't have. The page therefore stays static: no database read on `/`. The snapshot lives in `src/content/top-contributors.ts`, shared with the illustration of the Leaderboard news.

The other visuals illustrate and invent no result: the i-Virtual one shows a face, a scan ring and a generic pulse wave, with no vital-sign figure.

## Assets

`public/landing/logo/` (the two logos), `public/landing/hero/` (the four hero images, WebP), `public/landing/contributors/` (photos, same files as the Health landing) and `public/landing/flags/` (local copies, so the landing calls no third-party host). `/home` reads the photos and flags too, for its own "Join our Community".

## Still open

- **The top 3 is a snapshot.** Its CP drift from the real ranking as contributions land. Wiring it to `fetchLeaderboard()` makes `/` dynamic (like `/home`) and needs the photos to come from the accounts.
- **The stories are not wired.** "Read more" is a `<span>`, and the landing writes its own titles and visuals. The four articles exist (`mytwin-lab-leaderboard-beta`, `mytwin-accessibility`, `mykine`, `i-virtual-camera-vital-signs`), each with an `overviewTitle` and, for three of them, an `illustration` (see [`news.md`](./news.md)). The Leaderboard article still has to be rewritten around the Leaderboard itself (MyTwin Lab was never "launched": it exists since MyTwin does).
- **The hero images are 1774 px wide**, short for a full-screen retina hero.
- **`LabShell` is a stopgap.** A clean split (route groups or separate layouts) belongs to a later refactor of the web app, not to the landing work.
