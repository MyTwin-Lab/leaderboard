import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import type { Challenge } from "../../../../packages/database-service/domain/entities.js";
import {
  CaseClaimRepository,
  ChallengeRepository,
  ContributionRepository,
  RewardEntryRepository,
  ScenarioRunRepository,
  UserRepository,
  ValidationAttemptRepository,
  ValidationTargetRepository,
} from "../../../../packages/database-service/repositories/index.js";
import { eligibleDeliverableType } from "../../../../packages/capabilities/deliverables.js";
import { assertPublicHttpUrl } from "../../../../packages/services/challenge/ssrf-guard.js";
import { reviewerQualificationOf, validationConfigOf } from "../config.js";
import { validationModeOf } from "../mode.js";

const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const targetRepo = new ValidationTargetRepository();
const attemptRepo = new ValidationAttemptRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();
const caseClaimRepo = new CaseClaimRepository();
const scenarioRunRepo = new ScenarioRunRepository();

/**
 * Le flow du challenge source, dont les livrables fournissent les cibles. Une
 * requête de plus par appel : seul le lien vers le parent est stocké, ce qu'il
 * offre se lit dans les déclarations de son flow.
 */
async function sourceFlowOf(challenge: Challenge): Promise<string | null> {
  const source = challenge.source_challenge_id ? await challengeRepo.findById(challenge.source_challenge_id) : null;
  return source?.type ?? null;
}

/**
 * Les soumissions du challenge source qui peuvent devenir des cibles : le
 * livrable que la validation sait éprouver (`api_packaging` d'un challenge ML,
 * `project` d'un challenge code), pas encore exposé. L'URL de l'endpoint est
 * saisie par le manager à l'exposition, elle n'est pas exigée ici.
 */
async function eligibleSubmissions(challenge: Challenge) {
  const sourceContribs = challenge.source_challenge_id
    ? await contributionRepo.findByChallenge(challenge.source_challenge_id)
    : [];
  const existingTargets = await targetRepo.findByChallenge(challenge.uuid);
  const targetedContributionIds = new Set(existingTargets.map((t) => t.contribution_id));

  const eligibleType = eligibleDeliverableType(challenge.type, await sourceFlowOf(challenge));
  const eligible = eligibleType
    ? sourceContribs.filter((c) => c.type === eligibleType && !targetedContributionIds.has(c.uuid))
    : [];
  const users = await userRepo.findByIds([...new Set(eligible.map((c) => c.user_id))]);
  const usersById = new Map(users.map((u) => [u.uuid, u]));

  return eligible.map((c) => ({
    contributionId: c.uuid,
    userId: c.user_id,
    userName: usersById.get(c.user_id)?.full_name ?? "Unknown",
  }));
}

/**
 * `GET targets` — les cibles exposées, l'état du pool et ce que l'appelant en
 * a déjà fait. `?eligible=true` (admin ou manager) : les soumissions exposables.
 */
export async function listTargets({ request, challenge, user, access }: ActionContext) {
  const challengeId = challenge.uuid;
  const isManager = access.isAdmin() || (await access.isManager());

  if (new URL(request.url).searchParams.get("eligible") === "true") {
    if (!isManager) return Response.json({ error: "Forbidden" }, { status: 403 });
    return { eligible: await eligibleSubmissions(challenge) };
  }

  const mode = validationModeOf(challenge.type);
  const isScenario = mode === "scenario";

  const [targets, distributed] = await Promise.all([
    targetRepo.findByChallenge(challengeId),
    rewardRepo.sumByChallenge(challengeId),
  ]);

  const contributions = await Promise.all(targets.map((t) => contributionRepo.findById(t.contribution_id)));
  const submitterIds = [
    ...new Set(contributions.filter((c): c is NonNullable<typeof c> => !!c).map((c) => c.user_id)),
  ];
  const submitters = await userRepo.findByIds(submitterIds);
  const submittersById = new Map(submitters.map((u) => [u.uuid, u]));

  // Mode scénario : pas de verdict, pas de cas de référence, donc aucune des
  // requêtes du flux endpoint. Deux lectures suffisent — toutes les runs du
  // challenge (le compte par application) et les miennes (mon état).
  const [allRuns, myRuns] = isScenario
    ? await Promise.all([
        scenarioRunRepo.findByChallenge(challengeId),
        scenarioRunRepo.findByChallengeAndValidator(challengeId, user.id),
      ])
    : [[], []];

  const myAttempts = isScenario ? [] : await attemptRepo.findByChallengeAndValidator(challengeId, user.id);
  const validatedContributionIds = new Set(myAttempts.map((a) => a.contribution_id));

  const attemptsByTarget = isScenario
    ? targets.map(() => [])
    : await Promise.all(targets.map((t) => attemptRepo.findByChallengeAndContribution(challengeId, t.contribution_id)));

  // Les réclamations inachevées de l'appelant, par cible : le client reprend
  // une séquence observation/révélation/vote interrompue au lieu de reproposer
  // la liste des cas et de perdre ce travail en cours.
  const myOpenClaimsByTarget = isScenario
    ? targets.map(() => [])
    : await Promise.all(
        targets.map(async (t) => {
          const claims = await caseClaimRepo.findByValidatorAndTarget(user.id, t.contribution_id);
          return claims
            .filter((c) => !c.observed_at || !c.revealed_at)
            .map((c) => ({ id: c.uuid, observed: !!c.observed_at, revealed: !!c.revealed_at }));
        }),
      );

  const pool = challenge.contribution_points_reward;
  const payout = validationConfigOf(challenge);

  return {
    currentUserId: user.id,
    mode,
    // Relire exige la qualification que la configuration du challenge pose.
    viewer: { canReview: mode === "reference_case" && (await access.holds(reviewerQualificationOf(challenge))) },
    pool: {
      pool,
      distributed,
      remaining: Math.max(0, pool - distributed),
      cpPerValidation: payout.cp_per_validation,
      requiredValidations: payout.required_validations ?? 0,
    },
    targets: targets.map((t, i) => {
      const c = contributions[i];
      const submitter = c ? submittersById.get(c.user_id) : undefined;
      const attempts = attemptsByTarget[i];
      const worksCount = attempts.filter((a) => a.verdict === "works").length;
      const brokenCount = attempts.length - worksCount;
      const myRun = myRuns.find((r) => r.contribution_id === t.contribution_id) ?? null;
      return {
        id: t.uuid,
        contributionId: t.contribution_id,
        submitterUserId: c?.user_id ?? null,
        submitterName: submitter?.full_name ?? "Unknown",
        submitterAvatarUrl: submitter?.avatar_url ?? null,
        alreadyValidatedByMe: validatedContributionIds.has(t.contribution_id),
        verdictCount: attempts.length,
        outcome: t.outcome,
        resolvedAt: t.resolved_at,
        myOpenClaims: myOpenClaimsByTarget[i],
        ...(isScenario
          ? {
              // Le navigateur du validateur est ce qui charge l'application en
              // mode scénario, donc l'URL doit sortir jusqu'au client — elle a
              // déjà passé assertPublicHttpUrl à l'exposition. En mode
              // référence le proxy serveur est seul à appeler l'endpoint ;
              // cette URL n'a jamais eu à quitter le serveur et ne le doit pas.
              endpointUrl: c?.live_endpoint_url ?? null,
              walkthroughCount: allRuns.filter((r) => r.contribution_id === t.contribution_id).length,
              myWalkthrough: myRun ? { runId: myRun.uuid, completedAt: myRun.completed_at } : null,
            }
          : {}),
        // Le manager est le seul à voir le partage works/broken avant
        // résolution — et il n'existe pas en mode scénario.
        ...(isManager && !isScenario ? { worksCount, brokenCount } : {}),
      };
    }),
  };
}

const addTargetSchema = z.object({
  contribution_id: z.string().uuid(),
  live_endpoint_url: z.string().url(),
});

/**
 * `POST targets` — expose une soumission du challenge source (qui sera
 * crédité) avec l'endpoint à éprouver, saisi à ce moment par le manager.
 */
export async function addTarget({ request, challenge }: ActionContext) {
  const parsed = addTargetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }
  const { contribution_id, live_endpoint_url } = parsed.data;

  const expectedType = eligibleDeliverableType(challenge.type, await sourceFlowOf(challenge));
  if (!expectedType) {
    return Response.json(
      { error: "The source challenge of this validation challenge offers no deliverable it can test" },
      { status: 400 },
    );
  }

  const contribution = await contributionRepo.findById(contribution_id);
  if (
    !contribution ||
    contribution.challenge_id !== challenge.source_challenge_id ||
    contribution.type !== expectedType
  ) {
    return Response.json({ error: `Contribution is not an eligible ${expectedType} submission` }, { status: 400 });
  }

  const existing = await targetRepo.findByChallengeAndContribution(challenge.uuid, contribution_id);
  if (existing) {
    return Response.json({ error: "Already exposed on this validation challenge" }, { status: 409 });
  }

  try {
    await assertPublicHttpUrl(live_endpoint_url);
  } catch (err) {
    return Response.json(
      { error: `Endpoint URL is not reachable/allowed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  await contributionRepo.update(contribution_id, { live_endpoint_url });
  const target = await targetRepo.create({ validation_challenge_id: challenge.uuid, contribution_id, position: 0 });
  return Response.json(target, { status: 201 });
}

/** `DELETE targets/:targetId` — retire une cible sur laquelle personne n'a encore travaillé. */
export async function removeTarget({ challenge, params }: ActionContext) {
  const existing = await targetRepo.findById(params.targetId);
  if (!existing || existing.validation_challenge_id !== challenge.uuid) {
    return Response.json({ error: "Target not found" }, { status: 404 });
  }

  // Deux modes, deux formes de « travail déjà là » sur cette cible : un vote
  // en mode référence, une walkthrough (brouillon ou complétée et payée) en
  // mode scénario. `attempts` est toujours vide en mode scénario, donc sans
  // ce second compte la garde ne voyait jamais rien à protéger dans ce mode.
  const [attempts, runs] = await Promise.all([
    attemptRepo.findByChallengeAndContribution(challenge.uuid, existing.contribution_id),
    scenarioRunRepo.findByChallenge(challenge.uuid),
  ]);
  const walkthroughCount = runs.filter((r) => r.contribution_id === existing.contribution_id).length;
  if (attempts.length > 0) {
    return Response.json({ error: `Cannot remove a target that already has ${attempts.length} vote(s)` }, { status: 409 });
  }
  if (walkthroughCount > 0) {
    return Response.json(
      { error: `Cannot remove a target that already has ${walkthroughCount} walkthrough(s)` },
      { status: 409 },
    );
  }

  await targetRepo.delete(params.targetId);
  return { success: true };
}
