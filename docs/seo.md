# SEO

> What search engines may index on mytwinlab.care, how the site declares itself as part of the MyTwin entity, and where the public-facing pages that carry that live.

The site has two jobs in search: rank its own pages (home, the `/about` landing, challenge and sandbox pages) and reinforce the **MyTwin** entity whose canonical domain is mytwin.care. The two sites must not compete for the same queries: "digital twin" belongs to mytwin.care, the Lab owns "MyTwin Lab" and open health innovation.

## Surface

| Path | Indexed | Notes |
|---|---|---|
| `/` | ✅ | brand-first title, `Organization` + `WebSite` JSON-LD |
| `/about` | ✅ | the Lab landing (institutions + contributors), `AboutPage` JSON-LD |
| `/challenges`, `/challenges/<id>` | ✅ public ones | `BreadcrumbList` JSON-LD on detail |
| `/sandbox`, `/sandbox/<id>` | ✅ visible ones | `BreadcrumbList` JSON-LD on detail |
| `/leaderboard` | ✅ | |
| `/terms-of-use`, `/privacy-policy` | ✅ | markdown in `apps/leaderboard-client/content/legal/` |
| `/contributors/<id>` | ❌ `noindex, follow` | public, but a person's name is not a search result |
| drafts, validation challenges, archived sandboxes | ❌ `noindex, nofollow` | `unindexedMetadata()` — title not published either |
| `/admin`, `/signin`, `/contributors/me`, `/challenges/<id>/manage`, `/tasks`, `/sync-meetings`, `/api` | ❌ `X-Robots-Tag: noindex, nofollow` | header set in `next.config.ts` |

Everything is decided **from an anonymous visitor's point of view**: crawlers never have a session.

Where things live:
- `src/lib/seo.ts` — `SITE_URL`, `SITE_NAME`, `pageMetadata()`, sitemap builder, JSON-LD builders. Pure, no DB.
- `src/lib/server/seo.ts` — metadata and JSON-LD that depend on the database (challenge, sandbox, contributor), sitemap data.
- `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/opengraph-image.tsx`.
- `src/components/layout/Footer.tsx` — site-wide links, including the editorial link to mytwin.care and the legal pages.

## Gotchas

- **The canonical origin is a constant**, `SITE_URL` in `lib/seo.ts`, not `NEXT_PUBLIC_APP_URL`. That variable is inlined at build time: a build made before it was changed on Scalingo served canonicals, sitemap and robots.txt on `*.scalingo.io`, a domain that 301s to mytwinlab.care — a canonical pointing at a redirect, which Google cannot consolidate. `NEXT_PUBLIC_APP_URL` is still the fallback for post-login redirects (`lib/url.ts`).
- **Only `/admin` is `Disallow`ed.** A `Disallow` blocks crawling, so the engine never reads the page's `noindex`, and a blocked URL linked from elsewhere (the navbar's "Sign in" is on every page) can still be indexed without a description. Private pages stay crawlable and carry the header instead. Listing them in robots.txt would make them *less* safe.
- **`/api` is not disallowed either.** Challenge and sandbox detail pages are client components that fetch their content from `/api/...`; Googlebot honours robots.txt for those requests while rendering.
- **The sitemap lists indexable URLs only.** A `noindex` URL in it lowers the trust Google gives the whole file — which is why contributor profiles left it when they went `noindex`.
- **Challenge and Sandbox pages are client components, server-rendered for cookieless visitors.** `ChallengeDetailClient`, `SandboxDetailClient` and `SandboxExplorer` read their data from the API after `/api/contributors/me`; rendered as-is they ship a skeleton. For a visitor with no `access_token`, `refresh_token` or `sb_anon` cookie — every crawler — the server `page.tsx` prefills the React Query cache and the page arrives complete in the HTML (`lib/server/publicSsr.ts`). Anyone holding one of those cookies gets the client-loaded page, unchanged: their view depends on a session only the client can refresh.
- **The prefill calls the API route handlers in-process** (`readPublicRoute`) instead of re-implementing them: the field allowlists in `lib/public/*` stay the single place deciding what an anonymous visitor sees, so the HTML can never publish more than the public API. The query keys prefilled must match the client's `useQuery` keys.
- **A disabled query stays `isPending`.** The client components skip `meQuery` for a known-anonymous visitor, so they test a `sessionKnown` flag rather than `meQuery.isPending` — testing the latter would bring the skeleton back.
- Challenge cards on `/challenges` carry a real `<a href>` on their title: an `onClick` + `router.push` is not a link to a crawler.
- **JSON-LD escapes `<`** (`components/seo/JsonLd.tsx`): challenge and sandbox titles are user input.
- **Legal markdown is read with `process.cwd()`** (`lib/server/legal.ts`), which is `apps/leaderboard-client` under the Procfile and `next dev`. The in-house `Markdown` renderer has no tables, restarts ordered lists after a paragraph, and renders a bare `>` line as text — the legal files are written around that.

## Decisions

**MyTwin Lab is a child organization of MyTwin, not the same entity.** Its `Organization` node carries `parentOrganization` with `@id` `https://mytwin.care/#organization` — the exact `@id` mytwin.care declares in its own `src/lib/seo.ts`. A `sameAs` to mytwin.care would state that both sites describe one thing. `sameAs` only lists profiles of the Lab that exist (the MyTwin-Lab GitHub organization). The reverse link lives on mytwin.care (`subOrganization` + footer link).

**One page per query.** `/about` became the Lab landing and absorbed the values of the former manifesto: two pages about "MyTwin Lab" would compete for the same query.

**The landing tells the vision, the legal pages tell the facts.** `/about` presents where the Lab is going — applications connected to the MyTwin Platform, Sandbox projects built together — because that link is what the Lab means to an institution. Two things stay strictly factual on it because health is YMYL: the research-vs-medical-device line and the patient-data rule. No partner is named until one is public. The terms and privacy policy describe what the service actually does.

## Operating

After a deploy that touches any of this, check what production actually serves — not the code:

```bash
curl -s https://mytwinlab.care/robots.txt
curl -s https://mytwinlab.care/sitemap.xml | grep -o "<loc>[^<]*</loc>"
curl -s https://mytwinlab.care/about | grep -oE '<(title>[^<]*|link rel="canonical"[^>]*|meta name="(description|robots)"[^>]*)'
curl -sI https://mytwinlab.care/signin | grep -i x-robots-tag
```

Search Console: a **Domain** property for `mytwinlab.care`, verified by DNS TXT (survives any web-server change), with `https://mytwinlab.care/sitemap.xml` submitted.

Related: [`sandbox.md`](./sandbox.md) · [`deployment.md`](./deployment.md) · [`index.md`](./index.md)
