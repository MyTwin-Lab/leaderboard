import { z } from "zod";

/**
 * Règles de reward d'un challenge ML.
 *
 * Stockées en JSON dans `challenges.reward_rules` et versionnées : ces règles
 * vont bouger, et une version explicite permet de migrer les anciens challenges
 * sans casser ceux qui tournent.
 */

/** Métriques supportées : toutes dans [0,1] et "plus haut = mieux". */
export const ML_METRIC_NAMES = ["auc", "f1", "accuracy"] as const;
export type MlMetricName = (typeof ML_METRIC_NAMES)[number];

export const mlRewardRulesV1Schema = z.object({
  version: z.literal(1),

  dataset: z.object({
    /** Points max pour un dataset noté 100% par l'agent. */
    cap: z.number().int().nonnegative(),
  }),

  model: z.object({
    /** Points max de l'étape modèle, hors bonus "meilleur modèle". */
    cap: z.number().int().nonnegative(),
    /** Part du cap réservée au Kaggle (modulée par la métrique). Le reste va au GitHub. */
    kaggleShare: z.number().min(0).max(1).default(0.5),
    metric: z.object({
      name: z.enum(ML_METRIC_NAMES),
      /**
       * Seuil sous lequel la métrique ne rapporte rien.
       * Ex. 0.5 pour l'AUC : un modèle au niveau du hasard vaut 0.
       */
      baseline: z.number().min(0).max(1).default(0),
      /**
       * Seuil au-delà duquel les soumissions dataset/model/model_code se
       * ferment — seul l'API packaging reste accepté. Optionnel : absent =
       * pas de fermeture automatique, comportement actuel inchangé.
       */
      blockThreshold: z.number().min(0).max(1).optional(),
    }),
    /** Bonus fixe attribué à qui bat le meilleur score du challenge. */
    beatBestBonus: z.number().int().nonnegative(),
  }),

  apiPackaging: z.object({
    cap: z.number().int().nonnegative(),
  }),

  reuse: z.object({
    /** Part des points modèle du réutilisateur reversée à l'auteur du dataset. */
    datasetShare: z.number().min(0).max(1),
    /** Part des points modèle du réutilisateur reversée à l'auteur du modèle réutilisé. */
    modelShare: z.number().min(0).max(1),
    /**
     * Plancher de garde : le réutilisateur garde au moins cette fraction de ses
     * points bruts, quels que soient les prélèvements cumulés.
     */
    minKeepShare: z.number().min(0).max(1).default(0.5),
  }),
});

export type MlRewardRules = z.infer<typeof mlRewardRulesV1Schema>;

/** Union des versions supportées — un seul membre aujourd'hui. */
export const mlRewardRulesSchema = mlRewardRulesV1Schema;

/**
 * Parse des règles venant de la base (JSON non typé).
 * Renvoie null plutôt que de throw : un challenge ML sans règles valides doit
 * pouvoir s'afficher, pas planter la page.
 */
export function parseMlRewardRules(raw: unknown): MlRewardRules | null {
  if (!raw) return null;
  const result = mlRewardRulesSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const DEFAULT_ML_REWARD_RULES: MlRewardRules = {
  version: 1,
  dataset: { cap: 300 },
  model: {
    cap: 500,
    kaggleShare: 0.5,
    metric: { name: "auc", baseline: 0.5 },
    beatBestBonus: 50,
  },
  apiPackaging: { cap: 200 },
  reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
};
