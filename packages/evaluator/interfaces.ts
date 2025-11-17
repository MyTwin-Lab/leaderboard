import {Contribution, Evaluation, ToMergeContribution} from "./types.js";

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
    identify(context: any): Promise<Contribution[]>;

    /**
     * Fusionne les contributions identifiées.
     */
    merge(newContributions: Contribution[], oldContributions: any): Promise<ToMergeContribution[]>;

    /**
     * Évalue une contribution identifiée selon une grille interne.
     */
    evaluate(toMerge : boolean, contributions: Contribution | any, context: any): Promise<Evaluation>;

    /**
     * Pipeline complet : identification, évaluation, agrégation.
     */
    //run(context: any): Promise<Evaluation[]>;
}
