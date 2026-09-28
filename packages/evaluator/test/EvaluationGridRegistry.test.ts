import { describe, it, expect, afterEach, vi } from "vitest";
import { EvaluationGridRegistry } from "../grids/index.js";

const GRID = { type: "code", criteriaTemplate: [{ criterion: "quality", weight: 1 }], instructions: "" };

describe("EvaluationGridRegistry", () => {
  afterEach(() => EvaluationGridRegistry.reset());

  it("serves the grid of the installed provider, by slug", async () => {
    const getGrid = vi.fn(async () => GRID);
    EvaluationGridRegistry.setDatabaseProvider({ getGrid });

    expect(await EvaluationGridRegistry.getGrid("code")).toBe(GRID);
    expect(getGrid).toHaveBeenCalledWith("code");
  });

  it("names the slug when no grid is published under it, instead of a built-in fallback", async () => {
    EvaluationGridRegistry.setDatabaseProvider({ getGrid: async () => null });

    await expect(EvaluationGridRegistry.getGrid("code")).rejects.toThrow('No published grid "code"');
  });

  it("lets a provider error through", async () => {
    EvaluationGridRegistry.setDatabaseProvider({ getGrid: async () => { throw new Error("db down"); } });

    await expect(EvaluationGridRegistry.getGrid("code")).rejects.toThrow("db down");
  });

  it("refuses to serve a grid without a provider", async () => {
    await expect(EvaluationGridRegistry.getGrid("dataset")).rejects.toThrow(/No grid provider installed, cannot load grid "dataset"/);
  });
});
