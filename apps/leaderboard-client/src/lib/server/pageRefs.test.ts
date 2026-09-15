import { afterEach, describe, expect, it, vi } from "vitest";
import { repositories } from "@/lib/db";
import { resolveChallengeRef, resolveSandboxRef } from "./pageRefs";

const UUID = "8e53bee5-27d0-483d-9adf-091e5df9f2e8";
const CHALLENGE = { uuid: UUID, slug: "mammography-classification", title: "Mammography Classification" };

afterEach(() => {
  vi.restoreAllMocks();
});

function stubChallenges({
  bySlug = {},
  byId = {},
  redirects = {},
}: {
  bySlug?: Record<string, unknown>;
  byId?: Record<string, unknown>;
  redirects?: Record<string, string>;
}) {
  vi.spyOn(repositories.challenge, "findBySlug").mockImplementation(async (slug) => (bySlug[slug] as any) ?? null);
  vi.spyOn(repositories.challenge, "findById").mockImplementation(async (id) => (byId[id] as any) ?? null);
  vi.spyOn(repositories.challenge, "findSlugRedirect").mockImplementation(async (slug) => redirects[slug] ?? null);
}

describe("resolveChallengeRef", () => {
  it("finds a challenge at its current slug", async () => {
    stubChallenges({ bySlug: { "mammography-classification": CHALLENGE } });

    expect(await resolveChallengeRef("mammography-classification")).toEqual({ kind: "found", entity: CHALLENGE });
  });

  it("moves an old UUID URL to the slug", async () => {
    stubChallenges({ byId: { [UUID]: CHALLENGE } });

    expect(await resolveChallengeRef(UUID)).toEqual({ kind: "moved", slug: "mammography-classification" });
  });

  it("moves an abandoned slug to the current one", async () => {
    stubChallenges({ byId: { [UUID]: CHALLENGE }, redirects: { "mammo-classif": UUID } });

    expect(await resolveChallengeRef("mammo-classif")).toEqual({ kind: "moved", slug: "mammography-classification" });
  });

  it("moves a capitalised slug to its lowercase form", async () => {
    stubChallenges({ bySlug: { "mammography-classification": CHALLENGE } });

    expect(await resolveChallengeRef("Mammography-Classification"))
      .toEqual({ kind: "moved", slug: "mammography-classification" });
  });

  it("reports an unknown slug or UUID as missing", async () => {
    stubChallenges({});

    expect(await resolveChallengeRef("nothing-here")).toEqual({ kind: "missing" });
    expect(await resolveChallengeRef("00000000-0000-4000-8000-000000000000")).toEqual({ kind: "missing" });
  });

  it("never sends a UUID-shaped segment to the slug lookup", async () => {
    stubChallenges({});

    await resolveChallengeRef("11111111-2222-4333-8444-555555555555");

    expect(repositories.challenge.findBySlug).not.toHaveBeenCalled();
  });
});

describe("resolveSandboxRef", () => {
  it("resolves in the sandbox namespace", async () => {
    const sandbox = { uuid: UUID, slug: "mykine" };
    vi.spyOn(repositories.sandbox, "findBySlug").mockResolvedValue(sandbox as any);

    expect(await resolveSandboxRef("mykine")).toEqual({ kind: "found", entity: sandbox });
  });
});
