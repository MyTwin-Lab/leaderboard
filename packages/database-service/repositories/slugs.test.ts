import { describe, expect, it } from "vitest";
import { SlugTakenError } from "../domain/slug";
import { availableSlug, claimSlug, isSlugTaken, isSlugUniqueViolation, type SlugOwners } from "./slugs";

/** Deux tables en mémoire : slug courant → ligne, ancien slug → ligne. */
function owners(current: Record<string, string>, redirects: Record<string, string> = {}): SlugOwners {
  return {
    currentOwner: async (slug) => current[slug] ?? null,
    redirectOwner: async (slug) => redirects[slug] ?? null,
  };
}

describe("isSlugTaken", () => {
  it("is free when nobody holds or redirects it", async () => {
    expect(await isSlugTaken(owners({}), "mykine")).toBe(false);
  });

  it("is taken when another row holds it", async () => {
    expect(await isSlugTaken(owners({ mykine: "sb-1" }), "mykine")).toBe(true);
  });

  it("is taken when it redirects to another row, so shared links are never hijacked", async () => {
    expect(await isSlugTaken(owners({}, { mykine: "sb-1" }), "mykine")).toBe(true);
  });

  it("stays free for the row being edited, current or former slug alike", async () => {
    expect(await isSlugTaken(owners({ mykine: "sb-1" }), "mykine", "sb-1")).toBe(false);
    expect(await isSlugTaken(owners({}, { mykine: "sb-1" }), "mykine", "sb-1")).toBe(false);
  });
});

describe("availableSlug", () => {
  it("numbers past every taken candidate, redirects included", async () => {
    expect(await availableSlug(owners({ mykine: "a" }, { "mykine-2": "b" }), "mykine")).toBe("mykine-3");
  });
});

describe("claimSlug", () => {
  it("derives the slug from the title when none is requested", async () => {
    const slug = await claimSlug(owners({ "triage-assistant": "a" }), {
      title: "Triage Assistant",
      fallback: "sandbox",
    });
    expect(slug).toBe("triage-assistant-2");
  });

  it("keeps a free requested slug as is", async () => {
    expect(await claimSlug(owners({}), { requested: "mykine", title: "Whatever", fallback: "sandbox" }))
      .toBe("mykine");
  });

  it("refuses a taken requested slug instead of silently replacing it", async () => {
    const error = await claimSlug(owners({ mykine: "a" }), {
      requested: "mykine",
      title: "MyKine",
      fallback: "sandbox",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(SlugTakenError);
    expect(error.suggestion).toBe("mykine-2");
  });
});

describe("isSlugUniqueViolation", () => {
  const constraints = ["idx_sandboxes_slug"];

  it("recognises the slug index refusing a concurrent write", () => {
    expect(isSlugUniqueViolation({ code: "23505", constraint: "idx_sandboxes_slug" }, constraints)).toBe(true);
  });

  it("reads the driver error Drizzle wraps in `cause`", () => {
    const wrapped = { cause: { code: "23505", constraint: "idx_sandboxes_slug" } };
    expect(isSlugUniqueViolation(wrapped, constraints)).toBe(true);
  });

  it("ignores any other unique index, and any other error", () => {
    expect(isSlugUniqueViolation({ code: "23505", constraint: "idx_other" }, constraints)).toBe(false);
    expect(isSlugUniqueViolation(new Error("boom"), constraints)).toBe(false);
  });
});
