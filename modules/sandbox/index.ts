import type { ModuleDefinition } from "../../packages/registry/platform.js";

/**
 * Module sandbox — propositions de la communauté, étoiles et promotion en
 * challenge. Ses CP vivent dans un ledger à part (`sandbox_rewards`) qui n'a ni
 * challenge ni contribution : le module les apporte au classement comme source
 * de CP.
 *
 * Seule la source de CP est déclarée ici ; le reste du module rejoint ce
 * dossier avec le lot L6.
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
};
