import type { RewardEntryDraft } from "../../../packages/database-service/domain/entities.js";
import {
  ChallengeRepository,
  RewardEntryRepository,
} from "../../../packages/database-service/repositories/index.js";
import { resources } from "../../../packages/capabilities/resources.js";
import { ANNOTATION_RULE_KEY, CLAWBACK_RULE_KEY, ITEM, annotationRulesOf } from "./config.js";
import { DATA_ANNOTATION_FLOW_KEY } from "./descriptor.js";
import { valueOf } from "./scoring.js";

/**
 * Job `annotation.audit` — l'audit par échantillon
 * ------------------------------------------------
 * Chaque item labellisé passe une fois devant l'audit : tiré avec la
 * probabilité `audit_rate`, chacun de ses labels contraires au consensus est
 * repris par une ligne `annotation_clawback` de moins ce qu'il a rapporté.
 *
 * Le passage est marqué sur l'item (`resolution.audit`), tiré ou non : sans
 * cette marque, un item non tiré repasserait chaque semaine et le taux réel
 * tendrait vers 1. La marque est posée **avant** l'écriture des reprises, par
 * un UPDATE conditionnel : deux passages concurrents ne reprennent jamais deux
 * fois ; un échec entre les deux laisse une reprise manquée, jamais une double.
 */

export interface AuditDeps {
  challengeRepo: Pick<ChallengeRepository, "findAll">;
  rewardRepo: Pick<RewardEntryRepository, "findByChallenge" | "createManyAndSyncRewards">;
  res: Pick<ReturnType<typeof resources>, "list" | "stampResolution" | "consumedClaims">;
  random: () => number;
  now: () => Date;
}

export interface AuditSummary {
  items: number;
  sampled: number;
  clawbacks: number;
  points: number;
}

export async function runAnnotationAudit(deps?: Partial<AuditDeps>): Promise<AuditSummary> {
  const challengeRepo = deps?.challengeRepo ?? new ChallengeRepository();
  const rewardRepo = deps?.rewardRepo ?? new RewardEntryRepository();
  const res = deps?.res ?? resources();
  const random = deps?.random ?? Math.random;
  const now = deps?.now ?? (() => new Date());

  const summary: AuditSummary = { items: 0, sampled: 0, clawbacks: 0, points: 0 };
  const challenges = (await challengeRepo.findAll()).filter((c) => c.type === DATA_ANNOTATION_FLOW_KEY);

  for (const challenge of challenges) {
    const items = await res.list({
      challengeId: challenge.uuid,
      type: ITEM,
      verdict: "labeled",
      withoutResolutionKey: "audit",
    });
    if (items.length === 0) continue;

    const auditRate = annotationRulesOf(challenge).audit_rate;
    let paidByClaim: Map<string, { points: number; contributionId?: string }> | null = null;

    for (const item of items) {
      const sampled = random() < auditRate;
      const stamped = await res.stampResolution(item.uuid, "audit", { at: now().toISOString(), sampled });
      if (!stamped) continue;
      summary.items++;
      if (!sampled) continue;
      summary.sampled++;

      const consensus = stamped.resolution?.consensus;
      if (typeof consensus !== "string") continue;

      paidByClaim ??= await paidPerClaim(rewardRepo, challenge.uuid);
      const drafts: RewardEntryDraft[] = [];
      for (const claim of await res.consumedClaims(item.uuid)) {
        if (valueOf(claim) === consensus) continue;
        const paid = paidByClaim.get(claim.claim_id);
        if (!paid || paid.points <= 0) continue;
        drafts.push({
          challenge_id: challenge.uuid,
          user_id: claim.user_id,
          contribution_id: paid.contributionId,
          rule_key: CLAWBACK_RULE_KEY,
          points: -paid.points,
          meta: { claim_id: claim.claim_id },
        });
      }
      if (drafts.length === 0) continue;

      await rewardRepo.createManyAndSyncRewards(drafts);
      summary.clawbacks += drafts.length;
      summary.points += drafts.reduce((sum, draft) => sum - draft.points, 0);
    }
  }

  return summary;
}

/** Ce que chaque réclamation a rapporté, net des reprises déjà écrites. */
async function paidPerClaim(
  rewardRepo: AuditDeps["rewardRepo"],
  challengeId: string
): Promise<Map<string, { points: number; contributionId?: string }>> {
  const paid = new Map<string, { points: number; contributionId?: string }>();
  for (const entry of await rewardRepo.findByChallenge(challengeId)) {
    if (entry.rule_key !== ANNOTATION_RULE_KEY && entry.rule_key !== CLAWBACK_RULE_KEY) continue;
    const claimId = entry.meta?.claim_id;
    if (typeof claimId !== "string") continue;
    const current = paid.get(claimId);
    paid.set(claimId, {
      points: (current?.points ?? 0) + entry.points,
      contributionId: current?.contributionId ?? entry.contribution_id,
    });
  }
  return paid;
}
