# Watch

Watch is a **search page over the health literature**, backed by [OpenAlex](https://openalex.org): a query, filters that speak (topics, period, open access, high-impact journals), and results readable at a glance — title, journal and its impact score, abstract, PubMed link. No feed to configure, no cron: you search, you read, you close.

It is a product **module** (`modules/watch`), **enabled by default**, that an admin can turn off from the Modules tab of `/contributors/me` (see [`admin-settings.md`](./admin-settings.md)). It is reached from the **« Open resources »** link of the home page, and lives at `/watch`.

**Requires:** nothing — OpenAlex is public, free, and needs no API key. An OpenAlex contact email (the module's `openalex_mailto` setting) is recommended: it earns the "polite pool" (faster, less throttled).

**Reference document:** [`input/spec-watch-module.md`](./input/spec-watch-module.md) (functional spec, V1).

---

## What the page does

`/watch` is public: anyone reads the spotlight, and the page is indexable and in the sitemap while the module is enabled. Searching needs an account — `/api/watch/search` is in the proxy matcher (`distribution/modules/watch.proxy.ts`), and an anonymous visitor who types a query is offered to sign in (`/signin?from=/watch…`), the query kept in the URL. The page answers 404 while the module is disabled.

| Element | Behaviour |
|---|---|
| Search box | Debounced 400 ms, or Enter. Empty query with no restrictive filter → the **spotlight** (three publications rendered on the server, `lib/server/watch/spotlight.ts`, through the same cached search: the `spotlight_query` setting by relevance — « mammography deep learning » by default — or, when it is empty, the most cited of the last 30 days in the default domains), and no client request. |
| Search in | `Title + abstract` (OpenAlex `search=`) or `Title only` (`title.search:` filter). |
| Period | 30 days / 6 months / 1 year (default) / 5 years / Any — turned into a `from` date on the client. |
| Topics | Multi-select chips fed by the facets of the current search (OpenAlex subfields, with their count). 10 visible, « more » for the rest. |
| Open access only | `is_oa:true`. |
| High-impact journals only | Keeps journals whose 2-year mean citedness is at or above the module's threshold (default 9). See below. |
| Min. citations | `cited_by_count:>N-1`, i.e. "at least N". |
| Sort | Relevance (Newest when the query is empty — OpenAlex refuses a relevance sort without text), Newest, Most cited. |

Every filter lives in the URL (`lib/watch.ts`: `parseWatchFilters` / `serializeWatchFilters`), so a search reloads and shares as is.

A result card shows the title (linked to PubMed when a PMID exists, else the DOI, else OpenAlex), the journal and its score badge (tinted at or above the threshold), the date, the citation count, an `OA` badge, the first three authors (`+N`), the primary topic, and the abstract folded on two lines. Publishers that do not give OpenAlex an abstract are shown `No abstract available` — that is normal, not an error.

An OpenAlex failure (timeout, rate limit, 5xx) does not empty the list: the last answer stays, a line above it says what happened, and a Retry button asks again.

The page follows the vitrine design system of the redesign (`components/vitrine/vitrine.css` for the header, the search capsule and the pills; `components/watch/watch-vitrine.css` for the filter column, the result cards and the pagination). `/watch` is a vitrine route of `LabShell`.

---

## The module

`modules/watch/index.ts` declares the module: key `watch`, disabled by default, no job, no CP source, no event. Its settings schema is `modules/watch/settings.ts`:

| Setting | Default | Role |
|---|---|---|
| `openalex_mailto` | empty | Contact email sent with every OpenAlex call (`mailto=` and `User-Agent`) when set. Recommended for the polite pool; without it, OpenAlex still answers. |
| `default_domain_ids` | `["4"]` | OpenAlex domains searched by default (`4` = Health Sciences; ids at `GET https://api.openalex.org/domains`). |
| `high_impact_threshold` | `9` | 2-year mean citedness at or above which a journal counts as high-impact. |
| `page_size` | `25` | Results per page, 1 to 50. Never taken from the client. |
| `cache_ttl_seconds` | `600` | How long a search answer is reused before asking OpenAlex again. |
| `spotlight_query` | `mammography deep learning` | The search shown before any search (the page's spotlight), by relevance. Empty: the most cited papers of the last 30 days. |

**Enable guard.** The module is the first to use `ModuleDefinition.enableGuard` (challenge 020's registry, `packages/registry/platform.ts`): a function of the settings that says what prevents the module from being active, or `null`. The `modules` capability calls it on every update that leaves the module enabled; the watch guard refuses a malformed email with a `ModuleEnableError`, which `PATCH /api/modules/[key]` answers as `409` with the reason. Disabling never consults the guard.

The admin editor (`components/watch/WatchSettings.tsx`, wired in `distribution/modules/settings.tsx`) edits the five settings, each saved on blur.

---

## The API

### `GET /api/watch/search`

Signed-in sessions only (`/api/watch` is in the proxy matcher, and the handler re-checks) — the page is public, the search is not. `404` while the module is disabled, `401` without a session, `400` with `details` on an unreadable parameter.

| Param | Type | Notes |
|---|---|---|
| `q` | string ≤ 300 | Free text. Optional. |
| `scope` | `all` \| `title` | Default `all`. |
| `from`, `to` | ISO date | Optional, `from` ≤ `to`. |
| `topics` | comma-separated ids | OpenAlex subfield ids (`2730`) or topic ids (`T10001`), at most 20. |
| `oa`, `high_impact` | `true` \| `false` | |
| `min_cited` | integer ≥ 0 | |
| `sort` | `relevance` \| `date` \| `cited` | Relevance falls back to date without `q`. |
| `page` | 1 to 40 | OpenAlex limits basic pagination to 10 000 results. |

The response is the spec's shape: `results[]` (id, title, doi, pmid, url, publication_date, cited_by_count, is_oa, oa_url, `journal { source_id, name, citedness_2yr }`, `primary_topic { id, name, subfield }`, first three `authors`, `authors_count`, `abstract`), `facets.topics[]` (`{ id, name, count }`, 15 at most), `total`, `page`, `page_size`, `high_impact_truncated`.

Failures are typed for the client (`kind` in the body): `429` when OpenAlex rate-limits the server, `504` on a timeout, `502` on a 5xx or an unreachable OpenAlex.

---

## The OpenAlex integration

**Client** — `lib/server/openalex.ts`, native `fetch`, no SDK. When the module has a contact email, every call carries `mailto=` and `User-Agent: MyTwinLeaderboard/1.0 (mailto:…)`. Per process: at most **5 requests per second** (a sliding-window limiter on `globalThis`), an **8 s timeout**, and **one retry** after 500 ms on `429` or `5xx`. Errors are `OpenAlexError` with a `kind` (`timeout`, `rate_limited`, `upstream`, `network`, `invalid`).

**Query** — `lib/server/watch/query.ts`, pure. The `/works` filter always carries `type:article`, `primary_location.source.type:journal`, `language:en` and `primary_topic.domain.id:<defaults>`; the rest follows the params (`from_publication_date`, `to_publication_date`, `primary_topic.subfield.id:a|b` or `topics.id:…`, `is_oa:true`, `cited_by_count:>N-1`). `select=` limits the payload to what the card shows. The abstract is rebuilt from `abstract_inverted_index` by sorting positions.

**Facets** — a second `/works` call, in parallel, with the same filters minus `topics`, `group_by=primary_topic.subfield.id`, `per-page=1`. The first 15 groups are kept. A facet failure degrades to no facets and a log line; results still come back.

**Journal score** — `summary_stats.2yr_mean_citedness` lives on `/sources/{id}`, not on `/works`. For each page, the journals are resolved in `watch_sources` (`WatchSourceRepository`: `findMany`, `upsertMany`); the missing ones and those refreshed more than 30 days ago are fetched from `/sources?filter=ids.openalex:S1|S2|…` by batches of 50 and upserted. If that call fails, the page renders with the stored scores, stale or not.

**High-impact mode** — `per-page=100`, post-filtered on the threshold, the first `page_size` returned. No pagination beyond: when more than `page_size` results survive, `high_impact_truncated: true` and the page shows « Showing the first N high-impact results — narrow your search to see more ». An assumed V1 limitation.

**Cache** — `lib/server/watch/search.ts` keeps answers in memory (`globalThis`, 500 entries at most), keyed on the normalized params (lower-cased and collapsed query, sorted topics, resolved sort, page, and the settings that change an answer) for `cache_ttl_seconds`. Facets have their own key, shared by searches that differ only by topics, page, sort or the high-impact flag. A same search within the TTL makes **no** OpenAlex call. One process only: a multi-instance deployment would move it to Postgres (V2).

---

## Database

One table, created by `db:apply-schema` (`CREATE TABLE IF NOT EXISTS`) and declared in `packages/database-service/db/drizzle.ts`:

| Table | Purpose |
|---|---|
| `watch_sources` | The persistent cache of OpenAlex journals: `source_id` (e.g. `S137773608`, primary key), `display_name`, `citedness_2yr` (`numeric(8,3)`, null when OpenAlex has none), `refreshed_at`. Read by batches of ids, written by upsert; nothing is ever deleted. |

---

## Where the code lives

| Piece | Path |
|---|---|
| Module declaration and settings schema | `modules/watch/` |
| Enable guard in the core | `packages/registry/platform.ts` (`enableGuard`), `packages/capabilities/modules.ts` (`ModuleEnableError`) |
| Table and repository | `packages/database-service/db/drizzle.ts` (`watch_sources`), `packages/database-service/repositories/watchSource.repo.ts`, `scripts/db-apply-schema.ts` |
| OpenAlex client | `apps/leaderboard-client/src/lib/server/openalex.ts` |
| Search service (query building, cache, journal scores) | `apps/leaderboard-client/src/lib/server/watch/` |
| Shared types and URL filters | `apps/leaderboard-client/src/lib/watch.ts` |
| Route | `apps/leaderboard-client/src/app/api/watch/search/route.ts` |
| Page and components | `apps/leaderboard-client/src/app/watch/page.tsx`, `apps/leaderboard-client/src/components/watch/` |
| Distribution (slots, proxy, settings editor) | `apps/leaderboard-client/src/distribution/modules/watch.tsx`, `watch.proxy.ts`, `settings.tsx` |
| Home card | `apps/leaderboard-client/src/components/home/HomeResourceCard.tsx`: the « Open resources » card of the home page links to `/watch` while the module is enabled (the `homeLinks` slot of `lib/moduleSlots.ts`), to the external watch script otherwise |

The shell never imports `modules/watch`: the route reads the module through the `modules` capability (`readWatchSettings`), as the sandbox does. The architecture test (`packages/registry/architecture.test.ts`) enforces it.

---

## Tests

- **Unit** — `lib/watch.test.ts` (URL filters), `lib/server/watch/query.test.ts` (params, filter building for every combination, cache keys, abstract reconstruction, normalization), `lib/server/watch/search.test.ts` (cache hits, facets reuse, journal resolution by batches, high-impact truncation), `lib/server/openalex.test.ts` (mailto, retry, timeout, limiter), `modules/watch/settings.test.ts`, `packages/capabilities/modules.test.ts` (enable guard).
- **Route** — `app/api/watch/search/route.test.ts`: 404 module off, 401 without session, 400 on invalid params, spec-shaped response with a mocked service, error mapping.
- **External** — `lib/server/watch/openalex.external.test.ts`: one real call on `hepatocellular carcinoma`, checks ≥ 1 result with a non-null `journal.citedness_2yr`. Skipped unless `WATCH_EXTERNAL_TESTS=1`, and always in CI (see [`testing.md`](./testing.md)).

---

## Out of scope (V2)

Saved searches and « Follow this search » (a weekly `watch.fetch` job, a `publications` table, a digest section), a « Recent papers » block on a challenge brief (`challenge.watch_query`), LLM summaries or translations, per-contributor favourites and annotations, and a Postgres-backed query cache for multi-instance deployments.
