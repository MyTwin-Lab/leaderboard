import { describe, it, expect } from "vitest";
import { watchModule } from "./index.js";
import { watchEnableBlocker, watchSettingsSchema } from "./settings.js";

describe("watch module settings", () => {
  it("is declared by the module, enabled by default, with the spec defaults", () => {
    expect(watchModule.settings?.schema).toBe(watchSettingsSchema);
    expect(watchModule.defaultEnabled).toBe(true);
    expect(watchSettingsSchema.parse({})).toEqual({
      openalex_mailto: "",
      default_domain_ids: ["4"],
      high_impact_threshold: 9,
      page_size: 25,
      cache_ttl_seconds: 600,
      spotlight_mode: "recent",
      spotlight_query: "mammography deep learning",
      spotlight_window_days: 15,
      spotlight_ranking: "impact",
    });
  });

  it("bounds the spotlight: a known mode and ranking, a window of 1 to 365 days", () => {
    expect(watchSettingsSchema.safeParse({ spotlight_mode: "random" }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ spotlight_ranking: "cited" }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ spotlight_window_days: 0 }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ spotlight_window_days: 366 }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ spotlight_window_days: 7.5 }).success).toBe(false);
    expect(watchSettingsSchema.parse({ spotlight_mode: "query", spotlight_window_days: 30, spotlight_ranking: "newest" })).toMatchObject({
      spotlight_mode: "query",
      spotlight_window_days: 30,
      spotlight_ranking: "newest",
    });
  });

  it("bounds the page size, the cache TTL and the domain ids", () => {
    expect(watchSettingsSchema.safeParse({ page_size: 51 }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ page_size: 0 }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ cache_ttl_seconds: -1 }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ default_domain_ids: [] }).success).toBe(false);
    expect(watchSettingsSchema.safeParse({ default_domain_ids: ["health"] }).success).toBe(false);
    expect(watchSettingsSchema.parse({ default_domain_ids: ["4", "3"], openalex_mailto: "  lab@example.org " })).toMatchObject({
      default_domain_ids: ["4", "3"],
      openalex_mailto: "lab@example.org",
    });
  });

  it("refuses a malformed contact email, and nothing else", () => {
    expect(watchModule.enableGuard).toBe(watchEnableBlocker);
    expect(watchEnableBlocker({})).toBeNull();
    expect(watchEnableBlocker({ openalex_mailto: "" })).toBeNull();
    expect(watchEnableBlocker({ openalex_mailto: "not-an-email" })).toMatch(/not a valid email/);
    expect(watchEnableBlocker({ openalex_mailto: "lab@example.org" })).toBeNull();
  });
});
