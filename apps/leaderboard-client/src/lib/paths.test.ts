import { describe, expect, it } from "vitest";
import { challengeInvitePath, challengeManagePath, challengePath, sandboxPath, withSearchParams } from "./paths";

describe("page paths", () => {
  it("builds every public page on the slug", () => {
    expect(challengePath("mammography-classification")).toBe("/challenges/mammography-classification");
    expect(challengeManagePath("mykine")).toBe("/challenges/mykine/manage");
    expect(sandboxPath("mykine")).toBe("/sandbox/mykine");
  });

  it("carries the group token in the invite link", () => {
    expect(challengeInvitePath("mykine", "8e53bee5-27d0-483d-9adf-091e5df9f2e8"))
      .toBe("/challenges/mykine?group=8e53bee5-27d0-483d-9adf-091e5df9f2e8");
  });
});

describe("withSearchParams", () => {
  it("keeps the query of the URL being redirected, the invite token included", () => {
    expect(withSearchParams("/challenges/mykine", { group: "abc" })).toBe("/challenges/mykine?group=abc");
  });

  it("keeps repeated keys and drops undefined ones", () => {
    expect(withSearchParams("/sandbox/x", { tag: ["a", "b"], empty: undefined })).toBe("/sandbox/x?tag=a&tag=b");
  });

  it("adds nothing when there is no query", () => {
    expect(withSearchParams("/sandbox/x", {})).toBe("/sandbox/x");
  });
});
