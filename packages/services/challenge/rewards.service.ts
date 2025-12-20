import { ChallengeRepository, ContributionRepository } from "../../database-service/repositories/index.js";
import { computeRewards } from "../../evaluator/reward.js";
import type { Evaluation, ContributionReward } from "../../evaluator/types.js";

/**
 * RewardsService
 * --------------
 * Gère le calcul et la distribution des récompenses à la fin d'un challenge.
 */
export class RewardsService {
  private challengeRepo: ChallengeRepository;
  private contributionRepo: ContributionRepository;

  constructor() {
    this.challengeRepo = new ChallengeRepository();
    this.contributionRepo = new ContributionRepository();
  }

  /**
   * Calcule et distribue les rewards pour un challenge
   */
  async computeChallengeRewards(challengeId: string): Promise<ContributionReward[]> {
    console.log(`\n🏆 [RewardsService] Compute Rewards pour challenge ${challengeId}`);

    // 1. Récupérer le challenge
    const challenge = await this.challengeRepo.findById(challengeId);
    if (!challenge) {
      throw new Error(`[RewardsService] Challenge ${challengeId} not found`);
    }

    // 2. Récupérer toutes les contributions du challenge
    const contributions = await this.contributionRepo.findByChallenge(challengeId);
    console.log(`   - ${contributions.length} contributions trouvées`);

    // 3. Extraire les évaluations
    const evaluations: Evaluation[] = contributions
      .filter(c => c.evaluation)
      .map(c => c.evaluation as Evaluation);

    if (evaluations.length === 0) {
      console.warn("[RewardsService] Aucune évaluation trouvée");
      return [];
    }

    // 4. Calculer les rewards
    const totalPool = challenge.contribution_points_reward;
    const rewards = computeRewards(evaluations, totalPool);

    console.log(`[RewardsService] ${rewards.length} rewards calculés`);

    // 5. Mettre à jour les contributions avec les rewards
    for (const reward of rewards) {
      const contribution = contributions.find(c => 
        c.title === reward.contributionTitle
      );
      
      if (contribution) {
        try {
          await this.contributionRepo.update(contribution.uuid, {
            reward: reward.reward
          });
        } catch (error) {
          console.error(`[RewardsService] Erreur mise à jour reward pour ${contribution.title}:`, error);
        }
      }
    }

    console.log(`[RewardsService] ✅ Contributions mises à jour avec les rewards`);

    return rewards;
  }
}
