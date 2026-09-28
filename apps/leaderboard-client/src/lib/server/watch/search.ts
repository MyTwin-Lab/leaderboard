import "server-only";
import type { WatchSearchResponse, WatchFacet } from "@/lib/watch";
import { createOpenAlexClient, OpenAlexError, type OpenAlexClient } from "@/lib/server/openalex";
import type { WatchSourceDraft } from "../../../../../../packages/database-service/repositories";
import {
  buildFacetParams,
  buildWorksParams,
  facetsCacheKey,
  facetsFromGroups,
  normalizeSource,
  normalizeWork,
  searchCacheKey,
  sourceIdOf,
  type OpenAlexSourcesResponse,
  type OpenAlexWorksResponse,
  type WatchSearchQuery,
} from "./query";
import { readWatchSettings, type WatchSettings } from "./settings";

/**
 * Module watch — le service de recherche
 * --------------------------------------
 * Une recherche = un appel `/works` pour la page, un appel `/works` groupé
 * pour les facettes (en parallèle), puis la résolution des revues de la page
 * dans `watch_sources`, complétée par `/sources` pour celles qui manquent ou
 * datent de plus de 30 jours.
 *
 * Les réponses se gardent en mémoire le temps du réglage `cache_ttl_seconds`,
 * par paramètres normalisés : une même recherche relancée dans le TTL ne
 * déclenche aucun appel OpenAlex. Un cache par processus suffit à une seule
 * instance ; en multi-instances, il passerait en base (V2).
 */

/** Une revue plus vieille que ça se rafraîchit à la prochaine recherche qui la touche. */
export const SOURCE_STALE_MS = 30 * 86_400_000;
/** Mode high-impact : on demande large, on filtre, on rend la première page. */
export const HIGH_IMPACT_FETCH_SIZE = 100;
/** Lots de `/sources?filter=ids.openalex:…`. */
export const SOURCES_BATCH_SIZE = 50;
const CACHE_MAX_ENTRIES = 500;

/** Le module n'a pas d'email de contact OpenAlex : il ne peut pas chercher. */
export class WatchNotConfiguredError extends Error {
  constructor() {
    super("The Watch module has no OpenAlex contact email");
    this.name = "WatchNotConfiguredError";
  }
}

// ─── Cache mémoire ───────────────────────────────────────────────────────────

export interface TtlCache {
  get<T>(key: string, now: number): T | undefined;
  set<T>(key: string, value: T, ttlMs: number, now: number): void;
  /** Pour les tests. */
  clear(): void;
}

/** Un cache borné : au-delà de `maxEntries`, la plus ancienne entrée cède la place. */
export function createTtlCache(maxEntries = CACHE_MAX_ENTRIES): TtlCache {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    get<T>(key: string, now: number): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now) {
        entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set(key, value, ttlMs, now) {
      if (ttlMs <= 0) return;
      entries.delete(key);
      entries.set(key, { value, expiresAt: now + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
    },
  };
}

const CACHE_KEY = "__watchSearchCache";

/** Le cache du processus. Sur `globalThis` : Next peut charger ce module plusieurs fois. */
export function processCache(): TtlCache {
  const holder = globalThis as unknown as Record<string, TtlCache | undefined>;
  holder[CACHE_KEY] ??= createTtlCache();
  return holder[CACHE_KEY];
}

// ─── Dépendances ─────────────────────────────────────────────────────────────

export interface WatchSourceStore {
  findMany(ids: readonly string[]): Promise<Array<WatchSourceDraft & { refreshed_at: Date }>>;
  upsertMany(rows: readonly WatchSourceDraft[]): Promise<void>;
}

export interface WatchSearchDeps {
  settings(): Promise<WatchSettings>;
  client(mailto: string): OpenAlexClient;
  sources(): Promise<WatchSourceStore>;
  cache: TtlCache;
  now(): Date;
  /** Ce qui n'empêche pas la recherche mais mérite une ligne de log. */
  warn(message: string, error: unknown): void;
}

async function defaultSources(): Promise<WatchSourceStore> {
  // Import à la demande : lire ce module ne doit pas ouvrir la base.
  const { WatchSourceRepository } = await import("../../../../../../packages/database-service/repositories");
  return new WatchSourceRepository();
}

const DEFAULT_DEPS: WatchSearchDeps = {
  settings: () => readWatchSettings(),
  client: (mailto) => createOpenAlexClient({ mailto }),
  sources: defaultSources,
  get cache() {
    return processCache();
  },
  now: () => new Date(),
  warn: (message, error) => console.warn(`[watch] ${message}`, error),
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

/**
 * Le score `2yr_mean_citedness` des revues de la page. Les revues connues et
 * fraîches viennent de `watch_sources` ; les autres sont demandées à OpenAlex
 * par lots et upsertées. Si OpenAlex ne répond pas, la page se rend quand
 * même avec les scores connus, fussent-ils périmés.
 */
export async function resolveSourceCitedness(
  ids: readonly string[],
  deps: Pick<WatchSearchDeps, "sources" | "now" | "warn">,
  client: OpenAlexClient,
): Promise<Map<string, number | null>> {
  const citedness = new Map<string, number | null>();
  if (ids.length === 0) return citedness;

  const store = await deps.sources();
  const known = await store.findMany(ids);
  const nowMs = deps.now().getTime();
  const fresh = new Set<string>();
  for (const row of known) {
    citedness.set(row.source_id, row.citedness_2yr);
    if (nowMs - row.refreshed_at.getTime() < SOURCE_STALE_MS) fresh.add(row.source_id);
  }

  const missing = ids.filter((id) => !fresh.has(id));
  for (const batch of chunk(missing, SOURCES_BATCH_SIZE)) {
    let response: OpenAlexSourcesResponse;
    try {
      response = await client.get<OpenAlexSourcesResponse>("/sources", {
        filter: `ids.openalex:${batch.join("|")}`,
        "per-page": String(SOURCES_BATCH_SIZE),
        select: "id,display_name,summary_stats",
      });
    } catch (error) {
      // Un lot en échec (429, timeout) n'empêche pas d'essayer les suivants.
      deps.warn("journal scores could not be refreshed", error);
      continue;
    }
    const rows = (response.results ?? []).map(normalizeSource).filter((row): row is WatchSourceDraft => row !== null);
    for (const row of rows) citedness.set(row.source_id, row.citedness_2yr);
    if (rows.length > 0) {
      try {
        await store.upsertMany(rows);
      } catch (error) {
        deps.warn("journal scores could not be stored", error);
      }
    }
  }
  return citedness;
}

async function loadFacets(
  query: WatchSearchQuery,
  settings: WatchSettings,
  client: OpenAlexClient,
  deps: WatchSearchDeps,
  ttlMs: number,
): Promise<WatchFacet[]> {
  const key = facetsCacheKey(query, settings);
  const cached = deps.cache.get<WatchFacet[]>(key, deps.now().getTime());
  if (cached) return cached;
  try {
    const response = await client.get<OpenAlexWorksResponse>("/works", buildFacetParams(query, settings));
    const facets = facetsFromGroups(response.group_by);
    deps.cache.set(key, facets, ttlMs, deps.now().getTime());
    return facets;
  } catch (error) {
    // Des résultats sans facettes valent mieux que rien : l'échec se voit dans le log.
    deps.warn("topic facets could not be loaded", error);
    return [];
  }
}

/** Une page de résultats pour ces paramètres. Lève `OpenAlexError` ou `WatchNotConfiguredError`. */
export async function searchWatch(
  query: WatchSearchQuery,
  overrides: Partial<WatchSearchDeps> = {},
): Promise<WatchSearchResponse> {
  const deps: WatchSearchDeps = { ...DEFAULT_DEPS, ...overrides };
  const settings = await deps.settings();
  if (!settings.openalexMailto) throw new WatchNotConfiguredError();

  const ttlMs = settings.cacheTtlSeconds * 1_000;
  const key = searchCacheKey(query, settings);
  const cached = deps.cache.get<WatchSearchResponse>(key, deps.now().getTime());
  if (cached) return cached;

  const client = deps.client(settings.openalexMailto);
  const page = query.high_impact
    ? { perPage: HIGH_IMPACT_FETCH_SIZE, page: 1 }
    : { perPage: settings.pageSize, page: query.page };

  const [works, topics] = await Promise.all([
    client.get<OpenAlexWorksResponse>("/works", buildWorksParams(query, settings, page)),
    loadFacets(query, settings, client, deps, ttlMs),
  ]);

  const rawResults = works.results ?? [];
  const sourceIds = [...new Set(rawResults.map(sourceIdOf).filter((id): id is string => id !== null))];
  const citedness = await resolveSourceCitedness(sourceIds, deps, client);

  let results = rawResults.map((work) => normalizeWork(work, citedness));
  let total = typeof works.meta?.count === "number" ? works.meta.count : results.length;
  let truncated = false;
  if (query.high_impact) {
    const kept = results.filter(
      (result) => result.journal.citedness_2yr !== null && result.journal.citedness_2yr >= settings.highImpactThreshold,
    );
    truncated = kept.length > settings.pageSize;
    results = kept.slice(0, settings.pageSize);
    total = kept.length;
  }

  const response: WatchSearchResponse = {
    results,
    facets: { topics },
    total,
    page: page.page,
    page_size: settings.pageSize,
    high_impact_truncated: truncated,
  };
  deps.cache.set(key, response, ttlMs, deps.now().getTime());
  return response;
}

export { OpenAlexError };
