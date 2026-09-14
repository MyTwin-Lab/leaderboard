import { describe, it, expect, vi } from "vitest";
import {
  evaluateGithubRepo,
  parseGithubRepoUrl,
  toScore10,
  type RepoEvaluationDeps,
} from "./repo-evaluation.js";

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

/** Un connecteur minimal : `fetchItems` rend `count` commits numérotés. */
function makeConnector(count: number) {
  return {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    fetchItems: vi.fn(async () =>
      Array.from({ length: count }, (_, i) => ({ id: `sha-${i}` })),
    ),
  };
}

function makeDeps(opts: { commits?: number; evaluation?: any } = {}) {
  const connector = makeConnector(opts.commits ?? 3);
  const evaluate = vi.fn(async () => opts.evaluation ?? { globalScore: 9, scores: [{ criterion: "c" }] });
  const buildAggregatedSnapshot = vi.fn(async (_resolve: any, shas: string[]) => ({
    snapshotId: shas.join("_"),
    commitSha: shas[shas.length - 1],
    commitShas: shas,
    modifiedFiles: [],
  }));
  const prepareSnapshot = vi.fn(async (s: any) => ({ ...s, workspacePath: "/tmp/eval_agent-test" }));
  const cleanup = vi.fn(async (_s: any) => {});
  const loadGrid = vi.fn(async (slug: string) => ({ type: slug, criteriaTemplate: [], instructions: "" }));
  const createConnector = vi.fn(async () => connector);

  const deps = {
    createConnector,
    snapshotService: { buildAggregatedSnapshot, prepareSnapshot, cleanup },
    loadGrid,
    evaluator: { evaluate },
  } as unknown as RepoEvaluationDeps;

  return { deps, connector, evaluate, loadGrid, buildAggregatedSnapshot, createConnector, cleanup };
}

const INPUT = {
  slug: "acme/widget",
  branch: "main",
  gridSlug: "code",
  subject: { title: "Widget", type: "code", description: "ctx", challengeId: "sb-1", userId: "alice" },
  hasPriorEvaluation: false,
};

describe("evaluateGithubRepo", () => {
  it("rend le score sur 10 et le détail des critères", async () => {
    const { deps, evaluate } = makeDeps({ evaluation: { globalScore: 4.5, scores: ["a", "b"] } });

    const result = await evaluateGithubRepo(INPUT, deps);

    expect(result.score10).toBe(5);
    expect(result.evaluation).toEqual({ globalScore: 4.5, scores: ["a", "b"] });
    // Le sujet part tel quel à l'agent, commits compris.
    expect(evaluate).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ title: "Widget", challenge_id: "sb-1", userId: "alice", description: "ctx" }),
      expect.objectContaining({ grid: expect.anything() }),
    );
  });

  it("échoue quand le repo n'a aucun commit", async () => {
    const { deps, connector } = makeDeps({ commits: 0 });

    await expect(evaluateGithubRepo(INPUT, deps)).rejects.toThrow(/No commits found/);
    // Le connecteur est refermé quand même — c'est le `finally`.
    expect(connector.disconnect).toHaveBeenCalled();
  });

  it("plafonne le snapshot à 100 commits", async () => {
    const { deps, buildAggregatedSnapshot } = makeDeps({ commits: 250 });

    await evaluateGithubRepo(INPUT, deps);

    expect(buildAggregatedSnapshot.mock.calls[0][1]).toHaveLength(100);
  });

  it("respecte un maxCommits explicite", async () => {
    const { deps, buildAggregatedSnapshot } = makeDeps({ commits: 250 });

    await evaluateGithubRepo({ ...INPUT, maxCommits: 5 }, deps);

    expect(buildAggregatedSnapshot.mock.calls[0][1]).toHaveLength(5);
  });

  it("charge la grille par son slug", async () => {
    const { deps, loadGrid } = makeDeps();

    await evaluateGithubRepo({ ...INPUT, gridSlug: "dataset" }, deps);

    expect(loadGrid).toHaveBeenCalledWith("dataset");
  });

  it("ferme le connecteur même quand l'agent lève", async () => {
    const { deps, connector } = makeDeps();
    (deps.evaluator.evaluate as any).mockRejectedValueOnce(new Error("boom"));

    await expect(evaluateGithubRepo(INPUT, deps)).rejects.toThrow("boom");
    expect(connector.disconnect).toHaveBeenCalledTimes(1);
  });

  it("supprime le workspace du snapshot après l'évaluation", async () => {
    const { deps, cleanup } = makeDeps();

    await evaluateGithubRepo(INPUT, deps);

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(cleanup.mock.calls[0][0]).toMatchObject({ workspacePath: "/tmp/eval_agent-test" });
  });

  it("supprime le workspace même quand l'agent lève", async () => {
    const { deps, cleanup } = makeDeps();
    (deps.evaluator.evaluate as any).mockRejectedValueOnce(new Error("boom"));

    await expect(evaluateGithubRepo(INPUT, deps)).rejects.toThrow("boom");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("échoue quand aucun connecteur ne peut être créé", async () => {
    const { deps } = makeDeps();
    (deps.createConnector as any).mockResolvedValueOnce(null);

    await expect(evaluateGithubRepo(INPUT, deps)).rejects.toThrow(/No GitHub connector/);
  });
});
