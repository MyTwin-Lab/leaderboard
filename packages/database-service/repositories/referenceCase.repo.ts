import { db } from "../db/drizzle";
import { validation_reference_cases, validation_case_claims, challenges } from "../db/drizzle";
import { eq, and, ne, isNull, isNotNull, count, inArray, lt, sql } from "drizzle-orm";
import { toDomainValidationReferenceCase, toDbValidationReferenceCase } from "../db/mappers";
import type { ValidationReferenceCase } from "../domain/entities";
import { validationReferenceCaseSchema } from "../domain/schemas_zod";

/**
 * Summary columns only — no input_bytes/expected_output_bytes. Used for every
 * list/count read; expected_output_bytes in particular must never leave this
 * file except through findExpectedOutputById, the one enforcement point for
 * "never leaked before reveal" (see challenge-014 SPEC section 5).
 */
const CASE_SUMMARY_COLUMNS = {
  uuid: validation_reference_cases.uuid,
  validation_challenge_id: validation_reference_cases.validation_challenge_id,
  author_user_id: validation_reference_cases.author_user_id,
  input_filename: validation_reference_cases.input_filename,
  input_content_type: validation_reference_cases.input_content_type,
  created_at: validation_reference_cases.created_at,
};

export class ReferenceCaseRepository {
  async findByChallenge(validationChallengeId: string): Promise<ValidationReferenceCase[]> {
    const rows = await db
      .select(CASE_SUMMARY_COLUMNS)
      .from(validation_reference_cases)
      .where(eq(validation_reference_cases.validation_challenge_id, validationChallengeId))
      .orderBy(validation_reference_cases.created_at);
    return rows.map(toDomainValidationReferenceCase);
  }

  async findByAuthor(validationChallengeId: string, authorUserId: string): Promise<ValidationReferenceCase[]> {
    const rows = await db
      .select(CASE_SUMMARY_COLUMNS)
      .from(validation_reference_cases)
      .where(
        and(
          eq(validation_reference_cases.validation_challenge_id, validationChallengeId),
          eq(validation_reference_cases.author_user_id, authorUserId)
        )
      )
      .orderBy(validation_reference_cases.created_at);
    return rows.map(toDomainValidationReferenceCase);
  }

  async countByChallenge(validationChallengeId: string): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(validation_reference_cases)
      .where(eq(validation_reference_cases.validation_challenge_id, validationChallengeId));
    return row?.count ?? 0;
  }

  /**
   * Only input bytes — used at claim time. Never selects expected_output_bytes.
   * `purged_at` rides along so the byte-serving routes can answer 410 once the
   * retention purge has emptied the blobs, instead of serving zero bytes.
   */
  async findInputById(uuid: string): Promise<(Pick<ValidationReferenceCase, "uuid" | "validation_challenge_id" | "author_user_id" | "input_bytes" | "input_filename" | "input_content_type"> & { purged_at: Date | null }) | null> {
    const [row] = await db
      .select({
        uuid: validation_reference_cases.uuid,
        validation_challenge_id: validation_reference_cases.validation_challenge_id,
        author_user_id: validation_reference_cases.author_user_id,
        input_bytes: validation_reference_cases.input_bytes,
        input_filename: validation_reference_cases.input_filename,
        input_content_type: validation_reference_cases.input_content_type,
        purged_at: validation_reference_cases.purged_at,
      })
      .from(validation_reference_cases)
      .where(eq(validation_reference_cases.uuid, uuid));
    return row ?? null;
  }

  /**
   * Only expected-output bytes — used exclusively by
   * ReferenceCaseService.revealExpectedOutput, after the observed_at check
   * has already passed. The single enforcement point for "never leaked
   * before reveal" — no other method in this repository selects this column.
   */
  async findExpectedOutputById(uuid: string): Promise<Pick<ValidationReferenceCase, "expected_output_bytes" | "expected_output_filename" | "expected_output_content_type"> | null> {
    const [row] = await db
      .select({
        expected_output_bytes: validation_reference_cases.expected_output_bytes,
        expected_output_filename: validation_reference_cases.expected_output_filename,
        expected_output_content_type: validation_reference_cases.expected_output_content_type,
      })
      .from(validation_reference_cases)
      .where(eq(validation_reference_cases.uuid, uuid));
    return row ?? null;
  }

  /**
   * Vrai si la purge de conservation est passée sur ce cas — sans charger
   * aucun blob. `false` pour un cas inexistant : l'appelant garde son propre
   * 404, cette méthode ne répond qu'à « 410 ou pas ».
   */
  async isPurged(uuid: string): Promise<boolean> {
    const [row] = await db
      .select({ purged_at: validation_reference_cases.purged_at })
      .from(validation_reference_cases)
      .where(eq(validation_reference_cases.uuid, uuid));
    return !!row?.purged_at;
  }

  async create(entity: Omit<ValidationReferenceCase, "uuid" | "created_at">): Promise<ValidationReferenceCase> {
    const validated = validationReferenceCaseSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(validation_reference_cases)
      .values(toDbValidationReferenceCase(validated))
      .returning();
    return toDomainValidationReferenceCase(row);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(validation_reference_cases).where(eq(validation_reference_cases.uuid, uuid));
  }

  /**
   * Purge de conservation (politique de confidentialité §4.2 : pièces des
   * challenges de validation supprimées 12 mois après la fin du challenge).
   *
   * Vide `input_bytes` et `expected_output_bytes` (`''::bytea`, les colonnes
   * sont NOT NULL) et pose `purged_at`, sur les cas des challenges de
   * validation fermés avant `closedBefore`. Noms de fichiers, types et
   * métadonnées restent : ils ne contiennent pas la pièce elle-même, et les
   * verdicts et les CP, qui vivent ailleurs, ne sont pas touchés.
   *
   * Idempotente par la garde `purged_at IS NULL`. Renvoie le nombre de cas purgés.
   */
  async purgeBytesForChallengesClosedBefore(closedBefore: Date): Promise<number> {
    const purged = await db
      .update(validation_reference_cases)
      .set({
        input_bytes: sql`''::bytea`,
        expected_output_bytes: sql`''::bytea`,
        purged_at: new Date(),
      })
      .where(
        and(
          isNull(validation_reference_cases.purged_at),
          inArray(validation_reference_cases.validation_challenge_id, closedValidationChallengeIds(closedBefore))
        )
      )
      .returning({ uuid: validation_reference_cases.uuid });
    return purged.length;
  }

  /**
   * Cases on this challenge, not authored by excludeAuthorId, not already
   * claimed on this specific target — the "pick a case" list for a
   * qualified reviewer opening a target. The same case can still appear here for a
   * *different* target even after being claimed on this one, since claim
   * exclusivity is per-target, not per-case.
   */
  async findClaimable(
    validationChallengeId: string,
    contributionId: string,
    excludeAuthorId: string
  ): Promise<ValidationReferenceCase[]> {
    const rows = await db
      .select(CASE_SUMMARY_COLUMNS)
      .from(validation_reference_cases)
      .leftJoin(
        validation_case_claims,
        and(
          eq(validation_case_claims.reference_case_id, validation_reference_cases.uuid),
          eq(validation_case_claims.contribution_id, contributionId)
        )
      )
      .where(
        and(
          eq(validation_reference_cases.validation_challenge_id, validationChallengeId),
          ne(validation_reference_cases.author_user_id, excludeAuthorId),
          isNull(validation_case_claims.uuid)
        )
      )
      .orderBy(validation_reference_cases.created_at);
    return rows.map(toDomainValidationReferenceCase);
  }
}

/**
 * Sous-requête : les challenges de validation fermés avant `closedBefore`.
 *
 * `closed_at` n'est posé qu'au passage à 'completed' et effacé si le challenge
 * repart (voir `closedAtPatch`) : le filtre sur `closed_at` suffit donc à
 * exclure un challenge rouvert. Partagée avec `CaseClaimRepository`, pour que
 * les deux purges portent exactement sur le même périmètre.
 */
export function closedValidationChallengeIds(closedBefore: Date) {
  return db
    .select({ uuid: challenges.uuid })
    .from(challenges)
    .where(
      and(
        // Seuls les flows de validation ont un challenge parent.
        isNotNull(challenges.source_challenge_id),
        isNotNull(challenges.closed_at),
        lt(challenges.closed_at, closedBefore)
      )
    );
}
