import { eq, inArray } from "drizzle-orm";
import { db, google_accounts } from "../db/drizzle.js";
import { toDomainGoogleAccount, toDbGoogleAccount } from "../db/mappers.js";
import type { GoogleAccount } from "../domain/entities.js";
import { googleAccountSchema } from "../domain/schemas_zod.js";

export class GoogleAccountRepository {
  async findAll(): Promise<GoogleAccount[]> {
    const rows = await db.select().from(google_accounts);
    return rows.map(toDomainGoogleAccount);
  }

  async findById(uuid: string): Promise<GoogleAccount | null> {
    const rows = await db.select().from(google_accounts).where(eq(google_accounts.uuid, uuid));
    return rows[0] ? toDomainGoogleAccount(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<GoogleAccount | null> {
    const rows = await db.select().from(google_accounts).where(eq(google_accounts.user_id, userId));
    return rows[0] ? toDomainGoogleAccount(rows[0]) : null;
  }

  async findByUserIds(userIds: string[]): Promise<GoogleAccount[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await db
      .select()
      .from(google_accounts)
      .where(inArray(google_accounts.user_id, userIds));
    return rows.map(toDomainGoogleAccount);
  }

  async findByGoogleUserId(googleUserId: string): Promise<GoogleAccount | null> {
    const rows = await db.select().from(google_accounts).where(eq(google_accounts.google_user_id, googleUserId));
    return rows[0] ? toDomainGoogleAccount(rows[0]) : null;
  }

  async create(data: Omit<GoogleAccount, "uuid" | "created_at" | "updated_at">): Promise<GoogleAccount> {
    const validated = googleAccountSchema.omit({ uuid: true, created_at: true, updated_at: true }).parse(data);
    const dbData = toDbGoogleAccount(validated);
    const [inserted] = await db.insert(google_accounts).values(dbData).returning();
    return toDomainGoogleAccount(inserted);
  }

  async update(uuid: string, data: Partial<Omit<GoogleAccount, "uuid" | "user_id" | "created_at">>): Promise<GoogleAccount> {
    const validated = googleAccountSchema.omit({ uuid: true, user_id: true, created_at: true, updated_at: true }).partial().parse(data);
    const [updated] = await db.update(google_accounts)
      .set({
        ...validated,
        updated_at: new Date(),
      })
      .where(eq(google_accounts.uuid, uuid))
      .returning();
    return toDomainGoogleAccount(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(google_accounts).where(eq(google_accounts.uuid, uuid));
  }

}
