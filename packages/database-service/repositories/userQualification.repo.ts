import { and, eq, inArray } from "drizzle-orm";
import { db, qualification_changes, user_qualifications } from "../db/drizzle";
import type { DbTransaction } from "../db/drizzle";
import type { QualificationAction, UserQualification } from "../domain/entities";

/**
 * UserQualificationRepository
 * ---------------------------
 * Les qualifications des comptes (table user_qualifications) et leur journal
 * d'audit (qualification_changes).
 *
 * Même règle que les rôles : un octroi ou un retrait sans sa trace ne doit pas
 * pouvoir exister. Les écritures passent donc par `grant` et `revoke`, qui
 * écrivent la qualification et sa trace dans une seule transaction.
 */

export interface QualificationChangeDraft {
  user_id: string;
  key: string;
  action: QualificationAction;
  changed_by: string | null;
  note: string | null;
}

/**
 * La trace d'un changement, ou `null` s'il n'y a rien à tracer : octroyer une
 * qualification déjà détenue, ou retirer une qualification absente, ne change
 * rien et ne doit pas encombrer le journal.
 */
export function buildQualificationChange(input: {
  userId: string;
  key: string;
  action: QualificationAction;
  alreadyHeld: boolean;
  changedBy: string | null;
  note?: string | null;
}): QualificationChangeDraft | null {
  if (input.action === "granted" && input.alreadyHeld) return null;
  if (input.action === "revoked" && !input.alreadyHeld) return null;
  const note = input.note?.trim();
  return {
    user_id: input.userId,
    key: input.key,
    action: input.action,
    changed_by: input.changedBy,
    note: note ? note : null,
  };
}

async function recordQualificationChange(tx: DbTransaction, draft: QualificationChangeDraft): Promise<void> {
  await tx.insert(qualification_changes).values(draft);
}

function toDomain(row: typeof user_qualifications.$inferSelect): UserQualification {
  return {
    user_id: row.user_id,
    key: row.key,
    granted_by: row.granted_by ?? null,
    granted_at: new Date(row.granted_at),
    note: row.note ?? null,
  };
}

export class UserQualificationRepository {
  async has(userId: string, key: string): Promise<boolean> {
    const [row] = await db
      .select({ key: user_qualifications.key })
      .from(user_qualifications)
      .where(and(eq(user_qualifications.user_id, userId), eq(user_qualifications.key, key)));
    return !!row;
  }

  async findByUser(userId: string): Promise<UserQualification[]> {
    const rows = await db.select().from(user_qualifications).where(eq(user_qualifications.user_id, userId));
    return rows.map(toDomain);
  }

  async findByUsers(userIds: string[]): Promise<UserQualification[]> {
    if (userIds.length === 0) return [];
    const rows = await db.select().from(user_qualifications).where(inArray(user_qualifications.user_id, userIds));
    return rows.map(toDomain);
  }

  /** Parmi ces comptes, ceux qui détiennent la qualification. */
  async findHolders(userIds: string[], key: string): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await db
      .select({ user_id: user_qualifications.user_id })
      .from(user_qualifications)
      .where(and(inArray(user_qualifications.user_id, userIds), eq(user_qualifications.key, key)));
    return rows.map((row) => row.user_id);
  }

  /** Octroie la qualification. `false` si elle était déjà détenue : rien n'est écrit. */
  async grant(userId: string, key: string, audit: { changedBy: string | null; note?: string | null }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ key: user_qualifications.key })
        .from(user_qualifications)
        .where(and(eq(user_qualifications.user_id, userId), eq(user_qualifications.key, key)))
        .for("update");

      const draft = buildQualificationChange({
        userId,
        key,
        action: "granted",
        alreadyHeld: !!existing,
        changedBy: audit.changedBy,
        note: audit.note,
      });
      if (!draft) return false;

      await tx
        .insert(user_qualifications)
        .values({ user_id: userId, key, granted_by: audit.changedBy, note: draft.note })
        .onConflictDoNothing();
      await recordQualificationChange(tx, draft);
      return true;
    });
  }

  /** Retire la qualification. `false` si elle n'était pas détenue : rien n'est écrit. */
  async revoke(userId: string, key: string, audit: { changedBy: string | null; note?: string | null }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const removed = await tx
        .delete(user_qualifications)
        .where(and(eq(user_qualifications.user_id, userId), eq(user_qualifications.key, key)))
        .returning({ key: user_qualifications.key });

      const draft = buildQualificationChange({
        userId,
        key,
        action: "revoked",
        alreadyHeld: removed.length > 0,
        changedBy: audit.changedBy,
        note: audit.note,
      });
      if (!draft) return false;

      await recordQualificationChange(tx, draft);
      return true;
    });
  }
}
