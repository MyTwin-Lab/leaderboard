import { db } from "../db/drizzle";
import { task_assignees, users, tasks } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainTaskAssignee, toDbTaskAssignee, toDomainUser } from "../db/mappers";
import type { TaskAssignee, User } from "../domain/entities";
import { taskAssigneeSchema } from "../domain/schemas_zod";

export class TaskAssigneeRepository {
  async findAll(): Promise<TaskAssignee[]> {
    const rows = await db.select().from(task_assignees);
    return rows.map(toDomainTaskAssignee);
  }

  async findByTask(taskId: string): Promise<TaskAssignee[]> {
    const rows = await db.select().from(task_assignees).where(eq(task_assignees.task_id, taskId));
    return rows.map(toDomainTaskAssignee);
  }

  async findByUser(userId: string): Promise<TaskAssignee[]> {
    const rows = await db.select().from(task_assignees).where(eq(task_assignees.user_id, userId));
    return rows.map(toDomainTaskAssignee);
  }

  async findAssignees(taskId: string): Promise<User[]> {
    const results = await db
      .select({ user: users })
      .from(task_assignees)
      .leftJoin(users, eq(task_assignees.user_id, users.uuid))
      .where(eq(task_assignees.task_id, taskId));
    
    return results.filter(r => r.user !== null).map(r => toDomainUser(r.user!));
  }

  async assignUser(taskId: string, userId: string): Promise<TaskAssignee> {
    const entity = { task_id: taskId, user_id: userId };
    const validated = taskAssigneeSchema.omit({ assigned_at: true }).parse(entity);
    const dbData = toDbTaskAssignee(validated);
    const [inserted] = await db.insert(task_assignees).values(dbData).returning();
    return toDomainTaskAssignee(inserted);
  }

  async unassignUser(taskId: string, userId: string): Promise<void> {
    await db.delete(task_assignees)
      .where(and(eq(task_assignees.task_id, taskId), eq(task_assignees.user_id, userId)));
  }

  async isUserAssigned(taskId: string, userId: string): Promise<boolean> {
    const [row] = await db.select().from(task_assignees)
      .where(and(eq(task_assignees.task_id, taskId), eq(task_assignees.user_id, userId)));
    return !!row;
  }

  async countAssignees(taskId: string): Promise<number> {
    const rows = await db.select().from(task_assignees).where(eq(task_assignees.task_id, taskId));
    return rows.length;
  }
}
