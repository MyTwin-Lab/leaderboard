import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OpenAlexClient } from "@/lib/server/openalex";
import type { WatchSearchQuery } from "./query";
import {
  createTtlCache,
  HIGH_IMPACT_FETCH_SIZE,
  resolveSourceCitedness,
  searchWatch,
  SOURCE_STALE_MS,
  type WatchSearchDeps,
  type WatchSourceStore,
} from "./search";
import type { WatchSettings } from "./settings";

const SETTINGS: WatchSettings = {
  openalexMailto: "lab@example.org",
  defaultDomainIds: ["4"],
  highImpactThreshold: 9,
  pageSize: 2,
  cacheTtlSeconds: 600,
};

const QUERY: WatchSearchQuery = {
  q: "liver",
  scope: "all",
  from: null,
  to: null,
  topics: [],
  oa: false,
  high_impact: false,
  min_cited: null,
  sort: "relevance",
  page: 1,
};

const NOW = new Date("2026-09-28T10:00:00Z");

function work(id: string, source: string, title = id) {
  return {
    id: `https://openalex.org/${id}`,
    title,
    primary_location: { source: { id: `https://openalex.org/${source}`, display_name: `Journal ${source}` } },
    cited_by_count: 1,
  };
}

function source(id: string, citedness: number | null) {
  return { id: `https://openalex.org/${id}`, display_name: `Journal ${id}`, summary_stats: { "2yr_mean_citedness": citedness } };
}

function memoryStore(rows: Array<{ source_id: string; display_name: string; citedness_2yr: number | null; refreshed_at: Date }> = []) {
  const map = new Map(rows.map((row) => [row.source_id, row]));
  const store: WatchSourceStore & { upserts: unknown[][] } = {
    upserts: [],
    findMany: vi.fn(async (ids: readonly string[]) => ids.flatMap((id) => (map.has(id) ? [map.get(id)!] : []))),
    upsertMany: vi.fn(async (drafts) => {
      store.upserts.push([...drafts]);
      for (const draft of drafts) map.set(draft.source_id, { ...draft, refreshed_at: NOW });
    }),
  };
  return store;
}

/** Un OpenAlex de test : répond selon le chemin et les paramètres, et compte ses appels. */
function fakeClient(handlers: {
  works?: (params: Record<string, string | undefined>) => unknown;
  facets?: (params: Record<string, string | undefined>) => unknown;
  sources?: (params: Record<string, string | undefined>) => unknown;
}) {
  const calls: Array<{ path: string; params: Record<string, string | undefined> }> = [];
  const client: OpenAlexClient = {
    async get(path, params) {
      calls.push({ path, params });
      if (path === "/sources") return (handlers.sources?.(params) ?? { results: [] }) as never;
      if (params.group_by) return (handlers.facets?.(params) ?? { group_by: [] }) as never;
      return (handlers.works?.(params) ?? { meta: { count: 0 }, results: [] }) as never;
    },
  };
  return { client, calls };
}

function deps(overrides: Partial<WatchSearchDeps> & { clientImpl?: OpenAlexClient } = {}): Partial<WatchSearchDeps> {
  const { clientImpl, ...rest } = overrides;
  return {
    settings: async () => SETTINGS,
    client: () => clientImpl ?? fakeClient({}).client,
    sources: async () => memoryStore(),
    cache: createTtlCache(),
    now: () => NOW,
    warn: () => {},
    ...rest,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("searchWatch", () => {
  it("searches without a contact email, handing the client an empty mailto", async () => {
    const client = vi.fn(() => fakeClient({}).client);
    await searchWatch(QUERY, deps({ settings: async () => ({ ...SETTINGS, openalexMailto: "" }), client }));
    expect(client).toHaveBeenCalledWith("");
  });

  it("asks OpenAlex for the page and the facets, resolves journal scores, and shapes the response", async () => {
    const { client, calls } = fakeClient({
      works: () => ({ meta: { count: 1234 }, results: [work("W1", "S1"), work("W2", "S2")] }),
      facets: () => ({ group_by: [{ key: "https://openalex.org/subfields/2730", key_display_name: "Oncology", count: 340 }] }),
      sources: () => ({ results: [source("S1", 11.3), source("S2", null)] }),
    });
    const store = memoryStore();

    const response = await searchWatch(QUERY, deps({ clientImpl: client, sources: async () => store }));

    expect(response.total).toBe(1234);
    expect(response.page).toBe(1);
    expect(response.page_size).toBe(2);
    expect(response.high_impact_truncated).toBe(false);
    expect(response.facets.topics).toEqual([{ id: "2730", name: "Oncology", count: 340 }]);
    expect(response.results.map((result) => [result.id, result.journal.citedness_2yr])).toEqual([
      ["W1", 11.3],
      ["W2", null],
    ]);

    const works = calls.find((call) => call.path === "/works" && !call.params.group_by)!;
    expect(works.params.search).toBe("liver");
    expect(works.params["per-page"]).toBe("2");
    expect(works.params.page).toBe("1");
    expect(calls.find((call) => call.path === "/works" && call.params.group_by)).toBeDefined();
    const sources = calls.find((call) => call.path === "/sources")!;
    expect(sources.params.filter).toBe("ids.openalex:S1|S2");
    expect(store.upsertMany).toHaveBeenCalledTimes(1);
    expect(store.upserts[0]).toEqual([
      { source_id: "S1", display_name: "Journal S1", citedness_2yr: 11.3 },
      { source_id: "S2", display_name: "Journal S2", citedness_2yr: null },
    ]);
  });

  it("answers the same search from the cache within the TTL, without any OpenAlex call", async () => {
    const { client, calls } = fakeClient({ works: () => ({ meta: { count: 1 }, results: [work("W1", "S1")] }) });
    const cache = createTtlCache();
    const shared = deps({ clientImpl: client, cache });

    const first = await searchWatch(QUERY, shared);
    const callsAfterFirst = calls.length;
    const second = await searchWatch({ ...QUERY, q: "  LIVER " }, shared);

    expect(second).toBe(first);
    expect(calls.length).toBe(callsAfterFirst);

    // TTL écoulé : on redemande.
    await searchWatch(QUERY, { ...shared, now: () => new Date(NOW.getTime() + 601_000) });
    expect(calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("does not cache when the TTL is zero", async () => {
    const { client, calls } = fakeClient({});
    const shared = deps({ clientImpl: client, settings: async () => ({ ...SETTINGS, cacheTtlSeconds: 0 }) });
    await searchWatch(QUERY, shared);
    const after = calls.length;
    await searchWatch(QUERY, shared);
    expect(calls.length).toBe(after * 2);
  });

  it("reuses the facets of a search that only changed its topics or page", async () => {
    const facets = vi.fn(() => ({ group_by: [] }));
    const { client } = fakeClient({ facets });
    const shared = deps({ clientImpl: client });

    await searchWatch(QUERY, shared);
    await searchWatch({ ...QUERY, topics: ["2730"], page: 2 }, shared);
    expect(facets).toHaveBeenCalledTimes(1);

    await searchWatch({ ...QUERY, oa: true }, shared);
    expect(facets).toHaveBeenCalledTimes(2);
  });

  it("keeps the results when the facets fail, and says so", async () => {
    const warn = vi.fn();
    const { client } = fakeClient({
      works: () => ({ meta: { count: 1 }, results: [work("W1", "S1")] }),
      facets: () => {
        throw new Error("boom");
      },
    });

    const response = await searchWatch(QUERY, deps({ clientImpl: client, warn }));

    expect(response.results).toHaveLength(1);
    expect(response.facets.topics).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("facets"), expect.any(Error));
  });

  it("in high-impact mode, fetches wide, keeps journals at or above the threshold, and flags the truncation", async () => {
    const { client, calls } = fakeClient({
      works: () => ({
        meta: { count: 5000 },
        results: [work("W1", "S-low"), work("W2", "S-high"), work("W3", "S-edge"), work("W4", "S-high"), work("W5", "S-none")],
      }),
      sources: () => ({ results: [source("S-low", 2), source("S-high", 20), source("S-edge", 9), source("S-none", null)] }),
    });

    const response = await searchWatch({ ...QUERY, high_impact: true, page: 3 }, deps({ clientImpl: client }));

    const works = calls.find((call) => call.path === "/works" && !call.params.group_by)!;
    expect(works.params["per-page"]).toBe(String(HIGH_IMPACT_FETCH_SIZE));
    expect(works.params.page).toBe("1");
    expect(response.results.map((result) => result.id)).toEqual(["W2", "W3"]);
    expect(response.total).toBe(3);
    expect(response.page).toBe(1);
    expect(response.high_impact_truncated).toBe(true);
  });

  it("does not flag a truncation when the high-impact results fit in a page", async () => {
    const { client } = fakeClient({
      works: () => ({ meta: { count: 2 }, results: [work("W1", "S-high"), work("W2", "S-low")] }),
      sources: () => ({ results: [source("S-high", 20), source("S-low", 1)] }),
    });
    const response = await searchWatch({ ...QUERY, high_impact: true }, deps({ clientImpl: client }));
    expect(response.results.map((result) => result.id)).toEqual(["W1"]);
    expect(response.high_impact_truncated).toBe(false);
  });
});

describe("resolveSourceCitedness", () => {
  const base = { now: () => NOW, warn: () => {} };

  it("reads fresh journals from the store and asks OpenAlex only for the missing or stale ones, by batches of 50", async () => {
    const fresh = { source_id: "S-fresh", display_name: "Fresh", citedness_2yr: 4.5, refreshed_at: new Date(NOW.getTime() - 86_400_000) };
    const stale = { source_id: "S-stale", display_name: "Stale", citedness_2yr: 1, refreshed_at: new Date(NOW.getTime() - SOURCE_STALE_MS - 1) };
    const store = memoryStore([fresh, stale]);
    const missing = Array.from({ length: 60 }, (_, i) => `S-m${i}`);
    const { client, calls } = fakeClient({
      sources: (params) => ({
        results: (params.filter ?? "")
          .replace("ids.openalex:", "")
          .split("|")
          .map((id) => source(id, id === "S-stale" ? 7 : 3)),
      }),
    });

    const citedness = await resolveSourceCitedness(["S-fresh", "S-stale", ...missing], { ...base, sources: async () => store }, client);

    expect(citedness.get("S-fresh")).toBe(4.5);
    expect(citedness.get("S-stale")).toBe(7);
    expect(citedness.get("S-m59")).toBe(3);
    const sourceCalls = calls.filter((call) => call.path === "/sources");
    expect(sourceCalls).toHaveLength(2);
    expect(sourceCalls[0].params.filter!.split("|")).toHaveLength(50);
    expect(sourceCalls[0].params.filter).not.toContain("S-fresh");
    expect(sourceCalls[0].params.filter).toContain("S-stale");
    expect(store.upsertMany).toHaveBeenCalledTimes(2);
  });

  it("falls back on the stored score, stale or not, when OpenAlex does not answer", async () => {
    const warn = vi.fn();
    const stale = { source_id: "S-stale", display_name: "Stale", citedness_2yr: 1, refreshed_at: new Date(0) };
    const { client } = fakeClient({
      sources: () => {
        throw new Error("timeout");
      },
    });

    const citedness = await resolveSourceCitedness(["S-stale", "S-new"], { ...base, warn, sources: async () => memoryStore([stale]) }, client);

    expect(citedness.get("S-stale")).toBe(1);
    expect(citedness.has("S-new")).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("asks nothing for an empty page", async () => {
    const sources = vi.fn();
    const { client, calls } = fakeClient({});
    expect((await resolveSourceCitedness([], { ...base, sources }, client)).size).toBe(0);
    expect(sources).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});

describe("createTtlCache", () => {
  it("expires entries and evicts the oldest beyond its size", () => {
    const cache = createTtlCache(2);
    cache.set("a", 1, 1_000, 0);
    cache.set("b", 2, 1_000, 0);
    cache.set("c", 3, 1_000, 0);
    expect(cache.get("a", 10)).toBeUndefined();
    expect(cache.get("b", 10)).toBe(2);
    expect(cache.get("c", 999)).toBe(3);
    expect(cache.get("c", 1_000)).toBeUndefined();
    cache.set("d", 4, 0, 0);
    expect(cache.get("d", 0)).toBeUndefined();
  });
});
