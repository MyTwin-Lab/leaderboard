import { db } from "../db/drizzle";
import { users, contributions } from "../db/drizzle";
import { eq, inArray } from "drizzle-orm";
import { toDomainUser, toDomainContribution, toDbUser } from "../db/mappers";
import type { User, Contribution } from "../domain/entities";
import { userSchema } from "../domain/schemas_zod";

export class UserRepository {
  async findAll(): Promise<User[]> {
    const rows = await db.select().from(users);
    return rows.map(toDomainUser);
  }

  async findById(uuid: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.uuid, uuid));
    return row ? toDomainUser(row) : null;
  }

  async findByGithub(username: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.github_username, username));
    return row ? toDomainUser(row) : null;
  }

  async findByGoogleUserId(googleUserId: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.google_user_id, googleUserId));
    return row ? toDomainUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email));
    return row ? toDomainUser(row) : null;
  }

  async findByIds(uuids: string[]): Promise<User[]> {
    if (uuids.length === 0) return [];
    const rows = await db.select().from(users).where(inArray(users.uuid, uuids));
    return rows.map(toDomainUser);
  }

  async findContributions(uuid: string): Promise<Contribution[]> {
    const rows = await db.select().from(contributions).where(eq(contributions.user_id, uuid));
    return rows.map(toDomainContribution);
  }

  async create(entity: Omit<User, "uuid" | "created_at">): Promise<User> {
    const validated = userSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const dbData = toDbUser(validated);
    const [inserted] = await db.insert(users).values(dbData).returning();
    return toDomainUser(inserted);
  }

  async update(uuid: string, entity: Partial<Omit<User, "uuid" | "created_at">>): Promise<User> {
    const validated = userSchema.omit({ uuid: true, created_at: true }).partial().parse(entity);
    const dbData: Record<string, unknown> = {};
    if (validated.role) dbData.role = validated.role;
    if (validated.full_name) dbData.full_name = validated.full_name;
    if (validated.github_username !== undefined) dbData.github_username = validated.github_username;
    if (validated.email !== undefined) dbData.email = validated.email;
    if (validated.google_user_id !== undefined) dbData.google_user_id = validated.google_user_id;
    if (validated.bio !== undefined) dbData.bio = validated.bio;
    const [updated] = await db.update(users)
      .set(dbData)
      .where(eq(users.uuid, uuid))
      .returning();
    return toDomainUser(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(users).where(eq(users.uuid, uuid));
  }
}
