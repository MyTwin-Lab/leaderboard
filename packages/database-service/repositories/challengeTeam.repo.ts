import { db } from "../db/drizzle";
import { challenge_teams, users } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainChallengeTeam, toDomainUser } from "../db/mappers";
import type { ChallengeTeam, User } from "../domain/entities";
import { challengeTeamSchema } from "../domain/schemas_zod";

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
      workspace_provider: validated.workspace_provider ?? null,
      workspace_ref: validated.workspace_ref ?? null,
      workspace_url: validated.workspace_url ?? null,
      workspace_status: validated.workspace_status ?? null,
    }).returning();
    return toDomainChallengeTeam(inserted);
  }

  async delete(challengeId: string, userId: string): Promise<void> {
    await db.delete(challenge_teams)
      .where(and(eq(challenge_teams.challenge_id, challengeId), eq(challenge_teams.user_id, userId)));
  }

  async findByChallengeAndUser(challengeId: string, userId: string): Promise<ChallengeTeam | null> {
    const [row] = await db.select().from(challenge_teams)
      .where(and(eq(challenge_teams.challenge_id, challengeId), eq(challenge_teams.user_id, userId)));
    return row ? toDomainChallengeTeam(row) : null;
  }

  async updateWorkspace(
    challengeId: string,
    userId: string,
    fields: Partial<Pick<ChallengeTeam, 'workspace_provider' | 'workspace_ref' | 'workspace_url' | 'workspace_status'>>
  ): Promise<ChallengeTeam | null> {
    const [updated] = await db.update(challenge_teams)
      .set({
        ...(fields.workspace_provider !== undefined ? { workspace_provider: fields.workspace_provider } : {}),
        ...(fields.workspace_ref !== undefined ? { workspace_ref: fields.workspace_ref } : {}),
        ...(fields.workspace_url !== undefined ? { workspace_url: fields.workspace_url } : {}),
        ...(fields.workspace_status !== undefined ? { workspace_status: fields.workspace_status } : {}),
      })
      .where(and(eq(challenge_teams.challenge_id, challengeId), eq(challenge_teams.user_id, userId)))
      .returning();
    return updated ? toDomainChallengeTeam(updated) : null;
  }
}
