import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAIAgentEvaluator } from "../evaluator.js";
import * as EvaluateAgent from "../openai/evaluate.agent.js";

const contribution = {
  title: "Contribution",
  type: "code",
  challenge_id: "challenge",
  userId: "user",
  commitShas: [],
};

function context() {
  return { snapshot: { modifiedFiles: [] }, grid: { type: "code", criteriaTemplate: [], instructions: "" } };
}

describe("OpenAIAgentEvaluator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delegates to evaluate agent", async () => {
    const spy = vi.spyOn(EvaluateAgent, "runEvaluateAgent").mockResolvedValue({
      scores: [],
      globalScore: 80,
    });

    const evaluator = new OpenAIAgentEvaluator();
    const result = await evaluator.evaluate(false, contribution, context());

    expect(result.globalScore).toBe(80);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("retries failed evaluate calls up to 3 times", async () => {
    vi.useFakeTimers();

    const spy = vi.spyOn(EvaluateAgent, "runEvaluateAgent")
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue({ scores: [], globalScore: 42 });

    const evaluator = new OpenAIAgentEvaluator();
    const promise = evaluator.evaluate(false, contribution, context());

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.globalScore).toBe(42);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("throws after three failed attempts", async () => {
    vi.useFakeTimers();

    vi.spyOn(EvaluateAgent, "runEvaluateAgent").mockRejectedValue(new Error("boom"));

    const evaluator = new OpenAIAgentEvaluator();
    const promise = evaluator.evaluate(false, contribution, context());
    // L'assertion s'attache avant d'avancer le temps : sinon la promesse
    // rejette sans gestionnaire et Vitest signale une erreur non gérée.
    const assertion = expect(promise).rejects.toThrow("Agent Evaluate a échoué après 3 tentatives");

    await vi.runAllTimersAsync();
    await assertion;
  });
});
