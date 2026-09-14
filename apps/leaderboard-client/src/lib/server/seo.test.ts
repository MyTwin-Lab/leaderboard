import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repositories } from "@/lib/db";
import { challengeJsonLd, challengeMetadata, contributorMetadata, fetchSitemap, sandboxMetadata } from "./seo";

const NOINDEX = { index: false, follow: false };

const challenge = (overrides: Record<string, unknown> = {}) => ({
  uuid: "c1",
  title: "Predict glucose",
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
  status: "open",
  context: "Track sleep with a wearable.",
  why: null,
  goals: [],
  updated_at: new Date("2026-09-01T00:00:00Z"),
  ...overrides,
});

describe("challengeMetadata", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("titles a public challenge with its name and description", async () => {
    vi.spyOn(repositories.challenge, "findById").mockResolvedValue(challenge() as any);

    const metadata = await challengeMetadata("c1");

    expect(metadata.title).toBe("Predict glucose");
    expect(metadata.description).toBe("Build a model from CGM data.");
    expect(metadata.alternates?.canonical).toBe("/challenges/c1");
    expect(metadata.robots).toBeUndefined();
  });

  it("writes a description when the challenge has none", async () => {
    vi.spyOn(repositories.challenge, "findById").mockResolvedValue(challenge({ description: undefined }) as any);

    const metadata = await challengeMetadata("c1");

    expect(metadata.description).toBe(
      "Machine learning challenge at MyTwin Lab: contribute, get evaluated and earn contribution points (CP).",
    );
  });

  it.each([
    ["a draft", { status: "draft" }],
    ["an archived challenge", { status: "archived" }],
    ["a validation challenge", { type: "validation" }],
  ])("does not publish the title of %s", async (_label, overrides) => {
    vi.spyOn(repositories.challenge, "findById").mockResolvedValue(challenge(overrides) as any);

    const metadata = await challengeMetadata("c1");

    expect(metadata).toEqual({ title: "Challenges", robots: NOINDEX });
  });

  it("does not index an unknown challenge", async () => {
    vi.spyOn(repositories.challenge, "findById").mockResolvedValue(null);

    expect(await challengeMetadata("missing")).toEqual({ title: "Challenges", robots: NOINDEX });
  });

  it("falls back instead of failing when the lookup throws", async () => {
    vi.spyOn(repositories.challenge, "findById").mockRejectedValue(new Error("invalid input syntax for type uuid"));

    expect(await challengeMetadata("not-a-uuid")).toEqual({ title: "Challenges", robots: NOINDEX });
  });
});

describe("sandboxMetadata", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("titles an open proposal with its name and context", async () => {
    vi.spyOn(repositories.sandbox, "findById").mockResolvedValue(sandbox() as any);

    const metadata = await sandboxMetadata("s1");

    expect(metadata.title).toBe("Sleep tracker");
    expect(metadata.description).toBe("Track sleep with a wearable.");
    expect(metadata.alternates?.canonical).toBe("/sandbox/s1");
  });

  it("falls back on the goals when there is no context nor why", async () => {
    vi.spyOn(repositories.sandbox, "findById").mockResolvedValue(
      sandbox({ context: null, goals: ["Detect apnea", "Score sleep"] }) as any,
    );

    expect((await sandboxMetadata("s1")).description).toBe("Detect apnea. Score sleep");
  });

  it("does not publish the title of an archived proposal", async () => {
    vi.spyOn(repositories.sandbox, "findById").mockResolvedValue(sandbox({ status: "archived" }) as any);

    expect(await sandboxMetadata("s1")).toEqual({ title: "Sandbox", robots: NOINDEX });
  });
});

describe("challengeJsonLd", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives a public challenge a breadcrumb ending on its title", async () => {
    vi.spyOn(repositories.challenge, "findById").mockResolvedValue(challenge() as any);

    const graph = (await challengeJsonLd("c1")) as { "@graph": { itemListElement: { name: string; item: string }[] }[] };
    const items = graph["@graph"][0].itemListElement;

    expect(items.map((item) => item.name)).toEqual(["MyTwin Lab", "Challenges", "Predict glucose"]);
    expect(items[2].item).toBe("https://mytwinlab.care/challenges/c1");
  });

  it("describes nothing for a challenge an anonymous visitor cannot open", async () => {
    vi.spyOn(repositories.challenge, "findById").mockResolvedValue(challenge({ status: "draft" }) as any);

    expect(await challengeJsonLd("c1")).toBeNull();
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
      challenge({ uuid: "public" }),
      challenge({ uuid: "draft", status: "draft" }),
      challenge({ uuid: "validation", type: "validation" }),
    ] as any);
    vi.spyOn(repositories.sandbox, "findAll").mockResolvedValue([
      sandbox({ uuid: "open" }),
      sandbox({ uuid: "archived", status: "archived" }),
    ] as any);

    const urls = (await fetchSitemap()).map((entry) => entry.url);

    expect(urls).toContain("https://mytwinlab.care/challenges/public");
    expect(urls).toContain("https://mytwinlab.care/sandbox/open");
    expect(urls.some((url) => /draft|validation|archived|contributors/.test(url))).toBe(false);
  });
});
