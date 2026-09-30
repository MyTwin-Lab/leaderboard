import { describe, it, expect } from "vitest";
import type { OpenAlexClient } from "@/lib/server/openalex";
import type { WatchResult } from "@/lib/watch";
import { createTtlCache } from "./search";
import type { WatchSettings } from "./settings";
import {
  computeWatchSpotlight,
  loadWatchSpotlight,
  spotlightExpired,
  spotlightSignature,
  SPOTLIGHT_SIZE,
  type WatchSpotlightStore,
} from "./spotlight";

const SETTINGS: WatchSettings = {
  openalexMailto: "lab@example.org",
  defaultDomainIds: ["4"],
  highImpactThreshold: 9,
  pageSize: 25,
  cacheTtlSeconds: 600,
  spotlightMode: "recent",
  spotlightQuery: "mammography deep learning",
  spotlightWindowDays: 15,
  spotlightRanking: "impact",
};

const NOW = new Date("2026-09-29T10:00:00Z");

type Call = { path: string; params: Record<string, string | undefined> };

function client(handler: (path: string, params: Record<string, string | undefined>) => unknown): OpenAlexClient {
  return { get: async (path, params) => handler(path, params) as never };
}

/** Trois publications, dans une revue à fort impact quand `impact` est demandé. */
function works(count: number, calls?: Call[]) {
  return client((path, params) => {
    calls?.push({ path, params });
    if (path === "/works" && !params.group_by) {
      return {
        meta: { count },
        results: Array.from({ length: count }, (_, i) => ({
          id: `https://openalex.org/W${i + 1}`,
          title: `Paper ${i + 1}`,
          primary_location: { source: { id: "https://openalex.org/S1", display_name: "The Lancet" } },
        })),
      };
    }
    if (path === "/sources") {
      return { results: [{ id: "https://openalex.org/S1", display_name: "The Lancet", summary_stats: { "2yr_mean_citedness": 40 } }] };
    }
    return { results: [], group_by: [] };
  });
}

const search = (impl: OpenAlexClient) => ({
  client: () => impl,
  sources: async () => ({ findMany: async () => [], upsertMany: async () => {} }),
  cache: createTtlCache(),
  now: () => NOW,
  warn: () => {},
});

/** Un dépôt en mémoire, avec le journal de ses écritures. */
function memoryStore(initial: { signature: string; results: WatchResult[]; refreshed_at: Date } | null = null) {
  let saved = initial;
  const saves: Array<{ signature: string; results: WatchResult[]; at: Date }> = [];
  const store: WatchSpotlightStore = {
    find: async () => saved,
    save: async (snapshot, now) => {
      saves.push({ ...snapshot, at: now });
      saved = { ...snapshot, refreshed_at: now };
    },
  };
  return { store, saves, current: () => saved };
}

const deps = (impl: OpenAlexClient, store: WatchSpotlightStore) => ({
  search: search(impl),
  store: async () => store,
  now: () => NOW,
  warn: () => {},
  // Sous test, le renouvellement en arrière-plan est attendu.
  background: async (task: () => Promise<void>) => task(),
});

describe("computeWatchSpotlight", () => {
  it("in recent/impact mode, asks the most cited of the window from high-impact journals, three of them", async () => {
    const calls: Call[] = [];
    const spotlight = await computeWatchSpotlight(SETTINGS, search(works(3, calls)), NOW);

    expect(spotlight.map((result) => result.id)).toEqual(["W1", "W2", "W3"]);
    const call = calls.find((c) => c.path === "/works" && !c.params.group_by)!;
    expect(call.params.sort).toBe("cited_by_count:desc");
    expect(call.params.filter).toContain("from_publication_date:2026-09-14");
    expect(call.params.search).toBeUndefined();
    // Fort impact : on demande large et on filtre sur le score des revues.
    expect(Number(call.params["per-page"])).toBeGreaterThan(SPOTLIGHT_SIZE);
  });

  it("in recent/newest mode, asks the newest of the window, three of them, from any journal", async () => {
    const calls: Call[] = [];
    await computeWatchSpotlight({ ...SETTINGS, spotlightRanking: "newest", spotlightWindowDays: 7 }, search(works(3, calls)), NOW);

    const call = calls.find((c) => c.path === "/works" && !c.params.group_by)!;
    expect(call.params.sort).toBe("publication_date:desc");
    expect(call.params.filter).toContain("from_publication_date:2026-09-22");
    expect(call.params["per-page"]).toBe(String(SPOTLIGHT_SIZE));
  });

  it("in query mode, searches the configured query by relevance, without a date bound", async () => {
    const calls: Call[] = [];
    await computeWatchSpotlight({ ...SETTINGS, spotlightMode: "query" }, search(works(0, calls)), NOW);

    const call = calls.find((c) => c.path === "/works" && !c.params.group_by)!;
    expect(call.params.search).toBe("mammography deep learning");
    expect(call.params.sort).toBe("relevance_score:desc");
    expect(call.params["per-page"]).toBe(String(SPOTLIGHT_SIZE));
    expect(call.params.filter).not.toContain("from_publication_date");
  });

  it("in query mode with an empty query, falls back to the newest of the window", async () => {
    const calls: Call[] = [];
    await computeWatchSpotlight({ ...SETTINGS, spotlightMode: "query", spotlightQuery: "  " }, search(works(0, calls)), NOW);

    const call = calls.find((c) => c.path === "/works" && !c.params.group_by)!;
    expect(call.params.search).toBeUndefined();
    expect(call.params.sort).toBe("publication_date:desc");
  });
});

describe("spotlightSignature", () => {
  it("changes with what produces the selection, and only that", () => {
    const base = spotlightSignature(SETTINGS);
    expect(spotlightSignature({ ...SETTINGS, pageSize: 10, cacheTtlSeconds: 1, openalexMailto: "" })).toBe(base);
    expect(spotlightSignature({ ...SETTINGS, spotlightWindowDays: 30 })).not.toBe(base);
    expect(spotlightSignature({ ...SETTINGS, spotlightRanking: "newest" })).not.toBe(base);
    expect(spotlightSignature({ ...SETTINGS, spotlightMode: "query" })).not.toBe(base);
    expect(spotlightSignature({ ...SETTINGS, highImpactThreshold: 5 })).not.toBe(base);
    // En mode recherche, la fenêtre ne compte pas ; la requête, normalisée, oui.
    const query = spotlightSignature({ ...SETTINGS, spotlightMode: "query" });
    expect(spotlightSignature({ ...SETTINGS, spotlightMode: "query", spotlightWindowDays: 30 })).toBe(query);
    expect(spotlightSignature({ ...SETTINGS, spotlightMode: "query", spotlightQuery: "  Mammography   deep learning " })).toBe(query);
    expect(spotlightSignature({ ...SETTINGS, spotlightMode: "query", spotlightQuery: "sepsis" })).not.toBe(query);
  });
});

describe("spotlightExpired", () => {
  it("expires after the window, in days", () => {
    const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
    expect(spotlightExpired(days(14), SETTINGS, NOW)).toBe(false);
    expect(spotlightExpired(days(15), SETTINGS, NOW)).toBe(true);
    expect(spotlightExpired(days(2), { ...SETTINGS, spotlightWindowDays: 1 }, NOW)).toBe(true);
  });
});

describe("loadWatchSpotlight", () => {
  const paper = (id: string): WatchResult => ({ id, title: id } as unknown as WatchResult);

  it("computes and stores the selection when nothing is stored yet", async () => {
    const { store, saves } = memoryStore();
    const spotlight = await loadWatchSpotlight(SETTINGS, deps(works(3), store));

    expect(spotlight.map((r) => r.id)).toEqual(["W1", "W2", "W3"]);
    expect(saves).toHaveLength(1);
    expect(saves[0].signature).toBe(spotlightSignature(SETTINGS));
    expect(saves[0].at).toBe(NOW);
  });

  it("serves the stored selection without any OpenAlex call while it is fresh", async () => {
    const calls: Call[] = [];
    const { store, saves } = memoryStore({
      signature: spotlightSignature(SETTINGS),
      results: [paper("stored")],
      refreshed_at: new Date(NOW.getTime() - 3 * 86_400_000),
    });

    const spotlight = await loadWatchSpotlight(SETTINGS, deps(works(3, calls), store));

    expect(spotlight.map((r) => r.id)).toEqual(["stored"]);
    expect(calls).toHaveLength(0);
    expect(saves).toHaveLength(0);
  });

  it("recomputes before rendering when the settings behind the selection changed", async () => {
    const { store, saves } = memoryStore({
      signature: spotlightSignature({ ...SETTINGS, spotlightRanking: "newest" }),
      results: [paper("stored")],
      refreshed_at: NOW,
    });

    const spotlight = await loadWatchSpotlight(SETTINGS, deps(works(3), store));

    expect(spotlight.map((r) => r.id)).toEqual(["W1", "W2", "W3"]);
    expect(saves).toHaveLength(1);
  });

  it("serves the expired selection and refreshes it for the next visit", async () => {
    const { store, saves, current } = memoryStore({
      signature: spotlightSignature(SETTINGS),
      results: [paper("stale")],
      refreshed_at: new Date(NOW.getTime() - 16 * 86_400_000),
    });

    const spotlight = await loadWatchSpotlight(SETTINGS, deps(works(3), store));

    // Cette visite lit encore l'ancienne ; la suivante lira la nouvelle.
    expect(spotlight.map((r) => r.id)).toEqual(["stale"]);
    expect(saves).toHaveLength(1);
    expect(current()?.results.map((r) => r.id)).toEqual(["W1", "W2", "W3"]);
    expect(current()?.refreshed_at).toBe(NOW);
  });

  it("keeps the previous selection when OpenAlex does not answer", async () => {
    const down = client(() => {
      throw new Error("timeout");
    });
    const { store, saves } = memoryStore({
      signature: spotlightSignature(SETTINGS),
      results: [paper("stale")],
      refreshed_at: new Date(NOW.getTime() - 40 * 86_400_000),
    });

    expect((await loadWatchSpotlight(SETTINGS, deps(down, store))).map((r) => r.id)).toEqual(["stale"]);
    expect(saves).toHaveLength(0);
  });

  it("opens the page without a selection when nothing is stored and OpenAlex does not answer", async () => {
    const down = client(() => {
      throw new Error("timeout");
    });
    expect(await loadWatchSpotlight(SETTINGS, deps(down, memoryStore().store))).toEqual([]);
  });

  it("computes live when the store itself is unavailable", async () => {
    const spotlight = await loadWatchSpotlight(SETTINGS, {
      ...deps(works(3), memoryStore().store),
      store: async () => {
        throw new Error("no table");
      },
    });
    expect(spotlight.map((r) => r.id)).toEqual(["W1", "W2", "W3"]);
  });
});
