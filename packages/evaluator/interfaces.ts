import {Contribution, Evaluation} from "./types.js";

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
     * Évalue une contribution identifiée selon une grille interne.
     */
    evaluate(contributions: Contribution, context: any): Promise<Evaluation>;

    /**
     * Calcule et agrège le score final à partir d'une évaluation produite.
     */
    aggregate(evaluations: Evaluation): number;

    /**
     * Pipeline complet : identification, évaluation, agrégation.
     */
    //run(context: any): Promise<Evaluation[]>;
}
