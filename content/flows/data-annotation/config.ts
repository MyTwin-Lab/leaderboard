import { z } from "zod";
import type { Challenge } from "../../../packages/database-service/domain/entities.js";
import { flowConfigOf } from "../../../packages/capabilities/flow-config.js";

/** Les deux types de ressource du flow : l'item à labelliser et le cas de contrôle caché. */
export const ITEM = "item";
export const GOLD = "gold";

/** Les classes d'un item : un item sensible exige la clearance. */
export const ITEM_CLASSES = ["standard", "sensitive"] as const;
export type ItemClass = (typeof ITEM_CLASSES)[number];

/** Les clés du ledger du flow. */
export const ANNOTATION_RULE_KEY = "annotation";
export const CLAWBACK_RULE_KEY = "annotation_clawback";
/** La contribution d'agrégat d'un annotateur. */
export const ANNOTATION_CONTRIBUTION_TYPE = "annotation";

const optionSchema = z.object({
  key: z.string().trim().regex(/^[a-z0-9_-]{1,32}$/, "option keys are 1-32 lowercase letters, digits, - or _"),
  label: z.string().trim().min(1).max(80),
});

export const labelSchemaSchema = z
  .object({
    kind: z.literal("single_choice"),
    options: z.array(optionSchema).min(2).max(12),
  })
  .refine((schema) => new Set(schema.options.map((o) => o.key)).size === schema.options.length, {
    message: "option keys must be unique",
  });

export type LabelSchema = z.infer<typeof labelSchemaSchema>;

/**
 * Configuration, version 1 — la structure de la campagne, fixée à la création :
 * - `k`, impair, le nombre de labels qui résolvent un item ;
 * - `ttl_hours`, la durée de vie d'une réclamation ;
 * - `label_schema`, les réponses possibles ;
 * - `sensitive_clearance`, ce qu'il faut de golds vus et de précision pour
 *   recevoir les items sensibles.
 */
export const annotationConfigSchema = z.object({
  k: z.number().int().min(1).max(15).refine((k) => k % 2 === 1, { message: "k must be odd" }).default(3),
  ttl_hours: z.number().int().min(1).max(24 * 30).default(48),
  label_schema: labelSchemaSchema,
  sensitive_clearance: z
    .object({
      min_seen: z.number().int().min(0).default(5),
      min_accuracy: z.number().min(0).max(1).default(0.8),
    })
    .default({ min_seen: 5, min_accuracy: 0.8 }),
});

export type AnnotationConfig = z.infer<typeof annotationConfigSchema>;

/** Règles de récompense, éditables pendant la campagne. */
export const annotationRulesSchema = z.object({
  per_unit_cp: z.number().int().min(0),
  gold_rate: z.number().min(0).max(1).default(0.1),
  audit_rate: z.number().min(0).max(1).default(0.1),
});

export type AnnotationRules = z.infer<typeof annotationRulesSchema>;

export const DEFAULT_ANNOTATION_RULES: AnnotationRules = { per_unit_cp: 5, gold_rate: 0.1, audit_rate: 0.1 };

export function parseAnnotationRules(raw: unknown): AnnotationRules | null {
  const parsed = annotationRulesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Les règles d'un challenge ; les règles par défaut s'il n'en a pas de lisibles. */
export function annotationRulesOf(challenge: Pick<Challenge, "reward_rules">): AnnotationRules {
  return parseAnnotationRules(challenge.reward_rules) ?? DEFAULT_ANNOTATION_RULES;
}

/** La configuration d'un challenge d'annotation, ou `null` si elle ne se lit pas. */
export function annotationConfigOf(challenge: Challenge): AnnotationConfig | null {
  const config = flowConfigOf(challenge);
  if (!config) return null;
  const parsed = annotationConfigSchema.safeParse(config);
  return parsed.success ? parsed.data : null;
}

export function isOption(schema: LabelSchema, value: unknown): value is string {
  return typeof value === "string" && schema.options.some((option) => option.key === value);
}
