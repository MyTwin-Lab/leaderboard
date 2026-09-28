import type { ModuleDefinition } from "../../packages/registry/platform.js";
import { sandboxSettingsSchema } from "./settings.js";

export { sandboxSettingsSchema, type SandboxSettings } from "./settings.js";

/**
 * Module sandbox — propositions de la communauté, étoiles et promotion en
 * challenge. Ses CP vivent dans un ledger à part (`sandbox_rewards`) qui n'a ni
 * challenge ni contribution : le module les apporte au classement comme source
 * de CP.
 *
 * Une proposition est un projet, pas un challenge en attente : ni type, ni
 * dépôt, ni évaluation — ce qui la fait avancer, ce sont ses stars, et c'est
 * l'admin qui choisit la forme du challenge à la promotion. Le module règle
 * l'économie des étoiles ; désactivé, ses routes et ses pages répondent 404.
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
};
