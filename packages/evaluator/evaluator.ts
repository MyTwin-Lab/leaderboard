import { AgentEvaluator } from "./interfaces.js";
import { Contribution, Evaluation, ToMergeContribution, EvaluateContext } from "./types.js";
import { runEvaluateAgent } from "./openai/evaluate.agent.js";

// Wrapper pour gérer les erreurs des agents avec retries (3 tentatives max, délai 1s entre chaque tentative)
async function wrapAgentCall<T>(agentCall: () => Promise<T>, agentName: string): Promise<T> {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Evaluator] Tentative ${attempt}/${maxRetries} pour l'agent ${agentName}`);
      return await agentCall();
    } catch (error) {
      console.error(`[Evaluator] Erreur tentative ${attempt}/${maxRetries} dans l'agent ${agentName}:`, error);
      if (attempt === maxRetries) {
        throw new Error(`Agent ${agentName} a échoué après ${maxRetries} tentatives: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Délai de 1 seconde avant retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  // Ne devrait pas arriver, mais pour TypeScript
  throw new Error(`Agent ${agentName} a échoué de manière inattendue`);
}

export class OpenAIAgentEvaluator implements AgentEvaluator {
  async evaluate(toMerge : boolean, contribution: Contribution | ToMergeContribution, context: EvaluateContext): Promise<Evaluation> {
    return await wrapAgentCall(() => runEvaluateAgent(toMerge, contribution, context), "Evaluate");
  }
}
