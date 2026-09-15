import { describe, expect, it } from "vitest";
import {
  challengeInvitePath,
  challengeManagePath,
  challengePath,
  challengeSignInPath,
  sandboxPath,
  withSearchParams,
} from "./paths";
import { safeInternalPath } from "./url";

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

describe("challengeSignInPath", () => {
  const TOKEN = "8e53bee5-27d0-483d-9adf-091e5df9f2e8";

  it("comes back to the challenge page", () => {
    expect(challengeSignInPath("mykine")).toBe("/signin?from=%2Fchallenges%2Fmykine");
  });

  it("comes back to the invitation, token included, in a form sign-in accepts", () => {
    const href = challengeSignInPath("mykine", TOKEN);
    const from = new URLSearchParams(href.split("?")[1]).get("from");
    expect(from).toBe(`/challenges/mykine?group=${TOKEN}`);
    expect(safeInternalPath(from)).toBe(from);
  });

  it("drops a token sign-in would refuse, rather than losing the whole path", () => {
    expect(challengeSignInPath("mykine", "not-a-token")).toBe("/signin?from=%2Fchallenges%2Fmykine");
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
