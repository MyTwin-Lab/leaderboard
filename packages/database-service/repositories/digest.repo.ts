import { db, digests } from "../db/drizzle";
import type { DbTransaction } from "../db/drizzle";
import { count, desc, eq, sql } from "drizzle-orm";
import { toDomainDigest } from "../db/mappers";
import type { Digest, DigestPayload, DigestTriggerSource } from "../domain/entities";

/** Nom affiché à la place d'un compte supprimé — le même repli que digest-payload.ts. */
export const DELETED_USER_NAME = "Unknown";

/**
 * Retire le nom d'un compte d'un payload de digest.
 *
 * Toutes les sections qui dénormalisent un nom portent aussi le `user_id` à
 * côté : c'est lui qu'on suit, pas le nom (deux personnes peuvent le
 * partager). Le `user_id` reste : il ne pointe plus vers rien, et le rendu
 * s'en sert comme clé.
 *
 * Rend `null` quand le payload ne mentionne pas ce compte, pour que
 * l'appelant n'écrive pas une row inchangée.
 */
export function anonymizeDigestPayload(payload: DigestPayload, userId: string): DigestPayload | null {
  let changed = false;
  const scrub = <T extends { user_id: string; full_name: string }>(person: T): T => {
    if (person.user_id !== userId || person.full_name === DELETED_USER_NAME) return person;
    changed = true;
    return { ...person, full_name: DELETED_USER_NAME };
  };

  const next: DigestPayload = {
    ...payload,
    new_contributions: (payload.new_contributions ?? []).map((c) => ({
      ...c,
      contributors: (c.contributors ?? []).map(scrub),
    })),
    new_contributors: (payload.new_contributors ?? []).map(scrub),
    cp_distributed: (payload.cp_distributed ?? []).map(scrub),
  };
  // Absente d'un digest v1 : on ne la crée pas.
  if (payload.new_sandboxes) {
    next.new_sandboxes = payload.new_sandboxes.map((s) => ({ ...s, author: scrub(s.author) }));
  }

  return changed ? next : null;
}

/**
 * Anonymise un compte dans tous les digests, dans la transaction de la
 * suppression du compte. Seule écriture autorisée sur un digest existant.
 *
 * Le LIKE sur le texte du JSON est un préfiltre grossier (un uuid ne contient
 * ni `%` ni `_`) ; le tri fin est fait par anonymizeDigestPayload.
 */
export async function anonymizeUserInDigests(tx: DbTransaction, userId: string): Promise<number> {
  const rows = await tx
    .select({ uuid: digests.uuid, payload: digests.payload })
    .from(digests)
    .where(sql`${digests.payload}::text LIKE ${`%${userId}%`}`);

  let updated = 0;
  for (const row of rows) {
    const next = anonymizeDigestPayload(row.payload as DigestPayload, userId);
    if (!next) continue;
    await tx.update(digests).set({ payload: next }).where(eq(digests.uuid, row.uuid));
    updated++;
  }
  return updated;
}

/**
 * DigestRepository
 * ----------------
 * Snapshots périodiques de l'activité de la plateforme.
 *
 * Un digest est immuable : ni `update` ni `delete` ici, volontairement. La
 * seule écriture est un insert — à une exception près, hors de cette classe :
 * `anonymizeUserInDigests`, appelé à la suppression d'un compte.
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
