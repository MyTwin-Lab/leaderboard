import type { ModuleDefinition } from "../../packages/registry/platform.js";

/**
 * Module meetings — réunions de synchronisation Google Meet, leur analyse
 * après coup (`services/sync-meeting`).
 *
 * N'est déclaré ici que son job ; le reste du module (réglages, routes,
 * slots) rejoint ce dossier avec le lot L6.
 */
export const meetingsModule: ModuleDefinition = {
  key: "meetings",
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
