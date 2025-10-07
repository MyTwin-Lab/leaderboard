interface Period {
    start: Date;
    end: Date;
}

/**
 * Une contribution identifiée par l’agent à évaluer.
 */
interface Contribution {
    title: string;
    type: string;
    description?: string;
    tags?: string[];
    period: Period;
}

/**
 * Un score individuel sur un critère d’évaluation.
 */
interface CriterionScore {
    criterion: string;
    score: number;      // 0–1 ou 0–100 selon ton choix
    weight: number;
    comment?: string;
}

/**
 * Résultat global de l’évaluation d’une contribution.
 */
interface Evaluation {
    scores: CriterionScore[];
    globalScore: number;
    summary?: string;
}

/**
 * AgentEvaluator
 * ---------------
 * Interface conceptuelle unique d’évaluation de contributions.
 * Elle formalise le processus complet : identification → évaluation → agrégation.
 */
interface AgentEvaluator {
    /**
     * Identifie les contributions pertinentes à partir d’un contexte donné.
     * Exemple : analyse d’un projet, d’un dataset, d’un document, etc.
     */
    identify(context: any): Promise<Contribution[]>;

    /**
     * Évalue les contributions identifiées selon une grille interne.
     */
    evaluate(contributions: Contribution): Promise<Evaluation>;

    /**
     * Calcule et agrège le score final à partir des évaluations produites.
     */
    aggregate(evaluations: Evaluation): number;

    /**
     * Pipeline complet : identification, évaluation, agrégation.
     */
    run(context: any): Promise<Evaluation[]>;
}
