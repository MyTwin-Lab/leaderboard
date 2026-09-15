import { describe, it, expect, vi } from "vitest";
import { mlProposable, resumeAuthorWork } from "./proposable.js";

const REPO = "https://github.com/acme/lungs";
const DATASET = "https://kaggle.com/d/lungs";

describe("mlProposable.fields", () => {
  it("exige au moins un dataset", () => {
    expect(() => mlProposable.fields.parse({ repo_url: REPO })).toThrow();
    expect(() => mlProposable.fields.parse({ repo_url: REPO, dataset_urls: [] })).toThrow();
    expect(() => mlProposable.fields.parse({ repo_url: REPO, dataset_urls: [DATASET] })).not.toThrow();
  });

  it("laisse le modèle optionnel, et null le vide", () => {
    // Une proposition ML peut démarrer avant d'avoir produit un artefact.
    expect(mlProposable.fields.parse({ repo_url: REPO, dataset_urls: [DATASET] }).model_url).toBeUndefined();
    expect(mlProposable.fields.parse({ repo_url: REPO, dataset_urls: [DATASET], model_url: null }).model_url).toBeNull();
  });

  it("refuse une URL qui n'est pas en http(s)", () => {
    expect(() => mlProposable.fields.parse({ repo_url: REPO, dataset_urls: ["ftp://x/y"] })).toThrow();
  });
});

describe("mlProposable.evaluation", () => {
  it("évalue le dépôt avec la grille code, et donne les artefacts à l'agent", () => {
    const evaluation = mlProposable.evaluation!;
    expect(evaluation).toMatchObject({ bundleSource: "github-snapshot", grid: "code" });
    expect(evaluation.input({ repo_url: REPO })).toEqual({ slug: "acme/lungs", branch: undefined });
    expect(evaluation.context!({ repo_url: REPO, dataset_urls: [DATASET], model_url: null })).toEqual([
      `Datasets: ${DATASET}`,
    ]);
  });
});

describe("mlProposable.promote", () => {
  it("règle la puissance de calcul depuis le tiroir", () => {
    expect(mlProposable.promote!.flowConfig!({ compute_enabled: true })).toEqual({
      extensions: { compute: { enabled: true } },
    });
    expect(mlProposable.promote!.flowConfig!({})).toEqual({ extensions: { compute: { enabled: false } } });
  });

  it("pré-remplit le workspace de l'auteur", () => {
    expect(mlProposable.promote!.workspaceMeta!({ repo_url: REPO, dataset_urls: [DATASET] }, "alice")).toMatchObject({
      dataset: { userUrls: { alice: DATASET } },
      model_code: { userUrls: { alice: REPO } },
    });
  });
});

describe("resumeAuthorWork", () => {
  const context = {
    challengeId: "challenge-1",
    authorId: "alice",
    fields: { repo_url: REPO, dataset_urls: [DATASET], model_url: null },
    repoIdsByRole: { dataset: "repo-dataset", model: "repo-model", model_code: "repo-code" },
  };

  it("crée puis score chaque contribution, l'une après l'autre", async () => {
    const calls: string[] = [];
    const deps = {
      createContribution: vi.fn(async (contribution: { type: string }) => {
        calls.push(`create:${contribution.type}`);
      }),
      award: vi.fn(async (event: { repoId: string }) => {
        calls.push(`award:${event.repoId}`);
      }),
    };

    await resumeAuthorWork(context, deps);

    expect(calls).toEqual(["create:dataset", "award:repo-dataset", "create:model", "award:repo-code"]);
    expect(deps.award).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      userId: "alice",
      repoId: "repo-dataset",
      url: DATASET,
    });
  });

  it("saute un rôle sans repo : rien ne pourrait le scorer", async () => {
    const deps = { createContribution: vi.fn(async () => {}), award: vi.fn(async () => {}) };

    await resumeAuthorWork({ ...context, repoIdsByRole: { model_code: "repo-code" } }, deps);

    expect(deps.createContribution).toHaveBeenCalledTimes(1);
    expect(deps.award).toHaveBeenCalledWith(expect.objectContaining({ repoId: "repo-code" }));
  });
});
