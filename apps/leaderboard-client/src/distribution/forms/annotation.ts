import { dataAnnotationFlowDescriptor } from '../../../../../content/flows/data-annotation/descriptor';
import {
  DEFAULT_ANNOTATION_RULES,
  annotationConfigSchema,
  parseAnnotationRules,
  type AnnotationRules,
} from '../../../../../content/flows/data-annotation/config';
import type { FlowFormLogic } from '@/lib/flowFormSlots';
import { flowConfigRecord } from './shared';

export interface AnnotationOption {
  key: string;
  label: string;
}

export interface AnnotationFormState {
  /** Structure de la campagne, figée après la création. */
  k: number;
  ttlHours: number;
  options: AnnotationOption[];
  minSeen: number;
  minAccuracy: number;
  /** Politique, éditable pendant la campagne. */
  rules: AnnotationRules;
}

/** La clé d'une option tirée de son libellé : minuscules, chiffres, `-` et `_`. */
export function optionKeyOf(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function configOf(state: AnnotationFormState) {
  return {
    k: state.k,
    ttl_hours: state.ttlHours,
    label_schema: { kind: 'single_choice' as const, options: state.options.map((o) => ({ key: o.key.trim(), label: o.label.trim() })) },
    sensitive_clearance: { min_seen: state.minSeen, min_accuracy: state.minAccuracy },
  };
}

/** Section « Annotation » : structure de la campagne à la création, règles de paie à tout moment. */
export const annotationFormLogic: FlowFormLogic<AnnotationFormState> = {
  key: dataAnnotationFlowDescriptor.key,
  covers: (flowKey) => flowKey === dataAnnotationFlowDescriptor.key,

  initialState(ctx) {
    const config = flowConfigRecord(ctx.challenge);
    const schema = config.label_schema as { options?: AnnotationOption[] } | undefined;
    const clearance = (config.sensitive_clearance ?? {}) as Record<string, unknown>;
    return {
      k: numberOr(config.k, 3),
      ttlHours: numberOr(config.ttl_hours, 48),
      options: Array.isArray(schema?.options) && schema.options.length > 0
        ? schema.options.map((o) => ({ key: String(o.key), label: String(o.label) }))
        : [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }],
      minSeen: numberOr(clearance.min_seen, 5),
      minAccuracy: numberOr(clearance.min_accuracy, 0.8),
      rules: parseAnnotationRules(ctx.challenge?.reward_rules) ?? DEFAULT_ANNOTATION_RULES,
    };
  },

  validate(state, ctx) {
    if (!parseAnnotationRules(state.rules)) return 'Check the annotation pay: CP per label ≥ 0, rates between 0 and 1.';
    if (ctx.mode === 'edit') return null;
    const parsed = annotationConfigSchema.safeParse(configOf(state));
    if (parsed.success) return null;
    const issue = parsed.error.issues[0];
    return `Annotation setup: ${issue.path.join('.') || 'config'} — ${issue.message}`;
  },

  body(state, ctx) {
    if (ctx.mode === 'edit') return { reward_rules: state.rules };
    return { type: dataAnnotationFlowDescriptor.key, reward_rules: state.rules, flow_config: configOf(state) };
  },
};
