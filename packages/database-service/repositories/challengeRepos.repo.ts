import { db } from "../db/drizzle";
import { challenge_repos, challenges } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainChallengeRepo, toDomainChallenge } from "../db/mappers";
import type { ChallengeRepo, Challenge } from "../domain/entities";
import { challengeRepoSchema } from "../domain/schemas_zod";

export class ChallengeRepoRepository {
  async findAll(): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos);
    return rows.map(toDomainChallengeRepo);
  }

  async findByChallenge(challengeId: string): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos).where(eq(challenge_repos.challenge_id, challengeId));
    return rows.map(toDomainChallengeRepo);
  }

  /**
   * Récupère tous les challenges liés à un repo
   */
  async findChallengesByRepo(repoId: string): Promise<Challenge[]> {
    const results = await db
      .select({
        challenge: challenges,
      })
      .from(challenge_repos)
      .leftJoin(challenges, eq(challenge_repos.challenge_id, challenges.uuid))
      .where(eq(challenge_repos.repo_id, repoId));
    
    return results.filter(r => r.challenge !== null).map(r => toDomainChallenge(r.challenge!));
  }

  async findByRepo(repoId: string): Promise<ChallengeRepo[]> {
    const rows = await db.select().from(challenge_repos).where(eq(challenge_repos.repo_id, repoId));
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
