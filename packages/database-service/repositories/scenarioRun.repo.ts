import { db } from "../db/drizzle";
import { validation_scenario_runs } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { toDomainValidationScenarioRun, toDbValidationScenarioRun } from "../db/mappers";
import type { ValidationScenarioRun } from "../domain/entities";
import { validationScenarioRunSchema } from "../domain/schemas_zod";

/** Code d'unicité que Postgres lève sur un doublon (challenge, contribution, validateur). */
const POSTGRES_UNIQUE_VIOLATION = "23505";

export class ScenarioRunRepository {
  /** Toutes les runs du challenge, plus ancienne d'abord — alimente la supervision et le gel du scénario. */
  async findByChallenge(validationChallengeId: string): Promise<ValidationScenarioRun[]> {
    const rows = await db
      .select()
      .from(validation_scenario_runs)
      .where(eq(validation_scenario_runs.validation_challenge_id, validationChallengeId))
      .orderBy(validation_scenario_runs.created_at);
    return rows.map(toDomainValidationScenarioRun);
  }

  async findById(uuid: string): Promise<ValidationScenarioRun | null> {
    const [row] = await db.select().from(validation_scenario_runs).where(eq(validation_scenario_runs.uuid, uuid));
    return row ? toDomainValidationScenarioRun(row) : null;
  }

  async findByChallengeAndValidator(
    validationChallengeId: string,
    validatorUserId: string
  ): Promise<ValidationScenarioRun[]> {
    const rows = await db
      .select()
      .from(validation_scenario_runs)
      .where(
        and(
          eq(validation_scenario_runs.validation_challenge_id, validationChallengeId),
          eq(validation_scenario_runs.validator_user_id, validatorUserId)
        )
      );
    return rows.map(toDomainValidationScenarioRun);
  }

  async findOne(
    validationChallengeId: string,
    contributionId: string,
    validatorUserId: string
  ): Promise<ValidationScenarioRun | null> {
    const [row] = await db
      .select()
      .from(validation_scenario_runs)
      .where(
        and(
          eq(validation_scenario_runs.validation_challenge_id, validationChallengeId),
          eq(validation_scenario_runs.contribution_id, contributionId),
          eq(validation_scenario_runs.validator_user_id, validatorUserId)
        )
      );
    return row ? toDomainValidationScenarioRun(row) : null;
  }

  /**
   * Renvoie null au lieu de lever sur un doublon — l'index unique est la
   * vraie garantie « une walkthrough par (validateur, application) » sous
   * requêtes concurrentes. Même contrat que ValidationAttemptRepository.create.
   */
  async create(
    entity: Omit<ValidationScenarioRun, "uuid" | "created_at" | "global_feedback" | "completed_at">
  ): Promise<ValidationScenarioRun | null> {
    const validated = validationScenarioRunSchema
      .omit({ uuid: true, created_at: true, global_feedback: true, completed_at: true })
      .parse(entity);
    try {
      const [row] = await db
        .insert(validation_scenario_runs)
        .values(toDbValidationScenarioRun(validated))
        .returning();
      return toDomainValidationScenarioRun(row);
    } catch (error: any) {
      // drizzle-orm emballe l'erreur pg dans DrizzleQueryError — le code vit
      // sur .cause, pas sur le wrapper.
      const code = error?.code ?? error?.cause?.code;
      if (code === POSTGRES_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  /**
   * Complète la walkthrough — mais seulement si elle est encore brouillon.
   * Renvoie null si une requête concurrente l'a complétée d'abord : c'est le
   * WHERE qui empêche de payer deux fois, pas un contrôle applicatif.
   */
  async complete(uuid: string, globalFeedback: string): Promise<ValidationScenarioRun | null> {
    const [row] = await db
      .update(validation_scenario_runs)
      .set({ global_feedback: globalFeedback, completed_at: new Date() })
      .where(and(eq(validation_scenario_runs.uuid, uuid), isNull(validation_scenario_runs.completed_at)))
      .returning();
    return row ? toDomainValidationScenarioRun(row) : null;
  }
}
