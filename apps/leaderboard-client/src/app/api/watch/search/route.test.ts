import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { OpenAlexError } from "@/lib/server/openalex";
import { WatchNotConfiguredError } from "@/lib/server/watch/search";

const { mockVerifyRequestToken, mockModuleNotFoundResponse, mockSearchWatch } = vi.hoisted(() => ({
  mockVerifyRequestToken: vi.fn(),
  mockModuleNotFoundResponse: vi.fn(),
  mockSearchWatch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyRequestToken: mockVerifyRequestToken }));
vi.mock("@/lib/server/modules", () => ({ moduleNotFoundResponse: mockModuleNotFoundResponse }));
vi.mock("@/lib/server/watch/search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/watch/search")>()),
  searchWatch: mockSearchWatch,
}));

import { GET } from "./route";

const RESPONSE = {
  results: [
    {
      id: "W123",
      title: "A study",
      doi: "10.1000/xyz",
      pmid: "12345678",
      url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      publication_date: "2026-09-01",
      cited_by_count: 12,
      is_oa: true,
      oa_url: "https://example.org/pdf",
      journal: { source_id: "S456", name: "The Lancet", citedness_2yr: 11.3 },
      primary_topic: { id: "T789", name: "Liver cancer", subfield: "Oncology" },
      authors: ["A", "B", "C"],
      authors_count: 8,
      abstract: "Short abstract",
    },
  ],
  facets: { topics: [{ id: "2730", name: "Oncology", count: 340 }] },
  total: 1234,
  page: 1,
  page_size: 25,
  high_impact_truncated: false,
};

function search(query = "q=liver") {
  return GET(new NextRequest(`http://localhost/api/watch/search?${query}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockModuleNotFoundResponse.mockResolvedValue(null);
  mockVerifyRequestToken.mockResolvedValue({ userId: "u1", role: "contributor" });
  mockSearchWatch.mockResolvedValue(RESPONSE);
});

describe("GET /api/watch/search", () => {
  it("answers 404 while the watch module is disabled, before reading the session", async () => {
    mockModuleNotFoundResponse.mockResolvedValue(NextResponse.json({ error: "Not found" }, { status: 404 }));

    const res = await search();

    expect(res.status).toBe(404);
    expect(mockModuleNotFoundResponse).toHaveBeenCalledWith("watch");
    expect(mockVerifyRequestToken).not.toHaveBeenCalled();
    expect(mockSearchWatch).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    mockVerifyRequestToken.mockResolvedValue(null);

    expect((await search()).status).toBe(401);
    expect(mockSearchWatch).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid params, with the reason", async () => {
    for (const query of ["scope=abstract", "page=41", "from=2025-13-01", "min_cited=many", "sort=random", "oa=yes"]) {
      const res = await search(query);
      expect(res.status, query).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid query");
      expect(typeof body.details).toBe("string");
    }
    expect(mockSearchWatch).not.toHaveBeenCalled();
  });

  it("hands the parsed query to the service and returns its response as is", async () => {
    const res = await search("q=liver&scope=title&from=2025-09-28&topics=2730&oa=true&high_impact=true&min_cited=5&sort=cited&page=2&page_size=3");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESPONSE);
    expect(mockSearchWatch).toHaveBeenCalledWith({
      q: "liver",
      scope: "title",
      from: "2025-09-28",
      to: null,
      topics: ["2730"],
      oa: true,
      high_impact: true,
      min_cited: 5,
      sort: "cited",
      page: 2,
    });
  });

  it("maps OpenAlex failures to their own statuses, with the kind for the client", async () => {
    const cases: Array<[OpenAlexError, number]> = [
      [new OpenAlexError("rate_limited", "slow down", 429), 429],
      [new OpenAlexError("timeout", "too slow"), 504],
      [new OpenAlexError("upstream", "OpenAlex answered 503", 503), 502],
      [new OpenAlexError("network", "unreachable"), 502],
      [new OpenAlexError("invalid", "bad filter", 400), 502],
    ];
    for (const [error, status] of cases) {
      mockSearchWatch.mockRejectedValueOnce(error);
      const res = await search();
      expect(res.status, error.kind).toBe(status);
      expect(await res.json()).toEqual({ error: error.message, kind: error.kind });
    }
  });

  it("answers 503 while the module has no OpenAlex contact email", async () => {
    mockSearchWatch.mockRejectedValueOnce(new WatchNotConfiguredError());

    const res = await search();

    expect(res.status).toBe(503);
    expect((await res.json()).kind).toBe("not_configured");
  });
});
