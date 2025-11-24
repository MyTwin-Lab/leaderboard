import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIAgentEvaluator } from "../evaluator.js";
import * as IdentifyAgent from "../openai/identify.agent.js";
import * as MergeAgent from "../openai/merge.agent.js";
import * as EvaluateAgent from "../openai/evaluate.agent.js";
import { EvaluationGridRegistry } from "../grids/index.js";

const baseContext = {
  syncPreview: "summary",
  commits: [],
  users: [],
  roadmap: "roadmap",
};

describe("OpenAIAgentEvaluator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates to identify agent with retry", async () => {
    const spy = vi.spyOn(IdentifyAgent, "runIdentifyAgent").mockResolvedValue([
      {
        title: "Contribution",
        type: "code",
        challenge_id: "challenge",
        userId: "user",
        commitShas: [],
      },
    ]);

    const evaluator = new OpenAIAgentEvaluator();
    const result = await evaluator.identify(baseContext);

    expect(result).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries failed identify calls up to 3 times", async () => {
    vi.useFakeTimers();

    const spy = vi.spyOn(IdentifyAgent, "runIdentifyAgent")
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue([
        {
          title: "Contribution",
          type: "code",
          challenge_id: "challenge",
          userId: "user",
          commitShas: [],
        },
      ]);

    const evaluator = new OpenAIAgentEvaluator();
    const promise = evaluator.identify(baseContext);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("throws after three failed attempts", async () => {
    vi.useFakeTimers();

    const error = new Error("boom");
    vi.spyOn(IdentifyAgent, "runIdentifyAgent").mockRejectedValue(error);

    const evaluator = new OpenAIAgentEvaluator();
    const promise = evaluator.identify(baseContext);

    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(
      "Agent Identify a échoué après 3 tentatives"
    );
  });

  it("delegates to merge agent", async () => {
    const spy = vi.spyOn(MergeAgent, "runMergeAgent").mockResolvedValue([
      {
        contribution: {
          title: "Contribution",
          type: "code",
          challenge_id: "challenge",
          userId: "user",
          commitShas: [],
        },
        oldContributionId: "old",
      },
    ]);

    const evaluator = new OpenAIAgentEvaluator();
    const result = await evaluator.merge([], []);

    expect(result).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("delegates to evaluate agent", async () => {
    const spy = vi.spyOn(EvaluateAgent, "runEvaluateAgent").mockResolvedValue({
      scores: [],
      globalScore: 80,
    });

    const evaluator = new OpenAIAgentEvaluator();
    const grid = EvaluationGridRegistry.getGrid("code");

    const result = await evaluator.evaluate(false, {
      title: "Contribution",
      type: "code",
      challenge_id: "challenge",
      userId: "user",
      commitShas: [],
    }, {
      snapshot: {
        modifiedFiles: [],
      },
      grid,
    });

    expect(result.globalScore).toBe(80);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
