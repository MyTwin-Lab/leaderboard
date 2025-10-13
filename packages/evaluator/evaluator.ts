import { AgentEvaluator } from "./interfaces.js";
import { Contribution, Evaluation } from "./types.js";
import { runIdentifyAgent } from "./openai/identify.agent.js";
import { runEvaluateAgent } from "./openai/evaluate.agent.js";

export class OpenAIAgentEvaluator implements AgentEvaluator {
  async identify(context: any): Promise<Contribution[]> {
    return await runIdentifyAgent(context);
  }

  async evaluate(contribution: Contribution, context: any): Promise<Evaluation> {
    return await runEvaluateAgent(contribution, context);
  }

  aggregate(evaluation: Evaluation): number {
    const total = evaluation.scores.reduce((a, s) => a + s.weight, 0) || 1;
    return evaluation.scores.reduce((a, s) => a + s.score * s.weight, 0) / total;
  }
}
