import type { FlowRewardsContext } from "../../../packages/registry/platform.js";
import { parseMlRewardRules } from "../../../packages/database-service/domain/mlRewardRules.js";
import { MODEL_METRIC_META_FIELD, MODEL_METRIC_RULE_KEY } from "./metric.js";

/** Ce qu'un visiteur anonyme lit : la frise « battre le meilleur » et la meilleure valeur, ni règles ni personnes. */
export const ML_PUBLIC_REWARD_FIELDS = ["metric", "bestValue"] as const;

/**
 * Ce que le flow ML ajoute à l'état du pool : ses règles, la meilleure métrique
 * de chaque contributeur (sans nom, pour la frise), la meilleure valeur et si le
 * seuil qui ferme les soumissions de dataset et de modèle est atteint.
 */
export async function summarizeMlRewards({ challenge, entries, maxMetaNumber }: FlowRewardsContext): Promise<Record<string, unknown>> {
  const rules = parseMlRewardRules(challenge.reward_rules);
  if (!rules) return { rules: null, metric: null, bestValue: null, thresholdReached: false };

  const best = new Map<string, number>();
  for (const e of entries) {
    if (e.rule_key !== MODEL_METRIC_RULE_KEY) continue;
    const value = (e.meta as Record<string, unknown> | undefined)?.[MODEL_METRIC_META_FIELD];
    if (typeof value !== "number") continue;
    if (!best.has(e.user_id) || value > best.get(e.user_id)!) best.set(e.user_id, value);
  }

  // Un MAX SQL plutôt que le premier point ci-dessus : c'est la lecture même
  // de la garde de soumission, les deux ne peuvent pas diverger sur « atteint ».
  const bestValue = await maxMetaNumber({ ruleKey: MODEL_METRIC_RULE_KEY, field: MODEL_METRIC_META_FIELD });
  const blockThreshold = rules.model.metric.blockThreshold ?? null;

  return {
    rules,
    metric: {
      name: rules.model.metric.name,
      baseline: rules.model.metric.baseline,
      points: [...best.values()].sort((a, b) => b - a),
    },
    bestValue,
    thresholdReached: blockThreshold != null && bestValue != null && bestValue >= blockThreshold,
  };
}
