import { db } from "../db/drizzle";
import { challenges, challenge_repos, repos, contributions } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainChallenge, toDomainRepo, toDomainContribution, toDbChallenge } from "../db/mappers";
import type { Challenge, Repo, Contribution } from "../domain/entities";
import { challengeSchema } from "../domain/schemas_zod";

export class ChallengeRepository {
  async findAll(): Promise<Challenge[]> {
    const rows = await db.select().from(challenges);
    return rows.map(toDomainChallenge);
  }

  async findById(uuid: string): Promise<Challenge | null> {
    const [row] = await db.select().from(challenges).where(eq(challenges.uuid, uuid));
    return row ? toDomainChallenge(row) : null;
  }

  async findRepos(challengeId: string): Promise<Repo[]> {
    const results = await db
      .select({
        repo: repos,
      })
      .from(challenge_repos)
      .leftJoin(repos, eq(challenge_repos.repo_id, repos.uuid))
      .where(eq(challenge_repos.challenge_id, challengeId));
    
    return results.filter(r => r.repo !== null).map(r => toDomainRepo(r.repo!));
  }

  async findContributions(challengeId: string): Promise<Contribution[]> {
    const rows = await db
      .select()
      .from(contributions)
      .where(eq(contributions.challenge_id, challengeId));
    return rows.map(toDomainContribution);
  }

  async create(entity: Omit<Challenge, "uuid">): Promise<Challenge> {
    const validated = challengeSchema.omit({ uuid: true }).parse(entity);
    const dbData = toDbChallenge(validated);
    const [inserted] = await db.insert(challenges).values(dbData).returning();
    return toDomainChallenge(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<Challenge, "uuid">>): Promise<Challenge> {
    const validated = challengeSchema.omit({ uuid: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.index !== undefined) dbData.index = validated.index;
    if (validated.title) dbData.title = validated.title;
    if (validated.status) dbData.status = validated.status;
    if (validated.start_date) dbData.start_date = validated.start_date.toISOString().split("T")[0];
    if (validated.end_date) dbData.end_date = validated.end_date.toISOString().split("T")[0];
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.roadmap !== undefined) dbData.roadmap = validated.roadmap || null;
    if (validated.contribution_points_reward !== undefined) dbData.contribution_points_reward = validated.contribution_points_reward;
    if (validated.project_id) dbData.project_id = validated.project_id;

    const [updated] = await db.update(challenges)
      .set(dbData)
      .where(eq(challenges.uuid, uuid))
      .returning();
    return toDomainChallenge(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(challenges).where(eq(challenges.uuid, uuid));
  }
}
