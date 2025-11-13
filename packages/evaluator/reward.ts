import { Evaluation, ContributionReward } from "./types.js";

/**
 * Compute Rewards - Phase 5.3
 * 
 * Convertit les scores accumulés pendant un challenge en Contribution Points (CP).
 * Le pool total de rewards est distribué proportionnellement selon les scores de chaque contribution.
 * 
 * @param contributions - Liste des contributions avec leurs scores globaux
 * @param totalRewardPool - Pool total de CP à distribuer pour ce challenge
 * @returns Liste des rewards attribués par contribution
 */
export function computeRewards(
  contributions: any[],
  totalRewardPool: number
): (ContributionReward & { contributionId: string })[] {
  // Validation
  if (contributions.length === 0) {
    console.warn("[computeRewards] Aucune contribution fournie");
    return [];
  }

  if (totalRewardPool <= 0) {
    console.warn("[computeRewards] Pool de rewards invalide:", totalRewardPool);
    return [];
  }

  // Calculer le score total de toutes les contributions
  const totalScore = contributions.reduce((sum, contrib) => {
    return sum + (contrib.evaluation?.globalScore || 0);
  }, 0);

  if (totalScore === 0) {
    console.warn("[computeRewards] Score total est 0, distribution égale");
    // Distribution égale si tous les scores sont à 0
    const equalReward = totalRewardPool / contributions.length;
    return contributions.map((contrib) => ({
      contributionId: contrib.uuid,
      userId: contrib.user_id,
      contributionTitle: contrib.title,
      score: contrib.evaluation?.globalScore || 0,
      reward: Math.round(equalReward),
    }));
  }

  // Distribution proportionnelle
  const rewards = contributions.map((contrib) => {
    const score = contrib.evaluation?.globalScore || 0;
    const proportion = score / totalScore;
    const reward = Math.round(proportion * totalRewardPool);

    return {
      contributionId: contrib.uuid,
      userId: contrib.user_id,
      contributionTitle: contrib.title,
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

  console.log(`[computeRewards] Distribué ${totalRewardPool} CP sur ${contributions.length} contributions`);
  
  return rewards;
}