import type { ModuleDefinition } from "../../packages/registry/platform.js";
import { sandboxSettingsSchema } from "./settings.js";

export { sandboxSettingsSchema, type SandboxSettings } from "./settings.js";

/**
 * Module sandbox — propositions de la communauté, étoiles et promotion en
 * challenge. Ses CP vivent dans un ledger à part (`sandbox_rewards`) qui n'a ni
 * challenge ni contribution : le module les apporte au classement comme source
 * de CP.
 *
 * Ce qu'une proposition porte et comment elle s'évalue ne sont pas ici : chaque
 * flow proposable le déclare (`proposable`). Le module règle l'économie des
 * étoiles ; désactivé, ses routes et ses pages répondent 404.
 */
export const sandboxModule: ModuleDefinition = {
  key: "sandbox",
  label: "Sandbox",
  description: "Open proposals that the community stars, and that an admin can promote into challenges.",
  // Toujours actif avant les modules : une instance existante le garde.
  defaultEnabled: true,
  settings: { schema: sandboxSettingsSchema },
  jobs: [
    {
      // Les hachés d'IP des étoiles ne se gardent que 30 jours, digest activé ou non.
      key: "sandbox.ip-hashes.purge",
      schedule: "0 5 * * *",
      run: async () => (await import("./retention.js")).purgeIpHashes(),
    },
  ],
  cpSource: {
    key: "sandbox",
    // Import à la demande : déclarer le module ne doit pas ouvrir la base.
    async listAll() {
      const { SandboxRewardRepository } = await import("../../packages/database-service/repositories/index.js");
      return new SandboxRewardRepository().findAll();
    },
  },
  evaluationHandlers: [
    {
      // `SANDBOX_EVALUATION_HANDLER` du service d'évaluation.
      key: "formative",
      async retry(payload) {
        const { sandboxId, userId } = payload;
        if (typeof sandboxId !== "string" || typeof userId !== "string") {
          return { ok: false, reason: "invalid_payload" };
        }

        const { SandboxEvaluationService } = await import(
          "../../packages/services/sandbox/sandbox-evaluation.service.js"
        );
        const service = new SandboxEvaluationService();
        const event = { sandboxId, userId };

        const claimed = await service.claim(event);
        if (!claimed.ok) return { ok: false, reason: claimed.reason ?? "cannot_evaluate" };
        service.scheduleRun(event);
        return { ok: true };
      },
    },
  ],
};
