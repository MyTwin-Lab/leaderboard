import { z } from "zod";
import { flowConfigOf, type FlowConfigSource } from "../../../packages/capabilities/flow-config.js";

/**
 * Configuration du flow validation, version 1.
 *
 * - `cp_per_validation` : les CP fixes qu'une validation rapporte, sur le pool.
 * - `required_validations` : le quorum de verdicts avant qu'une cible se
 *   résolve, impair pour qu'une majorité existe. `null` face à une application
 *   parcourue en scénario, où chaque walkthrough paie sans rien résoudre.
 */
export const validationFlowConfigSchema = z
  .object({
    cp_per_validation: z.number().int().positive(),
    required_validations: z.number().int().positive().nullable().default(null),
  })
  .refine((config) => config.required_validations == null || config.required_validations % 2 === 1, {
    message: "required_validations must be odd",
    path: ["required_validations"],
  });

export type ValidationFlowConfig = z.infer<typeof validationFlowConfigSchema>;

/** La configuration d'un challenge de validation ; rien à payer ni à résoudre quand elle ne se lit pas. */
export function validationConfigOf(challenge: FlowConfigSource): ValidationFlowConfig {
  const config = flowConfigOf(challenge);
  const cp = config?.cp_per_validation;
  const required = config?.required_validations;
  return {
    cp_per_validation: typeof cp === "number" ? cp : 0,
    required_validations: typeof required === "number" ? required : null,
  };
}
