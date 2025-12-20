import { db } from "../db/drizzle";
import { task_workspaces, tasks, repos, challenges } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainTaskWorkspace, toDbTaskWorkspace } from "../db/mappers";
import type { TaskWorkspace, WorkspaceStatus, WorkspaceMeta } from "../domain/entities";

export class TaskWorkspaceRepository {
  async findAll(): Promise<TaskWorkspace[]> {
    const rows = await db.select().from(task_workspaces);
    return rows.map(toDomainTaskWorkspace);
  }

  async findByTask(taskId: string): Promise<TaskWorkspace[]> {
    const rows = await db.select().from(task_workspaces).where(eq(task_workspaces.task_id, taskId));
    return rows.map(toDomainTaskWorkspace);
  }

  async findByRepo(repoId: string): Promise<TaskWorkspace[]> {
    const rows = await db.select().from(task_workspaces).where(eq(task_workspaces.repo_id, repoId));
    return rows.map(toDomainTaskWorkspace);
  }

  async findByTaskAndRepo(taskId: string, repoId: string): Promise<TaskWorkspace | null> {
    const [row] = await db
      .select()
      .from(task_workspaces)
      .where(and(eq(task_workspaces.task_id, taskId), eq(task_workspaces.repo_id, repoId)));
    return row ? toDomainTaskWorkspace(row) : null;
  }

  async create(entity: TaskWorkspace): Promise<TaskWorkspace> {
    const dbData = toDbTaskWorkspace(entity);
    const [inserted] = await db.insert(task_workspaces).values(dbData).returning();
    return toDomainTaskWorkspace(inserted);
  }

  async updateWorkspaceStatus(
    taskId: string,
    repoId: string,
    status: WorkspaceStatus,
    meta?: Partial<WorkspaceMeta>
  ): Promise<TaskWorkspace | null> {
    const existing = await this.findByTaskAndRepo(taskId, repoId);
    if (!existing) return null;

    const newMeta = { ...existing.workspace_meta, ...meta };

    const [updated] = await db
      .update(task_workspaces)
      .set({
        workspace_status: status,
        workspace_meta: newMeta,
      })
      .where(and(eq(task_workspaces.task_id, taskId), eq(task_workspaces.repo_id, repoId)))
      .returning();

    return toDomainTaskWorkspace(updated);
  }

  async updateWorkspace(
    taskId: string,
    repoId: string,
    data: Partial<Pick<TaskWorkspace, 'workspace_provider' | 'workspace_ref' | 'workspace_url' | 'workspace_status' | 'workspace_meta'>>
  ): Promise<TaskWorkspace | null> {
    const updateData: Record<string, unknown> = {};
    
    if (data.workspace_provider !== undefined) updateData.workspace_provider = data.workspace_provider;
    if (data.workspace_ref !== undefined) updateData.workspace_ref = data.workspace_ref;
    if (data.workspace_url !== undefined) updateData.workspace_url = data.workspace_url;
    if (data.workspace_status !== undefined) updateData.workspace_status = data.workspace_status;
    if (data.workspace_meta !== undefined) updateData.workspace_meta = data.workspace_meta;

    const [updated] = await db
      .update(task_workspaces)
      .set(updateData)
      .where(and(eq(task_workspaces.task_id, taskId), eq(task_workspaces.repo_id, repoId)))
      .returning();

    return updated ? toDomainTaskWorkspace(updated) : null;
  }

  async delete(taskId: string, repoId: string): Promise<void> {
    await db
      .delete(task_workspaces)
      .where(and(eq(task_workspaces.task_id, taskId), eq(task_workspaces.repo_id, repoId)));
  }

  /**
   * Récupère les workspaces d'une task avec les infos du repo
   */
  async findByTaskWithRepo(taskId: string): Promise<(TaskWorkspace & { repo_type: string; repo_external_id?: string })[]> {
    const results = await db
      .select({
        task_workspace: task_workspaces,
        repo: repos,
      })
      .from(task_workspaces)
      .leftJoin(repos, eq(task_workspaces.repo_id, repos.uuid))
      .where(eq(task_workspaces.task_id, taskId));

    return results
      .filter(r => r.repo !== null)
      .map(r => ({
        ...toDomainTaskWorkspace(r.task_workspace),
        repo_type: r.repo!.type,
        repo_external_id: r.repo!.external_repo_id ?? undefined,
      }));
  }
}
