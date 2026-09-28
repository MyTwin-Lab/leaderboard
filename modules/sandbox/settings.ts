import { z } from "zod";
import {
  sandboxPromotionBonusSchema,
  sandboxStarTiersSchema,
} from "../../packages/database-service/domain/schemas_zod.js";

/**
 * Réglages du module sandbox (`module_settings.settings`) : l'économie des
 * étoiles. Les paliers se paient à la prochaine étoile, jamais rétroactivement
 * à l'enregistrement ; le bonus crédite l'auteur à la promotion.
 */
export const sandboxSettingsSchema = z.object({
  star_tiers: sandboxStarTiersSchema.default([]),
  promotion_bonus_cp: sandboxPromotionBonusSchema.default(0),
});

export type SandboxSettings = z.infer<typeof sandboxSettingsSchema>;
