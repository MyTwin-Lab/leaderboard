import { db } from "../db/drizzle";
import { validation_case_claims, validation_reference_cases } from "../db/drizzle";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { closedValidationChallengeIds } from "./referenceCase.repo";
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

  /**
   * État de purge d'un claim et de son cas de référence, sans charger aucun
   * blob — pour que les routes d'octets répondent 410 après la purge de
   * conservation. Lu en colonnes brutes, hors mapper, pour ne pas dépendre de
   * la forme de l'entité. `null` si le claim n'existe pas.
   */
  async findPurgeState(uuid: string): Promise<{
    validator_user_id: string;
    claim_purged_at: Date | null;
    case_purged_at: Date | null;
  } | null> {
    const [row] = await db
      .select({
        validator_user_id: validation_case_claims.validator_user_id,
        claim_purged_at: validation_case_claims.purged_at,
        case_purged_at: validation_reference_cases.purged_at,
      })
      .from(validation_case_claims)
      .innerJoin(
        validation_reference_cases,
        eq(validation_reference_cases.uuid, validation_case_claims.reference_case_id)
      )
      .where(eq(validation_case_claims.uuid, uuid));
    return row ?? null;
  }

  /**
   * Purge de conservation, pendant de
   * `ReferenceCaseRepository.purgeBytesForChallengesClosedBefore` : vide
   * `response_bytes` (`''::bytea`, colonne NOT NULL) et pose `purged_at` sur
   * les claims des challenges de validation fermés avant `closedBefore`.
   *
   * L'observation, le statut HTTP et les dates restent : la trace d'audit du
   * verdict tient sans la pièce. Idempotente par la garde `purged_at IS NULL`.
   */
  async purgeBytesForChallengesClosedBefore(closedBefore: Date): Promise<number> {
    const casesOfClosedChallenges = db
      .select({ uuid: validation_reference_cases.uuid })
      .from(validation_reference_cases)
      .where(
        inArray(validation_reference_cases.validation_challenge_id, closedValidationChallengeIds(closedBefore))
      );

    const purged = await db
      .update(validation_case_claims)
      .set({ response_bytes: sql`''::bytea`, purged_at: new Date() })
      .where(
        and(
          isNull(validation_case_claims.purged_at),
          inArray(validation_case_claims.reference_case_id, casesOfClosedChallenges)
        )
      )
      .returning({ uuid: validation_case_claims.uuid });
    return purged.length;
  }
}
