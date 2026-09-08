import { and, eq } from "drizzle-orm";
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

  /**
   * Un challenge peut porter plusieurs documents du même nom (aucune
   * contrainte d'unicité en base) : on renvoie le plus ancien, celui que le
   * tiroir Docs liste en premier — c'est lui que le brief doit remplacer.
   */
  async findByChallengeAndFilename(
    challengeId: string,
    filename: string
  ): Promise<ChallengeDocument | null> {
    const rows = await db
      .select()
      .from(challenge_documents)
      .where(and(
        eq(challenge_documents.challenge_id, challengeId),
        eq(challenge_documents.filename, filename)
      ))
      .orderBy(challenge_documents.created_at);
    return rows[0] ? toDomainChallengeDocument(rows[0]) : null;
  }

  async updateContent(
    uuid: string,
    content: string,
    uploadedBy?: string
  ): Promise<ChallengeDocument> {
    const [row] = await db
      .update(challenge_documents)
      .set({ content, uploaded_by: uploadedBy ?? null })
      .where(eq(challenge_documents.uuid, uuid))
      .returning();
    return toDomainChallengeDocument(row);
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
