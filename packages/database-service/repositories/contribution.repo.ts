import { db } from "../db/drizzle.js";
import { contributions, users, challenges } from "../db/drizzle.js";
import { eq } from "drizzle-orm";
import { toDomainContribution, toDomainUser, toDomainChallenge, toDbContribution } from "../db/mappers.js";
import type { Contribution, User, Challenge } from "../domain/entities.js";
import { contributionSchema } from "../domain/schemas_zod.js";

export class ContributionRepository {
  async findAll(): Promise<Contribution[]> {
    const rows = await db.select().from(contributions);
    return rows.map(toDomainContribution);
  }

  async findById(uuid: string): Promise<Contribution | null> {
    const [row] = await db.select().from(contributions).where(eq(contributions.uuid, uuid));
    return row ? toDomainContribution(row) : null;
  }

  async findByUser(userId: string): Promise<Contribution[]> {
    const rows = await db.select().from(contributions).where(eq(contributions.user_id, userId));
    return rows.map(toDomainContribution);
  }

  async findByChallenge(challengeId: string): Promise<Contribution[]> {
    const rows = await db.select().from(contributions).where(eq(contributions.challenge_id, challengeId));
    return rows.map(toDomainContribution);
  }

  async findDetailed(uuid: string): Promise<{ contribution: Contribution; user: User | null; challenge: Challenge | null } | null> {
    const [result] = await db
      .select({
        contribution: contributions,
        user: users,
        challenge: challenges,
      })
      .from(contributions)
      .leftJoin(users, eq(users.uuid, contributions.user_id))
      .leftJoin(challenges, eq(challenges.uuid, contributions.challenge_id))
      .where(eq(contributions.uuid, uuid));

    if (!result) return null;

    return {
      contribution: toDomainContribution(result.contribution),
      user: result.user ? toDomainUser(result.user) : null,
      challenge: result.challenge ? toDomainChallenge(result.challenge) : null,
    };
  }

  async create(entity: Omit<Contribution, "uuid">): Promise<Contribution> {
    const validated = contributionSchema.omit({ uuid: true }).parse(entity);
    const dbData = toDbContribution(validated);
    const [inserted] = await db.insert(contributions).values(dbData).returning();
    return toDomainContribution(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<Contribution, "uuid">>): Promise<Contribution> {
    const validated = contributionSchema.omit({ uuid: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.type) dbData.type = validated.type;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.evaluation !== undefined) dbData.evaluation = validated.evaluation;
    if (validated.tags !== undefined) dbData.tags = validated.tags.length > 0 ? validated.tags : null;
    if (validated.reward !== undefined) dbData.reward = validated.reward;
    if (validated.user_id) dbData.user_id = validated.user_id;
    if (validated.challenge_id) dbData.challenge_id = validated.challenge_id;

    const [updated] = await db.update(contributions)
      .set(dbData)
      .where(eq(contributions.uuid, uuid))
      .returning();
    return toDomainContribution(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(contributions).where(eq(contributions.uuid, uuid));
  }
}
