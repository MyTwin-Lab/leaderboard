import type { ModuleDefinition } from "../../packages/registry/platform.js";

/**
 * Module sandbox — propositions de la communauté, étoiles et promotion en
 * challenge. Ses CP vivent dans un ledger à part (`sandbox_rewards`) qui n'a ni
 * challenge ni contribution : le module les apporte au classement comme source
 * de CP.
 *
 * Sont déclarés ici la source de CP et le rejeu de l'évaluation formative ; le
 * reste du module rejoint ce dossier avec le lot L6.
 */
export const sandboxModule: ModuleDefinition = {
  key: "sandbox",
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
