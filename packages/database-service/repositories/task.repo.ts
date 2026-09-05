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

  /**
   * Met à jour une tâche, éventuellement sous condition de son statut actuel.
   *
   * `expectedStatus` transforme l'écriture aveugle en écriture conditionnelle :
   * la clause `AND status = ?` fait échouer l'UPDATE si quelqu'un a bougé la
   * carte entre-temps, et la méthode renvoie `null`. C'est ce qui empêche, sur
   * un board de groupe, qu'un membre au vieil écran écrase le déplacement d'un
   * autre sans que personne ne le voie.
   *
   * Le statut sert de garde plutôt qu'un numéro de version : `tasks` n'a pas de
   * colonne `updated_at`, et c'est de toute façon le statut qui est la donnée
   * disputée.
   */
  async update(
    uuid: string,
    entity: Partial<Omit<Task, "uuid" | "created_at">>,
    opts?: { expectedStatus?: Task["status"] }
  ): Promise<Task | null> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).partial().parse(entity);
    const dbData: Record<string, unknown> = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.status) dbData.status = validated.status;
    if (validated.parent_task_id !== undefined) dbData.parent_task_id = validated.parent_task_id || null;

    const where = opts?.expectedStatus
      ? and(eq(tasks.uuid, uuid), eq(tasks.status, opts.expectedStatus))
      : eq(tasks.uuid, uuid);

    const [updated] = await db.update(tasks).set(dbData).where(where).returning();
    return updated ? toDomainTask(updated) : null;
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.uuid, uuid));
  }
}
