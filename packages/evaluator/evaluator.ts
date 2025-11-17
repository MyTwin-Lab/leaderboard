import { AgentEvaluator } from "./interfaces.js";
import { Contribution, Evaluation, ToMergeContribution } from "./types.js";
import { runIdentifyAgent } from "./openai/identify.agent.js";
import { runEvaluateAgent } from "./openai/evaluate.agent.js";
import { runMergeAgent } from "./openai/merge.agent.js";

export class OpenAIAgentEvaluator implements AgentEvaluator {
  async identify(context: any): Promise<Contribution[]> {
    return await runIdentifyAgent(context);
  }

  async merge(newContributions: Contribution[], oldContributions: any): Promise<ToMergeContribution[]> {
    return await runMergeAgent(newContributions, oldContributions);
  }

  async evaluate(toMerge : boolean, contribution: Contribution | any, context: any): Promise<Evaluation> {
    return await runEvaluateAgent(toMerge, contribution, context);
  }
}
