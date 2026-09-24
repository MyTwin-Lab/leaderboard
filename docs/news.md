# MyTwin Lab News

> `/news` and `/news/<slug>`: dated news about the Lab's partnerships, challenges, Sandbox projects and research, written as real web pages rather than rendered markdown. What to write and how is in [`news-playbook.md`](./news-playbook.md); this page is the code side.

Modelled on the blog of mytwin.care (`src/features/blog/` in mytwin-health-landing): same idea of a shared template plus per-article visual blocks, adapted to news and to this app (English only, no dictionaries, the Lab's theme).

## Surface

| Path | What |
|---|---|
| `src/app/news/page.tsx` | the index: latest news featured, then a grid. `CollectionPage` + `BreadcrumbList` JSON-LD |
| `src/app/news/[slug]/page.tsx` | an article. `generateStaticParams` + `dynamicParams = false`: an unknown slug is a 404. `NewsArticle` + `BreadcrumbList` JSON-LD |
| `src/app/news/[slug]/opengraph-image.tsx` | the share preview of each news, generated at build: category, event month, title |
| `src/content/news/index.ts` | the registry: `NEWS_ARTICLES`, `getNewsBySlug`, `getLatestNews`, `getRelatedNews` |
| `src/content/news/types.ts` | `NewsArticle` and its parts, `NEWS_CATEGORY_LABELS` |
| `src/content/news/<slug>/` | one folder per news: `index.tsx` (the content) and its own visual blocks |
| `src/components/news/` | the template: `NewsArticleHeader`, `NewsArticleBody` (table of contents, *At a glance*, sections, FAQ, CTA, sources), `NewsCard` and its `NewsIllustrationFrame`, and the writing primitives `NewsProse`, `NewsLink`, `NewsCallout`, `NewsFigure`, `NewsPhotoRow`, `NewsVideoEmbed` |
| `public/news/` | the overview images (WebP), one per illustrated news |
| `src/components/podcast/` | MyTwin Inside episodes: `PodcastVideos` (home grid / mobile carousel) and `PodcastEpisodeEmbed` (one episode inside a news) |
| `src/components/home/HomeLatestNews.tsx` | "News" on the home page, the three latest news as `compact` cards |
| `lib/paths.ts` | `NEWS_PATH`, `newsPath(slug)` |
| `lib/seo.ts` | `articleMetadata`, `newsArticleJsonLd`, `collectionPageJsonLd`, `EDITORIAL_AUTHOR`, `authorJsonLd`; `buildSitemap` lists `/news` and every news |

Entry points: the footer ("MyTwin Lab News"), the home page section, and "Keep reading" under each news.

## Adding a news

1. Create `src/content/news/<slug>/index.tsx` exporting a `NewsArticle` (copy an existing one), with its `overviewTitle` and, if it has one, its `illustration`.
2. Add it to `ARTICLES` in `src/content/news/index.ts`.
3. Run the playbook checklist.

The sitemap, the index, the home section, the OG image and the JSON-LD follow from the registry.

## How the template reads the content

- **The body is written in bare tags** (`<p>`, `<ul>`, `<h3>`, `<strong>`): `NewsProse` styles its **direct** children only, so a visual block dropped between two paragraphs keeps its own typography.
- **Sections are data**: their `id` and `title` feed both the `<h2>` and the table of contents. From `MIN_SECTIONS_FOR_TOC` (3) sections, a sticky table of contents appears on desktop (scroll-spy, `lib/useScrollSpy.ts`) and a folded `<details>` one on mobile; below that, the column is centered and there is no table of contents.
- **FAQ and sources are optional**: no `faq`, no FAQ section and no FAQ entry in the table of contents. FAQ answers are plain strings and rendered in native `<details>`, so they stay in the DOM.
- **`NewsLink`** chooses the behaviour: `next/link` for Lab pages, same tab for mytwin.care, new tab with `rel="noopener"` for everything else (editorial links, no `nofollow`).
- **Photos in the body go through `NewsPhotoRow`**: one or several images on one line at the same height, each column as wide as its image's format, the row capped at 28rem high (portrait images narrow it rather than filling the screen). The WebP lives in `public/news/`. Unlike a card, a photo there carries a real `alt`: it is content.
- **A video goes through `NewsVideoEmbed`** (a talk, a conference): the article's `video` field, placed in the text by the article itself. The Lab serves the clip (`public/news/`, MP4 H.264 720p with `faststart`) instead of embedding YouTube: the reader stays on the page. Before the click, only the poster loads, through `next/image`; the `<video>` is mounted on click, so the article's load doesn't pay for the video. A non-English `language` is said under the player.
- **Cards show `eventMonth`**, the article header shows it next to the publication date: several news can be published the same day about events far apart.

## Overviews: title and illustration

A news has two faces. The article page carries `title`, the entity-first H1 written for search. Its overviews (the cards on `/news`, `/home` and under "Keep reading") carry `overviewTitle`, shorter and catchier, and an optional `illustration`:

| `illustration.kind` | What | Where it lives |
|---|---|---|
| `image` | a photo, cropped to the landscape frame (`position` sets `object-position`) | `public/news/`, or an image the site already serves |
| `visual` | a component drawn in HTML/SVG, on the frame's light panel or on its own (MyKine's is dark) | in the article's folder, next to its visual blocks (`access-illustration.tsx`, `home-session-illustration.tsx`, `mammogram-illustration.tsx`, `pose-illustration.tsx`, `risk-window-illustration.tsx`, `scan-illustration.tsx`) |

- **`NewsIllustrationFrame` fixes the format, the illustration fills it.** On a card the frame is 16:10 above the text; on the featured card of `/news` it takes the right half.
- **A visual is drawn in `em`.** The frame is a size container and sets its font size in `cqw`, so the whole drawing follows the width of the card. Colours are fixed (the panel stays light in both modes), never `currentColor` or `text-white`, which the light mode rewrites. An animation lives inside the component (a `<style>` with classes prefixed per article: `nes-`, `nhg-`, `niv-`, `nmg-`, `nrs-`) and stops under `prefers-reduced-motion`; SMIL ignores that query, so MyKine's pauses its SVG from a client effect.
- **An SVG that fills the frame is framed in 16:10**, the card's format (`viewBox` 352 × 220 around the drawing, `slice`): a 4:3 drawing would lose its top and bottom.
- **Always decorative in a card** (`aria-hidden`, empty `alt`): the title next to it already says what it shows. The `alt` of an image is there for the day it is shown on its own.
- **No illustration, no frame**: the card stays text only.
- **`compact` on `/home`**: the card keeps the illustration, the category, the month and the title, drops the excerpt, and its call shrinks to "Read". `/news` and "Keep reading" keep the full card.
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
- **Text-only cards next to illustrated ones** stretch to the row's height and show an empty band above "Read the news", on `/news` and under "Keep reading". On `/home` the band is taller: a `compact` card has no excerpt to fill it.
- **No "story so far" timeline yet.** The playbook's continuity rule (§3) is applied in the content for now: links between chapters and an update callout on the previous one. Build a timeline in the template when a project has two chapters.
- **Encoding a clip for a news**: `ffmpeg -i in.mp4 -vf scale=-2:720 -c:v libx264 -preset slow -crf 28 -c:a aac -b:a 96k -movflags +faststart public/news/<name>.mp4`. Without `+faststart`, the browser must fetch the whole file before playing.
- **The podcast data is duplicated from mytwin.care** (`components/podcast/episodes.ts`): a new episode there must be added here, thumbnail included (bundled, not hot-linked from YouTube).
- **YouTube loads only on click** (`youtube-nocookie.com`), which is what the privacy policy (§ 9) states. Don't autoplay or preload an embed.

Related: [`news-playbook.md`](./news-playbook.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
