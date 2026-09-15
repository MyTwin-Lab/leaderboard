import { describe, expect, it, vi } from "vitest";
import { SlugTakenError } from "../../../../../packages/database-service/domain/slug";
import { checkSlugAvailability, slugField, slugTakenResponse } from "./slugs";

function repo(taken: string[]) {
  return {
    isSlugTaken: vi.fn(async (slug: string) => taken.includes(slug)),
    availableSlug: vi.fn(async (base: string) => {
      for (let n = 1; ; n++) {
        const candidate = n === 1 ? base : `${base}-${n}`;
        if (!taken.includes(candidate)) return candidate;
      }
    }),
  };
}

describe("checkSlugAvailability", () => {
  it("says a free, well-formed slug is available", async () => {
    expect(await checkSlugAvailability(repo([]), "mykine", "sandbox", null)).toEqual({
      slug: "mykine", available: true, problem: null, suggestion: null,
    });
  });

  it("offers the next free candidate for a taken slug", async () => {
    const result = await checkSlugAvailability(repo(["mykine"]), "mykine", "sandbox", null);
    expect(result).toMatchObject({ available: false, suggestion: "mykine-2" });
    expect(result.problem).toMatch(/taken/);
  });

  it("names the problem with a malformed slug, and suggests a valid one", async () => {
    const result = await checkSlugAvailability(repo([]), "My Kine", "sandbox", null);
    expect(result).toMatchObject({ available: false, suggestion: "my-kine" });
    expect(result.problem).toMatch(/lowercase/i);
  });

  it("excludes the row being edited, and ignores an exclude that is not an id", async () => {
    const r = repo([]);
    const id = "8e53bee5-27d0-483d-9adf-091e5df9f2e8";
    await checkSlugAvailability(r, "mykine", "sandbox", id);
    expect(r.isSlugTaken).toHaveBeenCalledWith("mykine", id);

    await checkSlugAvailability(r, "mykine", "sandbox", "'; drop table");
    expect(r.isSlugTaken).toHaveBeenLastCalledWith("mykine", undefined);
  });
});

describe("slugTakenResponse", () => {
  it("answers 409 with the field and the suggestion", async () => {
    const res = slugTakenResponse(new SlugTakenError("mykine", "mykine-2"));
    expect(res?.status).toBe(409);
    expect(await res?.json()).toMatchObject({ field: "slug", suggestion: "mykine-2" });
  });

  it("leaves any other error to the caller", () => {
    expect(slugTakenResponse(new Error("boom"))).toBeNull();
  });
});

describe("slugField", () => {
  it("carries the same message the form shows", () => {
    const result = slugField.safeParse("ab");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/at least 3/i);
  });
});
