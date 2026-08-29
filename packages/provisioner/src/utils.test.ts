import { describe, it, expect } from "vitest";
import { generateContributorBranchName } from "./utils.js";

describe("generateContributorBranchName", () => {
  it("slugifies the username under a contrib/ prefix with the challenge index", () => {
    expect(generateContributorBranchName(15, "Alice Dupont")).toBe("contrib/015-alice-dupont");
  });
  it("strips characters not allowed in a git ref", () => {
    expect(generateContributorBranchName(7, "bob~^:l33t?")).toBe("contrib/007-bob-l33t");
  });
});
