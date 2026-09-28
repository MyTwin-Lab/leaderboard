import { db, onboarding_progress, onboarding_quest_progress, users } from "../db/drizzle";
import { and, eq, ne } from "drizzle-orm";
import type { OnboardingProgressWithUser, OnboardingQuestCompletion } from "../domain/entities";

/**
 * OnboardingProgressRepository
 * ----------------------------
 * Les quêtes d'onboarding accomplies, une ligne par quête
 * (`onboarding_quest_progress`, challenge 020, L6). La SPEC parle d'un
 * « repository des quêtes » : le nom reste celui-ci, que lisent déjà le shell
 * et le suivi de l'admin.
 *
 * Quelles quêtes existent n'est pas son affaire : leurs propriétaires les
 * déclarent au registre (`PlatformRegistry.quests()`).
 */
export class OnboardingProgressRepository {
  /** Les quêtes accomplies par ce compte. */
  async findByUserId(userId: string): Promise<OnboardingQuestCompletion[]> {
    return db
      .select({ quest_key: onboarding_quest_progress.quest_key, completed_at: onboarding_quest_progress.completed_at })
      .from(onboarding_quest_progress)
      .where(eq(onboarding_quest_progress.user_id, userId));
  }

  /** Chaque compte non admin, avec ses quêtes accomplies, par ordre de nom. */
  async findAllWithUsers(): Promise<OnboardingProgressWithUser[]> {
    const rows = await db
      .select({
        user_id: users.uuid,
        full_name: users.full_name,
        avatar_url: users.avatar_url,
        quest_key: onboarding_quest_progress.quest_key,
        completed_at: onboarding_quest_progress.completed_at,
      })
      .from(users)
      .leftJoin(onboarding_quest_progress, eq(onboarding_quest_progress.user_id, users.uuid))
      .where(ne(users.role, "admin"))
      .orderBy(users.full_name);

    const byUser = new Map<string, OnboardingProgressWithUser>();
    for (const row of rows) {
      let entry = byUser.get(row.user_id);
      if (!entry) {
        entry = { user_id: row.user_id, full_name: row.full_name, avatar_url: row.avatar_url ?? null, completed: [] };
        byUser.set(row.user_id, entry);
      }
      if (row.quest_key && row.completed_at) {
        entry.completed.push({ quest_key: row.quest_key, completed_at: row.completed_at });
      }
    }
    return [...byUser.values()];
  }

  /**
   * Enregistre une quête accomplie. Idempotent — un événement relivré ne
   * change rien : `false` quand elle l'était déjà.
   */
  async record(userId: string, questKey: string, completedAt: Date = new Date()): Promise<boolean> {
    const inserted = await db
      .insert(onboarding_quest_progress)
      .values({ user_id: userId, quest_key: questKey, completed_at: completedAt })
      .onConflictDoNothing()
      .returning({ quest_key: onboarding_quest_progress.quest_key });
    return inserted.length > 0;
  }

  async hasCompleted(userId: string, questKey: string): Promise<boolean> {
    const [row] = await db
      .select({ quest_key: onboarding_quest_progress.quest_key })
      .from(onboarding_quest_progress)
      .where(and(eq(onboarding_quest_progress.user_id, userId), eq(onboarding_quest_progress.quest_key, questKey)));
    return !!row;
  }

  /**
   * La ligne de l'ancienne table `onboarding_progress`, que relirait un retour
   * arrière du code. Idempotent ; disparaît avec la table en L7.
   */
  async initLegacyRow(userId: string): Promise<void> {
    await db.insert(onboarding_progress).values({ user_id: userId }).onConflictDoNothing();
  }
}
