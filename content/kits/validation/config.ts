import { z } from "zod";
import { flowConfigOf, type FlowConfigSource } from "../../../packages/capabilities/flow-config.js";

/** Les CP fixes qu'une validation rapporte, prélevés sur le pool du challenge. */
export const cpPerValidationSchema = z.number().int().positive();

/** Le nombre de verdicts avant qu'une cible se résolve : impair, pour qu'une majorité existe. */
export const quorumSchema = z
  .number()
  .int()
  .positive()
  .refine((value) => value % 2 === 1, { message: "required_validations must be odd" });

export interface ValidationPayout {
  /** 0 quand la configuration ne se lit pas : rien n'est payé. */
  cp_per_validation: number;
  /** `null` pour un flow sans quorum (parcours de scénario). */
  required_validations: number | null;
}

/** Ce qu'un challenge de validation paie et exige, lu dans sa configuration. */
export function validationConfigOf(challenge: FlowConfigSource): ValidationPayout {
  const config = flowConfigOf(challenge);
  const cp = config?.cp_per_validation;
  const required = config?.required_validations;
  return {
    cp_per_validation: typeof cp === "number" ? cp : 0,
    required_validations: typeof required === "number" ? required : null,
  };
}

/**
 * La qualification exigée des relecteurs (`reviewer_qualification`), ou `null`
 * quand la configuration ne la porte pas : personne ne relit. Posée par la
 * validation d'endpoints ; lue aussi par les cibles du kit, qui disent à
 * l'appelant s'il peut relire.
 */
export function reviewerQualificationOf(challenge: FlowConfigSource): string | null {
  const key = flowConfigOf(challenge)?.reviewer_qualification;
  return typeof key === "string" && key ? key : null;
}
