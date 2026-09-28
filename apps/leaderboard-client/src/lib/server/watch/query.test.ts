import { describe, it, expect } from "vitest";
import {
  buildFacetParams,
  buildWorksParams,
  facetsCacheKey,
  facetsFromGroups,
  normalizeSource,
  normalizeWork,
  parseWatchSearchQuery,
  reconstructAbstract,
  resolveSort,
  searchCacheKey,
  type WatchSearchQuery,
} from "./query";
import type { WatchSettings } from "./settings";

const SETTINGS: WatchSettings = {
  openalexMailto: "lab@example.org",
  defaultDomainIds: ["4"],
  highImpactThreshold: 9,
  pageSize: 25,
  cacheTtlSeconds: 600,
};

const BASE: WatchSearchQuery = {
  q: "",
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

const parse = (query: string) => parseWatchSearchQuery(new URLSearchParams(query));

describe("parseWatchSearchQuery", () => {
  it("reads every parameter, with the spec defaults", () => {
    expect(parse("")).toEqual({ ok: true, query: BASE });
    expect(
      parse("q=+liver+&scope=title&from=2025-01-01&to=2025-12-31&topics=2730,T10001&oa=true&high_impact=true&min_cited=10&sort=cited&page=3"),
    ).toEqual({
      ok: true,
      query: {
        q: "liver",
        scope: "title",
        from: "2025-01-01",
        to: "2025-12-31",
        topics: ["2730", "T10001"],
        oa: true,
        high_impact: true,
        min_cited: 10,
        sort: "cited",
        page: 3,
      },
    });
  });

  it("refuses what it cannot read", () => {
    expect(parse("scope=abstract")).toMatchObject({ ok: false });
    expect(parse("sort=random")).toMatchObject({ ok: false });
    expect(parse("from=2025-13-01")).toMatchObject({ ok: false });
    expect(parse("from=2025-02-30")).toMatchObject({ ok: false });
    expect(parse("from=2025-06-01&to=2025-01-01")).toMatchObject({ ok: false });
    expect(parse("topics=oncology")).toMatchObject({ ok: false });
    expect(parse("oa=yes")).toMatchObject({ ok: false });
    expect(parse("min_cited=-1")).toMatchObject({ ok: false });
    expect(parse("min_cited=ten")).toMatchObject({ ok: false });
    expect(parse("page=0")).toMatchObject({ ok: false });
    expect(parse("page=41")).toMatchObject({ ok: false });
    expect(parse(`q=${"a".repeat(301)}`)).toMatchObject({ ok: false });
  });

  it("never reads page_size from the client", () => {
    const parsed = parse("page_size=5");
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && "page_size" in parsed.query).toBe(false);
  });
});

describe("buildWorksParams", () => {
  it("always filters on articles, journals, English and the default domains", () => {
    const params = buildWorksParams(BASE, SETTINGS, { perPage: 25, page: 1 });
    expect(params.filter).toBe("type:article,primary_location.source.type:journal,language:en,primary_topic.domain.id:4");
    expect(params.search).toBeUndefined();
    expect(params.sort).toBe("publication_date:desc");
    expect(params["per-page"]).toBe("25");
    expect(params.page).toBe("1");
    expect(params.select).toContain("abstract_inverted_index");
  });

  it("puts a title+abstract query in `search`, a title-only query in the filter", () => {
    const all = buildWorksParams({ ...BASE, q: "liver cancer" }, SETTINGS, { perPage: 25, page: 1 });
    expect(all.search).toBe("liver cancer");
    expect(all.filter).not.toContain("title.search");
    expect(all.sort).toBe("relevance_score:desc");

    const title = buildWorksParams({ ...BASE, q: "liver, cancer|x", scope: "title" }, SETTINGS, { perPage: 25, page: 1 });
    expect(title.search).toBeUndefined();
    // Virgule et barre sont des séparateurs de filtre OpenAlex : neutralisées.
    expect(title.filter).toContain("title.search:liver cancer x");
    expect(title.sort).toBe("relevance_score:desc");
  });

  it("translates every filter of the spec", () => {
    const params = buildWorksParams(
      {
        ...BASE,
        from: "2025-01-01",
        to: "2025-12-31",
        topics: ["2730", "2740", "T10001"],
        oa: true,
        min_cited: 10,
        sort: "cited",
        page: 2,
      },
      { ...SETTINGS, defaultDomainIds: ["4", "3"] },
      { perPage: 10, page: 2 },
    );
    expect(params.filter.split(",")).toEqual([
      "type:article",
      "primary_location.source.type:journal",
      "language:en",
      "primary_topic.domain.id:4|3",
      "from_publication_date:2025-01-01",
      "to_publication_date:2025-12-31",
      "primary_topic.subfield.id:2730|2740",
      "topics.id:T10001",
      "is_oa:true",
      // « au moins 10 » : OpenAlex ne connaît que le strict `>`.
      "cited_by_count:>9",
    ]);
    expect(params.sort).toBe("cited_by_count:desc");
    expect(params["per-page"]).toBe("10");
    expect(params.page).toBe("2");
  });

  it("never asks OpenAlex for a relevance sort without a query", () => {
    expect(resolveSort({ q: "", sort: "relevance" })).toBe("publication_date:desc");
    expect(resolveSort({ q: "x", sort: "date" })).toBe("publication_date:desc");
    expect(resolveSort({ q: "", sort: "cited" })).toBe("cited_by_count:desc");
  });
});

describe("buildFacetParams", () => {
  it("groups by subfield on the same filters, without the topics", () => {
    const params = buildFacetParams({ ...BASE, q: "liver", topics: ["2730"], oa: true }, SETTINGS);
    expect(params.group_by).toBe("primary_topic.subfield.id");
    expect(params["per-page"]).toBe("1");
    expect(params.search).toBe("liver");
    expect(params.filter).toContain("is_oa:true");
    expect(params.filter).not.toContain("subfield.id");
    expect(params.select).toBeUndefined();
    expect(params.sort).toBeUndefined();
  });
});

describe("cache keys", () => {
  it("normalizes the query text and the topic order, and separates pages", () => {
    const a = searchCacheKey({ ...BASE, q: "Liver   Cancer", topics: ["2", "1"] }, SETTINGS);
    const b = searchCacheKey({ ...BASE, q: "liver cancer ", topics: ["1", "2"] }, SETTINGS);
    expect(a).toBe(b);
    expect(searchCacheKey({ ...BASE, q: "liver cancer", page: 2 }, SETTINGS)).not.toBe(a);
    expect(searchCacheKey({ ...BASE, q: "liver cancer", high_impact: true }, SETTINGS)).not.toBe(a);
    expect(searchCacheKey(BASE, { ...SETTINGS, pageSize: 10 })).not.toBe(searchCacheKey(BASE, SETTINGS));
  });

  it("keys the facets without topics, page, sort or the high-impact flag", () => {
    const a = facetsCacheKey({ ...BASE, q: "liver", topics: ["2730"], page: 3, sort: "cited", high_impact: true }, SETTINGS);
    const b = facetsCacheKey({ ...BASE, q: "liver" }, SETTINGS);
    expect(a).toBe(b);
    expect(facetsCacheKey({ ...BASE, q: "liver", oa: true }, SETTINGS)).not.toBe(b);
    expect(a).not.toBe(searchCacheKey({ ...BASE, q: "liver" }, SETTINGS));
  });
});

describe("reconstructAbstract", () => {
  it("orders words by position, contiguous or not", () => {
    expect(reconstructAbstract({ world: [1], Hello: [0] })).toBe("Hello world");
    expect(reconstructAbstract({ a: [0, 4], b: [2], c: [7] })).toBe("a b a c");
  });

  it("gives null for a missing or empty index", () => {
    expect(reconstructAbstract(null)).toBeNull();
    expect(reconstructAbstract(undefined)).toBeNull();
    expect(reconstructAbstract({})).toBeNull();
    expect(reconstructAbstract({ "": [0] })).toBeNull();
  });
});

describe("normalizeWork", () => {
  const raw = {
    id: "https://openalex.org/W123",
    title: "A study",
    doi: "https://doi.org/10.1000/xyz",
    ids: { pmid: "https://pubmed.ncbi.nlm.nih.gov/12345678" },
    publication_date: "2026-09-01",
    cited_by_count: 12,
    open_access: { is_oa: true, oa_url: "https://example.org/pdf" },
    primary_location: { source: { id: "https://openalex.org/S456", display_name: "The Lancet" } },
    primary_topic: { id: "https://openalex.org/T789", display_name: "Liver cancer", subfield: { display_name: "Oncology" } },
    authorships: [
      { author: { display_name: "A" } },
      { author: { display_name: "B" } },
      { author: { display_name: "C" } },
      { author: { display_name: "D" } },
    ],
    abstract_inverted_index: { Short: [0], abstract: [1] },
  };

  it("gives the spec shape, PubMed first, with the journal score from the cache", () => {
    expect(normalizeWork(raw, new Map([["S456", 11.3]]))).toEqual({
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
      authors_count: 4,
      abstract: "Short abstract",
    });
  });

  it("falls back on the DOI, then the OpenAlex page, and tolerates missing fields", () => {
    expect(normalizeWork({ ...raw, ids: {} }, new Map()).url).toBe("https://doi.org/10.1000/xyz");
    const bare = normalizeWork({ id: "https://openalex.org/W1" }, new Map());
    expect(bare.url).toBe("https://openalex.org/W1");
    expect(bare.title).toBe("Untitled");
    expect(bare.journal).toEqual({ source_id: null, name: null, citedness_2yr: null });
    expect(bare.primary_topic).toBeNull();
    expect(bare.authors).toEqual([]);
    expect(bare.abstract).toBeNull();
    expect(bare.is_oa).toBe(false);
  });
});

describe("facets and sources", () => {
  it("keeps the first fifteen named groups", () => {
    const groups = Array.from({ length: 20 }, (_, i) => ({
      key: `https://openalex.org/subfields/${2700 + i}`,
      key_display_name: `Field ${i}`,
      count: 100 - i,
    }));
    const facets = facetsFromGroups([{ key: "unknown", key_display_name: "unknown", count: 3 }, ...groups]);
    expect(facets).toHaveLength(15);
    expect(facets[0]).toEqual({ id: "2700", name: "Field 0", count: 100 });
    expect(facetsFromGroups(null)).toEqual([]);
  });

  it("normalizes a source, with a null score when OpenAlex has none", () => {
    expect(normalizeSource({ id: "https://openalex.org/S1", display_name: "J", summary_stats: { "2yr_mean_citedness": 3.25 } })).toEqual({
      source_id: "S1",
      display_name: "J",
      citedness_2yr: 3.25,
    });
    expect(normalizeSource({ id: "https://openalex.org/S2" })).toEqual({ source_id: "S2", display_name: "S2", citedness_2yr: null });
    expect(normalizeSource({})).toBeNull();
  });
});
