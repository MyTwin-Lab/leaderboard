import { afterEach, describe, expect, it, vi } from "vitest";
import { repositories } from "@/lib/db";
import { challengeJsonLd, challengeMetadata, contributorMetadata, fetchSitemap, sandboxJsonLd, sandboxMetadata } from "./seo";

const NOINDEX = { index: false, follow: false };

const challenge = (overrides: Record<string, unknown> = {}) => ({
  uuid: "c1",
  title: "Predict glucose",
  slug: "predict-glucose",
  status: "active",
  type: "ml",
  description: "Build a **model** from CGM data.",
  created_at: new Date("2026-06-01T00:00:00Z"),
  closed_at: null,
  ...overrides,
});

const sandbox = (overrides: Record<string, unknown> = {}) => ({
  uuid: "s1",
  user_id: "u1",
  title: "Sleep tracker",
  slug: "sleep-tracker",
  status: "open",
  context: "Track sleep with a wearable.",
  why: null,
  goals: [],
  updated_at: new Date("2026-09-01T00:00:00Z"),
  ...overrides,
});

describe("challengeMetadata", () => {
  it("titles a public challenge with its name and description, canonical at its slug", () => {
    const metadata = challengeMetadata(challenge() as any);

    expect(metadata.title).toBe("Predict glucose");
    expect(metadata.description).toBe("Build a model from CGM data.");
    expect(metadata.alternates?.canonical).toBe("/challenges/predict-glucose");
    expect(metadata.robots).toBeUndefined();
  });

  it("writes a description when the challenge has none", () => {
    const metadata = challengeMetadata(challenge({ description: undefined }) as any);

    expect(metadata.description).toBe(
      "Machine learning challenge at MyTwin Lab: contribute, get evaluated and earn contribution points (CP).",
    );
  });

  it.each([
    ["a draft", { status: "draft" }],
    ["an archived challenge", { status: "archived" }],
    ["a validation challenge", { type: "endpoint-validation" }],
  ])("does not publish the title of %s", (_label, overrides) => {
    expect(challengeMetadata(challenge(overrides) as any)).toEqual({ title: "Challenges", robots: NOINDEX });
  });
});

describe("sandboxMetadata", () => {
  it("titles an open proposal with its name and context, canonical at its slug", () => {
    const metadata = sandboxMetadata(sandbox() as any);

    expect(metadata.title).toBe("Sleep tracker");
    expect(metadata.description).toBe("Track sleep with a wearable.");
    expect(metadata.alternates?.canonical).toBe("/sandbox/sleep-tracker");
  });

  it("falls back on the goals when there is no context nor why", () => {
    expect(sandboxMetadata(sandbox({ context: null, goals: ["Detect apnea", "Score sleep"] }) as any).description)
      .toBe("Detect apnea. Score sleep");
  });

  it("does not publish the title of an archived proposal", () => {
    expect(sandboxMetadata(sandbox({ status: "archived" }) as any)).toEqual({ title: "Sandbox", robots: NOINDEX });
  });
});

describe("challengeJsonLd", () => {
  it("gives a public challenge a breadcrumb ending on its title, at its slug", () => {
    const graph = challengeJsonLd(challenge() as any) as { "@graph": { itemListElement: { name: string; item: string }[] }[] };
    const items = graph["@graph"][0].itemListElement;

    expect(items.map((item) => item.name)).toEqual(["MyTwin Lab", "Challenges", "Predict glucose"]);
    expect(items[2].item).toBe("https://mytwinlab.care/challenges/predict-glucose");
  });

  it("describes nothing for a challenge an anonymous visitor cannot open", () => {
    expect(challengeJsonLd(challenge({ status: "draft" }) as any)).toBeNull();
  });
});

describe("sandboxJsonLd", () => {
  it("gives an open proposal a breadcrumb at its slug", () => {
    const graph = sandboxJsonLd(sandbox() as any) as { "@graph": { itemListElement: { item: string }[] }[] };

    expect(graph["@graph"][0].itemListElement[2].item).toBe("https://mytwinlab.care/sandbox/sleep-tracker");
  });
});

describe("contributorMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("describes a contributor without a bio, and keeps the profile out of the index", async () => {
    vi.spyOn(repositories.user, "findById").mockResolvedValue(
      { uuid: "u1", full_name: "Alice Martin", role: "contributor", created_at: new Date() } as any,
    );

    const metadata = await contributorMetadata("u1");

    expect(metadata.title).toBe("Alice Martin");
    expect(metadata.description).toBe(
      "Alice Martin's contributions to MyTwin Lab, tracked, evaluated and rewarded in CP.",
    );
    expect(metadata.alternates?.canonical).toBe("/contributors/u1");
    // Hors de l'index, mais ses liens vers les challenges restent suivis.
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});

describe("fetchSitemap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists only what an anonymous visitor can open, and no contributor profile", async () => {
    vi.spyOn(repositories.challenge, "findAll").mockResolvedValue([
      challenge({ slug: "public-one" }),
      challenge({ slug: "hidden-draft", status: "draft" }),
      challenge({ slug: "hidden-validation", type: "endpoint-validation" }),
    ] as any);
    vi.spyOn(repositories.sandbox, "findAll").mockResolvedValue([
      sandbox({ slug: "open-one" }),
      sandbox({ slug: "hidden-archived", status: "archived" }),
    ] as any);

    const urls = (await fetchSitemap()).map((entry) => entry.url);

    expect(urls).toContain("https://mytwinlab.care/challenges/public-one");
    expect(urls).toContain("https://mytwinlab.care/sandbox/open-one");
    // Les slugs de fixture portent « hidden » : ni brouillon, ni validation,
    // ni archivé, ni profil ne doit apparaître.
    expect(urls.some((url) => /hidden|contributors/.test(url))).toBe(false);
  });
});
