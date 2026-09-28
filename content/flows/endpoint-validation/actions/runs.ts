import type { ActionContext } from "../../../../packages/registry/platform.js";
import {
  CaseClaimRepository,
  ContributionRepository,
  ReferenceCaseRepository,
  UserRepository,
  ValidationAttemptRepository,
} from "../../../../packages/database-service/repositories/index.js";
import { buildSafeFileHeaders } from "../../../../packages/capabilities/safe-file-headers.js";

/**
 * Les runs d'un challenge de validation d'endpoints, pour sa supervision : la
 * liste (métadonnées seules), puis le fichier et la réponse de chacun.
 */

const contributionRepo = new ContributionRepository();
const attemptRepo = new ValidationAttemptRepository();
const userRepo = new UserRepository();
const caseClaimRepo = new CaseClaimRepository();
const referenceCaseRepo = new ReferenceCaseRepository();

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** `GET runs` — chaque verdict rendu, toutes cibles confondues, sans aucun octet. */
export async function listRuns({ challenge }: ActionContext) {
  const attempts = await attemptRepo.findByChallenge(challenge.uuid);

  const contributionIds = [...new Set(attempts.map((a) => a.contribution_id))];
  const contributions = await Promise.all(contributionIds.map((id) => contributionRepo.findById(id)));
  const submitterIdByContribution = new Map(
    contributions.filter((c): c is NonNullable<typeof c> => !!c).map((c) => [c.uuid, c.user_id]),
  );

  const userIds = [...new Set([...submitterIdByContribution.values(), ...attempts.map((a) => a.validator_user_id)])];
  const users = await userRepo.findByIds(userIds);
  const usersById = new Map(users.map((u) => [u.uuid, u]));

  return {
    runs: attempts.map((a) => {
      const submitterId = submitterIdByContribution.get(a.contribution_id);
      return {
        id: a.uuid,
        contributionId: a.contribution_id,
        submitterName: (submitterId && usersById.get(submitterId)?.full_name) ?? "Unknown",
        validatorId: a.validator_user_id,
        validatorName: usersById.get(a.validator_user_id)?.full_name ?? "Unknown",
        verdict: a.verdict,
        description: a.description,
        createdAt: a.created_at,
        fileFilename: a.file_filename,
        fileContentType: a.file_content_type,
        responseContentType: a.response_content_type,
        responseStatus: a.response_status,
        purged: a.purged_at !== null,
      };
    }),
  };
}

async function attemptOf(challengeId: string, attemptId: string) {
  const attempt = await attemptRepo.findById(attemptId);
  return attempt && attempt.validation_challenge_id === challengeId ? attempt : null;
}

/** `GET runs/:attemptId/file` — exactement le fichier que le relecteur a éprouvé. */
export async function runFile({ challenge, params }: ActionContext) {
  const attempt = await attemptOf(challenge.uuid, params.attemptId);
  if (!attempt) return fail(404, "Run not found");

  // Depuis challenge-014, la preuve d'un verdict vit sur la réclamation de son
  // cas de référence, et `attempt.file_bytes` reste nul sur toute nouvelle
  // ligne. Le chemin historique ci-dessous reste en repli.
  if (attempt.reference_case_claim_id) {
    // Purge de conservation passée : input_bytes a été vidé sur le cas de
    // référence. 410 plutôt qu'un 200 à corps vide — vérifié avant de
    // charger le moindre blob.
    const purgeState = await caseClaimRepo.findPurgeState(attempt.reference_case_claim_id);
    if (!purgeState || purgeState.case_purged_at) return fail(410, "File not available (purged or missing)");
    const claim = await caseClaimRepo.findById(attempt.reference_case_claim_id);
    if (!claim) return fail(410, "File not available (purged or missing)");
    const referenceCase = await referenceCaseRepo.findInputById(claim.reference_case_id);
    if (!referenceCase) return fail(410, "File not available (purged or missing)");
    return new Response(new Uint8Array(referenceCase.input_bytes), {
      status: 200,
      headers: buildSafeFileHeaders(referenceCase.input_content_type, referenceCase.input_filename),
    });
  }

  if (!attempt.file_bytes) return fail(410, "File not available (purged or missing)");

  return new Response(new Uint8Array(attempt.file_bytes), {
    status: 200,
    headers: buildSafeFileHeaders(attempt.file_content_type, attempt.file_filename),
  });
}

/** `GET runs/:attemptId/response` — exactement la réponse brute que l'endpoint a renvoyée. */
export async function runResponse({ challenge, params }: ActionContext) {
  const attempt = await attemptOf(challenge.uuid, params.attemptId);
  if (!attempt) return fail(404, "Run not found");

  // Même repli que `runFile` : depuis challenge-014, response_bytes vit sur la réclamation.
  if (attempt.reference_case_claim_id) {
    // Purge de conservation passée : response_bytes a été vidé sur le claim.
    // 410 plutôt qu'un 200 à corps vide — vérifié avant de charger le blob.
    const purgeState = await caseClaimRepo.findPurgeState(attempt.reference_case_claim_id);
    if (!purgeState || purgeState.claim_purged_at) return fail(410, "Response not available (purged or missing)");
    const claim = await caseClaimRepo.findById(attempt.reference_case_claim_id);
    if (!claim) return fail(410, "Response not available (purged or missing)");
    const headers = buildSafeFileHeaders(claim.response_content_type, "response") as Record<string, string>;
    headers["X-Validation-Status"] = String(claim.response_status);
    return new Response(new Uint8Array(claim.response_bytes), { status: 200, headers });
  }

  if (!attempt.response_bytes) return fail(410, "Response not available (purged or missing)");

  const headers = buildSafeFileHeaders(attempt.response_content_type, "response") as Record<string, string>;
  if (attempt.response_status !== null) headers["X-Validation-Status"] = String(attempt.response_status);

  return new Response(new Uint8Array(attempt.response_bytes), { status: 200, headers });
}
