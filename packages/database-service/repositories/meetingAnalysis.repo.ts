import { eq } from "drizzle-orm";
import { db, meeting_analyses } from "../db/drizzle.js";
import { toDomainMeetingAnalysis, toDbMeetingAnalysis } from "../db/mappers.js";
import type { MeetingAnalysis, MeetingAnalysisStatus } from "../domain/entities.js";
import { meetingAnalysisSchema } from "../domain/schemas_zod.js";

export class MeetingAnalysisRepository {
  async findAll(): Promise<MeetingAnalysis[]> {
    const rows = await db.select().from(meeting_analyses);
    return rows.map(toDomainMeetingAnalysis);
  }

  async findById(uuid: string): Promise<MeetingAnalysis | null> {
    const rows = await db.select().from(meeting_analyses).where(eq(meeting_analyses.uuid, uuid));
    return rows[0] ? toDomainMeetingAnalysis(rows[0]) : null;
  }

  async findByMeetingId(meetingId: string): Promise<MeetingAnalysis | null> {
    const rows = await db.select().from(meeting_analyses).where(eq(meeting_analyses.sync_meeting_id, meetingId));
    return rows[0] ? toDomainMeetingAnalysis(rows[0]) : null;
  }

  async create(data: Omit<MeetingAnalysis, "uuid" | "created_at">): Promise<MeetingAnalysis> {
    const validated = meetingAnalysisSchema.omit({ uuid: true, created_at: true }).parse(data);
    const dbData = toDbMeetingAnalysis(validated);
    const [inserted] = await db.insert(meeting_analyses).values(dbData).returning();
    return toDomainMeetingAnalysis(inserted);
  }

  async update(uuid: string, data: Partial<Omit<MeetingAnalysis, "uuid" | "sync_meeting_id" | "created_at">>): Promise<MeetingAnalysis> {
    const validated = meetingAnalysisSchema.omit({ uuid: true, sync_meeting_id: true, created_at: true }).partial().parse(data);
    const [updated] = await db.update(meeting_analyses)
      .set(validated as any)
      .where(eq(meeting_analyses.uuid, uuid))
      .returning();
    return toDomainMeetingAnalysis(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(meeting_analyses).where(eq(meeting_analyses.uuid, uuid));
  }

}
