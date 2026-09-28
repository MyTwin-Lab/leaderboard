import { ContributionRepository } from "../../../packages/database-service/repositories/index.js";
import type { Challenge, Contribution } from "../../../packages/database-service/domain/entities.js";

/**
 * La contribution `type: 'validation'` qui agrège le ledger d'un validateur
 * sur un challenge — une par (validateur, challenge), créée à la première
 * récompense. Miroir du motif `type: 'discussion'` des signaux Slack : une
 * puce sur le profil, pas une entrée dans la liste des contributions.
 *
 * Extraite parce que les deux modes de validation paient exactement pareil —
 * `rule_key: 'validation'`, mêmes points, même contribution d'agrégation. Une
 * seconde copie de ces dix lignes serait une seconde façon de nommer la même
 * contribution, donc deux lignes d'agrégat pour une seule personne.
 */
export async function findOrCreateValidatorContribution(
  deps: { contributionRepo: Pick<ContributionRepository, "findByChallenge" | "create"> },
  challenge: Challenge,
  userId: string
): Promise<Contribution> {
  const all = await deps.contributionRepo.findByChallenge(challenge.uuid);
  const existing = all.find(c => c.type === "validation" && c.user_id === userId);
  if (existing) return existing;
  return deps.contributionRepo.create({
    title: "Validations performed",
    type: "validation",
    description: `Validations on ${challenge.title}`,
    reward: 0,
    user_id: userId,
    challenge_id: challenge.uuid,
    submitted_at: new Date(),
    evaluation_status: "done",
  });
}
