/**
 * Module watch — ce que le client et le serveur partagent
 * -------------------------------------------------------
 * La forme de `GET /api/watch/search`, les filtres de la page `/watch` et leur
 * aller-retour avec l'URL. Pur : aucun import serveur, aucun composant.
 *
 * L'URL est la source de vérité des filtres : recharger une recherche filtrée
 * restitue exactement les mêmes filtres, et un lien se partage tel quel.
 */

export type WatchScope = "all" | "title";
export type WatchSort = "relevance" | "date" | "cited";
export type WatchPeriod = "30d" | "6m" | "1y" | "5y" | "any";

export interface WatchResult {
  id: string;
  title: string;
  doi: string | null;
  pmid: string | null;
  /** PubMed si PMID, sinon le DOI, sinon la page OpenAlex. */
  url: string;
  publication_date: string | null;
  cited_by_count: number;
  is_oa: boolean;
  oa_url: string | null;
  journal: { source_id: string | null; name: string | null; citedness_2yr: number | null };
  primary_topic: { id: string; name: string; subfield: string | null } | null;
  /** Les trois premiers ; `authors_count` dit combien il y en a en tout. */
  authors: string[];
  authors_count: number;
  abstract: string | null;
}

export interface WatchFacet {
  id: string;
  name: string;
  count: number;
}

export interface WatchSearchResponse {
  results: WatchResult[];
  facets: { topics: WatchFacet[] };
  total: number;
  page: number;
  page_size: number;
  /** Mode high-impact : plus de `page_size` résultats après filtre, seuls les premiers sont là. */
  high_impact_truncated: boolean;
}

/** Ce que l'API rend quand OpenAlex n'a pas répondu, ou que le module n'est pas réglé. */
export interface WatchSearchError {
  error: string;
  kind?: "timeout" | "rate_limited" | "upstream" | "network" | "invalid";
}

export interface WatchFilters {
  q: string;
  scope: WatchScope;
  period: WatchPeriod;
  topics: string[];
  oa: boolean;
  highImpact: boolean;
  minCited: number | null;
  sort: WatchSort;
  page: number;
}

export const DEFAULT_WATCH_FILTERS: WatchFilters = {
  q: "",
  scope: "all",
  period: "1y",
  topics: [],
  oa: false,
  highImpact: false,
  minCited: null,
  sort: "relevance",
  page: 1,
};

/** OpenAlex limite la pagination simple à 10 000 résultats : 40 pages au plus. */
export const MAX_WATCH_PAGE = 40;
export const MAX_WATCH_QUERY_LENGTH = 300;
export const MAX_WATCH_TOPICS = 20;
export const MAX_WATCH_MIN_CITED = 10_000_000;
/** Chips de topics visibles avant « more ». */
export const VISIBLE_TOPIC_FACETS = 10;

export const WATCH_PERIODS: ReadonlyArray<{ key: WatchPeriod; label: string; days: number | null }> = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "6m", label: "6 months", days: 183 },
  { key: "1y", label: "1 year", days: 365 },
  { key: "5y", label: "5 years", days: 5 * 365 },
  { key: "any", label: "Any", days: null },
];

export const WATCH_SORTS: ReadonlyArray<{ key: WatchSort; label: string }> = [
  { key: "relevance", label: "Relevance" },
  { key: "date", label: "Newest" },
  { key: "cited", label: "Most cited" },
];

export const WATCH_SCOPES: ReadonlyArray<{ key: WatchScope; label: string }> = [
  { key: "all", label: "Title + abstract" },
  { key: "title", label: "Title only" },
];

const SCOPES = new Set<string>(WATCH_SCOPES.map((scope) => scope.key));
const SORTS = new Set<string>(WATCH_SORTS.map((sort) => sort.key));
const PERIODS = new Set<string>(WATCH_PERIODS.map((period) => period.key));
/** Un subfield OpenAlex (`2730`) ou un topic (`T10001`). */
const TOPIC_ID = /^T?\d{1,12}$/;

/** Les ids de topics d'une liste séparée par des virgules : valides, uniques, bornés. */
export function parseTopicIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const ids: string[] = [];
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (TOPIC_ID.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= MAX_WATCH_TOPICS) break;
  }
  return ids;
}

function parseNonNegativeInt(raw: string | null, max: number): number | null {
  if (raw === null || !/^\d{1,12}$/.test(raw)) return null;
  const value = Number(raw);
  return value > max ? max : value;
}

/** Les filtres portés par une URL de `/watch` ; une valeur illisible retombe sur son défaut. */
export function parseWatchFilters(params: URLSearchParams): WatchFilters {
  const scope = params.get("scope");
  const sort = params.get("sort");
  const period = params.get("period");
  const page = parseNonNegativeInt(params.get("page"), MAX_WATCH_PAGE);
  const minCited = parseNonNegativeInt(params.get("min_cited"), MAX_WATCH_MIN_CITED);
  return {
    q: (params.get("q") ?? "").slice(0, MAX_WATCH_QUERY_LENGTH),
    scope: scope && SCOPES.has(scope) ? (scope as WatchScope) : DEFAULT_WATCH_FILTERS.scope,
    period: period && PERIODS.has(period) ? (period as WatchPeriod) : DEFAULT_WATCH_FILTERS.period,
    topics: parseTopicIds(params.get("topics")),
    oa: params.get("oa") === "true",
    highImpact: params.get("high_impact") === "true",
    minCited: minCited && minCited > 0 ? minCited : null,
    sort: sort && SORTS.has(sort) ? (sort as WatchSort) : DEFAULT_WATCH_FILTERS.sort,
    page: page && page >= 1 ? page : 1,
  };
}

/** L'URL d'une recherche : seuls les filtres qui diffèrent du défaut y figurent. */
export function serializeWatchFilters(filters: WatchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.scope !== DEFAULT_WATCH_FILTERS.scope) params.set("scope", filters.scope);
  if (filters.period !== DEFAULT_WATCH_FILTERS.period) params.set("period", filters.period);
  if (filters.topics.length > 0) params.set("topics", filters.topics.join(","));
  if (filters.oa) params.set("oa", "true");
  if (filters.highImpact) params.set("high_impact", "true");
  if (filters.minCited !== null && filters.minCited > 0) params.set("min_cited", String(filters.minCited));
  if (filters.sort !== DEFAULT_WATCH_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

/** Le tri appliqué : la pertinence n'a pas de sens sans texte, on rend alors le plus récent. */
export function effectiveSort(filters: Pick<WatchFilters, "q" | "sort">): WatchSort {
  return filters.sort === "relevance" && !filters.q.trim() ? "date" : filters.sort;
}

/** Aucun texte ni filtre restrictif : la page montre son aide et ses exemples. */
export function isInitialState(filters: WatchFilters): boolean {
  return !filters.q.trim() && filters.topics.length === 0 && !filters.oa && !filters.highImpact && !filters.minCited;
}

/** Le premier jour de la période, en date ISO (UTC), ou `null` pour « Any ». */
export function periodStart(period: WatchPeriod, today: Date): string | null {
  const days = WATCH_PERIODS.find((entry) => entry.key === period)?.days ?? null;
  if (days === null) return null;
  return new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Les paramètres de `GET /api/watch/search` pour ces filtres. */
export function toWatchApiQuery(filters: WatchFilters, today: Date): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set("q", q);
  if (filters.scope !== "all") params.set("scope", filters.scope);
  const from = periodStart(filters.period, today);
  if (from) params.set("from", from);
  if (filters.topics.length > 0) params.set("topics", filters.topics.join(","));
  if (filters.oa) params.set("oa", "true");
  if (filters.highImpact) params.set("high_impact", "true");
  if (filters.minCited !== null && filters.minCited > 0) params.set("min_cited", String(filters.minCited));
  params.set("sort", effectiveSort(filters));
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}
