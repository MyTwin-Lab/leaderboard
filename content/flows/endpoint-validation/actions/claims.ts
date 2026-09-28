import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import {
  CaseClaimRepository,
  ReferenceCaseRepository,
  ValidationTargetRepository,
} from "../../../../packages/database-service/repositories/index.js";
import {
  ClaimNotFoundError,
  DuplicateClaimError,
  EndpointCallError,
  ForbiddenClaimAccessError,
  InsufficientRoleError,
  ObservationAlreadyRecordedError,
  ObservationRequiredError,
  ReferenceCaseService,
  SelfAuthoredCaseError,
  SelfVoteError,
  ValidationTargetError,
} from "../../../../packages/services/challenge/reference-case.service.js";
import { buildSafeFileHeaders } from "../../../../packages/capabilities/safe-file-headers.js";

/**
 * La séquence d'un relecteur sur une cible : réclamer un cas de référence et
 * appeler l'endpoint, noter ce qu'il a vu, puis seulement découvrir le
 * résultat attendu. L'accès (la qualification) est déclaré dans `index.ts`.
 */

const service = new ReferenceCaseService();
const targetRepo = new ValidationTargetRepository();
const caseRepo = new ReferenceCaseRepository();
const caseClaimRepo = new CaseClaimRepository();

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** Les refus métier du service, en statuts. Toute autre erreur remonte au dispatcher (500). */
function refusal(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Validation error", details: error.issues }, { status: 400 });
  }
  if (
    error instanceof InsufficientRoleError ||
    error instanceof SelfAuthoredCaseError ||
    error instanceof SelfVoteError ||
    error instanceof ForbiddenClaimAccessError
  ) {
    return fail(403, error.message);
  }
  if (error instanceof ClaimNotFoundError) return fail(404, error.message);
  if (error instanceof ValidationTargetError || error instanceof ObservationRequiredError) return fail(400, error.message);
  if (error instanceof DuplicateClaimError || error instanceof ObservationAlreadyRecordedError) return fail(409, error.message);
  if (error instanceof EndpointCallError) {
    console.error("Validation endpoint call error:", error.message);
    return fail(502, `The API didn't respond correctly: ${error.message}`);
  }
  throw error;
}

const claimSchema = z.object({
  reference_case_id: z.string().uuid(),
});

/**
 * `POST targets/:targetId/claim` — réclame un cas de référence sur la cible et
 * l'éprouve contre son endpoint en un seul geste. Renvoie les octets bruts de
 * la réponse, avec `X-Validation-Status` et `X-Claim-Id` pour enchaîner
 * l'observation, la révélation et le verdict.
 */
export async function claimCase({ request, challenge, user, params }: ActionContext) {
  try {
    const { reference_case_id } = claimSchema.parse(await request.json());

    const target = await targetRepo.findById(params.targetId);
    if (!target || target.validation_challenge_id !== challenge.uuid) return fail(404, "Target not found");

    // Un cas purgé n'a plus d'octets d'entrée : l'envoyer à l'endpoint
    // testerait un fichier vide. 410, comme les actions d'octets.
    if (await caseRepo.isPurged(reference_case_id)) {
      return fail(410, "Reference case no longer available (purged after the retention period)");
    }

    const { claim, liveResponse } = await service.claimCase({
      validationChallengeId: challenge.uuid,
      contributionId: target.contribution_id,
      referenceCaseId: reference_case_id,
      validatorUserId: user.id,
    });

    // La réponse vient d'un endpoint tiers : son Content-Type n'est jamais
    // recopié tel quel. buildSafeFileHeaders normalise le type, pose nosniff
    // et force le téléchargement de tout ce qui n'est pas une image sûre.
    const headers = buildSafeFileHeaders(liveResponse.contentType, "response") as Record<string, string>;
    headers["X-Validation-Status"] = String(liveResponse.status);
    headers["X-Claim-Id"] = claim.uuid;

    return new Response(new Uint8Array(liveResponse.body), { status: 200, headers });
  } catch (error) {
    return refusal(error);
  }
}

/**
 * `GET targets/:targetId/claimable-cases` — les cas encore réclamables par
 * l'appelant sur cette cible (métadonnées seules), et ses réclamations
 * inachevées, pour reprendre une séquence interrompue.
 */
export async function claimableCases({ challenge, user, params }: ActionContext) {
  try {
    const target = await targetRepo.findById(params.targetId);
    if (!target || target.validation_challenge_id !== challenge.uuid) return fail(404, "Target not found");

    const [claimable, myClaims] = await Promise.all([
      service.listClaimableCases({
        validationChallengeId: challenge.uuid,
        contributionId: target.contribution_id,
        requestingUserId: user.id,
      }),
      caseClaimRepo.findByValidatorAndTarget(user.id, target.contribution_id),
    ]);

    return {
      claimableCases: claimable.map((c) => ({
        id: c.uuid,
        inputFilename: c.input_filename,
        inputContentType: c.input_content_type,
      })),
      myOpenClaims: myClaims
        .filter((c) => !c.observed_at || !c.revealed_at)
        .map((c) => ({ id: c.uuid, observed: !!c.observed_at, revealed: !!c.revealed_at })),
    };
  } catch (error) {
    return refusal(error);
  }
}

const observationSchema = z.object({
  observation: z.string().trim().min(1),
});

/** `POST case-claims/:claimId/observation` — ce que le relecteur a vu, avant toute révélation. */
export async function recordObservation({ request, user, params }: ActionContext) {
  try {
    const { observation } = observationSchema.parse(await request.json());
    await service.recordObservation({ claimId: params.claimId, validatorUserId: user.id, observation });
    return { ok: true };
  } catch (error) {
    return refusal(error);
  }
}

/**
 * `POST case-claims/:claimId/reveal` — le résultat attendu du cas, seulement
 * une fois l'observation enregistrée (`ObservationRequiredError` sinon) : un
 * client ne peut jamais obtenir ces octets avant d'avoir noté ce qu'il a vu,
 * quel que soit l'ordre de ses appels.
 */
export async function revealExpectedOutput({ user, params }: ActionContext) {
  try {
    // Purge de conservation passée : 410 plutôt qu'un fichier vide. Seulement
    // pour le propriétaire du claim — pour tout autre appelant, le service
    // ci-dessous garde la main et répond 404/403 comme avant.
    const purgeState = await caseClaimRepo.findPurgeState(params.claimId);
    if (purgeState && purgeState.validator_user_id === user.id && (purgeState.claim_purged_at || purgeState.case_purged_at)) {
      return fail(410, "Expected output no longer available (purged after the retention period)");
    }

    const expected = await service.revealExpectedOutput({ claimId: params.claimId, validatorUserId: user.id });
    return new Response(new Uint8Array(expected.body), {
      status: 200,
      headers: buildSafeFileHeaders(expected.contentType, expected.filename),
    });
  } catch (error) {
    return refusal(error);
  }
}
