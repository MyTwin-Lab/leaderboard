import { db } from "../db/drizzle.js";
import { projects, repos, challenges } from "../db/drizzle.js";
import { eq } from "drizzle-orm";
import { toDomainProject, toDomainRepo, toDomainChallenge, toDbProject } from "../db/mappers.js";
import type { Project, Repo, Challenge } from "../domain/entities.js";
import { projectSchema } from "../domain/schemas_zod.js";

export class ProjectRepository {
  async findAll(): Promise<Project[]> {
    const rows = await db.select().from(projects);
    return rows.map(toDomainProject);
  }

  async findById(uuid: string): Promise<Project | null> {
    const [row] = await db.select().from(projects).where(eq(projects.uuid, uuid));
    return row ? toDomainProject(row) : null;
  }

  async findWithRepos(uuid: string): Promise<Repo[]> {
    const rows = await db.select()
      .from(repos)
      .where(eq(repos.project_id, uuid));
    return rows.map(toDomainRepo);
  }

  async findWithChallenges(uuid: string): Promise<Challenge[]> {
    const rows = await db.select()
      .from(challenges)
      .where(eq(challenges.project_id, uuid));
    return rows.map(toDomainChallenge);
  }

  async create(entity: Omit<Project, "uuid" | "created_at">): Promise<Project> {
    const validated = projectSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const dbData = toDbProject(validated);
    const [inserted] = await db.insert(projects).values(dbData).returning();
    return toDomainProject(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<Project, "uuid" | "created_at">>): Promise<Project> {
    const validated = projectSchema.omit({ uuid: true, created_at: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.description !== undefined) dbData.description = validated.description || null;

    const [updated] = await db.update(projects)
      .set(dbData)
      .where(eq(projects.uuid, uuid))
      .returning();
    return toDomainProject(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(projects).where(eq(projects.uuid, uuid));
  }
}
