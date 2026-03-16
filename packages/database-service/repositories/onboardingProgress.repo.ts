import { db } from "../db/drizzle";
import { onboarding_progress } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainOnboardingProgress } from "../db/mappers";
import type { OnboardingProgress, OnboardingStep } from "../domain/entities";

const ALL_STEPS: OnboardingStep[] = [
  'clicked_challenge',
  'assigned_task',
  'evaluated_contribution',
  'validated_task',
  'joined_meeting',
];

export class OnboardingProgressRepository {
  async findByUserId(userId: string): Promise<OnboardingProgress | null> {
    const [row] = await db.select().from(onboarding_progress).where(eq(onboarding_progress.user_id, userId));
    return row ? toDomainOnboardingProgress(row) : null;
  }

  async initForUser(userId: string): Promise<OnboardingProgress> {
    const [inserted] = await db.insert(onboarding_progress).values({
      user_id: userId,
    }).returning();
    return toDomainOnboardingProgress(inserted);
  }

  async markStepComplete(userId: string, step: OnboardingStep): Promise<OnboardingProgress | null> {
    // Update the specific step to true
    const [updated] = await db.update(onboarding_progress)
      .set({
        [step]: true,
        updated_at: new Date(),
      })
      .where(eq(onboarding_progress.user_id, userId))
      .returning();

    if (!updated) return null;

    // Check if all steps are now complete
    const allComplete = ALL_STEPS.every((s) => updated[s] === true);
    if (allComplete && !updated.completed_at) {
      const [final] = await db.update(onboarding_progress)
        .set({
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(onboarding_progress.user_id, userId))
        .returning();
      return toDomainOnboardingProgress(final);
    }

    return toDomainOnboardingProgress(updated);
  }
}
