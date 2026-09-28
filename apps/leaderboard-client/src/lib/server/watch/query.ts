import {
  MAX_WATCH_MIN_CITED,
  MAX_WATCH_PAGE,
  MAX_WATCH_QUERY_LENGTH,
  parseTopicIds,
  type WatchFacet,
  type WatchResult,
  type WatchScope,
  type WatchSort,
} from "@/lib/watch";
import type { WatchSettings } from "./settings";

/**
 * Module watch — la traduction d'une recherche en requête OpenAlex
 * -----------------------------------------------------------------
 * Pur : ni réseau, ni base. Lit les paramètres de `GET /api/watch/search`,
 * construit le `filter` de `/works`, normalise la clé du cache et met en
 * forme ce qu'OpenAlex rend (abstract inversé compris).
 */

// ─── Paramètres de la route ──────────────────────────────────────────────────

export interface WatchSearchQuery {
  q: string;
  scope: WatchScope;
  from: string | null;
  to: string | null;
  topics: string[];
  oa: boolean;
  high_impact: boolean;
  min_cited: number | null;
  sort: WatchSort;
  page: number;
}

export type ParsedWatchQuery = { ok: true; query: WatchSearchQuery } | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCOPES: readonly WatchScope[] = ["all", "title"];
const SORTS: readonly WatchSort[] = ["relevance", "date", "cited"];

function isValidDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readInt(params: URLSearchParams, name: string, min: number, max: number): number | null | string {
  const raw = params.get(name);
  if (raw === null || raw === "") return null;
  if (!/^\d{1,12}$/.test(raw)) return `${name} must be a whole number`;
  const value = Number(raw);
  if (value < min || value > max) return `${name} must be between ${min} and ${max}`;
  return value;
}

/** Les paramètres de la route, vérifiés. `page_size` n'en fait pas partie : il vient des réglages. */
export function parseWatchSearchQuery(params: URLSearchParams): ParsedWatchQuery {
  const q = (params.get("q") ?? "").trim();
  if (q.length > MAX_WATCH_QUERY_LENGTH) return { ok: false, error: `q must be at most ${MAX_WATCH_QUERY_LENGTH} characters` };

  const scope = params.get("scope") ?? "all";
  if (!SCOPES.includes(scope as WatchScope)) return { ok: false, error: "scope must be 'all' or 'title'" };

  const sort = params.get("sort") ?? "relevance";
  if (!SORTS.includes(sort as WatchSort)) return { ok: false, error: "sort must be 'relevance', 'date' or 'cited'" };

  const from = params.get("from") || null;
  if (from !== null && !isValidDate(from)) return { ok: false, error: "from must be an ISO date (YYYY-MM-DD)" };
  const to = params.get("to") || null;
  if (to !== null && !isValidDate(to)) return { ok: false, error: "to must be an ISO date (YYYY-MM-DD)" };
  if (from && to && from > to) return { ok: false, error: "from must not be after to" };

  const rawTopics = params.get("topics") ?? "";
  const topics = parseTopicIds(rawTopics);
  if (rawTopics.trim() && topics.length === 0) return { ok: false, error: "topics must be OpenAlex subfield or topic ids" };

  for (const flag of ["oa", "high_impact"]) {
    const value = params.get(flag);
    if (value !== null && value !== "true" && value !== "false") return { ok: false, error: `${flag} must be 'true' or 'false'` };
  }

  const minCited = readInt(params, "min_cited", 0, MAX_WATCH_MIN_CITED);
  if (typeof minCited === "string") return { ok: false, error: minCited };
  const page = readInt(params, "page", 1, MAX_WATCH_PAGE);
  if (typeof page === "string") return { ok: false, error: page };

  return {
    ok: true,
    query: {
      q,
      scope: scope as WatchScope,
      from,
      to,
      topics,
      oa: params.get("oa") === "true",
      high_impact: params.get("high_impact") === "true",
      min_cited: minCited && minCited > 0 ? minCited : null,
      sort: sort as WatchSort,
      page: page ?? 1,
    },
  };
}

// ─── Requête `/works` ────────────────────────────────────────────────────────

/** Les champs rapatriés : rien de plus que ce que la carte affiche. */
export const WORKS_SELECT =
  "id,title,doi,ids,publication_date,cited_by_count,open_access,primary_location,primary_topic,authorships,abstract_inverted_index";

/** Groupes de facettes gardés. */
export const FACET_LIMIT = 15;

/** Une valeur de filtre OpenAlex : la virgule sépare les filtres, la barre les alternatives. */
function filterValue(text: string): string {
  return text.replace(/[,|]/g, " ").replace(/\s+/g, " ").trim();
}

/** Le tri OpenAlex : `relevance_score` n'existe qu'avec un texte cherché. */
export function resolveSort(query: Pick<WatchSearchQuery, "q" | "sort">): string {
  if (query.sort === "cited") return "cited_by_count:desc";
  if (query.sort === "relevance" && query.q) return "relevance_score:desc";
  return "publication_date:desc";
}

/** Les filtres communs à la recherche et aux facettes (`topics` en option). */
function buildFilters(query: WatchSearchQuery, settings: WatchSettings, withTopics: boolean): string {
  const filters = [
    "type:article",
    "primary_location.source.type:journal",
    "language:en",
    `primary_topic.domain.id:${settings.defaultDomainIds.join("|")}`,
  ];
  if (query.q && query.scope === "title") filters.push(`title.search:${filterValue(query.q)}`);
  if (query.from) filters.push(`from_publication_date:${query.from}`);
  if (query.to) filters.push(`to_publication_date:${query.to}`);
  if (withTopics && query.topics.length > 0) {
    // Les facettes rendent des subfields (ids numériques) ; un topic (`T…`)
    // reste accepté pour un lien construit à la main.
    const subfields = query.topics.filter((id) => !id.startsWith("T"));
    const topics = query.topics.filter((id) => id.startsWith("T"));
    if (subfields.length > 0) filters.push(`primary_topic.subfield.id:${subfields.join("|")}`);
    if (topics.length > 0) filters.push(`topics.id:${topics.join("|")}`);
  }
  if (query.oa) filters.push("is_oa:true");
  // « Au moins N citations » : OpenAlex ne connaît que le strict `>`.
  if (query.min_cited !== null && query.min_cited > 0) filters.push(`cited_by_count:>${query.min_cited - 1}`);
  return filters.join(",");
}

export interface WorksPage {
  perPage: number;
  page: number;
}

/** Les paramètres de `GET /works` pour une page de résultats. */
export function buildWorksParams(
  query: WatchSearchQuery,
  settings: WatchSettings,
  page: WorksPage,
): Record<string, string | undefined> {
  return {
    search: query.q && query.scope === "all" ? query.q : undefined,
    filter: buildFilters(query, settings, true),
    sort: resolveSort(query),
    "per-page": String(page.perPage),
    page: String(page.page),
    select: WORKS_SELECT,
  };
}

/** Les paramètres de `GET /works` pour les facettes : mêmes filtres, sans `topics`, groupés par subfield. */
export function buildFacetParams(query: WatchSearchQuery, settings: WatchSettings): Record<string, string | undefined> {
  return {
    search: query.q && query.scope === "all" ? query.q : undefined,
    filter: buildFilters(query, settings, false),
    group_by: "primary_topic.subfield.id",
    "per-page": "1",
  };
}

// ─── Clés de cache ───────────────────────────────────────────────────────────

function normalizedText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Ce qui, dans les réglages, change une réponse. */
function settingsKey(settings: WatchSettings): string {
  return [settings.defaultDomainIds.join("|"), settings.pageSize, settings.highImpactThreshold].join(";");
}

/** La clé d'une page de résultats : paramètres normalisés, réglages qui comptent. */
export function searchCacheKey(query: WatchSearchQuery, settings: WatchSettings): string {
  return JSON.stringify([
    "search",
    normalizedText(query.q),
    query.scope,
    query.from,
    query.to,
    [...query.topics].sort(),
    query.oa,
    query.high_impact,
    query.min_cited,
    resolveSort(query),
    query.page,
    settingsKey(settings),
  ]);
}

/** La clé des facettes : la même recherche, sans `topics` ni `page` ni tri ni filtre high-impact. */
export function facetsCacheKey(query: WatchSearchQuery, settings: WatchSettings): string {
  return JSON.stringify([
    "facets",
    normalizedText(query.q),
    query.scope,
    query.from,
    query.to,
    query.oa,
    query.min_cited,
    settings.defaultDomainIds.join("|"),
  ]);
}

// ─── Réponse OpenAlex ────────────────────────────────────────────────────────

export interface OpenAlexWork {
  id?: string | null;
  title?: string | null;
  display_name?: string | null;
  doi?: string | null;
  ids?: { pmid?: string | null; doi?: string | null } | null;
  publication_date?: string | null;
  cited_by_count?: number | null;
  open_access?: { is_oa?: boolean | null; oa_url?: string | null } | null;
  primary_location?: { source?: { id?: string | null; display_name?: string | null } | null } | null;
  primary_topic?: {
    id?: string | null;
    display_name?: string | null;
    subfield?: { id?: string | null; display_name?: string | null } | null;
  } | null;
  authorships?: Array<{ author?: { display_name?: string | null } | null }> | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export interface OpenAlexGroup {
  key?: string | null;
  key_display_name?: string | null;
  count?: number | null;
}

export interface OpenAlexWorksResponse {
  meta?: { count?: number | null } | null;
  results?: OpenAlexWork[] | null;
  group_by?: OpenAlexGroup[] | null;
}

export interface OpenAlexSource {
  id?: string | null;
  display_name?: string | null;
  summary_stats?: { "2yr_mean_citedness"?: number | null } | null;
}

export interface OpenAlexSourcesResponse {
  results?: OpenAlexSource[] | null;
}

/** `https://openalex.org/W123` → `W123` ; `https://openalex.org/subfields/2730` → `2730`. */
export function stripOpenAlexId(value: string | null | undefined): string | null {
  if (!value) return null;
  const last = value.split("/").filter(Boolean).pop() ?? "";
  return last || null;
}

function stripDoi(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim() || null;
}

function stripPmid(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/(\d+)\/?$/);
  return match ? match[1] : null;
}

/**
 * L'abstract depuis son index inversé (`mot → positions`), en triant les
 * positions. Vide ou absent → `null` : bien des éditeurs ne le fournissent pas
 * à OpenAlex, ce n'est pas une erreur.
 */
export function reconstructAbstract(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const words: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (Number.isInteger(position)) words.push([position, word]);
    }
  }
  if (words.length === 0) return null;
  words.sort((a, b) => a[0] - b[0]);
  const text = words
    .map(([, word]) => word)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** L'id de revue d'un résultat (`S…`), ou `null`. */
export function sourceIdOf(work: OpenAlexWork): string | null {
  return stripOpenAlexId(work.primary_location?.source?.id);
}

/** Un résultat tel que la carte l'affiche, le score de revue venant du cache des revues. */
export function normalizeWork(work: OpenAlexWork, citednessBySource: ReadonlyMap<string, number | null>): WatchResult {
  const id = stripOpenAlexId(work.id) ?? "";
  const doi = stripDoi(work.doi ?? work.ids?.doi);
  const pmid = stripPmid(work.ids?.pmid);
  const sourceId = sourceIdOf(work);
  const authorships = Array.isArray(work.authorships) ? work.authorships : [];
  const authors = authorships
    .map((authorship) => authorship?.author?.display_name?.trim() ?? "")
    .filter((name) => name.length > 0);
  const topic = work.primary_topic;

  return {
    id,
    title: (work.title ?? work.display_name ?? "").trim() || "Untitled",
    doi,
    pmid,
    url: pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : doi
        ? `https://doi.org/${doi}`
        : `https://openalex.org/${id}`,
    publication_date: work.publication_date ?? null,
    cited_by_count: typeof work.cited_by_count === "number" ? work.cited_by_count : 0,
    is_oa: work.open_access?.is_oa === true,
    oa_url: work.open_access?.oa_url ?? null,
    journal: {
      source_id: sourceId,
      name: work.primary_location?.source?.display_name ?? null,
      citedness_2yr: sourceId ? (citednessBySource.get(sourceId) ?? null) : null,
    },
    primary_topic: topic?.id
      ? {
          id: stripOpenAlexId(topic.id) ?? "",
          name: topic.display_name ?? "",
          subfield: topic.subfield?.display_name ?? null,
        }
      : null,
    authors: authors.slice(0, 3),
    authors_count: authorships.length,
    abstract: reconstructAbstract(work.abstract_inverted_index),
  };
}

/** Les facettes de topics : les premiers groupes, avec leur libellé et leur compte. */
export function facetsFromGroups(groups: OpenAlexGroup[] | null | undefined): WatchFacet[] {
  if (!Array.isArray(groups)) return [];
  const facets: WatchFacet[] = [];
  for (const group of groups) {
    const id = stripOpenAlexId(group.key);
    if (!id || id === "unknown") continue;
    facets.push({ id, name: group.key_display_name?.trim() || id, count: typeof group.count === "number" ? group.count : 0 });
    if (facets.length >= FACET_LIMIT) break;
  }
  return facets;
}

/** Une revue OpenAlex, prête pour `watch_sources`. */
export function normalizeSource(source: OpenAlexSource): { source_id: string; display_name: string; citedness_2yr: number | null } | null {
  const id = stripOpenAlexId(source.id);
  if (!id) return null;
  const citedness = source.summary_stats?.["2yr_mean_citedness"];
  return {
    source_id: id,
    display_name: source.display_name?.trim() || id,
    citedness_2yr: typeof citedness === "number" && Number.isFinite(citedness) ? citedness : null,
  };
}
