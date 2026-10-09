import { describe, expect, it } from "vitest";

import { isJoinStep, parseLabRole } from "./join";

describe("parseLabRole", () => {
  it("keeps a known role", () => {
    expect(parseLabRole("developer")).toBe("developer");
  });

  it("falls back to « other » for nothing, or anything else", () => {
    expect(parseLabRole(null)).toBe("other");
    expect(parseLabRole("")).toBe("other");
    expect(parseLabRole("admin")).toBe("other");
  });
});

describe("isJoinStep", () => {
  it("only knows the steps that can be ticked", () => {
    expect(isJoinStep("anecdote")).toBe(true);
    expect(isJoinStep("whatsapp")).toBe(true);
    expect(isJoinStep("challenges")).toBe(false);
  });
});
