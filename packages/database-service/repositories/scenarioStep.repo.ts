import { db } from "../db/drizzle";
import { validation_scenario_steps } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainValidationScenarioStep, toDbValidationScenarioStep } from "../db/mappers";
import type { ValidationScenarioStep } from "../domain/entities";
import { validationScenarioStepSchema } from "../domain/schemas_zod";

export class ScenarioStepRepository {
  /** Le scénario dans l'ordre. `created_at` départage deux étapes de même position. */
  async findByChallenge(validationChallengeId: string): Promise<ValidationScenarioStep[]> {
    const rows = await db
      .select()
      .from(validation_scenario_steps)
      .where(eq(validation_scenario_steps.validation_challenge_id, validationChallengeId))
      .orderBy(validation_scenario_steps.position, validation_scenario_steps.created_at);
    return rows.map(toDomainValidationScenarioStep);
  }

  async findById(uuid: string): Promise<ValidationScenarioStep | null> {
    const [row] = await db.select().from(validation_scenario_steps).where(eq(validation_scenario_steps.uuid, uuid));
    return row ? toDomainValidationScenarioStep(row) : null;
  }

  async create(entity: Omit<ValidationScenarioStep, "uuid" | "created_at">): Promise<ValidationScenarioStep> {
    const validated = validationScenarioStepSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(validation_scenario_steps)
      .values(toDbValidationScenarioStep(validated))
      .returning();
    return toDomainValidationScenarioStep(row);
  }

  async update(
    uuid: string,
    patch: Partial<Pick<ValidationScenarioStep, "title" | "instructions" | "position">>
  ): Promise<ValidationScenarioStep> {
    const [row] = await db
      .update(validation_scenario_steps)
      .set(patch)
      .where(eq(validation_scenario_steps.uuid, uuid))
      .returning();
    return toDomainValidationScenarioStep(row);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(validation_scenario_steps).where(eq(validation_scenario_steps.uuid, uuid));
  }
}
