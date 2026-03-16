import { eq, and, inArray, lt } from "drizzle-orm";
import { db, sync_meetings } from "../db/drizzle.js";
import { toDomainSyncMeeting, toDbSyncMeeting } from "../db/mappers.js";
import type { SyncMeeting, SyncMeetingStatus } from "../domain/entities.js";
import { syncMeetingSchema } from "../domain/schemas_zod.js";

export class SyncMeetingRepository {
  async findAll(): Promise<SyncMeeting[]> {
    const rows = await db.select().from(sync_meetings);
    return rows.map(toDomainSyncMeeting);
  }

  async findById(uuid: string): Promise<SyncMeeting | null> {
    const rows = await db.select().from(sync_meetings).where(eq(sync_meetings.uuid, uuid));
    return rows[0] ? toDomainSyncMeeting(rows[0]) : null;
  }

  async findByChallengeId(challengeId: string): Promise<SyncMeeting[]> {
    const rows = await db.select().from(sync_meetings).where(eq(sync_meetings.challenge_id, challengeId));
    return rows.map(toDomainSyncMeeting);
  }

  async findByStatus(statuses: SyncMeetingStatus[]): Promise<SyncMeeting[]> {
    const rows = await db.select().from(sync_meetings).where(inArray(sync_meetings.status, statuses));
    return rows.map(toDomainSyncMeeting);
  }

  async findCompletedBefore(date: Date, statuses: SyncMeetingStatus[]): Promise<SyncMeeting[]> {
    const rows = await db.select()
      .from(sync_meetings)
      .where(
        and(
          inArray(sync_meetings.status, statuses),
          lt(sync_meetings.end_time, date)
        )
      );
    return rows.map(toDomainSyncMeeting);
  }

  async create(data: Omit<SyncMeeting, "uuid" | "created_at" | "updated_at">): Promise<SyncMeeting> {
    const validated = syncMeetingSchema.omit({ uuid: true, created_at: true, updated_at: true }).parse(data);
    const dbData = toDbSyncMeeting(validated);
    const [inserted] = await db.insert(sync_meetings).values(dbData).returning();
    return toDomainSyncMeeting(inserted);
  }

  async update(uuid: string, data: Partial<Omit<SyncMeeting, "uuid" | "created_at">>): Promise<SyncMeeting> {
    const validated = syncMeetingSchema.omit({ uuid: true, created_at: true, updated_at: true }).partial().parse(data);
    const [updated] = await db.update(sync_meetings)
      .set({
        ...validated,
        updated_at: new Date(),
      })
      .where(eq(sync_meetings.uuid, uuid))
      .returning();
    return toDomainSyncMeeting(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(sync_meetings).where(eq(sync_meetings.uuid, uuid));
  }

}
