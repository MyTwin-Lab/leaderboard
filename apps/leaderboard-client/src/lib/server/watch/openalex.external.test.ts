import { describe, it, expect } from "vitest";
import { createOpenAlexClient, createRateLimiter } from "@/lib/server/openalex";
import { searchWatch, createTtlCache } from "./search";

/**
 * Test d'intégration `external` : un vrai appel OpenAlex. Sauté par défaut et
 * en CI ; se lance avec `WATCH_EXTERNAL_TESTS=1 npx vitest run openalex.external`
 * depuis `apps/leaderboard-client` (voir docs/testing.md).
 */
const RUN_EXTERNAL = process.env.WATCH_EXTERNAL_TESTS === "1" && !process.env.CI;

describe.skipIf(!RUN_EXTERNAL)("OpenAlex (external)", () => {
  it("finds hepatocellular carcinoma papers with a journal score", async () => {
    const mailto = process.env.WATCH_EXTERNAL_MAILTO ?? "leaderboard-tests@example.org";
    const stored = new Map<string, { source_id: string; display_name: string; citedness_2yr: number | null; refreshed_at: Date }>();

    const response = await searchWatch(
      {
        q: "hepatocellular carcinoma",
        scope: "all",
        from: null,
        to: null,
        topics: [],
        oa: false,
        high_impact: false,
        min_cited: null,
        sort: "relevance",
        page: 1,
      },
      {
        settings: async () => ({
          openalexMailto: mailto,
          defaultDomainIds: ["4"],
          highImpactThreshold: 9,
          pageSize: 10,
          cacheTtlSeconds: 0,
        }),
        client: (email) => createOpenAlexClient({ mailto: email, limiter: createRateLimiter(5) }),
        sources: async () => ({
          findMany: async (ids) => ids.flatMap((id) => (stored.has(id) ? [stored.get(id)!] : [])),
          upsertMany: async (rows) => {
            for (const row of rows) stored.set(row.source_id, { ...row, refreshed_at: new Date() });
          },
        }),
        cache: createTtlCache(),
        now: () => new Date(),
        warn: (message, error) => console.warn(message, error),
      },
    );

    expect(response.results.length).toBeGreaterThanOrEqual(1);
    expect(response.results.some((result) => result.journal.citedness_2yr !== null)).toBe(true);
    expect(response.total).toBeGreaterThan(0);
  }, 30_000);
});
