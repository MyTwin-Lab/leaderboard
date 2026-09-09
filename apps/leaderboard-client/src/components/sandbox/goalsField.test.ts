import { describe, it, expect } from "vitest";
import { formatGoals, goalsError, MAX_GOALS, parseGoals } from "./goalsField";

describe("parseGoals", () => {
  it("turns one line into one goal", () => {
    expect(parseGoals("A reproducible pipeline\nA baseline CNN")).toEqual([
      "A reproducible pipeline",
      "A baseline CNN",
    ]);
  });

  it("drops blank lines and trims each goal", () => {
    expect(parseGoals("\n  First goal  \n\n\tSecond goal\n\n")).toEqual([
      "First goal",
      "Second goal",
    ]);
  });

  it("strips a bullet the author typed by hand", () => {
    expect(parseGoals("- Dash\n* Star\n• Bullet\n1. Numbered\n2) Parenthesised")).toEqual([
      "Dash",
      "Star",
      "Bullet",
      "Numbered",
      "Parenthesised",
    ]);
  });

  it("leaves a dash that is part of the sentence alone", () => {
    expect(parseGoals("A-B testing of the policy")).toEqual(["A-B testing of the policy"]);
    expect(parseGoals("Ship it -- fast")).toEqual(["Ship it -- fast"]);
  });

  it("returns an empty array for an empty or blank field", () => {
    expect(parseGoals("")).toEqual([]);
    expect(parseGoals("   \n\n  ")).toEqual([]);
  });
});

describe("formatGoals", () => {
  it("is the inverse of parseGoals on already-clean input", () => {
    const goals = ["First goal", "Second goal"];
    expect(parseGoals(formatGoals(goals))).toEqual(goals);
  });

  it("renders an empty or missing list as an empty field", () => {
    expect(formatGoals([])).toBe("");
    expect(formatGoals(null)).toBe("");
    expect(formatGoals(undefined)).toBe("");
  });
});

describe("goalsError", () => {
  it("accepts a normal list", () => {
    expect(goalsError(["One", "Two"])).toBeNull();
  });

  it("rejects more goals than the schema allows", () => {
    const tooMany = Array.from({ length: MAX_GOALS + 1 }, (_, i) => `Goal ${i}`);
    expect(goalsError(tooMany)).toMatch(/At most 20/);
  });

  it("rejects a goal longer than the schema allows", () => {
    expect(goalsError(["x".repeat(501)])).toMatch(/500 characters/);
  });
});
