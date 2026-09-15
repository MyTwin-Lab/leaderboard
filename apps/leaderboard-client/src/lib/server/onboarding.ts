import "server-only";

import { repositories } from "@/lib/db";
import { ownerEnabled } from "@packages/capabilities/modules";
import { PlatformRegistry } from "@packages/registry/platform";

/** Une quête d'onboarding telle que le tiroir l'affiche. */
export interface OnboardingQuestView {
  key: string;
  label: string;
  description: string | null;
  completed: boolean;
}

/**
 * Les quêtes installées, dans leur ordre, et leur état pour ce compte. Une
 * quête dont le propriétaire est désactivé (le module meetings, par exemple)
 * ne s'affiche pas : personne ne pourrait l'accomplir.
 */
export async function fetchOnboardingQuests(userId: string): Promise<OnboardingQuestView[]> {
  const installed = PlatformRegistry.isInstalled() ? PlatformRegistry.quests() : [];
  const enabled = await Promise.all(installed.map((quest) => ownerEnabled(quest.owner)));
  const quests = installed.filter((_, index) => enabled[index]);
  if (quests.length === 0) return [];

  const completed = new Set((await repositories.onboardingProgress.findByUserId(userId)).map((row) => row.quest_key));
  return quests.map((quest) => ({
    key: quest.key,
    label: quest.label,
    description: quest.description ?? null,
    completed: completed.has(quest.key),
  }));
}
