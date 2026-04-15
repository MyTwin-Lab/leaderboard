import { db } from "../db/drizzle";
import { evaluation_runs, challenges } from "../db/drizzle";
import { eq, desc, and, gte, lte, inArray } from "drizzle-orm";
import { toDomainEvaluationRun, toDbEvaluationRun, toDomainChallenge } from "../db/mappers";
import type { EvaluationRun, EvaluationRunStatus, Challenge } from "../domain/entities";
import { evaluationRunSchema } from "../domain/schemas_zod";

export interface ListEvaluationRunsOptions {
  challengeId?: string;
  status?: EvaluationRunStatus[];
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export class EvaluationRunsRepository {
  async findAll(options: ListEvaluationRunsOptions = {}): Promise<EvaluationRun[]> {
    const { challengeId, status, from, to, page = 1, pageSize = 20 } = options;
    
    let query = db.select().from(evaluation_runs).$dynamic();
    
    const conditions = [];
    if (challengeId) {
      conditions.push(eq(evaluation_runs.challengeId, challengeId));
    }
    if (status && status.length > 0) {
      conditions.push(inArray(evaluation_runs.status, status));
    }
    if (from) {
      conditions.push(gte(evaluation_runs.startedAt, from));
    }
    if (to) {
      conditions.push(lte(evaluation_runs.startedAt, to));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const rows = await query
      .orderBy(desc(evaluation_runs.startedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    
    return rows.map(toDomainEvaluationRun);
  }

  async findById(uuid: string): Promise<EvaluationRun | null> {
    const [row] = await db
      .select()
      .from(evaluation_runs)
      .where(eq(evaluation_runs.uuid, uuid));
    return row ? toDomainEvaluationRun(row) : null;
  }

  async findByChallenge(challengeId: string): Promise<EvaluationRun[]> {
    const rows = await db
      .select()
      .from(evaluation_runs)
      .where(eq(evaluation_runs.challengeId, challengeId))
      .orderBy(desc(evaluation_runs.startedAt));
    return rows.map(toDomainEvaluationRun);
  }

  async findWithChallenge(uuid: string): Promise<{ run: EvaluationRun; challenge: Challenge | null } | null> {
    const [result] = await db
      .select({
        run: evaluation_runs,
        challenge: challenges,
      })
      .from(evaluation_runs)
      .leftJoin(challenges, eq(challenges.uuid, evaluation_runs.challengeId))
      .where(eq(evaluation_runs.uuid, uuid));

    if (!result) return null;

    return {
      run: toDomainEvaluationRun(result.run),
      challenge: result.challenge ? toDomainChallenge(result.challenge) : null,
    };
  }

  async create(entity: Omit<EvaluationRun, "uuid">): Promise<EvaluationRun> {
    const validated = evaluationRunSchema.omit({ uuid: true }).parse(entity);
    const dbData = toDbEvaluationRun(validated as Omit<EvaluationRun, "uuid">);
    const [inserted] = await db.insert(evaluation_runs).values(dbData).returning();
    return toDomainEvaluationRun(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<EvaluationRun, "uuid">>): Promise<EvaluationRun> {
    const dbData: Record<string, unknown> = {};
    
    if (entity.status !== undefined) dbData.status = entity.status;
    if (entity.started_at !== undefined) dbData.startedAt = entity.started_at;
    if (entity.finished_at !== undefined) dbData.finishedAt = entity.finished_at;
    if (entity.error_code !== undefined) dbData.errorCode = entity.error_code;
    if (entity.error_message !== undefined) dbData.errorMessage = entity.error_message;
    if (entity.meta !== undefined) dbData.meta = entity.meta;
    if (entity.window_start !== undefined) dbData.windowStart = entity.window_start;
    if (entity.window_end !== undefined) dbData.windowEnd = entity.window_end;

    const [updated] = await db
      .update(evaluation_runs)
      .set(dbData)
      .where(eq(evaluation_runs.uuid, uuid))
      .returning();
    return toDomainEvaluationRun(updated);
  }

  async markSucceeded(uuid: string, meta?: EvaluationRun['meta']): Promise<EvaluationRun> {
    return this.update(uuid, {
      status: 'succeeded',
      finished_at: new Date(),
      meta,
    });
  }

  async markFailed(uuid: string, errorCode: string, errorMessage: string): Promise<EvaluationRun> {
    return this.update(uuid, {
      status: 'failed',
      finished_at: new Date(),
      error_code: errorCode,
      error_message: errorMessage.slice(0, 1000),
    });
  }

  async countByStatus(challengeId?: string): Promise<Record<EvaluationRunStatus, number>> {
    const conditions = challengeId ? eq(evaluation_runs.challengeId, challengeId) : undefined;
    
    const rows = await db
      .select()
      .from(evaluation_runs)
      .where(conditions);
    
    const counts: Record<EvaluationRunStatus, number> = {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      canceled: 0,
    };
    
    for (const row of rows) {
      const status = row.status as EvaluationRunStatus;
      counts[status] = (counts[status] || 0) + 1;
    }
    
    return counts;
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(evaluation_runs).where(eq(evaluation_runs.uuid, uuid));
  }
}
