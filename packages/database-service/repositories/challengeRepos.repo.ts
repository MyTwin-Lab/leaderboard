import { db } from "../db/drizzle.js";
import { challenge_repos } from "../db/drizzle.js";
import { eq, and } from "drizzle-orm";
import { toDomainChallengeRepo } from "../db/mappers.js";
import type { ChallengeRepo } from "../domain/entities.js";
import { challengeRepoSchema } from "../domain/schemas_zod.js";

export class ChallengeRepoRepository {
  async findAll(): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos);
    return rows.map(toDomainChallengeRepo);
  }

  async findByChallenge(challengeId: string): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos).where(eq(challenge_repos.challenge_id, challengeId));
    return rows.map(toDomainChallengeRepo);
  }

  async create(entity: ChallengeRepo): Promise<ChallengeRepo> {
    const validated = challengeRepoSchema.parse(entity);
    const [inserted] = await db.insert(challenge_repos).values({
      challenge_id: validated.challenge_id,
      repo_id: validated.repo_id,
    }).returning();
    return toDomainChallengeRepo(inserted);
  }

  async delete(challengeId: string, repoId: string): Promise<void> {
    await db.delete(challenge_repos)
      .where(and(eq(challenge_repos.challenge_id, challengeId), eq(challenge_repos.repo_id, repoId)));
  }
}
