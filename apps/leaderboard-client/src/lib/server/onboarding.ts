import "server-only";

import { repositories } from "@/lib/db";
import type { OnboardingProgress } from "../../../../../packages/database-service/domain/entities";

export async function fetchOnboardingProgress(userId: string): Promise<OnboardingProgress | null> {
  return repositories.onboardingProgress.findByUserId(userId);
}
