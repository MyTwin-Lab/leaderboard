import { describe, it, expect } from "vitest";
import {
  filterAndSort,
  searchPool,
  statusCounts,
  type FilterableSandbox,
} from "./sandboxFilters";

function sandbox(overrides: Partial<FilterableSandbox> & { uuid: string }): FilterableSandbox {
  return {
    title: "A proposal",
    status: "open",
    user_id: "user-other",
    context: null,
    star_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    author: { full_name: "Someone Else" },
    ...overrides,
  };
}

const ME = "user-me";

const FIXTURES: FilterableSandbox[] = [
  sandbox({
    uuid: "open-popular",
    title: "Sleep apnea screening",
    context: "Detect apnea events from phone audio.",
    star_count: 47,
    created_at: "2026-02-01T00:00:00.000Z",
    author: { full_name: "Priya N." },
  }),
  sandbox({
    uuid: "open-recent",
    title: "Medication interactions registry",
    star_count: 3,
    created_at: "2026-03-01T00:00:00.000Z",
    author: { full_name: "Camille H." },
  }),
  sandbox({
    uuid: "mine-open",
    title: "Twin calibration",
    user_id: ME,
    star_count: 12,
    created_at: "2026-02-15T00:00:00.000Z",
    author: { full_name: "Alix Chagot" },
  }),
  sandbox({
    uuid: "mine-archived",
    title: "An abandoned idea",
    user_id: ME,
    status: "archived",
    created_at: "2026-01-15T00:00:00.000Z",
  }),
  sandbox({
    uuid: "promoted",
    title: "Mammogram augmentation benchmark",
    status: "promoted",
    star_count: 63,
    created_at: "2025-12-01T00:00:00.000Z",
  }),
];

describe("searchPool", () => {
  it("returns a copy of everything on an empty query", () => {
    const pool = searchPool(FIXTURES, "  ");
    expect(pool).toHaveLength(FIXTURES.length);
    expect(pool).not.toBe(FIXTURES);
  });

  it("matches the title, the author and the context, case-insensitively", () => {
    expect(searchPool(FIXTURES, "APNEA").map((s) => s.uuid)).toEqual(["open-popular"]);
    expect(searchPool(FIXTURES, "camille").map((s) => s.uuid)).toEqual(["open-recent"]);
    expect(searchPool(FIXTURES, "phone audio").map((s) => s.uuid)).toEqual(["open-popular"]);
  });

  it("ignores statuses — the pill filters, not the search", () => {
    expect(searchPool(FIXTURES, "mammogram").map((s) => s.uuid)).toEqual(["promoted"]);
  });
});

describe("statusCounts", () => {
  it("counts each pill on the searched pool", () => {
    expect(statusCounts(FIXTURES, ME)).toEqual({ open: 3, promoted: 1, mine: 2 });
  });

  it("narrows with the search, so the pills never contradict the grid", () => {
    const pool = searchPool(FIXTURES, "twin");
    expect(statusCounts(pool, ME)).toEqual({ open: 1, promoted: 0, mine: 1 });
  });

  it("has no 'mine' for an anonymous visitor", () => {
    expect(statusCounts(FIXTURES, null).mine).toBe(0);
  });
});

describe("filterAndSort", () => {
  it("sorts open sandboxes by star count", () => {
    const list = filterAndSort(FIXTURES, {
      query: "",
      status: "open",
      sort: "stars",
      currentUserId: ME,
    });
    expect(list.map((s) => s.uuid)).toEqual(["open-popular", "mine-open", "open-recent"]);
  });

  it("sorts by creation date, most recent first, when asked", () => {
    const list = filterAndSort(FIXTURES, {
      query: "",
      status: "open",
      sort: "recent",
      currentUserId: ME,
    });
    expect(list.map((s) => s.uuid)).toEqual(["open-recent", "mine-open", "open-popular"]);
  });

  it("breaks star ties by date so the order is stable across reloads", () => {
    const tied = [
      sandbox({ uuid: "older", star_count: 5, created_at: "2026-01-01T00:00:00.000Z" }),
      sandbox({ uuid: "newer", star_count: 5, created_at: "2026-05-01T00:00:00.000Z" }),
    ];
    const list = filterAndSort(tied, {
      query: "",
      status: "open",
      sort: "stars",
      currentUserId: null,
    });
    expect(list.map((s) => s.uuid)).toEqual(["newer", "older"]);
  });

  it("sinks a sandbox without a creation date to the bottom", () => {
    const undated = [
      sandbox({ uuid: "dated", created_at: "2026-01-01T00:00:00.000Z" }),
      sandbox({ uuid: "undated", created_at: null }),
    ];
    const list = filterAndSort(undated, {
      query: "",
      status: "open",
      sort: "recent",
      currentUserId: null,
    });
    expect(list.map((s) => s.uuid)).toEqual(["dated", "undated"]);
  });

  it("shows archived sandboxes under 'mine', and nowhere else", () => {
    const mine = filterAndSort(FIXTURES, {
      query: "",
      status: "mine",
      sort: "recent",
      currentUserId: ME,
    });
    expect(mine.map((s) => s.uuid)).toEqual(["mine-open", "mine-archived"]);

    const open = filterAndSort(FIXTURES, {
      query: "",
      status: "open",
      sort: "recent",
      currentUserId: ME,
    });
    expect(open.map((s) => s.uuid)).not.toContain("mine-archived");
  });

  it("applies the search before the pill", () => {
    const list = filterAndSort(FIXTURES, {
      query: "twin",
      status: "open",
      sort: "stars",
      currentUserId: ME,
    });
    expect(list.map((s) => s.uuid)).toEqual(["mine-open"]);
  });

  it("leaves the input array untouched", () => {
    const input = [...FIXTURES];
    filterAndSort(input, { query: "", status: "open", sort: "stars", currentUserId: ME });
    expect(input.map((s) => s.uuid)).toEqual(FIXTURES.map((s) => s.uuid));
  });
});
