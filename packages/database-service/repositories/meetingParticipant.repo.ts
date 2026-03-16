import { eq } from "drizzle-orm";
import { db, meeting_participants } from "../db/drizzle.js";
import { toDomainMeetingParticipant, toDbMeetingParticipant } from "../db/mappers.js";
import type { MeetingParticipant } from "../domain/entities.js";
import { meetingParticipantSchema } from "../domain/schemas_zod.js";

export class MeetingParticipantRepository {
  async findAll(): Promise<MeetingParticipant[]> {
    const rows = await db.select().from(meeting_participants);
    return rows.map(toDomainMeetingParticipant);
  }

  async findById(uuid: string): Promise<MeetingParticipant | null> {
    const rows = await db.select().from(meeting_participants).where(eq(meeting_participants.uuid, uuid));
    return rows[0] ? toDomainMeetingParticipant(rows[0]) : null;
  }

  async findByMeetingId(meetingId: string): Promise<MeetingParticipant[]> {
    const rows = await db.select().from(meeting_participants).where(eq(meeting_participants.sync_meeting_id, meetingId));
    return rows.map(toDomainMeetingParticipant);
  }

  async create(data: Omit<MeetingParticipant, "uuid">): Promise<MeetingParticipant> {
    const validated = meetingParticipantSchema.omit({ uuid: true }).parse(data);
    const dbData = toDbMeetingParticipant(validated);
    const [inserted] = await db.insert(meeting_participants).values(dbData).returning();
    return toDomainMeetingParticipant(inserted);
  }

  async bulkCreate(participants: Omit<MeetingParticipant, "uuid">[]): Promise<MeetingParticipant[]> {
    const validatedList = participants.map(p => meetingParticipantSchema.omit({ uuid: true }).parse(p));
    const dbDataList = validatedList.map(toDbMeetingParticipant);
    const inserted = await db.insert(meeting_participants).values(dbDataList).returning();
    return inserted.map(toDomainMeetingParticipant);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(meeting_participants).where(eq(meeting_participants.uuid, uuid));
  }

}
