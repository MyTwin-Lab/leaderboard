import { describe, it, expect } from "vitest";
import {
  buildAuthorContributions,
  mlEvaluationContext,
  mlProposalFieldsOf,
  seedMlWorkspaceMeta,
} from "./proposal.js";

const AUTHOR = "user-1";
const CHALLENGE_ID = "challenge-1";

const fields = mlProposalFieldsOf({
  repo_url: "https://github.com/alice/triage",
  model_url: "https://kaggle.com/models/alice/triage",
  dataset_urls: ["https://kaggle.com/datasets/alice/intake", "https://kaggle.com/datasets/bob/vitals"],
});

describe("mlProposalFieldsOf", () => {
  it("lit défensivement des champs incomplets", () => {
    expect(mlProposalFieldsOf({ repo_url: "https://github.com/a/b", model_url: "", dataset_urls: [1, "x"] })).toEqual({
      repo_url: "https://github.com/a/b",
      model_url: null,
      dataset_urls: ["x"],
    });
  });
});

describe("mlEvaluationContext", () => {
  it("donne à l'agent le modèle et les datasets", () => {
    expect(mlEvaluationContext(fields)).toEqual([
      "Model artifact: https://kaggle.com/models/alice/triage",
      "Datasets: https://kaggle.com/datasets/alice/intake, https://kaggle.com/datasets/bob/vitals",
    ]);
  });

  it("sans modèle, aucune ligne Model artifact", () => {
    expect(mlEvaluationContext({ ...fields, model_url: null })).toEqual([
      "Datasets: https://kaggle.com/datasets/alice/intake, https://kaggle.com/datasets/bob/vitals",
    ]);
  });
});

describe("seedMlWorkspaceMeta", () => {
  it("recopie datasets, modèle et code dans les formes attendues par le workspace ML", () => {
    expect(seedMlWorkspaceMeta(fields, AUTHOR)).toEqual({
      dataset: {
        userUrls: { [AUTHOR]: "https://kaggle.com/datasets/alice/intake" },
        datasetUrls: {
          [AUTHOR]: [
            "https://kaggle.com/datasets/alice/intake",
            "https://kaggle.com/datasets/bob/vitals",
          ],
        },
      },
      model: { userUrls: { [AUTHOR]: "https://kaggle.com/models/alice/triage" } },
      model_code: { userUrls: { [AUTHOR]: "https://github.com/alice/triage" } },
    });
  });

  it("n'écrit rien pour le rôle model quand la proposition n'a pas de modèle", () => {
    const seed = seedMlWorkspaceMeta({ ...fields, model_url: null }, AUTHOR);
    expect(seed.model).toBeUndefined();
    expect(seed.dataset).toBeDefined();
    expect(seed.model_code).toBeDefined();
  });
});

describe("buildAuthorContributions", () => {
  const single = { ...fields, dataset_urls: ["https://kaggle.com/datasets/alice/intake"] };
  const now = new Date("2026-02-02T10:00:00Z");

  it("reprend le dataset et le code du modèle, jamais le modèle seul", () => {
    const drafts = buildAuthorContributions(single, AUTHOR, CHALLENGE_ID, now);
    expect(drafts.map((d) => d.role)).toEqual(["dataset", "model_code"]);

    const [dataset, modelCode] = drafts;
    expect(dataset.contribution.type).toBe("dataset");
    expect(dataset.contribution.artifact_url).toBe("kaggle.com/datasets/alice/intake");
    expect(dataset.url).toBe("https://kaggle.com/datasets/alice/intake");

    // L'étape modèle n'a qu'une contribution pour ses deux repos, et le code
    // n'identifie pas l'artefact — pas d'artifact_url.
    expect(modelCode.contribution.type).toBe("model");
    expect(modelCode.contribution.artifact_url).toBeUndefined();
    expect(modelCode.contribution.description).toBe(
      "model: https://kaggle.com/models/alice/triage\nmodel_code: https://github.com/alice/triage",
    );
    expect(modelCode.url).toBe("https://github.com/alice/triage");
  });

  it("omet la ligne model quand la proposition n'a pas de modèle", () => {
    const [, ...rest] = buildAuthorContributions({ ...single, model_url: null }, AUTHOR, CHALLENGE_ID, now);
    expect(rest[0].contribution.description).toBe("model_code: https://github.com/alice/triage");
  });

  it("marque les contributions à évaluer, à zéro CP, au nom de l'auteur", () => {
    for (const draft of buildAuthorContributions(single, AUTHOR, CHALLENGE_ID, now)) {
      expect(draft.contribution).toMatchObject({
        reward: 0,
        user_id: AUTHOR,
        challenge_id: CHALLENGE_ID,
        evaluation_status: "pending",
        submitted_at: now,
      });
    }
  });
});
