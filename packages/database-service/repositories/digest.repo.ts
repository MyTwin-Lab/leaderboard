import { db, digests } from "../db/drizzle";
import { count, desc, eq } from "drizzle-orm";
import { toDomainDigest } from "../db/mappers";
import type { Digest, DigestPayload, DigestTriggerSource } from "../domain/entities";

/**
 * DigestRepository
 * ----------------
 * Snapshots périodiques de l'activité de la plateforme.
 *
 * Un digest est immuable : ni `update` ni `delete` ici, volontairement. La
 * seule écriture est un insert.
 *
 * `findLatest()` est le curseur dont dépend toute la planification — le
 * `period_start` du prochain digest vaut le `period_end` de celui-ci. C'est ce
 * qui interdit trou et recouvrement entre deux digests consécutifs sans avoir
 * à stocker un état parallèle dans app_settings.
 */
export class DigestRepository {
  /** Le curseur. `null` = aucun digest encore généré. */
  async findLatest(): Promise<Digest | null> {
    const [row] = await db
      .select()
      .from(digests)
      .orderBy(desc(digests.period_end))
      .limit(1);
    return row ? toDomainDigest(row) : null;
  }

  async list(limit = 20, offset = 0): Promise<Digest[]> {
    const rows = await db
      .select()
      .from(digests)
      .orderBy(desc(digests.period_end))
      .limit(limit)
      .offset(offset);
    return rows.map(toDomainDigest);
  }

  async findById(uuid: string): Promise<Digest | null> {
    const [row] = await db.select().from(digests).where(eq(digests.uuid, uuid));
    return row ? toDomainDigest(row) : null;
  }

  /** Total, pour que la liste paginée sache s'il reste des pages. */
  async count(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(digests);
    return row?.value ?? 0;
  }

  async create(entry: {
    period_start: Date;
    period_end: Date;
    trigger_source: DigestTriggerSource;
    payload: DigestPayload;
  }): Promise<Digest> {
    const [inserted] = await db.insert(digests).values(entry).returning();
    return toDomainDigest(inserted);
  }
}
