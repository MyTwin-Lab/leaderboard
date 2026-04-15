import { eq } from "drizzle-orm";
import { db, onboarding_progress } from "../db/drizzle.js";
import { toDomainOnboardingProgress } from "../db/mappers.js";
import type { OnboardingProgress } from "../domain/entities.js";

export class OnboardingProgressRepository {
  async findByUserId(userId: string): Promise<OnboardingProgress | null> {
    const rows = await db.select().from(onboarding_progress).where(eq(onboarding_progress.user_id, userId));
    return rows[0] ? toDomainOnboardingProgress(rows[0]) : null;
  }

  async upsert(userId: string, data: Partial<Omit<OnboardingProgress, "user_id" | "created_at">>): Promise<OnboardingProgress> {
    const [row] = await db
      .insert(onboarding_progress)
      .values({ user_id: userId, ...data })
      .onConflictDoUpdate({
        target: onboarding_progress.user_id,
        set: { ...data, updated_at: new Date() },
      })
      .returning();
    return toDomainOnboardingProgress(row);
  }

  async delete(userId: string): Promise<void> {
    await db.delete(onboarding_progress).where(eq(onboarding_progress.user_id, userId));
  }
}