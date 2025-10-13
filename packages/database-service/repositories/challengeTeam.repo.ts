import { db } from "../db/drizzle.js";
import { challenge_teams, users } from "../db/drizzle.js";
import { eq, and } from "drizzle-orm";
import { toDomainChallengeTeam, toDomainUser } from "../db/mappers.js";
import type { ChallengeTeam, User } from "../domain/entities.js";
import { challengeTeamSchema } from "../domain/schemas_zod.js";

export class ChallengeTeamRepository {
  async findAll(): Promise<ChallengeTeam[]> {
    const rows = await db.select().from(challenge_teams);
    return rows.map(toDomainChallengeTeam);
  }

  async findByChallenge(challengeId: string): Promise<ChallengeTeam[]> {
    const rows = await db.select().from(challenge_teams).where(eq(challenge_teams.challenge_id, challengeId));
    return rows.map(toDomainChallengeTeam);
  }

  async findByUser(userId: string): Promise<ChallengeTeam[]> {
    const rows = await db.select().from(challenge_teams).where(eq(challenge_teams.user_id, userId));
    return rows.map(toDomainChallengeTeam);
  }

  /**
   * Récupère tous les membres (users) d'un challenge
   */
  async findTeamMembers(challengeId: string): Promise<User[]> {
    const results = await db
      .select({
        user: users,
      })
      .from(challenge_teams)
      .leftJoin(users, eq(challenge_teams.user_id, users.uuid))
      .where(eq(challenge_teams.challenge_id, challengeId));
    
    return results.filter(r => r.user !== null).map(r => toDomainUser(r.user!));
  }

  async create(entity: ChallengeTeam): Promise<ChallengeTeam> {
    const validated = challengeTeamSchema.parse(entity);
    const [inserted] = await db.insert(challenge_teams).values({
      challenge_id: validated.challenge_id,
      user_id: validated.user_id,
    }).returning();
    return toDomainChallengeTeam(inserted);
  }

  async delete(challengeId: string, userId: string): Promise<void> {
    await db.delete(challenge_teams)
      .where(and(eq(challenge_teams.challenge_id, challengeId), eq(challenge_teams.user_id, userId)));
  }
}
