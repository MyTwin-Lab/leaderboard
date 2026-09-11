import { db, notifications } from "../db/drizzle";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { toDomainNotification } from "../db/mappers";
import type { Notification, NotificationType } from "../domain/entities";

/** Une notification à écrire. `dedupe_key` NULL = pas de déduplication. */
export interface NotificationDraft {
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
}

/**
 * Le brouillon d'une invitation de groupe — pur, sans I/O, donc testable seul.
 *
 * `dedupe_key` porte le jeton du groupe : c'est ce qui fait qu'inviter deux
 * fois la même personne dans le même groupe n'écrit qu'une ligne.
 */
export function buildGroupInviteDraft(input: {
  recipientId: string;
  challengeId: string;
  challengeTitle: string;
  groupToken: string;
  fromUserId: string;
  fromName: string;
}): NotificationDraft {
  return {
    user_id: input.recipientId,
    type: "group_invite",
    payload: {
      challengeId: input.challengeId,
      challengeTitle: input.challengeTitle,
      groupToken: input.groupToken,
      fromUserId: input.fromUserId,
      fromName: input.fromName,
    },
    dedupe_key: input.groupToken,
  };
}

/**
 * Plafond de lecture, sans pagination.
 *
 * Quelqu'un qui a accumulé plus de cinquante invitations a un autre problème,
 * et un bouton « charger plus » serait le seul consommateur d'un offset que
 * personne n'a demandé.
 */
export const NOTIFICATIONS_PAGE_SIZE = 50;

/**
 * NotificationRepository
 * ----------------------
 * Notifications in-app. Voir docs/challenge-groups.md.
 *
 * Deux choses à savoir en lisant ce fichier :
 *
 * 1. **Une notification ne porte pas d'état d'acceptation.** Elle transporte
 *    un lien. Il n'y a donc ni `accepted_at`, ni statut, ni transition — les
 *    barrières vivent sur la route que le lien vise.
 *
 * 2. **La propriété de la ligne voyage dans le WHERE**, jamais dans une
 *    vérification faite par l'appelant : une garde écrite dans la requête ne
 *    peut pas être oubliée par un second appelant.
 */
export class NotificationRepository {
  async findByUser(userId: string): Promise<Notification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, userId))
      .orderBy(desc(notifications.created_at))
      .limit(NOTIFICATIONS_PAGE_SIZE);
    return rows.map(toDomainNotification);
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
    return row?.value ?? 0;
  }

  /**
   * Écrit la notification, sauf si elle existe déjà. Renvoie `null` dans ce cas.
   *
   * `ON CONFLICT DO NOTHING` sur l'index unique partiel : deux clics
   * concurrents sur le même contributeur produisent exactement une ligne. Le
   * `where` passé ici est le prédicat de l'index, sans lequel Postgres ne sait
   * pas quel index arbitre le conflit.
   *
   * Un `null` ne veut pas dire « échec » : du point de vue de l'expéditeur, la
   * personne est invitée dans les deux cas.
   */
  async insertIfAbsent(draft: NotificationDraft): Promise<Notification | null> {
    const [inserted] = await db
      .insert(notifications)
      .values(draft)
      .onConflictDoNothing({
        target: [notifications.user_id, notifications.type, notifications.dedupe_key],
        where: sql`dedupe_key IS NOT NULL`,
      })
      .returning();
    return inserted ? toDomainNotification(inserted) : null;
  }

  /**
   * Idempotent : une ligne déjà lue n'est pas re-datée, pour que `read_at`
   * garde la date de la première lecture. Le `false` qui en résulte ne
   * distingue pas « déjà lue » de « pas à vous » — voir la route, qui répond
   * 404 dans les deux cas plutôt que de confirmer l'existence d'une ligne qui
   * ne regarde pas l'appelant.
   */
  async markRead(uuid: string, userId: string): Promise<boolean> {
    const updated = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(
        and(
          eq(notifications.uuid, uuid),
          eq(notifications.user_id, userId),
          isNull(notifications.read_at)
        )
      )
      .returning({ uuid: notifications.uuid });
    return updated.length > 0;
  }

  /**
   * Suppression définitive, par son propriétaire.
   *
   * C'est ce que fait « refuser » une invitation, et c'est aussi ce qui retire
   * une notification devenue caduque après un join réussi. À ne pas confondre
   * avec un veto : le jeton du groupe reste valide et le lien continue de
   * marcher. Sans état en attente, refuser classe sans suite, ça n'interdit
   * rien — voir docs/challenge-groups.md.
   *
   * `userId` est dans le WHERE pour la même raison que dans `markRead` : une
   * garde écrite dans la requête ne peut pas être oubliée par un appelant.
   */
  async delete(uuid: string, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(notifications)
      .where(and(eq(notifications.uuid, uuid), eq(notifications.user_id, userId)))
      .returning({ uuid: notifications.uuid });
    return deleted.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)))
      .returning({ uuid: notifications.uuid });
    return updated.length;
  }
}
