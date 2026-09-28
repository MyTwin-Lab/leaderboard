import type { FlowFormLogic } from '@/lib/flowFormSlots';
import { noneFlowDescriptor } from '../../../../../content/flows/none/descriptor';

/**
 * Le challenge repère (`none`) : une entrée du catalogue sans travail
 * derrière, donc sans champ propre. À la création, la section pose seulement
 * son type ; à l'édition, rien.
 */
export const noneFormLogic: FlowFormLogic<Record<string, never>> = {
  key: noneFlowDescriptor.key,
  covers: (flowKey) => flowKey === noneFlowDescriptor.key,
  initialState: () => ({}),
  body: (_state, ctx) => (ctx.mode === 'create' ? { type: noneFlowDescriptor.key } : {}),
};
