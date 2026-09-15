import { z } from "zod";
import type { ActionContext } from "../../../../packages/registry/platform.js";
import {
  ClaimNotFoundError,
  ClaimNotRevealedError,
  DuplicateVerdictError,
  ForbiddenClaimAccessError,
  InsufficientRoleError,
  SelfVoteError,
  ValidationChallengeService,
  ValidationTargetError,
} from "../../../../packages/services/challenge/validation-challenge.service.js";

const service = new ValidationChallengeService();

const castVerdictSchema = z.object({
  contribution_id: z.string().uuid(),
  verdict: z.enum(["works", "broken"]),
  // Exigée dans tous les cas depuis challenge-014.
  description: z.string().trim().min(1),
  reference_case_claim_id: z.string().uuid(),
});

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/**
 * `POST verdicts` — après avoir réclamé un cas, noté son observation et vu le
 * résultat attendu révélé. Body : contribution_id, verdict, description,
 * reference_case_claim_id.
 */
export async function castVerdict({ request, challenge, user }: ActionContext) {
  try {
    const parsed = castVerdictSchema.parse(await request.json());
    return await service.castVerdict({
      validationChallengeId: challenge.uuid,
      contributionId: parsed.contribution_id,
      validatorUserId: user.id,
      verdict: parsed.verdict,
      description: parsed.description,
      referenceCaseClaimId: parsed.reference_case_claim_id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Validation error", details: error.issues }, { status: 400 });
    }
    if (error instanceof InsufficientRoleError || error instanceof SelfVoteError || error instanceof ForbiddenClaimAccessError) {
      return fail(403, error.message);
    }
    if (error instanceof DuplicateVerdictError) return fail(409, error.message);
    if (error instanceof ClaimNotFoundError) return fail(404, error.message);
    if (error instanceof ClaimNotRevealedError || error instanceof ValidationTargetError) return fail(400, error.message);
    throw error;
  }
}
