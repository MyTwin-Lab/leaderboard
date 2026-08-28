import { z } from "zod";

/**
 * Règles de reward d'un challenge code (boards personnels).
 *
 * Même contrat que mlRewardRules.ts : stockées en JSON dans
 * `challenges.reward_rules`, versionnées, parsées en safeParse pour qu'un
 * challenge aux règles invalides s'affiche au lieu de planter.
 *
 * Points d'un run d'évaluation = fixed (livrable recevable) + cap × note/10.
 * Le delta itératif est calculé ailleurs (evaluator/code-reward.ts).
 */
export const codeRewardRulesV1Schema = z.object({
  version: z.literal(1),
  delivery: z.object({
    /** Part acquise dès qu'une évaluation aboutit, quelle que soit la note. */
    fixed: z.number().int().nonnegative(),
    /** Part variable maximale, modulée par la note agent /10. */
    cap: z.number().int().nonnegative(),
  }),
});

export type CodeRewardRules = z.infer<typeof codeRewardRulesV1Schema>;

/** Union des versions supportées — un seul membre aujourd'hui. */
export const codeRewardRulesSchema = codeRewardRulesV1Schema;

export function parseCodeRewardRules(raw: unknown): CodeRewardRules | null {
  if (!raw) return null;
  const result = codeRewardRulesSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const DEFAULT_CODE_REWARD_RULES: CodeRewardRules = {
  version: 1,
  delivery: { fixed: 25, cap: 75 },
};
