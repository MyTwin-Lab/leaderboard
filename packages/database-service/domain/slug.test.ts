import { describe, expect, it } from "vitest";
import {
  SLUG_MAX_LENGTH,
  SlugTakenError,
  firstFreeSlug,
  isValidSlug,
  looksLikeUuid,
  normalizeSlugInput,
  planSlugBackfill,
  slugCandidate,
  slugProblem,
  slugify,
} from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates a plain title", () => {
    expect(slugify("Mammography Classification", "challenge")).toBe("mammography-classification");
  });

  it("drops diacritics instead of the letters that carry them", () => {
    expect(slugify("Détection de lésion ligamentaire du genou (IRM)", "challenge"))
      .toBe("detection-de-lesion-ligamentaire-du-genou-irm");
  });

  it("transliterates the letters NFKD does not decompose", () => {
    expect(slugify("Cœur, Straße & Ærø", "challenge")).toBe("coeur-strasse-and-aero");
  });

  it("collapses dashes, punctuation and em dashes into single hyphens", () => {
    expect(slugify("Validation clinique qualifiée — API Lésion Ligamentaire", "challenge"))
      .toBe("validation-clinique-qualifiee-api-lesion-ligamentaire");
    expect(slugify("MyKine - guided physio sessions", "sandbox")).toBe("mykine-guided-physio-sessions");
  });

  it("keeps an apostrophe's word whole", () => {
    expect(slugify("A patient's own data", "sandbox")).toBe("a-patients-own-data");
  });

  it("cuts a long title on a word boundary", () => {
    const slug = slugify("word ".repeat(40), "challenge");
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("word")).toBe(true);
    expect(isValidSlug(slug)).toBe(true);
  });

  it("falls back when the title yields nothing", () => {
    expect(slugify("🩺🧬", "sandbox")).toBe("sandbox");
    expect(slugify("   ", "challenge")).toBe("challenge");
  });

  it("always returns a valid slug, completing what would be refused", () => {
    expect(slugify("AI", "challenge")).toBe("ai-challenge");
    expect(slugify("New", "sandbox")).toBe("new-sandbox");
    const uuid = "8e53bee5-27d0-483d-9adf-091e5df9f2e8";
    expect(slugify(uuid, "challenge")).toBe(`${uuid}-challenge`);
    expect(isValidSlug(slugify(uuid, "challenge"))).toBe(true);
  });
});

describe("slugProblem", () => {
  it("accepts a well-formed slug", () => {
    expect(slugProblem("mykine")).toBeNull();
    expect(slugProblem("model-2")).toBeNull();
  });

  it("names the problem with a malformed one", () => {
    expect(slugProblem("")).toMatch(/choose/i);
    expect(slugProblem("ab")).toMatch(/at least 3/i);
    expect(slugProblem("a".repeat(SLUG_MAX_LENGTH + 1))).toMatch(/at most/i);
    expect(slugProblem("Upper")).toMatch(/lowercase/i);
    expect(slugProblem("double--hyphen")).toMatch(/single hyphens/i);
    expect(slugProblem("-leading")).toMatch(/single hyphens/i);
    expect(slugProblem("trailing-")).toMatch(/single hyphens/i);
  });

  it("refuses a uuid, which would clash with the old-URL redirect", () => {
    expect(looksLikeUuid("8e53bee5-27d0-483d-9adf-091e5df9f2e8")).toBe(true);
    expect(slugProblem("8e53bee5-27d0-483d-9adf-091e5df9f2e8")).toMatch(/id/);
  });

  it("refuses a reserved word", () => {
    expect(slugProblem("new")).toMatch(/reserved/);
  });
});

describe("normalizeSlugInput", () => {
  it("normalizes as the user types, keeping a trailing hyphen", () => {
    expect(normalizeSlugInput("Mammo Classif")).toBe("mammo-classif");
    expect(normalizeSlugInput("mammography-")).toBe("mammography-");
    expect(normalizeSlugInput("Lésion__IRM!!")).toBe("lesion-irm");
    expect(normalizeSlugInput("--a---b")).toBe("a-b");
  });

  it("trims the trailing hyphen once final", () => {
    expect(normalizeSlugInput("mammography-", { final: true })).toBe("mammography");
  });
});

describe("slugCandidate", () => {
  it("numbers from 2, the bare base being the first candidate", () => {
    expect(slugCandidate("mykine", 1)).toBe("mykine");
    expect(slugCandidate("mykine", 2)).toBe("mykine-2");
    expect(slugCandidate("mykine", 12)).toBe("mykine-12");
  });

  it("shortens the base so the suffix still fits", () => {
    const base = `${"a".repeat(78)}-b`;
    const candidate = slugCandidate(base, 3);
    expect(candidate.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(candidate.endsWith("-3")).toBe(true);
    expect(isValidSlug(candidate)).toBe(true);
  });
});

describe("firstFreeSlug", () => {
  it("skips every taken candidate", () => {
    const taken = new Set(["mykine", "mykine-2"]);
    expect(firstFreeSlug("mykine", (slug) => taken.has(slug))).toBe("mykine-3");
  });
});

describe("SlugTakenError", () => {
  it("carries the refused slug and a free suggestion", () => {
    const error = new SlugTakenError("mykine", "mykine-2");
    expect(error).toBeInstanceOf(Error);
    expect(error.slug).toBe("mykine");
    expect(error.suggestion).toBe("mykine-2");
  });
});

describe("planSlugBackfill", () => {
  it("assigns a slug to every row without one, in the given order", () => {
    const plan = planSlugBackfill(
      [
        { uuid: "u1", title: "Breast Cancer Detection", slug: null },
        { uuid: "u2", title: "Breast cancer detection", slug: null },
        { uuid: "u3", title: "Leaderboard PoC", slug: null },
      ],
      "challenge",
    );
    expect(plan).toEqual([
      { uuid: "u1", slug: "breast-cancer-detection" },
      { uuid: "u2", slug: "breast-cancer-detection-2" },
      { uuid: "u3", slug: "leaderboard-poc" },
    ]);
  });

  it("leaves rows that already have a slug alone, and never reuses theirs", () => {
    const plan = planSlugBackfill(
      [
        { uuid: "u1", title: "MyKine", slug: null },
        { uuid: "u2", title: "Something else", slug: "mykine" },
      ],
      "sandbox",
    );
    expect(plan).toEqual([{ uuid: "u1", slug: "mykine-2" }]);
  });

  it("does not hand out a slug kept as a redirect", () => {
    const plan = planSlugBackfill([{ uuid: "u1", title: "MyKine", slug: null }], "sandbox", ["mykine"]);
    expect(plan).toEqual([{ uuid: "u1", slug: "mykine-2" }]);
  });

  it("is a no-op once every row has a slug", () => {
    expect(planSlugBackfill([{ uuid: "u1", title: "MyKine", slug: "mykine" }], "sandbox")).toEqual([]);
  });
});
