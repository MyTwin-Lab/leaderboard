import { db } from "../db/drizzle";
import { validation_targets } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainValidationTarget, toDbValidationTarget } from "../db/mappers";
import type { ValidationTarget } from "../domain/entities";
import { validationTargetSchema } from "../domain/schemas_zod";

export class ValidationTargetRepository {
  async findByChallenge(validationChallengeId: string): Promise<ValidationTarget[]> {
    const rows = await db
      .select()
      .from(validation_targets)
      .where(eq(validation_targets.validation_challenge_id, validationChallengeId))
      .orderBy(validation_targets.position, validation_targets.created_at);
    return rows.map(toDomainValidationTarget);
  }

  async findById(uuid: string): Promise<ValidationTarget | null> {
    const [row] = await db.select().from(validation_targets).where(eq(validation_targets.uuid, uuid));
    return row ? toDomainValidationTarget(row) : null;
  }

  async findByChallengeAndContribution(
    validationChallengeId: string,
    contributionId: string
  ): Promise<ValidationTarget | null> {
    const [row] = await db
      .select()
      .from(validation_targets)
      .where(
        and(
          eq(validation_targets.validation_challenge_id, validationChallengeId),
          eq(validation_targets.contribution_id, contributionId)
        )
      );
    return row ? toDomainValidationTarget(row) : null;
  }

  async create(entity: Omit<ValidationTarget, "uuid" | "created_at">): Promise<ValidationTarget> {
    const validated = validationTargetSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(validation_targets)
      .values(toDbValidationTarget(validated))
      .returning();
    return toDomainValidationTarget(row);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(validation_targets).where(eq(validation_targets.uuid, uuid));
  }
}
