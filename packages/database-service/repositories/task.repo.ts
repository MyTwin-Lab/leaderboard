import { db } from "../db/drizzle";
import { tasks } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { toDomainTask, toDbTask } from "../db/mappers";
import type { Task } from "../domain/entities";
import { taskSchema } from "../domain/schemas_zod";

export class TaskRepository {
  async findAll(): Promise<Task[]> {
    const rows = await db.select().from(tasks);
    return rows.map(toDomainTask);
  }

  async findById(uuid: string): Promise<Task | null> {
    const [row] = await db.select().from(tasks).where(eq(tasks.uuid, uuid));
    return row ? toDomainTask(row) : null;
  }

  async findByChallenge(challengeId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.challenge_id, challengeId));
    return rows.map(toDomainTask);
  }

  /** Board personnel d'un contributeur sur un challenge. */
  async findPersonalTasks(challengeId: string, userId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks)
      .where(and(eq(tasks.challenge_id, challengeId), eq(tasks.user_id, userId)));
    return rows.map(toDomainTask);
  }

  /** Tâches template (user_id NULL) définies par l'admin/manager. */
  async findTemplateTasks(challengeId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks)
      .where(and(eq(tasks.challenge_id, challengeId), isNull(tasks.user_id)));
    return rows.map(toDomainTask);
  }

  async findByUser(userId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.user_id, userId));
    return rows.map(toDomainTask);
  }

  async findSubTasks(parentTaskId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.parent_task_id, parentTaskId));
    return rows.map(toDomainTask);
  }

  async create(entity: Omit<Task, "uuid" | "created_at">): Promise<Task> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [inserted] = await db.insert(tasks).values(toDbTask(validated)).returning();
    return toDomainTask(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<Task, "uuid" | "created_at">>): Promise<Task> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).partial().parse(entity);
    const dbData: Record<string, unknown> = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.status) dbData.status = validated.status;
    if (validated.parent_task_id !== undefined) dbData.parent_task_id = validated.parent_task_id || null;
    const [updated] = await db.update(tasks).set(dbData).where(eq(tasks.uuid, uuid)).returning();
    return toDomainTask(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.uuid, uuid));
  }
}
