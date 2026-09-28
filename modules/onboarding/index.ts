import type { ModuleDefinition, PlatformEvent } from "../../packages/registry/platform.js";

/** L'utilisateur que l'événement désigne : son émetteur l'écrit dans `userId`. */
function userOf(event: PlatformEvent): string | null {
  return typeof event.payload.userId === "string" ? event.payload.userId : null;
}

// Import à la demande : déclarer le module ne charge pas la base.
async function progressRepository() {
  const { OnboardingProgressRepository } = await import(
    "../../packages/database-service/repositories/onboardingProgress.repo.js"
  );
  return new OnboardingProgressRepository();
}

/**
 * Module onboarding — les quêtes des premiers pas, et leur tiroir.
 *
 * Il enregistre toutes les quêtes de la plateforme (`questRecorder`), les
 * siennes comme celles que déclarent le flow code (`validated_task`) ou le
 * module meetings (`joined_meeting`). Une quête ne se valide que par
 * l'événement qui la complète, jamais depuis le navigateur.
 *
 * Désactivé, il ne consomme rien : les événements l'attendent dans l'outbox
 * (30 jours), le tiroir disparaît et `GET /api/onboarding` répond 404.
 */
export const onboardingModule: ModuleDefinition = {
  key: "onboarding",
  label: "Onboarding",
  description: "Getting-started quests for new contributors, completed by what they do on the platform.",
  defaultEnabled: false,
  questRecorder: {
    async record(userId, questKey, completedAt) {
      await (await progressRepository()).record(userId, questKey, completedAt);
    },
  },
  subscriptions: [
    {
      // La progression d'un nouveau compte. Les quêtes n'ont besoin d'aucune
      // ligne avant d'être accomplies : seule l'ancienne table, gardée pour un
      // retour arrière jusqu'en L7, en attend une.
      key: "onboarding.init-progress",
      event: "user.created",
      async handle(event) {
        const userId = userOf(event);
        if (userId) await (await progressRepository()).initLegacyRow(userId);
      },
    },
  ],
  quests: [
    { key: "clicked_challenge", label: "Explore a challenge", order: 1, event: "ui.challenge_opened", userOf },
    { key: "assigned_task", label: "Assign yourself to a task", order: 2, event: "task.created", userOf },
    { key: "evaluated_contribution", label: "Evaluate a contribution", order: 3, event: "contribution.evaluated", userOf },
  ],
};
