import type { ModuleDefinition } from "../../packages/registry/platform.js";

/**
 * Module digest — le récapitulatif périodique de l'activité
 * (`services/digest`).
 *
 * N'est déclaré ici que son job ; le reste du module (réglages dans
 * `module_settings`, routes) rejoint ce dossier avec le lot L6.
 */
export const digestModule: ModuleDefinition = {
  key: "digest",
  jobs: [
    {
      // Génère un digest quand un est dû ; ne fait rien quand le digest est désactivé.
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
