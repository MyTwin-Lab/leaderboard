import { codeFlowDescriptor } from '../../../../../content/flows/code/descriptor';
import { mlFlowDescriptor } from '../../../../../content/flows/ml/descriptor';
import { ENDPOINT_VALIDATION_FLOW_KEY } from '../../../../../content/flows/endpoint-validation/descriptor';
import { JOURNEY_VALIDATION_FLOW_KEY } from '../../../../../content/flows/journey-validation/descriptor';
import type { FlowFormContext, FlowFormLogic } from '@/lib/flowFormSlots';
import { flowConfigRecord } from './shared';

/**
 * Le flow de validation qui éprouve les livrables d'un challenge source, par
 * flow du source. Côté serveur, la même rencontre se lit dans les livrables
 * déclarés (`flowsValidating`) ; le test de la distribution vérifie que les
 * deux disent la même chose. Le client n'a pas le registre : il lit cette table.
 */
export const VALIDATION_FLOW_BY_SOURCE: Readonly<Record<string, string>> = {
  [mlFlowDescriptor.key]: ENDPOINT_VALIDATION_FLOW_KEY,
  [codeFlowDescriptor.key]: JOURNEY_VALIDATION_FLOW_KEY,
};

export interface ValidationFormState {
  sourceChallengeId: string;
  /** Le flow du challenge source choisi : il décide du flow de validation créé. */
  sourceType: string | null;
  cpPerValidation: number;
  requiredValidations: number;
}

/** Le flow de validation du formulaire : celui du challenge édité, ou celui que le source décide. */
export function validationFlowOf(state: ValidationFormState, ctx: FlowFormContext): string | null {
  if (ctx.mode === 'edit') return ctx.challenge?.type ?? null;
  return state.sourceType ? VALIDATION_FLOW_BY_SOURCE[state.sourceType] ?? null : null;
}

/** Un parcours de scénario : pas de quorum, rien ne se résout à la majorité. */
export function isScenarioValidation(state: ValidationFormState, ctx: FlowFormContext): boolean {
  return validationFlowOf(state, ctx) === JOURNEY_VALIDATION_FLOW_KEY;
}

/**
 * Section « Validation » : une seule entrée pour les deux flows de validation.
 * Le source, le forfait et le quorum sont figés après la création — les
 * validateurs travaillent déjà contre eux.
 */
export const validationFormLogic: FlowFormLogic<ValidationFormState> = {
  key: 'validation',
  covers: (flowKey) => flowKey === ENDPOINT_VALIDATION_FLOW_KEY || flowKey === JOURNEY_VALIDATION_FLOW_KEY,

  initialState(ctx) {
    const config = flowConfigRecord(ctx.challenge);
    return {
      sourceChallengeId: ctx.challenge?.source_challenge_id ?? '',
      sourceType: null,
      cpPerValidation: typeof config.cp_per_validation === 'number' && config.cp_per_validation > 0 ? config.cp_per_validation : 5,
      requiredValidations: typeof config.required_validations === 'number' ? config.required_validations : 3,
    };
  },

  validate(state, ctx) {
    if (ctx.mode !== 'create') return null;
    if (!state.sourceChallengeId || !validationFlowOf(state, ctx)) {
      return 'Pick the source challenge this validation challenge tests.';
    }
    return null;
  },

  body(state, ctx) {
    // Un challenge de validation n'a ni règles de pool ni puissance de calcul.
    const fields = { reward_rules: null, compute_enabled: false };
    if (ctx.mode !== 'create') return fields;
    return {
      type: validationFlowOf(state, ctx),
      ...fields,
      source_challenge_id: state.sourceChallengeId,
      cp_per_validation: state.cpPerValidation,
      required_validations: isScenarioValidation(state, ctx) ? undefined : state.requiredValidations,
    };
  },
};
