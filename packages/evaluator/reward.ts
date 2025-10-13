import { Evaluation, ContributionReward } from "./types.js";

/**
 * Compute Rewards - Phase 5.3
 * 
 * Convertit les scores accumulés pendant un challenge en Contribution Points (CP).
 * Le pool total de rewards est distribué proportionnellement selon les scores de chaque contribution.
 * 
 * @param evaluations - Liste des évaluations avec leurs scores globaux
 * @param totalRewardPool - Pool total de CP à distribuer pour ce challenge
 * @returns Liste des rewards attribués par contribution
 */
export function computeRewards(
  evaluations: Evaluation[],
  totalRewardPool: number
): ContributionReward[] {
  // Validation
  if (evaluations.length === 0) {
    console.warn("[computeRewards] Aucune évaluation fournie");
    return [];
  }

  if (totalRewardPool <= 0) {
    console.warn("[computeRewards] Pool de rewards invalide:", totalRewardPool);
    return [];
  }

  // Calculer le score total de toutes les contributions
  const totalScore = evaluations.reduce((sum, evaluation) => {
    return sum + (evaluation.globalScore || 0);
  }, 0);

  if (totalScore === 0) {
    console.warn("[computeRewards] Score total est 0, distribution égale");
    // Distribution égale si tous les scores sont à 0
    const equalReward = totalRewardPool / evaluations.length;
    return evaluations.map((evaluation) => ({
      userId: evaluation.contribution?.userId || "unknown",
      contributionTitle: evaluation.contribution?.title || "Untitled",
      score: evaluation.globalScore || 0,
      reward: Math.round(equalReward),
    }));
  }

  // Distribution proportionnelle
  const rewards: ContributionReward[] = evaluations.map((evaluation) => {
    const score = evaluation.globalScore || 0;
    const proportion = score / totalScore;
    const reward = Math.round(proportion * totalRewardPool);

    return {
      userId: evaluation.contribution?.userId || "unknown",
      contributionTitle: evaluation.contribution?.title || "Untitled",
      score,
      reward,
    };
  });

  // Vérifier que la somme des rewards correspond au pool (ajustement d'arrondi)
  const distributedTotal = rewards.reduce((sum, r) => sum + r.reward, 0);
  const difference = totalRewardPool - distributedTotal;

  // Ajuster le dernier reward si nécessaire (erreur d'arrondi)
  if (difference !== 0 && rewards.length > 0) {
    rewards[rewards.length - 1].reward += difference;
  }

  console.log(`[computeRewards] Distribué ${totalRewardPool} CP sur ${evaluations.length} contributions`);
  
  return rewards;
}