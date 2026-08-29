import { eq } from "drizzle-orm";
import { db, challenge_documents } from "../db/drizzle.js";
import { toDomainChallengeDocument, toDbChallengeDocument } from "../db/mappers.js";
import type { ChallengeDocument } from "../domain/entities.js";

export class ChallengeDocumentRepository {
  async findByChallengeId(challengeId: string): Promise<ChallengeDocument[]> {
    const rows = await db
      .select()
      .from(challenge_documents)
      .where(eq(challenge_documents.challenge_id, challengeId))
      .orderBy(challenge_documents.created_at);
    return rows.map(toDomainChallengeDocument);
  }

  async findById(uuid: string): Promise<ChallengeDocument | null> {
    const rows = await db
      .select()
      .from(challenge_documents)
      .where(eq(challenge_documents.uuid, uuid));
    return rows[0] ? toDomainChallengeDocument(rows[0]) : null;
  }

  async create(entity: Omit<ChallengeDocument, "uuid" | "created_at">): Promise<ChallengeDocument> {
    const [row] = await db
      .insert(challenge_documents)
      .values(toDbChallengeDocument(entity))
      .returning();
    return toDomainChallengeDocument(row);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(challenge_documents).where(eq(challenge_documents.uuid, uuid));
  }
}
