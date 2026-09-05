import type { CodeRewardRules } from "../database-service/domain/codeRewardRules.js";
import type { RewardRuleKey } from "../database-service/domain/entities.js";
import type { RewardEntryDraft } from "./ml-reward.js";

/**
 * Reward des challenges code (boards personnels).
 *
 * Comme ml-reward.ts : fonction pure, lignes de ledger immuables, montants
 * absolus clampés au pool restant. La spécificité code est le delta itératif :
 * chaque run recalcule les points bruts par règle et ne verse que
 * `max(0, brut − déjà versé)`. Une note qui baisse ne produit rien et rien
 * n'est jamais repris. Le fixe tombe au premier run réussi puis son delta
 * vaut 0 pour toujours — aucune logique "première fois" nécessaire.
 */
export interface CodeAwardInput {
  rules: CodeRewardRules;
  challengeId: string;
  userId: string;
  contributionId: string;
  /** Note agent ramenée sur 0..10. */
  score: number;
  /** Σ des lignes déjà au ledger pour (challenge, user), par règle. */
  alreadyAwarded: { code_fixed: number; code_quality: number };
  /** CP encore disponibles sur le challenge. Les deltas sont clampés dessus. */
  remainingPool: number;
  /**
   * Bonus collectif quand la livraison est celle d'un groupe (1 en solo).
   *
   * Il multiplie le brut, donc avant le delta et avant le clamp : c'est le
   * montant total dû au groupe qui grandit, et la division en parts se fait
   * plus tard, sur les points réellement attribués.
   */
  groupMultiplier?: number;
}

export function computeCodeAward(input: CodeAwardInput): RewardEntryDraft[] {
  const score = Math.min(10, Math.max(0, input.score));
  const multiplier = input.groupMultiplier ?? 1;
  let pool = Math.max(0, input.remainingPool);
  const drafts: RewardEntryDraft[] = [];

  // Le brut est multiplié, le déjà-versé ne l'est pas : il est lu tel quel au
  // ledger. Un membre qui rejoint entre deux runs fait donc monter le brut et
  // rouvre un delta positif — le groupe touche le complément au run suivant.
  // C'est voulu, et c'est le pendant naturel d'un ledger append-only : rien
  // n'est repris, seul l'écart restant est versé.
  const gross: Array<{ rule_key: RewardRuleKey; raw: number; already: number }> = [
    { rule_key: "code_fixed", raw: Math.round(input.rules.delivery.fixed * multiplier), already: input.alreadyAwarded.code_fixed },
    { rule_key: "code_quality", raw: Math.round((input.rules.delivery.cap * score * multiplier) / 10), already: input.alreadyAwarded.code_quality },
  ];

  for (const g of gross) {
    const delta = Math.max(0, g.raw - g.already);
    if (delta === 0) continue;
    const points = Math.min(delta, pool);
    if (points === 0) continue; // pool épuisé — pas de ligne à 0
    pool -= points;
    drafts.push({
      challenge_id: input.challengeId,
      user_id: input.userId,
      contribution_id: input.contributionId,
      rule_key: g.rule_key,
      points,
      meta: {
        agentScore: score,
        rawPoints: g.raw,
        ...(points < delta ? { clampedTo: points } : {}),
      },
    });
  }

  return drafts;
}
