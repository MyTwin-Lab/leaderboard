import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import type { Challenge } from "../../../../packages/database-service/domain/entities.js";
import {
  ContributionRepository,
  RewardEntryRepository,
} from "../../../../packages/database-service/repositories/index.js";
import { ClaimNotConsumableError, resources } from "../../../../packages/capabilities/resources.js";
import { distributedFromPool, remainingPool } from "../../../../packages/capabilities/pool.js";
import { isClosedStatus } from "../../../../packages/capabilities/challenge-hooks.js";
import {
  ANNOTATION_CONTRIBUTION_TYPE,
  ANNOTATION_RULE_KEY,
  CLAWBACK_RULE_KEY,
  GOLD,
  ITEM,
  annotationConfigOf,
  annotationRulesOf,
  isOption,
  type AnnotationConfig,
} from "../config.js";
import { annotatorQuality, clearsSensitive, labelPay, resolveConsensus, valueOf } from "../scoring.js";

/**
 * Le travail d'un annotateur : tirer une image, la labelliser ou l'abandonner,
 * suivre sa progression. L'accès (être participant) est déclaré dans `index.ts`.
 *
 * Opacité des golds : rien de ce qui part vers l'annotateur ne dit si une
 * réclamation portait sur un gold — ni le tirage (la charge est filtrée), ni
 * la réponse au label (même forme, même paie), ni la progression (qualité
 * décalée, voir `QUALITY_LAG`).
 */

const res = resources();
const contributionRepo = new ContributionRepository();
const rewardRepo = new RewardEntryRepository();

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

function configOrFail(challenge: Challenge): AnnotationConfig | Response {
  return annotationConfigOf(challenge) ?? fail(409, "This annotation challenge has no readable configuration");
}

/** La carte servie à l'annotateur : l'image et les réponses possibles, jamais le type ni la réponse attendue. */
function card(
  claim: { claimId: string; expiresAt: Date | null },
  payload: Record<string, unknown>,
  config: AnnotationConfig
) {
  return {
    claim: {
      claim_id: claim.claimId,
      image_url: typeof payload.image_url === "string" ? payload.image_url : null,
      options: config.label_schema.options,
      expires_at: claim.expiresAt,
    },
  };
}

/**
 * `POST draw` — le seul geste de tirage. Une réclamation encore active est
 * resservie : tirer sans labelliser ne réserve pas plusieurs images. Sinon,
 * avec la probabilité `gold_rate`, un gold jamais vu ; à défaut un item, les
 * sensibles seulement si l'annotateur a la clearance.
 */
export async function draw({ challenge, user }: ActionContext) {
  const config = configOrFail(challenge);
  if (config instanceof Response) return config;
  if (isClosedStatus(challenge.status)) return fail(409, "This challenge is closed");

  const active = await res.activeClaim(challenge.uuid, user.id);
  if (active) {
    return card({ claimId: active.claim.uuid, expiresAt: active.claim.expires_at }, active.resource.payload, config);
  }

  const rules = annotationRulesOf(challenge);
  const quality = annotatorQuality(await res.consumedBy({ challengeId: challenge.uuid, userId: user.id }));

  let drawn = null;
  if (Math.random() < rules.gold_rate) {
    drawn = await res.draw(challenge.uuid, user.id, { type: GOLD, ttlHours: config.ttl_hours });
  }
  drawn ??= await res.draw(challenge.uuid, user.id, {
    type: ITEM,
    k: config.k,
    ttlHours: config.ttl_hours,
    class: clearsSensitive(quality, config.sensitive_clearance) ? undefined : "standard",
  });

  if (!drawn) return { claim: null };
  return card(drawn, drawn.payload, config);
}

const labelSchema = z.object({ value: z.string() });

/**
 * `POST claims/:claimId/label` — livre le label d'une réclamation active.
 *
 * Un item qui atteint `k` labels se résout (pluralité stricte, sinon
 * contesté). Chaque label est payé `per_unit_cp × précision`, borné par le
 * pool — pareil pour un gold.
 */
export async function label({ request, challenge, user, params }: ActionContext) {
  const config = configOrFail(challenge);
  if (config instanceof Response) return config;

  const parsed = labelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isOption(config.label_schema, parsed.data.value)) {
    return fail(400, "value must be one of the label options");
  }

  const claim = await res.claim(params.claimId);
  if (!claim || claim.user_id !== user.id || claim.challenge_id !== challenge.uuid) return fail(404, "Claim not found");

  try {
    await res.consume(claim.uuid, user.id, { value: parsed.data.value });
  } catch (error) {
    if (!(error instanceof ClaimNotConsumableError)) throw error;
    if (error.reason === "consumed") return fail(409, "This item is already labeled");
    if (error.reason === "lapsed") return fail(410, "This claim expired or was released; draw again");
    return fail(404, "Claim not found");
  }

  const resource = await res.resource(claim.resource_id);
  if (resource?.resource_type === ITEM && resource.state === "open") {
    const labels = await res.consumedClaims(resource.uuid);
    if (labels.length >= config.k) {
      const outcome = resolveConsensus(labels.map(valueOf).filter((v): v is string => v !== null));
      await res.close(
        resource.uuid,
        outcome.verdict,
        outcome.verdict === "labeled" ? { consensus: outcome.consensus } : {}
      );
    }
  }

  const cpAwarded = await pay(challenge, user.id, claim.uuid);
  return { labeled: true, cp_awarded: cpAwarded };
}

async function pay(challenge: Challenge, userId: string, claimId: string): Promise<number> {
  const rules = annotationRulesOf(challenge);
  const quality = annotatorQuality(await res.consumedBy({ challengeId: challenge.uuid, userId }));
  const remaining = remainingPool(
    challenge.contribution_points_reward,
    await distributedFromPool(rewardRepo, challenge.uuid)
  );
  const points = labelPay(rules.per_unit_cp, quality, remaining);
  if (points <= 0) return 0;

  const { contribution } = await contributionRepo.createIfAbsent({
    title: "Annotations",
    type: ANNOTATION_CONTRIBUTION_TYPE,
    description: `Labels on ${challenge.title}`,
    reward: 0,
    user_id: userId,
    challenge_id: challenge.uuid,
    submitted_at: new Date(),
    evaluation_status: "done",
  });
  // `claim_id` seulement : l'audit retrouve ce que la réclamation a rapporté,
  // et la ligne ne dit rien de la ressource.
  await rewardRepo.createManyAndSyncRewards([
    {
      challenge_id: challenge.uuid,
      user_id: userId,
      contribution_id: contribution.uuid,
      rule_key: ANNOTATION_RULE_KEY,
      points,
      meta: { claim_id: claimId },
    },
  ]);
  return points;
}

/** `POST claims/:claimId/release` — abandon explicite ; l'échéance couvre l'abandon silencieux. */
export async function release({ challenge, user, params }: ActionContext) {
  const claim = await res.claim(params.claimId);
  if (!claim || claim.user_id !== user.id || claim.challenge_id !== challenge.uuid) return fail(404, "Claim not found");
  if (!(await res.release(claim.uuid, user.id))) return fail(409, "This claim is no longer active");
  return { released: true };
}

/**
 * `GET progress` — ce que l'annotateur voit de lui-même : ses labels, ses CP
 * nets (clawbacks déduits) et son score de qualité, jamais lesquels de ses
 * tirages étaient des golds.
 */
export async function progress({ challenge, user }: ActionContext) {
  const config = configOrFail(challenge);
  if (config instanceof Response) return config;

  const [consumed, entries, active] = await Promise.all([
    res.consumedBy({ challengeId: challenge.uuid, userId: user.id }),
    rewardRepo.findByUserAndChallenge(user.id, challenge.uuid),
    res.activeClaim(challenge.uuid, user.id),
  ]);
  const quality = annotatorQuality(consumed);

  return {
    labeled: consumed.length,
    cp_earned: entries
      .filter((entry) => entry.rule_key === ANNOTATION_RULE_KEY || entry.rule_key === CLAWBACK_RULE_KEY)
      .reduce((sum, entry) => sum + entry.points, 0),
    quality_score: quality.accuracy,
    sensitive_cleared: clearsSensitive(quality, config.sensitive_clearance),
    has_active_claim: !!active,
  };
}
