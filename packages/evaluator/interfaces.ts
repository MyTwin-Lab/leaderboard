import {Contribution, Evaluation, ToMergeContribution, EvaluateContext} from "./types.js";

/**
 * AgentEvaluator
 * ---------------
 * Interface d’évaluation d’une contribution par un agent, selon une grille.
 */
export interface AgentEvaluator {
    /**
     * Évalue une contribution selon une grille interne.
     */
    evaluate(toMerge : boolean, contributions: Contribution | ToMergeContribution, context: EvaluateContext): Promise<Evaluation>;
}
