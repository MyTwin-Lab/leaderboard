import { describe, it, expect } from "vitest";
import { EvaluationGridRegistry } from "../grids/index.js";

describe("EvaluationGridRegistry", () => {
  it("returns the grid for a registered type", () => {
    const grid = EvaluationGridRegistry.getGrid("code");

    expect(grid).toBeDefined();
    expect(grid.type).toBe("code");
  });

  it("confirms whether a grid exists", () => {
    expect(EvaluationGridRegistry.hasGrid("model")).toBe(true);
    expect(EvaluationGridRegistry.hasGrid("dataset")).toBe(true);
    expect(EvaluationGridRegistry.hasGrid("unknown")).toBe(false);
  });

  it("exposes the list of available types", () => {
    const types = EvaluationGridRegistry.getAvailableTypes();

    expect(types).toEqual(expect.arrayContaining(["code", "model", "dataset"]));
  });

  it("throws with a clear message when the grid is missing", () => {
    expect(() => EvaluationGridRegistry.getGrid("unknown"))
      .toThrow('[EvaluationGridRegistry] No grid found for type: "unknown"');
  });
});
