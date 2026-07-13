import { db } from "../db/drizzle";
import { onboarding_progress, users } from "../db/drizzle";
import { eq, ne } from "drizzle-orm";
import { toDomainOnboardingProgress } from "../db/mappers";
import type { OnboardingProgress, OnboardingProgressWithUser, OnboardingStep } from "../domain/entities";

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

  async findAllWithUsers(): Promise<OnboardingProgressWithUser[]> {
    const rows = await db
      .select({
        user_id: users.uuid,
        full_name: users.full_name,
        avatar_url: users.avatar_url,
        clicked_challenge: onboarding_progress.clicked_challenge,
        assigned_task: onboarding_progress.assigned_task,
        evaluated_contribution: onboarding_progress.evaluated_contribution,
        validated_task: onboarding_progress.validated_task,
        joined_meeting: onboarding_progress.joined_meeting,
        completed_at: onboarding_progress.completed_at,
      })
      .from(users)
      .leftJoin(onboarding_progress, eq(onboarding_progress.user_id, users.uuid))
      .where(ne(users.role, 'admin'))
      .orderBy(users.full_name);

    return rows.map(r => ({
      user_id: r.user_id,
      full_name: r.full_name,
      avatar_url: r.avatar_url ?? null,
      clicked_challenge: r.clicked_challenge ?? false,
      assigned_task: r.assigned_task ?? false,
      evaluated_contribution: r.evaluated_contribution ?? false,
      validated_task: r.validated_task ?? false,
      joined_meeting: r.joined_meeting ?? false,
      completed_at: r.completed_at ?? undefined,
    }));
  }

  async initForUser(userId: string): Promise<OnboardingProgress> {
    const [inserted] = await db.insert(onboarding_progress).values({
      user_id: userId,
    }).returning();
    return toDomainOnboardingProgress(inserted);
  }

  async markStepComplete(userId: string, step: OnboardingStep): Promise<OnboardingProgress | null> {
    const [updated] = await db.update(onboarding_progress)
      .set({
        [step]: true,
        updated_at: new Date(),
      })
      .where(eq(onboarding_progress.user_id, userId))
      .returning();

    if (!updated) return null;

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
