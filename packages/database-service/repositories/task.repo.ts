import { db } from "../db/drizzle";
import { tasks, task_assignees, users } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainTask, toDbTask, toDomainUser } from "../db/mappers";
import type { Task, User } from "../domain/entities";
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

  async findByUser(userId: string): Promise<Task[]> {
    const results = await db
      .select({ task: tasks })
      .from(task_assignees)
      .leftJoin(tasks, eq(task_assignees.task_id, tasks.uuid))
      .where(eq(task_assignees.user_id, userId));
    
    return results.filter(r => r.task !== null).map(r => toDomainTask(r.task!));
  }

  async findSubTasks(parentTaskId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.parent_task_id, parentTaskId));
    return rows.map(toDomainTask);
  }

  async findAssignees(taskId: string): Promise<User[]> {
    const results = await db
      .select({ user: users })
      .from(task_assignees)
      .leftJoin(users, eq(task_assignees.user_id, users.uuid))
      .where(eq(task_assignees.task_id, taskId));
    
    return results.filter(r => r.user !== null).map(r => toDomainUser(r.user!));
  }

  async create(entity: Omit<Task, "uuid" | "created_at">): Promise<Task> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const dbData = toDbTask(validated);
    const [inserted] = await db.insert(tasks).values(dbData).returning();
    return toDomainTask(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<Task, "uuid" | "created_at">>): Promise<Task> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.challenge_id !== undefined) dbData.challenge_id = validated.challenge_id || null;
    if (validated.parent_task_id !== undefined) dbData.parent_task_id = validated.parent_task_id || null;
    if (validated.title) dbData.title = validated.title;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.type) dbData.type = validated.type;

    const [updated] = await db.update(tasks)
      .set(dbData)
      .where(eq(tasks.uuid, uuid))
      .returning();
    return toDomainTask(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.uuid, uuid));
  }
}
