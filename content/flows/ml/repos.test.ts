import { describe, it, expect } from "vitest";
import type { Challenge } from "../../../packages/database-service/domain/entities.js";
import { mlCreationRepos } from "./repos.js";

const TITLE = "Triage assistant";
const CHALLENGE = { uuid: "c-1", title: TITLE, type: "ml" } as Challenge;

describe("mlCreationRepos", () => {
  it("creates one repo per step, in order dataset → model → model_code → api", () => {
    expect(mlCreationRepos({ challenge: CHALLENGE, input: {} }).repos).toEqual([
      { title: `${TITLE} — Dataset`, type: "kaggle_dataset", role: "dataset" },
      { title: `${TITLE} — Model`, type: "kaggle_model", role: "model" },
      { title: `${TITLE} — Model Code`, type: "github", role: "model_code" },
      { title: `${TITLE} — API`, type: "github", role: "api" },
    ]);
  });

  it("skips the API step when API packaging is disabled", () => {
    expect(mlCreationRepos({ challenge: CHALLENGE, input: { api_packaging_enabled: false } }).repos.map((r) => r.role)).toEqual([
      "dataset",
      "model",
      "model_code",
    ]);
  });
});
