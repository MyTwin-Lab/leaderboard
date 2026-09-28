import { describe, it, expect, vi } from "vitest";
import { evaluateGithubRepo, parseGithubRepoUrl, toScore10 } from "./repo-evaluation.js";

describe("toScore10", () => {
  it("ramène 0-9 sur 0-10", () => {
    expect(toScore10(0)).toBe(0);
    expect(toScore10(9)).toBe(10);
    expect(toScore10(4.5)).toBe(5);
  });

  it("borne les valeurs hors échelle — une grille personnalisée mal remplie n'explose pas", () => {
    expect(toScore10(12)).toBe(10);
    expect(toScore10(-3)).toBe(0);
  });
});

describe("parseGithubRepoUrl", () => {
  it("lit une URL racine", () => {
    expect(parseGithubRepoUrl("https://github.com/acme/widget")).toEqual({
      slug: "acme/widget",
      branch: undefined,
    });
  });

  it("ignore le suffixe .git", () => {
    expect(parseGithubRepoUrl("https://github.com/acme/widget.git")).toEqual({
      slug: "acme/widget",
      branch: undefined,
    });
  });

  it("extrait la branche d'un /tree/", () => {
    expect(parseGithubRepoUrl("https://github.com/acme/widget/tree/feat/login")).toEqual({
      slug: "acme/widget",
      branch: "feat/login",
    });
  });

  it("rend null sur une URL absente ou étrangère à GitHub", () => {
    expect(parseGithubRepoUrl(undefined)).toBeNull();
    expect(parseGithubRepoUrl("https://gitlab.com/acme/widget")).toBeNull();
  });
});

const ORIGIN = { owner: "sandbox", handler: "formative", payload: { sandboxId: "sb-1", userId: "alice" }, challengeId: null };

const INPUT = {
  slug: "acme/widget",
  branch: "main",
  gridSlug: "code",
  subject: { title: "Widget", type: "code", description: "ctx", challengeId: "sb-1", userId: "alice" },
  hasPriorEvaluation: false,
  origin: ORIGIN,
};

function fakeEvaluate(globalScore = 4.5) {
  return vi.fn(async () => ({ runId: "run-1", refs: ["sha-1"], evaluation: { globalScore, scores: [] } }));
}

describe("evaluateGithubRepo", () => {
  it("rend le score sur 10 et le détail des critères", async () => {
    const evaluate = fakeEvaluate(4.5);

    const result = await evaluateGithubRepo(INPUT, { evaluate });

    expect(result).toEqual({ score10: 5, evaluation: { globalScore: 4.5, scores: [] } });
  });

  it("évalue un snapshot GitHub du repo et de sa branche, avec la grille demandée", async () => {
    const evaluate = fakeEvaluate();

    await evaluateGithubRepo({ ...INPUT, maxCommits: 5 }, { evaluate });

    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        bundle: { source: "github-snapshot", input: { slug: "acme/widget", branch: "main", maxCommits: 5 } },
        gridSlug: "code",
        hasPriorEvaluation: false,
      }),
    );
  });

  it("passe le sujet à l'agent et le run au nom de l'appelant", async () => {
    const evaluate = fakeEvaluate();

    await evaluateGithubRepo(INPUT, { evaluate });

    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: { title: "Widget", type: "code", description: "ctx", ref: "sb-1", userId: "alice" },
        origin: ORIGIN,
      }),
    );
  });

  it("laisse passer l'échec de l'évaluation", async () => {
    const evaluate = vi.fn(async () => { throw new Error("boom"); });

    await expect(evaluateGithubRepo(INPUT, { evaluate })).rejects.toThrow("boom");
  });
});
