import type { FlowFormLogic } from '@/lib/flowFormSlots';
import { codeFormLogic } from './code';
import { mlFormLogic } from './ml';
import { validationFormLogic } from './validation';

/** Les entrées du sélecteur de type, dans l'ordre affiché. La première est le défaut. */
export const formLogics: readonly FlowFormLogic[] = [codeFormLogic, mlFormLogic, validationFormLogic];

/** L'entrée d'un challenge existant ; celle du flow par défaut pour un type inconnu. */
export function formLogicFor(flowKey: string | null | undefined): FlowFormLogic {
  return formLogics.find((logic) => logic.covers(flowKey)) ?? codeFormLogic;
}
