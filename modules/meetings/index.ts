import type { ModuleDefinition, PlatformEvent } from "../../packages/registry/platform.js";

/** L'utilisateur qui a ouvert le lien : la route `/api/events/ui` l'écrit depuis la session. */
function userOf(event: PlatformEvent): string | null {
  return typeof event.payload.userId === "string" ? event.payload.userId : null;
}

/**
 * Module meetings — réunions de synchronisation Google Meet, leur analyse
 * après coup (`services/sync-meeting`).
 *
 * Désactivé par défaut : il demande un compte de service Google Workspace.
 * Désactivé, ses routes (`/api/sync-meetings/**`, `/api/challenges/[id]/meetings`)
 * répondent 404, ses slots (`distribution/modules/meetings.tsx`) disparaissent
 * et son job est sauté par le tick.
 */
export const meetingsModule: ModuleDefinition = {
  key: "meetings",
  label: "Meetings",
  description: "Google Meet sync meetings attached to challenges, analysed once they end.",
  defaultEnabled: false,
  events: [
    // Un clic sur « Join » : ne prouve que le clic, pas la présence.
    { type: "ui.meeting_link_opened" },
  ],
  quests: [
    {
      key: "joined_meeting",
      label: "Join a meeting",
      order: 5,
      event: "ui.meeting_link_opened",
      userOf,
    },
  ],
  jobs: [
    {
      // Détecte les réunions terminées et lance leur analyse.
      key: "meetings.check",
      schedule: "* * * * *",
      async run() {
        const { checkCompletedMeetings } = await import("../../packages/services/sync-meeting/cron-check-meetings.js");
        await checkCompletedMeetings();
      },
    },
  ],
};
