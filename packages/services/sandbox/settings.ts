import { modules, type Modules } from "../../capabilities/modules.js";
import type { SandboxStarTier } from "../../database-service/domain/entities.js";

/** La clé du module produit sandbox. */
export const SANDBOX_MODULE = "sandbox";

/** L'économie des étoiles, telle que le module la règle. */
export interface SandboxEconomySettings {
  star_tiers: SandboxStarTier[];
  promotion_bonus_cp: number;
}

/**
 * Les réglages du module sandbox. Déjà validés par le schéma du module
 * (`modules.settings`) ; lus ici défensivement parce qu'un module absent rend
 * `{}` — l'économie est alors inerte, sans palier ni bonus.
 */
export async function readSandboxSettings(registry: Pick<Modules, "settings"> = modules): Promise<SandboxEconomySettings> {
  const settings = await registry.settings(SANDBOX_MODULE);
  return {
    star_tiers: Array.isArray(settings.star_tiers) ? (settings.star_tiers as SandboxStarTier[]) : [],
    promotion_bonus_cp: typeof settings.promotion_bonus_cp === "number" ? settings.promotion_bonus_cp : 0,
  };
}
