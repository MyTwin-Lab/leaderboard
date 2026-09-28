import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlatformRegistry } from "../registry/platform.js";
import {
  databaseRunRecorder,
  evaluate,
  retryEvaluationRun,
  type EvaluateRequest,
  type EvaluationDeps,
} from "./evaluation.js";

const REQUEST: EvaluateRequest = {
  bundle: { source: "files", input: { id: 1 } },
  gridSlug: "code",
  subject: { title: "Widget", type: "code", description: "ctx", ref: "ch-1", userId: "alice" },
  origin: {
    owner: "code",
    handler: "project",
    payload: { challengeId: "ch-1", userId: "alice" },
    challengeId: "ch-1",
    contributionId: "c-1",
  },
};

function makeDeps() {
  const sourceRelease = vi.fn(async () => {});
  const collect = vi.fn(async () => ({
    snapshot: { modifiedFiles: [{ path: "a.ts", content: "x" }] },
    refs: ["sha-1", "sha-2"],
    release: sourceRelease,
  }));
  const handle = { runId: "run-1", succeed: vi.fn(async () => {}), fail: vi.fn(async () => {}) };
  const agentEvaluate = vi.fn(async () => ({ globalScore: 4.5, scores: [{ criterion: "c", score: 4, weight: 1 }] }));

  const deps = {
    source: vi.fn((key: string) => (key === "files" ? { key, collect } : undefined)),
    prepare: vi.fn(async (snapshot: any) => ({ ...snapshot, workspacePath: "/tmp/eval_agent-x" })),
    release: vi.fn(async () => {}),
    loadGrid: vi.fn(async (slug: string) => ({ type: slug, criteriaTemplate: [], instructions: "" })),
    agent: { evaluate: agentEvaluate },
    runs: { start: vi.fn(async () => handle as any) },
  } satisfies EvaluationDeps;

  return { deps, collect, sourceRelease, handle, agentEvaluate };
}

// Sans abonné simulé : l'émission par défaut écrirait dans la vraie base.
const noEmit = async () => null;

describe("evaluate", () => {
  it("notes the collected bundle with the grid and traces a succeeded run", async () => {
    const { deps, handle, agentEvaluate } = makeDeps();

    const result = await evaluate(REQUEST, deps);

    expect(result).toEqual({
      runId: "run-1",
      refs: ["sha-1", "sha-2"],
      evaluation: { globalScore: 4.5, scores: [{ criterion: "c", score: 4, weight: 1 }] },
    });
    expect(agentEvaluate).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ title: "Widget", challenge_id: "ch-1", userId: "alice", commitShas: ["sha-1", "sha-2"] }),
      expect.objectContaining({
        snapshot: expect.objectContaining({ workspacePath: "/tmp/eval_agent-x" }),
        grid: expect.objectContaining({ type: "code" }),
      }),
    );
    expect(handle.succeed).toHaveBeenCalledWith(expect.objectContaining({ globalScore: 4.5 }));
    expect(handle.fail).not.toHaveBeenCalled();
  });

  it("loads the grid before collecting, so a missing grid costs no network call", async () => {
    const { deps, collect, handle } = makeDeps();
    deps.loadGrid.mockRejectedValueOnce(new Error('No published grid "code"'));

    await expect(evaluate(REQUEST, deps)).rejects.toThrow('No published grid "code"');
    expect(collect).not.toHaveBeenCalled();
    expect(handle.fail).toHaveBeenCalledTimes(1);
  });

  it("fails on a bundle source that is not installed", async () => {
    const { deps } = makeDeps();

    await expect(evaluate({ ...REQUEST, bundle: { source: "nope", input: {} } }, deps)).rejects.toThrow(
      'No bundle source "nope" installed',
    );
  });

  it("frees the workspace and the source even when the agent throws", async () => {
    const { deps, sourceRelease, handle, agentEvaluate } = makeDeps();
    agentEvaluate.mockRejectedValueOnce(new Error("boom"));

    await expect(evaluate(REQUEST, deps)).rejects.toThrow("boom");
    expect(deps.release).toHaveBeenCalledWith(expect.objectContaining({ workspacePath: "/tmp/eval_agent-x" }));
    expect(sourceRelease).toHaveBeenCalledTimes(1);
    expect(handle.fail).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    expect(handle.succeed).not.toHaveBeenCalled();
  });

  it("still evaluates when the run cannot be recorded", async () => {
    const { deps } = makeDeps();
    deps.runs.start.mockResolvedValueOnce(null);

    const result = await evaluate(REQUEST, deps);

    expect(result.runId).toBeNull();
    expect(result.evaluation.globalScore).toBe(4.5);
  });
});

function makeRepositories() {
  return {
    runs: {
      create: vi.fn(async () => ({ uuid: "run-1" }) as any),
      markSucceeded: vi.fn(async () => ({}) as any),
      markFailed: vi.fn(async () => ({}) as any),
    },
    links: {
      create: vi.fn(async () => ({ uuid: "link-1" }) as any),
      updateStatus: vi.fn(async () => ({}) as any),
    },
    contributions: {
      findById: vi.fn(async () => ({ uuid: "c-1", user_id: "alice", challenge_id: "ch-1" }) as any),
    },
  };
}

describe("databaseRunRecorder", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records the owner, its handler and the evaluated contribution", async () => {
    const repos = makeRepositories();

    const handle = await databaseRunRecorder(repos, noEmit).start(REQUEST);
    await handle!.succeed({ durationMs: 10, globalScore: 4.5 });

    expect(repos.runs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        challenge_id: "ch-1",
        trigger_type: "code",
        trigger_payload: { handler: "project", payload: { challengeId: "ch-1", userId: "alice" } },
        status: "running",
      }),
    );
    expect(repos.links.create).toHaveBeenCalledWith({ run_id: "run-1", contribution_id: "c-1", status: "identified" });
    expect(repos.links.updateStatus).toHaveBeenCalledWith("link-1", "evaluated");
    expect(repos.runs.markSucceeded).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ gridSlug: "code", bundleSource: "files", contributionCount: 1, durationMs: 10 }),
    );
  });

  it("keeps the subject in meta when no contribution is evaluated", async () => {
    const repos = makeRepositories();

    await databaseRunRecorder(repos, noEmit).start({
      ...REQUEST,
      origin: { owner: "sandbox", handler: "formative", payload: { sandboxId: "sb-1" }, challengeId: null },
    });

    const created = (repos.runs.create.mock.calls[0] as any[])[0];
    expect(created.challenge_id).toBeUndefined();
    expect(created.meta).toMatchObject({ contributionCount: 0, subject: { title: "Widget", type: "code", ref: "ch-1" } });
    expect(repos.links.create).not.toHaveBeenCalled();
  });

  it("marks the run and its contribution failed with the error", async () => {
    const repos = makeRepositories();

    const handle = await databaseRunRecorder(repos, noEmit).start(REQUEST);
    await handle!.fail(new Error("boom"));

    expect(repos.links.updateStatus).toHaveBeenCalledWith("link-1", "skipped", { skipReason: "boom" });
    expect(repos.runs.markFailed).toHaveBeenCalledWith("run-1", "Error", "boom");
  });

  it("announces the evaluated contribution, credited to its author", async () => {
    const repos = makeRepositories();
    const emit = vi.fn(async () => 1);

    const handle = await databaseRunRecorder(repos, emit).start(REQUEST);
    await handle!.succeed({ durationMs: 10, globalScore: 4.5 });

    expect(repos.contributions.findById).toHaveBeenCalledWith("c-1");
    expect(emit).toHaveBeenCalledWith("contribution.evaluated", {
      contributionId: "c-1",
      challengeId: "ch-1",
      userId: "alice",
      runId: "run-1",
    });
  });

  it("announces nothing for a failed run, nor for a subject without contribution", async () => {
    const repos = makeRepositories();
    const emit = vi.fn(async () => 1);

    const failed = await databaseRunRecorder(repos, emit).start(REQUEST);
    await failed!.fail(new Error("boom"));
    const subject = await databaseRunRecorder(repos, emit).start({
      ...REQUEST,
      origin: { owner: "sandbox", handler: "formative", payload: { sandboxId: "sb-1" }, challengeId: null },
    });
    await subject!.succeed({ durationMs: 10, globalScore: 4.5 });

    expect(emit).not.toHaveBeenCalled();
  });

  it("keeps the run succeeded when the event cannot be written", async () => {
    const repos = makeRepositories();
    const emit = vi.fn(async () => {
      throw new Error("outbox down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const handle = await databaseRunRecorder(repos, emit).start(REQUEST);
    await expect(handle!.succeed({ durationMs: 10, globalScore: 4.5 })).resolves.toBeUndefined();

    expect(repos.runs.markSucceeded).toHaveBeenCalled();
  });

  it("gives up tracing, without throwing, when the run cannot be written", async () => {
    const repos = makeRepositories();
    repos.runs.create.mockRejectedValueOnce(new Error("column does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await databaseRunRecorder(repos, noEmit).start(REQUEST)).toBeNull();
  });
});

describe("retryEvaluationRun", () => {
  const retry = vi.fn(async () => ({ ok: true as const }));
  const failedRun = {
    status: "failed" as const,
    trigger_type: "code",
    trigger_payload: { handler: "project", payload: { challengeId: "ch-1", userId: "alice" } },
  };

  beforeEach(() => {
    retry.mockClear();
    PlatformRegistry.reset();
    PlatformRegistry.install({
      flows: [
        {
          descriptor: { key: "code", label: "Code", longLabel: "Code", icon: "code", briefRequired: true, publiclyVisible: true },
          evaluationHandlers: [{ key: "project", retry }],
        },
      ],
    });
  });

  afterEach(() => PlatformRegistry.reset());

  it("replays the handler declared by the run's owner, with its payload", async () => {
    expect(await retryEvaluationRun(failedRun)).toEqual({ ok: true });
    expect(retry).toHaveBeenCalledWith({ challengeId: "ch-1", userId: "alice" });
  });

  it("only replays a failed run", async () => {
    expect(await retryEvaluationRun({ ...failedRun, status: "succeeded" })).toEqual({ ok: false, reason: "not_failed" });
    expect(retry).not.toHaveBeenCalled();
  });

  it("refuses a run whose handler is not installed, or that names none", async () => {
    expect(await retryEvaluationRun({ ...failedRun, trigger_type: "ml" })).toEqual({ ok: false, reason: "no_handler" });
    expect(await retryEvaluationRun({ ...failedRun, trigger_payload: undefined })).toEqual({ ok: false, reason: "no_handler" });
  });
});
