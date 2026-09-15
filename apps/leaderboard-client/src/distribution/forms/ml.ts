import {
  DEFAULT_ML_REWARD_RULES,
  parseMlRewardRules,
  type MlRewardRules,
} from '../../../../../packages/database-service/domain/mlRewardRules';
import { mlFlowDescriptor } from '../../../../../content/flows/ml/descriptor';
import type { FlowFormLogic } from '@/lib/flowFormSlots';
import { extensionConfigRecord } from './shared';

export interface MlFormState {
  rewardRules: MlRewardRules;
  /** La configuration éditable de l'extension compute. */
  computeEnabled: boolean;
  /** Création et promotion seulement : décide si le repo et l'étape API existent. */
  apiPackagingEnabled: boolean;
}

/** Section du flow ML : règles, puissance de calcul, étape d'API packaging. */
export const mlFormLogic: FlowFormLogic<MlFormState> = {
  key: mlFlowDescriptor.key,
  covers: (flowKey) => flowKey === mlFlowDescriptor.key,

  initialState(ctx) {
    if (ctx.mode === 'edit') {
      return {
        rewardRules: parseMlRewardRules(ctx.challenge?.reward_rules) ?? DEFAULT_ML_REWARD_RULES,
        computeEnabled: extensionConfigRecord(ctx.challenge, 'compute').enabled === true,
        apiPackagingEnabled: true,
      };
    }
    return { rewardRules: DEFAULT_ML_REWARD_RULES, computeEnabled: false, apiPackagingEnabled: true };
  },

  body(state, ctx) {
    const fields = { reward_rules: state.rewardRules, compute_enabled: state.computeEnabled };
    if (ctx.mode === 'edit') return fields;
    const creation = { ...fields, api_packaging_enabled: state.apiPackagingEnabled };
    return ctx.mode === 'create' ? { type: mlFlowDescriptor.key, ...creation } : creation;
  },
};
