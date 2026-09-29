import { describe, it, expect } from "vitest";
import type { OpenAlexClient } from "@/lib/server/openalex";
import { createTtlCache } from "./search";
import type { WatchSettings } from "./settings";
import { fetchWatchSpotlight, SPOTLIGHT_SIZE } from "./spotlight";

const SETTINGS: WatchSettings = {
  openalexMailto: "lab@example.org",
  defaultDomainIds: ["4"],
  highImpactThreshold: 9,
  pageSize: 25,
  cacheTtlSeconds: 600,
  spotlightQuery: "",
};

const NOW = new Date("2026-09-29T10:00:00Z");

function client(handler: (path: string, params: Record<string, string | undefined>) => unknown): OpenAlexClient {
  return { get: async (path, params) => handler(path, params) as never };
}

const deps = (impl: OpenAlexClient) => ({
  client: () => impl,
  sources: async () => ({ findMany: async () => [], upsertMany: async () => {} }),
  cache: createTtlCache(),
  now: () => NOW,
  warn: () => {},
});

describe("fetchWatchSpotlight", () => {
  it("asks OpenAlex for the most cited publications of the last 30 days, three of them", async () => {
    const calls: Array<{ path: string; params: Record<string, string | undefined> }> = [];
    const impl = client((path, params) => {
      calls.push({ path, params });
      if (path === "/works" && !params.group_by) {
        return { meta: { count: 3 }, results: [1, 2, 3].map((i) => ({ id: `https://openalex.org/W${i}`, title: `Paper ${i}` })) };
      }
      return { results: [], group_by: [] };
    });

    const spotlight = await fetchWatchSpotlight(SETTINGS, deps(impl), NOW);

    expect(spotlight.map((result) => result.id)).toEqual(["W1", "W2", "W3"]);
    const works = calls.find((call) => call.path === "/works" && !call.params.group_by)!;
    expect(works.params["per-page"]).toBe(String(SPOTLIGHT_SIZE));
    expect(works.params.sort).toBe("cited_by_count:desc");
    expect(works.params.filter).toContain("from_publication_date:2026-08-30");
    expect(works.params.search).toBeUndefined();
  });

  it("searches the configured query by relevance, three results, when one is set", async () => {
    const calls: Array<{ path: string; params: Record<string, string | undefined> }> = [];
    const impl = client((path, params) => {
      calls.push({ path, params });
      return { meta: { count: 0 }, results: [], group_by: [] };
    });

    await fetchWatchSpotlight({ ...SETTINGS, spotlightQuery: "mammography deep learning" }, deps(impl), NOW);

    const works = calls.find((call) => call.path === "/works" && !call.params.group_by)!;
    expect(works.params.search).toBe("mammography deep learning");
    expect(works.params.sort).toBe("relevance_score:desc");
    expect(works.params["per-page"]).toBe(String(SPOTLIGHT_SIZE));
    expect(works.params.filter).not.toContain("from_publication_date");
  });

  it("opens the page without a selection when OpenAlex does not answer", async () => {
    const impl = client(() => {
      throw new Error("timeout");
    });
    expect(await fetchWatchSpotlight(SETTINGS, deps(impl), NOW)).toEqual([]);
  });
});
