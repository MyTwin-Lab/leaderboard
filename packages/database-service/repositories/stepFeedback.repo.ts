import { db } from "../db/drizzle";
import { validation_step_feedbacks } from "../db/drizzle";
import { eq, inArray } from "drizzle-orm";
import { toDomainValidationStepFeedback } from "../db/mappers";
import type { ValidationStepFeedback } from "../domain/entities";
import { validationStepFeedbackSchema } from "../domain/schemas_zod";

export class StepFeedbackRepository {
  async findByRun(runId: string): Promise<ValidationStepFeedback[]> {
    const rows = await db
      .select()
      .from(validation_step_feedbacks)
      .where(eq(validation_step_feedbacks.run_id, runId));
    return rows.map(toDomainValidationStepFeedback);
  }

  /** Une seule requête pour la supervision, qui affiche toutes les runs du challenge d'un coup. */
  async findByRuns(runIds: string[]): Promise<ValidationStepFeedback[]> {
    if (runIds.length === 0) return [];
    const rows = await db
      .select()
      .from(validation_step_feedbacks)
      .where(inArray(validation_step_feedbacks.run_id, runIds));
    return rows.map(toDomainValidationStepFeedback);
  }

  /**
   * Upsert sur (run_id, step_id) : le validateur peut revenir sur une étape
   * tant que la walkthrough est brouillon, et chaque passage réécrit la même
   * ligne. Le PUT porte l'état complet du panneau d'étape — un champ absent
   * vaut vide, jamais « garde l'ancienne valeur » — donc un seul statement
   * suffit, sans lecture préalable.
   */
  async upsert(entity: Omit<ValidationStepFeedback, "uuid" | "created_at">): Promise<ValidationStepFeedback> {
    const validated = validationStepFeedbackSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(validation_step_feedbacks)
      .values({
        run_id: validated.run_id,
        step_id: validated.step_id,
        result: validated.result,
        comment: validated.comment ?? null,
        medical_comment: validated.medical_comment ?? null,
      })
      .onConflictDoUpdate({
        target: [validation_step_feedbacks.run_id, validation_step_feedbacks.step_id],
        set: {
          result: validated.result,
          comment: validated.comment ?? null,
          medical_comment: validated.medical_comment ?? null,
        },
      })
      .returning();
    return toDomainValidationStepFeedback(row);
  }
}
