import { db } from "../db/drizzle";
import { evaluation_run_contributions, contributions, users } from "../db/drizzle";
import { eq, and, inArray, sql } from "drizzle-orm";
import { 
  toDomainEvaluationRunContribution, 
  toDbEvaluationRunContribution,
  toDomainContribution,
  toDomainUser,
} from "../db/mappers";
import type { 
  EvaluationRunContribution, 
  EvaluationRunContributionStatus,
  Contribution,
  User,
} from "../domain/entities";
import { evaluationRunContributionSchema } from "../domain/schemas_zod";

export interface ListRunContributionsOptions {
  status?: EvaluationRunContributionStatus[];
  page?: number;
  pageSize?: number;
}

export interface RunContributionWithDetails {
  runContribution: EvaluationRunContribution;
  contribution: Contribution | null;
  user: User | null;
}

export class EvaluationRunContributionsRepository {
  async findByRun(runId: string, options: ListRunContributionsOptions = {}): Promise<EvaluationRunContribution[]> {
    const { status, page = 1, pageSize = 50 } = options;
    
    const conditions = [eq(evaluation_run_contributions.runId, runId)];
    if (status && status.length > 0) {
      conditions.push(inArray(evaluation_run_contributions.status, status));
    }
    
    const rows = await db
      .select()
      .from(evaluation_run_contributions)
      .where(and(...conditions))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    
    return rows.map(toDomainEvaluationRunContribution);
  }

  async findByRunWithDetails(runId: string, options: ListRunContributionsOptions = {}): Promise<RunContributionWithDetails[]> {
    const { status, page = 1, pageSize = 50 } = options;
    
    const conditions = [eq(evaluation_run_contributions.runId, runId)];
    if (status && status.length > 0) {
      conditions.push(inArray(evaluation_run_contributions.status, status));
    }
    
    const rows = await db
      .select({
        runContribution: evaluation_run_contributions,
        contribution: contributions,
        user: users,
      })
      .from(evaluation_run_contributions)
      .leftJoin(contributions, eq(contributions.uuid, evaluation_run_contributions.contributionId))
      .leftJoin(users, eq(users.uuid, contributions.user_id))
      .where(and(...conditions))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    
    return rows.map(row => ({
      runContribution: toDomainEvaluationRunContribution(row.runContribution),
      contribution: row.contribution ? toDomainContribution(row.contribution) : null,
      user: row.user ? toDomainUser(row.user) : null,
    }));
  }

  async findById(uuid: string): Promise<EvaluationRunContribution | null> {
    const [row] = await db
      .select()
      .from(evaluation_run_contributions)
      .where(eq(evaluation_run_contributions.uuid, uuid));
    return row ? toDomainEvaluationRunContribution(row) : null;
  }

  async create(entity: Omit<EvaluationRunContribution, "uuid" | "created_at">): Promise<EvaluationRunContribution> {
    const validated = evaluationRunContributionSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const dbData = toDbEvaluationRunContribution(validated as Omit<EvaluationRunContribution, "uuid" | "created_at">);
    const [inserted] = await db.insert(evaluation_run_contributions).values(dbData).returning();
    return toDomainEvaluationRunContribution(inserted);
  }

  async bulkInsert(entities: Omit<EvaluationRunContribution, "uuid" | "created_at">[]): Promise<EvaluationRunContribution[]> {
    if (entities.length === 0) return [];
    
    const dbData = entities.map(entity => {
      const validated = evaluationRunContributionSchema.omit({ uuid: true, created_at: true }).parse(entity);
      return toDbEvaluationRunContribution(validated as Omit<EvaluationRunContribution, "uuid" | "created_at">);
    });
    
    const inserted = await db.insert(evaluation_run_contributions).values(dbData).returning();
    return inserted.map(toDomainEvaluationRunContribution);
  }

  async updateStatus(uuid: string, status: EvaluationRunContributionStatus, notes?: EvaluationRunContribution['notes']): Promise<EvaluationRunContribution> {
    const dbData: Record<string, unknown> = { status };
    if (notes !== undefined) dbData.notes = notes;
    
    const [updated] = await db
      .update(evaluation_run_contributions)
      .set(dbData)
      .where(eq(evaluation_run_contributions.uuid, uuid))
      .returning();
    return toDomainEvaluationRunContribution(updated);
  }

  async countByStatus(runId: string): Promise<Record<EvaluationRunContributionStatus, number>> {
    const rows = await db
      .select()
      .from(evaluation_run_contributions)
      .where(eq(evaluation_run_contributions.runId, runId));
    
    const counts: Record<EvaluationRunContributionStatus, number> = {
      identified: 0,
      merged: 0,
      evaluated: 0,
      skipped: 0,
    };
    
    for (const row of rows) {
      const status = row.status as EvaluationRunContributionStatus;
      counts[status] = (counts[status] || 0) + 1;
    }
    
    return counts;
  }

  async countByRun(runId: string): Promise<number> {
    const rows = await db
      .select()
      .from(evaluation_run_contributions)
      .where(eq(evaluation_run_contributions.runId, runId));
    return rows.length;
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(evaluation_run_contributions).where(eq(evaluation_run_contributions.uuid, uuid));
  }

  async deleteByRun(runId: string): Promise<void> {
    await db.delete(evaluation_run_contributions).where(eq(evaluation_run_contributions.runId, runId));
  }
}
