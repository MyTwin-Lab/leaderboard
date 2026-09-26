# MyTwin Lab News

> `/news` and `/news/<slug>`: dated news about the Lab's partnerships, challenges, Sandbox projects and research, written as real web pages rather than rendered markdown. What to write and how is in [`news-playbook.md`](./news-playbook.md); this page is the code side.

Modelled on the blog of mytwin.care (`src/features/blog/` in mytwin-health-landing): same idea of a shared template plus per-article visual blocks, adapted to news and to this app (English only, no dictionaries, the Lab's theme).

## Surface

| Path | What |
|---|---|
| `src/app/news/page.tsx` | the index, at the vitrine style: a fixed featured news (`FEATURED_NEWS`), then the others in a grid. `CollectionPage` + `BreadcrumbList` JSON-LD |
| `src/app/news/[slug]/page.tsx` | an article. `generateStaticParams` + `dynamicParams = false`: an unknown slug is a 404. `NewsArticle` + `BreadcrumbList` JSON-LD |
| `src/app/news/[slug]/opengraph-image.tsx` | the share preview of each news, generated at build: category, event month, title |
| `src/content/news/index.ts` | the registry: `NEWS_ARTICLES`, `getNewsBySlug`, `FEATURED_NEWS`, `HOME_NEWS`, `getRelatedNews` |
| `src/content/news/types.ts` | `NewsArticle` and its parts, `NEWS_CATEGORY_LABELS` |
| `src/content/news/<slug>/` | one folder per news: `index.tsx` (the content) and its own visual blocks |
| `src/components/news/` | the template: `NewsArticleHeader`, `NewsHero`, `NewsArticleBody` (table of contents, sections, FAQ, CTA, sources), `NewsRelated` (*Keep reading*), `NewsCard` and its `NewsIllustrationFrame`, the icons of the mock-up (`NewsIcons`), and the writing primitives `NewsProse`, `NewsLink`, `NewsCallout`, `NewsFigure`, `NewsPhotoRow`, `NewsVideoEmbed` |
| `src/components/news/news-detail-vitrine.css` | the look of an article page, from `News Detail Redesign Vitrine.dc.html` — everything scoped under `.vitrine .v-nd` |
| `src/components/news/news-index-vitrine.css` | the look of the index — no mock-up of its own: the `.v-head` grammar of the three listings, the card material of an article page. Scoped under `.vitrine .v-news` |
| `public/news/` | the overview images (WebP), one per illustrated news |
| `src/components/podcast/` | MyTwin Inside episodes: `PodcastVideos` (home grid / mobile carousel) and `PodcastEpisodeEmbed` (one episode inside a news) |
| `src/components/home/HomeLatestNews.tsx` | "News" on the home page: a fixed selection (`HOME_NEWS`, in its order), not the latest — a feature then two briefs |
| `lib/paths.ts` | `NEWS_PATH`, `newsPath(slug)` |
| `lib/seo.ts` | `articleMetadata`, `newsArticleJsonLd`, `collectionPageJsonLd`, `EDITORIAL_AUTHOR`, `authorJsonLd`; `buildSitemap` lists `/news` and every news |

Entry points: the footer ("MyTwin Lab News"), the home page section, and "Keep reading" under each news.

## Adding a news

1. Create `src/content/news/<slug>/index.tsx` exporting a `NewsArticle` (copy an existing one), with its `overviewTitle` and, if it has one, its `illustration`.
2. Add it to `ARTICLES` in `src/content/news/index.ts`.
3. Run the playbook checklist.

The sitemap, the index, the home section, the OG image and the JSON-LD follow from the registry.

## The look of an article page

`/news/<slug>` is a **vitrine**, like the home page, the three listings and `/vision`: the light ground of the Claude Design mock-ups (`#fcfcfc`), Plus Jakarta Sans for the headings, Hanken Grotesk for the text. `LabShell` paints the chrome for both — `/news` by name in `VITRINE_BACKGROUNDS`, `/news/<slug>` by the `/news/` prefix — so the navbar and the footer sit on the same ground as the page. Each carries the shared `BackToLab` link in its header, like the three listings.

- Everything is scoped under `.vitrine .v-nd` and prefixed `v-nd-`, on the `--v-*` tokens of `components/vitrine/vitrine.css`. No `text-white` / `bg-white/…` / `border-white` utility anywhere on this page, in the template or in an article's visual blocks: `globals.css` rewrites them in light mode, and they would be invisible here.
- Two breakpoints, the mock-up's own: **900px**, below which the sticky table of contents folds into the article, and **768px**, below which the phone layout takes over (tighter type, a 4/3 hero, the *Keep reading* cards in a rail, the sources behind a `Sources · n` fold).
- The mock-up carries its own navbar, footer and desktop/phone switch. None of the three is ported: `LabShell` already puts the chrome on every page, and the real page switches on the browser's width.
- A page-wide vocabulary carries the per-article visual blocks: `v-nd-panel` (a drawing of one piece) and `v-nd-tile` (a step, one side of a comparison), with `data-on` for the current step, `data-dashed` for what is still to come. An article draws its own schemas without the page changing grammar.

## How the template reads the content

- **The body is written in bare tags** (`<p>`, `<ul>`, `<h3>`, `<strong>`): `NewsProse` styles its **direct** children only, so a visual block dropped between two paragraphs keeps its own typography. It is a grid: the breathing between two blocks is its `gap`, not a margin each block has to set.
- **The header and the hero span the page**, above the two columns: the title breathes on 52rem before the text narrows to its 44rem reading measure. The hero is the article's own `illustration` — the same one its cards show — and there it is content, so it carries the image's `alt`.
- **Sections are data**: their `id` and `title` feed both the `<h2>` and the table of contents. Neither numbers them: the mock-up's `01`, `02`… were taken off the headings and the table of contents. From `MIN_SECTIONS_FOR_TOC` (3) sections, a sticky table of contents appears on desktop (scroll-spy, `lib/useScrollSpy.ts`); between 900 and 768px it folds into a `<details>` at the top of the article, and below 768px it goes altogether — on a phone the article is scrolled, and folding it in only pushed the text down. With fewer than three sections the column is centered and there is no table of contents at all.
- **No *At a glance* panel.** The mock-up's one was taken off: an article opens on its lead. The `facts` field is still written in each news (see the playbook) but nothing renders it.
- **FAQ and sources are optional**: no `faq`, no FAQ section and no FAQ entry in the table of contents. FAQ answers are plain strings and rendered in native `<details>`, so they stay in the DOM. Sources are numbered `01`, `02`… and their `<details>` is open on load, on the phone as on a screen: on a health subject, being able to check where a claim comes from is part of the content.
- **The CTA banner's eyebrow reads its own destination** — *Open challenge*, *Sandbox*, *Research vision*, *MyTwin* — not the article's category: it announces where the button goes.
- **`NewsLink`** chooses the behaviour: `next/link` for Lab pages, same tab for mytwin.care, new tab with `rel="noopener"` for everything else (editorial links, no `nofollow`).
- **Photos in the body go through `NewsPhotoRow`**: one or several images on one line at the same height, each column as wide as its image's format, the row capped at 28rem high (portrait images narrow it rather than filling the screen). The WebP lives in `public/news/`. Unlike a card, a photo there carries a real `alt`: it is content.
- **A video goes through `NewsVideoPlayer`** (a talk, a conference): the article's `video` field. When the video *is* the news, it is the article's illustration (`kind: "video"`) and the player sits at the top, in place of the hero image; otherwise the article places it in its text with `NewsVideoEmbed`. The Lab serves the clip (`public/news/`, MP4 H.264 with `faststart`) instead of embedding YouTube: the reader stays on the page. Before the click, only the image loads, through `next/image`; the `<video>` is mounted on click. A non-English `language` and the subtitles' language are said under the player.
- **Subtitles are a WebVTT track, never burned into the MP4** (`video.captions`, next to the clip in `public/news/`, e.g. `ynov-talk.en.vtt` converted from the SRT). The player keeps the track `hidden` and draws the active cue itself, white on a night veil, above the native controls; the native CC button still turns it off. In native fullscreen (iPhone, or the controls' fullscreen button) the overlay is no longer in the page, so the track goes back to `showing` and the browser draws it, styled by `::cue`. The track is also declared as the `caption` of the `VideoObject`.
- **Cards show `eventMonth`**, the article header shows it next to the publication date: several news can be published the same day about events far apart.

## Overviews: title and illustration

A news has two faces. The article page carries `title`, the entity-first H1 written for search. Its overviews (the cards on `/news`, `/home` and under "Keep reading") carry `overviewTitle`, shorter and catchier, and an optional `illustration`:

| `illustration.kind` | What | Where it lives |
|---|---|---|
| `image` | a photo, cropped to the landscape frame (`position` sets `object-position`), or shown whole with `fit: "contain"`: slightly inset, with a faint border, centred on a black ground (the mammogram, whose own background is black; `ratio` gives the image's width / height so the border hugs it) | `public/news/`, or an image the site already serves |
| `video` | the article's video: its image (`src`, `position`) with a small play button in the bottom-right corner in the cards; in the article, the player itself, 16:9 at every size, with its `caption` | the clip, image and `.vtt` in `public/news/` |
| `visual` | a component drawn in HTML/SVG, on the frame's light panel or on its own (MyKine's is dark) | in the article's folder, next to its visual blocks (`access-illustration.tsx`, `app-illustration.tsx`, `home-session-illustration.tsx`, `pose-illustration.tsx`, `risk-window-illustration.tsx`, `scan-illustration.tsx`) |

- **`NewsIllustrationFrame` fixes the format, the illustration fills it.** On a card the frame is 16:10 above the text; on the featured card of `/news` it takes the right half.
- **A visual is drawn in `em`.** The frame is a size container and sets its font size in `cqw`, so the whole drawing follows the width of the card. Colours are fixed (the panel stays light in both modes), never `currentColor` or `text-white`, which the light mode rewrites. An animation lives inside the component (a `<style>` with classes prefixed per article: `nes-`, `nhg-`, `niv-`, `nrs-`) and stops under `prefers-reduced-motion`; SMIL ignores that query, so MyKine's pauses its SVG from a client effect.
- **An SVG that fills the frame is framed in 16:10**, the card's format (`viewBox` 352 × 220 around the drawing, `slice`): a 4:3 drawing would lose its top and bottom. A drawing that must never be cut (MyKine's figure, head to floor) uses `meet` instead, on a panel that fills the sides: the home frames are wider than 16:10.
- **A visual can show more in the hero.** `NewsHero` passes `hero` to the frame, which hands it to the visual. MyTwin Athlete's app screenshot uses it: in the cards the phone is large and the frame cuts it at mid-height, under the logo and the athlete; in the hero it shrinks to show down to the first two buttons. Its sizes are set on the frame's height, so the cut holds whatever the format.
- **Always decorative in a card** (`aria-hidden`, empty `alt`): the title next to it already says what it shows. The `alt` of an image is there for the day it is shown on its own.
- **No illustration, no frame**: the card stays text only.
- **Three shapes, three components.** `NewsCard` serves `/news` only — the full card: illustration, kicker, title, excerpt, "Read the news", and `featured` for the lead. The home page draws its own feature-then-briefs (`HomeLatestNews`), and "Keep reading" its thumbnail card (`NewsRelated`).
- **Same rule as a visual block**: an illustration illustrates and adds nothing, no figure or result that isn't in the article.

## SEO

- `<title>` = `seoTitle | MyTwin Lab` (layout template). `og:type` = `article` with published and modified times, author and tags (`articleMetadata`).
- `NewsArticle` JSON-LD: `author` is Rubens Valcy with `worksFor` pointing at mytwin.care's `@id`; `publisher` is the Lab organization's `@id`; `mentions` declares the partners and products with their URL; `citation` declares the sources; `image` is the article's generated OG image.
- `video`, when the article has one, adds a `VideoObject` to the `NewsArticle` (`contentUrl` and poster served by the Lab, `duration`, `uploadDate`).
- The sitemap entry's `lastModified` is `updatedAt ?? publishedAt`.

## Gotchas

- **Light mode flattens `text-white/xx`.** `globals.css` forces every `text-white*` class to the full foreground colour in light mode, so opacity-based text hierarchies collapse. Where a difference must survive (the active item of the table of contents), use `opacity-*` instead of a colour alpha.
- **…and only on the element that carries the class.** The override matches `[class*="text-white"]`, so a descendant variant such as `[&_strong]:text-white` on a wrapper leaves the `<strong>` itself truly white on a light background. Style children from a parent with `text-foreground`, which follows the theme in both modes (`NewsProse` does).
- **The OG image imports the registry**, hence every article module and its illustration components. Keep them free of side effects and server-only imports.
- **Text-only cards next to illustrated ones** stretch to the row's height and show an empty band above "Read the news".
- **No "story so far" timeline yet.** The playbook's continuity rule (§3) is applied in the content for now: links between chapters and an update callout on the previous one. Build a timeline in the template when a project has two chapters.
- **Encoding a clip for a news**: `ffmpeg -i in.mp4 -vf scale=-2:720 -c:v libx264 -preset slow -crf 28 -c:a aac -b:a 96k -movflags +faststart public/news/<name>.mp4`. Without `+faststart`, the browser must fetch the whole file before playing.
- **The podcast data is duplicated from mytwin.care** (`components/podcast/episodes.ts`): a new episode there must be added here, thumbnail included (bundled, not hot-linked from YouTube).
- **YouTube loads only on click** (`youtube-nocookie.com`), which is what the privacy policy (§ 9) states. Don't autoplay or preload an embed.

Related: [`news-playbook.md`](./news-playbook.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
