import type { Contribution } from "./types";

export async function evaluateContribution(
  contribution: Contribution,
  workspacePath: string
) {
  const evaluatorModule = await import("../evaluator/evaluator");
  const gridsModule = await import("../evaluator/grids/index");

  const { OpenAIAgentEvaluator } = evaluatorModule;
  const { EvaluationGridRegistry } = gridsModule;

  const grid = EvaluationGridRegistry.getGrid(contribution.type);
  const evaluator = new OpenAIAgentEvaluator();

  const evaluation = await evaluator.evaluate(false, contribution, {
    snapshot: {
      workspacePath,
      modifiedFiles: []
    },
    grid
  });

  return evaluation;
}