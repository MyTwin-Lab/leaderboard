import { db } from "../db/drizzle";
import { validation_attempts } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainValidationAttempt, toDbValidationAttempt } from "../db/mappers";
import type { ValidationAttempt } from "../domain/entities";
import { validationAttemptSchema } from "../domain/schemas_zod";

/** Unique-violation code Postgres raises on a duplicate (challenge, contribution, validator) triple. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

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
      .select()
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
      .select()
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
   * Returns null instead of throwing on a duplicate — the unique index is the
   * real dedupe guarantee under concurrent requests; a race here means someone
   * else's request already recorded (and will pay for) this exact attempt.
   */
  async create(entity: Omit<ValidationAttempt, "uuid" | "created_at">): Promise<ValidationAttempt | null> {
    const validated = validationAttemptSchema.omit({ uuid: true, created_at: true }).parse(entity);
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
}
