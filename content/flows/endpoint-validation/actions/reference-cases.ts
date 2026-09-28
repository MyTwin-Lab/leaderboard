import type { ActionContext } from "../../../../packages/registry/platform.js";
import { CaseClaimRepository, ReferenceCaseRepository } from "../../../../packages/database-service/repositories/index.js";
import {
  InsufficientRoleError,
  ReferenceCaseQuotaError,
  ReferenceCaseService,
  ValidationTargetError,
} from "../../../../packages/services/challenge/reference-case.service.js";
import { buildSafeFileHeaders } from "../../../../packages/capabilities/safe-file-headers.js";

const service = new ReferenceCaseService();
const caseRepo = new ReferenceCaseRepository();
const caseClaimRepo = new CaseClaimRepository();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function fail(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

type CaseSummary = Awaited<ReturnType<ReferenceCaseRepository["findByChallenge"]>>[number];

function toClientCase(c: CaseSummary) {
  return {
    id: c.uuid,
    authorUserId: c.author_user_id,
    inputFilename: c.input_filename,
    inputContentType: c.input_content_type,
    createdAt: c.created_at,
  };
}

/**
 * `GET reference-cases` — admin et manager : tous les cas du challenge
 * (supervision). Relecteur qualifié : les cas qu'il a écrits.
 */
export async function listReferenceCases({ challenge, user, access }: ActionContext) {
  if (access.isAdmin() || (await access.isManager())) {
    return { cases: (await caseRepo.findByChallenge(challenge.uuid)).map(toClientCase) };
  }
  return { cases: (await caseRepo.findByAuthor(challenge.uuid, user.id)).map(toClientCase) };
}

/**
 * `POST reference-cases` — multipart : `input` et `expected_output` (le client
 * enveloppe un texte saisi dans un Blob, pour un seul contrat).
 */
export async function authorReferenceCase({ request, challenge, user }: ActionContext) {
  try {
    const form = await request.formData();
    const inputFile = form.get("input");
    const expectedOutputFile = form.get("expected_output");
    if (!(inputFile instanceof File)) return fail(400, "input is required");
    if (!(expectedOutputFile instanceof File)) return fail(400, "expected_output is required");
    if (inputFile.size > MAX_UPLOAD_BYTES || expectedOutputFile.size > MAX_UPLOAD_BYTES) {
      return fail(413, "File too large");
    }

    const created = await service.authorCase({
      validationChallengeId: challenge.uuid,
      authorUserId: user.id,
      input: {
        buffer: Buffer.from(await inputFile.arrayBuffer()),
        filename: inputFile.name,
        contentType: inputFile.type || "application/octet-stream",
      },
      expectedOutput: {
        buffer: Buffer.from(await expectedOutputFile.arrayBuffer()),
        filename: expectedOutputFile.name || null,
        contentType: expectedOutputFile.type || "application/octet-stream",
      },
    });

    return Response.json(
      {
        id: created.uuid,
        authorUserId: created.author_user_id,
        inputFilename: created.input_filename,
        inputContentType: created.input_content_type,
        createdAt: created.created_at,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InsufficientRoleError) return fail(403, error.message);
    if (error instanceof ReferenceCaseQuotaError) return fail(409, error.message);
    if (error instanceof ValidationTargetError) return fail(400, error.message);
    throw error;
  }
}

/**
 * `DELETE reference-cases/:caseId` — l'auteur du cas, ou un admin (pas un
 * manager : écrire un cas est une frontière de qualification, modérer revient
 * à l'admin). 409 dès qu'une réclamation existe sur le cas.
 */
export async function removeReferenceCase({ challenge, user, params, access }: ActionContext) {
  const existing = await caseRepo.findInputById(params.caseId);
  if (!existing || existing.validation_challenge_id !== challenge.uuid) return fail(404, "Reference case not found");

  if (existing.author_user_id !== user.id && !access.isAdmin()) return fail(403, "Forbidden");

  const claims = await caseClaimRepo.findByReferenceCase(params.caseId);
  if (claims.length > 0) {
    return fail(409, `Cannot remove a reference case that already has ${claims.length} claim(s)`);
  }

  await caseRepo.delete(params.caseId);
  return { success: true };
}

/**
 * `GET reference-cases/:caseId/input` — l'auteur, un admin ou le manager.
 * Aucune action ne sert le résultat attendu : seule la révélation d'une
 * réclamation observée le rend (challenge-014, SPEC section 5).
 */
export async function referenceCaseInput({ challenge, user, params, access }: ActionContext) {
  const referenceCase = await caseRepo.findInputById(params.caseId);
  if (!referenceCase || referenceCase.validation_challenge_id !== challenge.uuid) {
    return fail(404, "Reference case not found");
  }

  const allowed = referenceCase.author_user_id === user.id || access.isAdmin() || (await access.isManager());
  if (!allowed) return fail(403, "Forbidden");

  // Purge de conservation passée (12 mois après la fermeture du challenge) :
  // les octets ont été vidés, on le dit plutôt que de servir un fichier vide.
  if (referenceCase.purged_at) {
    return fail(410, "Input no longer available (purged after the retention period)");
  }

  return new Response(new Uint8Array(referenceCase.input_bytes), {
    status: 200,
    headers: buildSafeFileHeaders(referenceCase.input_content_type, referenceCase.input_filename),
  });
}
