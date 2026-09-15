import { z } from "zod";
import type { ModuleDefinition } from "../../packages/registry/platform.js";

/**
 * Réglages du digest (`module_settings.settings`) : sa fréquence, en jours
 * entiers. Une fréquence de 0 le rendrait dû en permanence.
 */
export const digestSettingsSchema = z.object({
  frequency_days: z.number().int().min(1).max(365).default(7),
});

/**
 * Module digest — le récapitulatif périodique de l'activité
 * (`services/digest`).
 *
 * Désactivé, son job est sauté par le tick. Le reste du module (routes,
 * lecture de ses réglages par le service) rejoint ce dossier avec le lot L6.
 */
export const digestModule: ModuleDefinition = {
  key: "digest",
  label: "Digest",
  description: "A periodic summary of the platform's activity.",
  settings: { schema: digestSettingsSchema },
  jobs: [
    {
      // Génère un digest quand un est dû.
      key: "digest.generate",
      schedule: "0 5 * * *",
      // Le résumé passe par un modèle de langage : le verrou couvre un appel lent.
      lockSeconds: 1800,
      async run() {
        const { runDigestCron } = await import("../../packages/services/digest/cron-digest.js");
        return runDigestCron();
      },
    },
  ],
};
