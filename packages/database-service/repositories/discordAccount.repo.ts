import { db, discord_accounts } from "../db/drizzle";
import { eq } from "drizzle-orm";

export class DiscordAccountRepository {
  async findById(discord_id: string) {
    const [row] = await db.select().from(discord_accounts).where(eq(discord_accounts.discord_id, discord_id));
    return row ?? null;
  }

  async upsert(data: { discord_id: string; username: string; user_id?: string | null }) {
    const [row] = await db
      .insert(discord_accounts)
      .values(data)
      .onConflictDoUpdate({
        target: discord_accounts.discord_id,
        set: { username: data.username },
      })
      .returning();
    return row;
  }
}
