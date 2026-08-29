import { db } from "../db/drizzle";
import { validation_case_claims } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { toDomainValidationCaseClaim, toDbValidationCaseClaim } from "../db/mappers";
import type { ValidationCaseClaim } from "../domain/entities";
import { validationCaseClaimSchema } from "../domain/schemas_zod";

/** Unique-violation code Postgres raises on a duplicate (reference_case, contribution) pair. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

/** Summary columns only — excludes response_bytes. */
const CLAIM_SUMMARY_COLUMNS = {
  uuid: validation_case_claims.uuid,
  reference_case_id: validation_case_claims.reference_case_id,
  contribution_id: validation_case_claims.contribution_id,
  validator_user_id: validation_case_claims.validator_user_id,
  response_content_type: validation_case_claims.response_content_type,
  response_status: validation_case_claims.response_status,
  observation: validation_case_claims.observation,
  observed_at: validation_case_claims.observed_at,
  revealed_at: validation_case_claims.revealed_at,
  created_at: validation_case_claims.created_at,
};

export class CaseClaimRepository {
  /**
   * Claim and test are one gesture — the caller always has the real response
   * bytes in hand before calling this. Returns null instead of throwing on a
   * duplicate — the unique index on (reference_case_id, contribution_id) is
   * the actual race guard; null means someone else claimed this case on this
   * target first, mirroring ValidationAttemptRepository.create's contract.
   */
  async create(
    entity: Omit<ValidationCaseClaim, "uuid" | "created_at" | "observation" | "observed_at" | "revealed_at">
  ): Promise<ValidationCaseClaim | null> {
    const validated = validationCaseClaimSchema
      .omit({ uuid: true, created_at: true, observation: true, observed_at: true, revealed_at: true })
      .parse(entity);
    try {
      const [row] = await db
        .insert(validation_case_claims)
        .values(toDbValidationCaseClaim(validated))
        .returning();
      return toDomainValidationCaseClaim(row);
    } catch (error: any) {
      const code = error?.code ?? error?.cause?.code;
      if (code === POSTGRES_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  /** Full row, including response_bytes — for the service layer and byte-serving routes. */
  async findById(uuid: string): Promise<ValidationCaseClaim | null> {
    const [row] = await db.select().from(validation_case_claims).where(eq(validation_case_claims.uuid, uuid));
    return row ? toDomainValidationCaseClaim(row) : null;
  }

  /** "My claims on this target" — drives the resume-in-progress UI (skip the pick list if one is unfinished). */
  async findByValidatorAndTarget(validatorUserId: string, contributionId: string): Promise<ValidationCaseClaim[]> {
    const rows = await db
      .select(CLAIM_SUMMARY_COLUMNS)
      .from(validation_case_claims)
      .where(
        and(
          eq(validation_case_claims.validator_user_id, validatorUserId),
          eq(validation_case_claims.contribution_id, contributionId)
        )
      )
      .orderBy(validation_case_claims.created_at);
    return rows.map(toDomainValidationCaseClaim);
  }

  /** Every claim ever made against a given case — used by the case-deletion guard (409 once any claim exists). */
  async findByReferenceCase(referenceCaseId: string): Promise<ValidationCaseClaim[]> {
    const rows = await db
      .select(CLAIM_SUMMARY_COLUMNS)
      .from(validation_case_claims)
      .where(eq(validation_case_claims.reference_case_id, referenceCaseId));
    return rows.map(toDomainValidationCaseClaim);
  }

  /**
   * WHERE observed_at IS NULL — returns null (no row matched/updated) if this
   * claim was already observed, so the service can turn that into
   * ObservationAlreadyRecordedError instead of silently overwriting a note.
   */
  async markObserved(uuid: string, observation: string): Promise<ValidationCaseClaim | null> {
    const [row] = await db
      .update(validation_case_claims)
      .set({ observation, observed_at: new Date() })
      .where(and(eq(validation_case_claims.uuid, uuid), isNull(validation_case_claims.observed_at)))
      .returning();
    return row ? toDomainValidationCaseClaim(row) : null;
  }

  /**
   * WHERE revealed_at IS NULL — idempotent by design: a second call (e.g. a
   * retried request) returns null rather than erroring, and the service
   * layer treats that as "already revealed" and just re-serves the same
   * expected output instead of failing.
   */
  async markRevealed(uuid: string): Promise<ValidationCaseClaim | null> {
    const [row] = await db
      .update(validation_case_claims)
      .set({ revealed_at: new Date() })
      .where(and(eq(validation_case_claims.uuid, uuid), isNull(validation_case_claims.revealed_at)))
      .returning();
    return row ? toDomainValidationCaseClaim(row) : null;
  }
}
