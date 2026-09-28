import { describe, it, expect } from "vitest";
import {
  DEFAULT_WATCH_FILTERS,
  effectiveSort,
  isInitialState,
  parseTopicIds,
  parseWatchFilters,
  periodStart,
  serializeWatchFilters,
  toWatchApiQuery,
  type WatchFilters,
} from "./watch";

const TODAY = new Date("2026-09-28T12:00:00Z");

describe("watch filters in the URL", () => {
  it("reads the defaults from an empty URL", () => {
    expect(parseWatchFilters(new URLSearchParams())).toEqual(DEFAULT_WATCH_FILTERS);
  });

  it("round-trips every filter, keeping only what differs from the defaults", () => {
    const filters: WatchFilters = {
      q: "mammography deep learning",
      scope: "title",
      period: "5y",
      topics: ["2730", "T10001"],
      oa: true,
      highImpact: true,
      minCited: 12,
      sort: "cited",
      page: 3,
    };
    const url = serializeWatchFilters(filters).toString();
    expect(parseWatchFilters(new URLSearchParams(url))).toEqual(filters);
    expect(serializeWatchFilters(DEFAULT_WATCH_FILTERS).toString()).toBe("");
    expect(serializeWatchFilters({ ...DEFAULT_WATCH_FILTERS, q: "  liver  " }).toString()).toBe("q=liver");
  });

  it("falls back to the defaults on values it cannot read", () => {
    const parsed = parseWatchFilters(
      new URLSearchParams("scope=abstract&period=2w&sort=random&page=0&min_cited=-3&topics=oncology,2730,,T5&oa=yes"),
    );
    expect(parsed).toEqual({ ...DEFAULT_WATCH_FILTERS, topics: ["2730", "T5"] });
    expect(parseWatchFilters(new URLSearchParams("page=99")).page).toBe(40);
    expect(parseWatchFilters(new URLSearchParams("min_cited=0")).minCited).toBeNull();
  });

  it("bounds and deduplicates topic ids", () => {
    expect(parseTopicIds(" 2730 , 2730,T1, x, 12")).toEqual(["2730", "T1", "12"]);
    expect(parseTopicIds(Array.from({ length: 30 }, (_, i) => String(i)).join(","))).toHaveLength(20);
    expect(parseTopicIds(null)).toEqual([]);
  });
});

describe("watch query derivation", () => {
  it("sorts by date when relevance is asked without a query", () => {
    expect(effectiveSort({ q: "", sort: "relevance" })).toBe("date");
    expect(effectiveSort({ q: "liver", sort: "relevance" })).toBe("relevance");
    expect(effectiveSort({ q: "", sort: "cited" })).toBe("cited");
  });

  it("knows the initial state: no query and no restrictive filter", () => {
    expect(isInitialState(DEFAULT_WATCH_FILTERS)).toBe(true);
    expect(isInitialState({ ...DEFAULT_WATCH_FILTERS, period: "any", sort: "date" })).toBe(true);
    expect(isInitialState({ ...DEFAULT_WATCH_FILTERS, q: " " })).toBe(true);
    expect(isInitialState({ ...DEFAULT_WATCH_FILTERS, oa: true })).toBe(false);
    expect(isInitialState({ ...DEFAULT_WATCH_FILTERS, topics: ["2730"] })).toBe(false);
    expect(isInitialState({ ...DEFAULT_WATCH_FILTERS, q: "liver" })).toBe(false);
  });

  it("turns a period into a start date, and 'Any' into none", () => {
    expect(periodStart("30d", TODAY)).toBe("2026-08-29");
    expect(periodStart("1y", TODAY)).toBe("2025-09-28");
    expect(periodStart("any", TODAY)).toBeNull();
  });

  it("builds the API query the route expects", () => {
    const params = toWatchApiQuery(
      { ...DEFAULT_WATCH_FILTERS, q: " liver ", topics: ["2730"], oa: true, highImpact: true, minCited: 5, page: 2 },
      TODAY,
    );
    expect(Object.fromEntries(params)).toEqual({
      q: "liver",
      from: "2025-09-28",
      topics: "2730",
      oa: "true",
      high_impact: "true",
      min_cited: "5",
      sort: "relevance",
      page: "2",
    });
    expect(Object.fromEntries(toWatchApiQuery({ ...DEFAULT_WATCH_FILTERS, period: "any", scope: "title" }, TODAY))).toEqual({
      scope: "title",
      sort: "date",
    });
  });
});
