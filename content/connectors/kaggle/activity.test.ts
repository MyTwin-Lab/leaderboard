import { describe, it, expect } from "vitest";
import { kaggleDatasetOf, kaggleModelOf, mergeKaggleActivities, type KaggleActivityPayload } from "./activity.js";

const MODEL_A: KaggleActivityPayload = {
  kind: "model",
  modelVersions: [{ ref: "alice/lungs", versions: [{ versionNumber: 1, createdAt: "2026-03-01", metrics: { auc: 0.9 } }] }],
};
const MODEL_B: KaggleActivityPayload = {
  kind: "model",
  modelVersions: [{ ref: "bob/lungs", versions: [{ versionNumber: 2, createdAt: "2026-03-02", metrics: { f1: 0.8 } }] }],
};
const DATASET: KaggleActivityPayload = {
  kind: "dataset",
  datasetMeta: { title: "Chest X-rays", url: "https://www.kaggle.com/datasets/alice/xrays", tags: ["medical"] },
};

describe("mergeKaggleActivities", () => {
  it("concatenates the model versions of every contributor's artifact", () => {
    expect(mergeKaggleActivities([MODEL_A, null, MODEL_B])).toEqual({
      kind: "model",
      modelVersions: [...MODEL_A.modelVersions!, ...MODEL_B.modelVersions!],
    });
  });

  it("gives an empty model when every artifact failed", () => {
    expect(mergeKaggleActivities([])).toEqual({ kind: "model", modelVersions: [] });
  });
});

describe("Kaggle extractors", () => {
  const activities = {
    "repo-1": { connectorKey: "github", payload: { events: [] } },
    "repo-2": { connectorKey: "kaggle", payload: DATASET },
    "repo-3": { error: "unavailable" },
    "repo-4": { connectorKey: "kaggle", payload: MODEL_A },
  };

  it("finds the dataset and the model among the challenge's activities", () => {
    expect(kaggleDatasetOf(activities)).toBe(DATASET);
    expect(kaggleModelOf(activities)).toBe(MODEL_A);
  });

  it("answers null when the challenge has none", () => {
    expect(kaggleDatasetOf({ "repo-4": activities["repo-4"] })).toBeNull();
    expect(kaggleModelOf(null)).toBeNull();
  });
});
