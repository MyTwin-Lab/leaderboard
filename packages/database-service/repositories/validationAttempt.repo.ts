import { db } from "../db/drizzle";
import { validation_attempts } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { toDomainValidationAttempt, toDbValidationAttempt } from "../db/mappers";
import type { ValidationAttempt } from "../domain/entities";
import { validationAttemptSchema } from "../domain/schemas_zod";

/** Unique-violation code Postgres raises on a duplicate (challenge, contribution, validator) triple. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Light-weight columns only — no file_bytes/response_bytes. Used everywhere
 * except findById/create, so quorum/majority reads (called on every single
 * vote cast) never drag every historical run's binary content across the wire.
 */
const ATTEMPT_SUMMARY_COLUMNS = {
  uuid: validation_attempts.uuid,
  validation_challenge_id: validation_attempts.validation_challenge_id,
  contribution_id: validation_attempts.contribution_id,
  validator_user_id: validation_attempts.validator_user_id,
  verdict: validation_attempts.verdict,
  description: validation_attempts.description,
  created_at: validation_attempts.created_at,
  // Light metadata only — excludes file_bytes/response_bytes (the actual blobs).
  file_filename: validation_attempts.file_filename,
  file_content_type: validation_attempts.file_content_type,
  response_content_type: validation_attempts.response_content_type,
  response_status: validation_attempts.response_status,
  purged_at: validation_attempts.purged_at,
};

export class ValidationAttemptRepository {
  async exists(
    validationChallengeId: string,
    contributionId: string,
    validatorUserId: string
  ): Promise<boolean> {
    const [row] = await db
      .select({ uuid: validation_attempts.uuid })
      .from(validation_attempts)
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          eq(validation_attempts.contribution_id, contributionId),
          eq(validation_attempts.validator_user_id, validatorUserId)
        )
      );
    return !!row;
  }

  /**
   * Every verdict cast on one target, oldest first — used to count votes
   * toward quorum, compute the majority, and pay out in the chronological
   * order the verdicts were cast.
   */
  async findByChallengeAndContribution(
    validationChallengeId: string,
    contributionId: string
  ): Promise<ValidationAttempt[]> {
    const rows = await db
      .select(ATTEMPT_SUMMARY_COLUMNS)
      .from(validation_attempts)
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          eq(validation_attempts.contribution_id, contributionId)
        )
      )
      .orderBy(validation_attempts.created_at);
    return rows.map(toDomainValidationAttempt);
  }

  async findByChallengeAndValidator(
    validationChallengeId: string,
    validatorUserId: string
  ): Promise<ValidationAttempt[]> {
    const rows = await db
      .select(ATTEMPT_SUMMARY_COLUMNS)
      .from(validation_attempts)
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          eq(validation_attempts.validator_user_id, validatorUserId)
        )
      );
    return rows.map(toDomainValidationAttempt);
  }

  /**
   * Every run cast on a validation challenge, across all targets — metadata
   * only (no blobs). Backs the manager-facing "Runs" list.
   */
  async findByChallenge(validationChallengeId: string): Promise<ValidationAttempt[]> {
    const rows = await db
      .select(ATTEMPT_SUMMARY_COLUMNS)
      .from(validation_attempts)
      .where(eq(validation_attempts.validation_challenge_id, validationChallengeId))
      .orderBy(validation_attempts.created_at);
    return rows.map(toDomainValidationAttempt);
  }

  /** Single full row, including file/response blobs — for the byte-serving routes only. */
  async findById(uuid: string): Promise<ValidationAttempt | null> {
    const [row] = await db.select().from(validation_attempts).where(eq(validation_attempts.uuid, uuid));
    return row ? toDomainValidationAttempt(row) : null;
  }

  /**
   * Returns null instead of throwing on a duplicate — the unique index is the
   * real dedupe guarantee under concurrent requests; a race here means someone
   * else's request already recorded (and will pay for) this exact attempt.
   */
  async create(
    entity: Omit<ValidationAttempt, "uuid" | "created_at" | "purged_at">
  ): Promise<ValidationAttempt | null> {
    const validated = validationAttemptSchema
      .omit({ uuid: true, created_at: true, purged_at: true })
      .parse(entity);
    try {
      const [row] = await db
        .insert(validation_attempts)
        .values(toDbValidationAttempt(validated))
        .returning();
      return toDomainValidationAttempt(row);
    } catch (error: any) {
      // drizzle-orm wraps the raw pg error in a DrizzleQueryError — the actual
      // code lives on .cause, not on the wrapper itself.
      const code = error?.code ?? error?.cause?.code;
      if (code === POSTGRES_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  /**
   * Archive-triggered purge: nulls the file/response blobs for every attempt
   * on this validation challenge, keeping verdict/description/metadata intact
   * for the CP audit trail. Idempotent via the purged_at guard.
   */
  async purgeContentForChallenge(validationChallengeId: string): Promise<void> {
    await db
      .update(validation_attempts)
      .set({
        file_bytes: null,
        file_filename: null,
        file_content_type: null,
        response_bytes: null,
        response_content_type: null,
        response_status: null,
        purged_at: new Date(),
      })
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          isNull(validation_attempts.purged_at)
        )
      );
  }
}
