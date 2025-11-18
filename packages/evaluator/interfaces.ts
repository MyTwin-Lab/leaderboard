import {Contribution, Evaluation, ToMergeContribution, OldContribution, EvaluateContext, IdentifyContext} from "./types.js";

/**
 * AgentEvaluator
 * ---------------
 * Interface conceptuelle unique d’évaluation de contributions.
 * Elle formalise le processus complet : identification → évaluation → agrégation.
 */
export interface AgentEvaluator {
    /**
     * Identifie les contributions pertinentes à partir d’un contexte donné.
     */
    identify(context: IdentifyContext): Promise<Contribution[]>;

    /**
     * Fusionne les contributions identifiées.
     */
    merge(newContributions: Contribution[], oldContributions: OldContribution[]): Promise<ToMergeContribution[]>;

    /**
     * Évalue une contribution identifiée selon une grille interne.
     */
    evaluate(toMerge : boolean, contributions: Contribution | ToMergeContribution, context: EvaluateContext): Promise<Evaluation>;

    /**
     * Pipeline complet : identification, évaluation, agrégation.
     */
    //run(context: any): Promise<Evaluation[]>;
}
