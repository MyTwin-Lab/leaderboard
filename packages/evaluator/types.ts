/**
 * Une contribution identifiée par l’agent à évaluer.
 */
export interface Contribution {
    title: string;
    type: string;
    description?: string;
    challenge_id: string;
    tags?: string[];
    userId: string;
    commitSha: string;
}

/**
 * Un score individuel sur un critère d’évaluation.
 */
export interface CriterionScore {
    criterion: string;
    score: number;      // 0–100
    weight: number;
    comment?: string;
}

/**
 * Résultat global de l’évaluation d’une contribution.
 */
export interface Evaluation {
    scores: CriterionScore[];
    globalScore: number;
    // Métadonnées de la contribution évaluée
    contribution?: Contribution;
}

/**
 * Résultat de la distribution des rewards pour une contribution
 */
export interface ContributionReward {
    userId: string;
    contributionTitle: string;
    score: number;
    reward: number; // Contribution Points (CP) attribués
}