import { db, role_changes } from "../db/drizzle";
import type { DbTransaction } from "../db/drizzle";
import { desc, eq } from "drizzle-orm";
import { toDomainRoleChange } from "../db/mappers";
import type { RoleChange } from "../domain/entities";

/**
 * RoleChangeRepository
 * --------------------
 * Journal d'audit des rôles (table role_changes).
 *
 * Il n'y a volontairement pas de `create` autonome : une trace écrite hors de
 * la transaction de l'UPDATE pourrait manquer (crash entre les deux) ou
 * mentir (UPDATE annulé après coup). Les écritures passent par
 * `recordRoleChange(tx, …)`, appelé par UserRepository.
 */

export interface RoleChangeDraft {
  user_id: string;
  old_role: string | null;
  new_role: string;
  changed_by: string | null;
  note: string | null;
}

/**
 * La trace d'un changement, ou `null` s'il n'y a rien à tracer.
 *
 * Réattribuer le rôle déjà en place n'est pas un changement : le journal ne
 * doit contenir que des transitions, sinon il noie les vraies.
 */
export function buildRoleChange(input: {
  userId: string;
  oldRole: string | null;
  newRole: string;
  changedBy: string | null;
  note?: string | null;
}): RoleChangeDraft | null {
  if (input.oldRole === input.newRole) return null;
  const note = input.note?.trim();
  return {
    user_id: input.userId,
    old_role: input.oldRole,
    new_role: input.newRole,
    changed_by: input.changedBy,
    note: note ? note : null,
  };
}

/** Écrit la trace dans la transaction de l'appelant — c'est tout son intérêt. */
export async function recordRoleChange(tx: DbTransaction, draft: RoleChangeDraft): Promise<void> {
  await tx.insert(role_changes).values(draft);
}

export class RoleChangeRepository {
  /** Historique d'un compte, plus récent d'abord. */
  async findByUser(userId: string): Promise<RoleChange[]> {
    const rows = await db
      .select()
      .from(role_changes)
      .where(eq(role_changes.user_id, userId))
      .orderBy(desc(role_changes.created_at));
    return rows.map(toDomainRoleChange);
  }
}
