import { db } from "../db/drizzle";
import { validation_reference_cases, validation_case_claims } from "../db/drizzle";
import { eq, and, ne, isNull, count } from "drizzle-orm";
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

  /** Only input bytes — used at claim time. Never selects expected_output_bytes. */
  async findInputById(uuid: string): Promise<Pick<ValidationReferenceCase, "uuid" | "validation_challenge_id" | "author_user_id" | "input_bytes" | "input_filename" | "input_content_type"> | null> {
    const [row] = await db
      .select({
        uuid: validation_reference_cases.uuid,
        validation_challenge_id: validation_reference_cases.validation_challenge_id,
        author_user_id: validation_reference_cases.author_user_id,
        input_bytes: validation_reference_cases.input_bytes,
        input_filename: validation_reference_cases.input_filename,
        input_content_type: validation_reference_cases.input_content_type,
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
   * Cases on this challenge, not authored by excludeAuthorId, not already
   * claimed on this specific target — the "pick a case" list for a
   * medical_pro opening a target. The same case can still appear here for a
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
