# Landing (`/`)

The root page is the first thing a hospital, a partner or a future contributor sees. It is a single screen with no scroll: the vision in one sentence, then one call to action, **Enter the Lab**, which leads to `/home`. Landing and web app are two separate worlds: the landing has its own art direction and does not use the Lab's theme system.

## How it leaves the Lab chrome

The root layout wraps every page in the Lab chrome (themed background, navbar, centred container, footer, onboarding drawer). `components/layout/LabShell.tsx` is a client switch on the pathname: on `/` it renders the page alone, everywhere else it renders exactly the tree the layout rendered before.

This is a deliberate conditional, not route groups: route groups would move every page of the web app into a `(lab)/` folder. The rule for this work is that the landing must not touch the web app.

## The screen

Everything lives in `components/landing/Landing.tsx`, styled by `landing.css`:

| Layer | What |
|-------|------|
| Background | Two framings of the same scene, full screen (`object-fit: cover`), under a dark scrim so the title reads: `digital-twin-hologram.webp` (landscape) when the screen is wider than tall, `digital-twin-hologram-mobile.webp` (portrait) otherwise, both in `public/landing/hero/`. A `<picture>` built with `getImageProps` picks one by `orientation`, so the browser loads only that one. Decorative, empty `alt` |
| Logo | The MyTwin Lab logo, small, top left: `public/landing/logo/mytwin-lab-logo-dark.png` (white "MyTwin", for dark backgrounds) |
| Title | The H1, centred: "We are building the world's most advanced human digital twin" |
| CTA | **Enter the Lab**, a white pill under the title, → `/home` |

No scroll: `.landing` is `100svh` high with `overflow: hidden`, and nothing follows the screen, not even a footer (the legal pages stay linked from the Lab footer). A `min-height` of 20rem keeps the title and CTA whole on a very short screen (a phone held sideways), where the page would then scroll a little.

## Art direction

- Every rule is scoped under `.landing` and every class is prefixed `l-`, so nothing leaks into the web app.
- Its own tokens (`--l-ink`, `--l-night`, `--l-mint`…) and its own fonts (`fonts.ts`), none of the theme variables set on `<html>`. The title uses Plus Jakarta Sans, the heading family of the MyTwin Health landing (`.l-heading`); the button uses Hanken Grotesk.
- No Tailwind `text-white`, `border-white` or `bg-white/…` utilities: `globals.css` rewrites them when the instance is in light mode. The same stylesheet forces the colour of every SVG in light mode, which `.landing.landing svg` undoes.
- The web app keeps `MyTwinLogo`; the landing uses its own PNG.

Motion is slow and quiet (one easing, `--l-ease`): the image settles in, then the logo, the title and the CTA rise one after the other. `prefers-reduced-motion` turns it off.

## Where the old sections went

The landing used to scroll through "Join our Community", four news stories and a closing statement.

- **Join our Community** lives on `/home` (`HomeCommunity`), in the Lab's look. Its photos and flags are still served from `public/landing/contributors/` and `public/landing/flags/`.
- **Three of the four stories' visuals** became the overview illustrations of their news (see [`news.md`](./news.md)): the top 3 contributors (Leaderboard), the pose skeleton (MyKine), the selfie scan (i-Virtual). The accessibility news shows a photo of the pictogram for visually impaired people instead; its screen reader and voice visual was dropped (last version in commit `334fafa`, `content/news/mytwin-accessibility/screen-reader-illustration.tsx`).

## Still open

- **The page carries almost no text**: the H1 and the button. The title and description of the page and the entity JSON-LD are unchanged (see [`seo.md`](./seo.md)).
- **The landscape image is 1774 px wide**, short for a full-screen retina hero.
- **`LabShell` is a stopgap.** A clean split (route groups or separate layouts) belongs to a later refactor of the web app, not to the landing work.
