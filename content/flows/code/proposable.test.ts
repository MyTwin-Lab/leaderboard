import { describe, it, expect } from "vitest";
import { codeProposable } from "./proposable.js";

const fields = codeProposable.fields;

describe("codeProposable.fields", () => {
  it("accepte une proposition avec le seul dépôt", () => {
    expect(fields.parse({ repo_url: "https://github.com/acme/readmission" })).toMatchObject({
      repo_url: "https://github.com/acme/readmission",
      dataset_urls: [],
    });
  });

  it("refuse modèle et datasets", () => {
    // Ces champs n'existent que sur une proposition ML : les accepter ici les
    // rendrait invisibles dans l'UI tout en polluant le contexte d'évaluation.
    expect(() =>
      fields.parse({ repo_url: "https://github.com/acme/r", model_url: "https://kaggle.com/m/x" }),
    ).toThrow();
    expect(() =>
      fields.parse({ repo_url: "https://github.com/acme/r", dataset_urls: ["https://kaggle.com/d/x"] }),
    ).toThrow();
  });

  it("laisse passer le miroir des anciennes colonnes, qui écrit null et []", () => {
    expect(() =>
      fields.parse({ repo_url: "https://github.com/acme/r", model_url: null, dataset_urls: [] }),
    ).not.toThrow();
  });

  it("refuse une URL qui n'est pas en http(s), et un dépôt absent", () => {
    for (const repo_url of ["ftp://example.org/repo", "mailto:a@b.c", "pas une url"]) {
      expect(() => fields.parse({ repo_url })).toThrow();
    }
    expect(() => fields.parse({})).toThrow();
  });
});

describe("codeProposable.evaluation", () => {
  it("évalue un snapshot GitHub du dépôt avec la grille code", () => {
    expect(codeProposable.evaluation).toMatchObject({ bundleSource: "github-snapshot", grid: "code" });
    expect(codeProposable.evaluation!.input({ repo_url: "https://github.com/acme/widget/tree/dev" })).toEqual({
      slug: "acme/widget",
      branch: "dev",
    });
  });

  it("ne tire aucune entrée d'un dépôt qui n'est pas sur GitHub", () => {
    expect(codeProposable.evaluation!.input({ repo_url: "https://gitlab.com/acme/widget" })).toBeNull();
    expect(codeProposable.evaluation!.input({})).toBeNull();
  });
});

describe("codeProposable.promote", () => {
  it("fait du challenge promu un challenge own_repo, sur le dépôt de l'auteur", () => {
    expect(codeProposable.promote!.flowConfig!({ compute_enabled: true })).toEqual({ workspace_mode: "own_repo" });
    expect(codeProposable.promote!.afterPromote).toBeUndefined();
  });
});
