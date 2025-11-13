import { db } from "../db/drizzle";
import { repos } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainRepo, toDbRepo } from "../db/mappers";
import type { Repo } from "../domain/entities";
import { repoSchema } from "../domain/schemas_zod";

export class RepoRepository {
  async findAll(): Promise<Repo[]> {
    const rows = await db.select().from(repos);
    return rows.map(toDomainRepo);
  }

  async findById(uuid: string): Promise<Repo | null> {
    const [row] = await db.select().from(repos).where(eq(repos.uuid, uuid));
    return row ? toDomainRepo(row) : null;
  }

  async findByProject(projectId: string): Promise<Repo[]> {
    const rows = await db.select().from(repos).where(eq(repos.project_id, projectId));
    return rows.map(toDomainRepo);
  }

  async findByExternalId(externalRepoId: string): Promise<Repo | null> {
    const [row] = await db.select().from(repos).where(eq(repos.external_repo_id, externalRepoId));
    return row ? toDomainRepo(row) : null;
  }

  async create(entity: Omit<Repo, "uuid">): Promise<Repo> {
    const validated = repoSchema.omit({ uuid: true }).parse(entity);
    const dbData = toDbRepo(validated);
    const [inserted] = await db.insert(repos).values(dbData).returning();
    return toDomainRepo(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<Repo, "uuid">>): Promise<Repo> {
    const validated = repoSchema.omit({ uuid: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.type) dbData.type = validated.type;
    if (validated.external_repo_id !== undefined) dbData.external_repo_id = validated.external_repo_id || null;
    if (validated.project_id) dbData.project_id = validated.project_id;

    const [updated] = await db.update(repos)
      .set(dbData)
      .where(eq(repos.uuid, uuid))
      .returning();
    return toDomainRepo(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(repos).where(eq(repos.uuid, uuid));
  }
}
