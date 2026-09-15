import { BrainCircuit, Code2, ShieldCheck } from 'lucide-react';
import type { FlowFormSection } from '@/lib/flowFormSlots';
import { codeFormLogic } from './forms/code';
import { mlFormLogic } from './forms/ml';
import { validationFormLogic } from './forms/validation';
import { CodeDetails, CodeFields } from './forms/code-fields';
import { MlFields } from './forms/ml-fields';
import { ValidationDetails, ValidationFields } from './forms/validation-fields';

export { sandboxKinds, sandboxKindOf, type SandboxKind } from './forms/sandbox';

/**
 * Distribution MyTwin — formulaires de challenge
 * ----------------------------------------------
 * Les entrées du sélecteur de type du tiroir de challenge, avec leurs champs.
 * La logique de chaque section vit dans `forms/<entrée>.ts`, testable sans
 * navigateur ; les champs dans `forms/<entrée>-fields.tsx`.
 */
export const creatableFormSections: readonly FlowFormSection[] = [
  { ...codeFormLogic, label: 'Code', description: 'Tasks, Kanban, GitHub', icon: Code2, Fields: CodeFields, Details: CodeDetails },
  { ...mlFormLogic, label: 'ML', description: 'Dataset, Model, API', icon: BrainCircuit, Fields: MlFields },
  {
    ...validationFormLogic,
    label: 'Validation',
    description: 'Test a submitted API live',
    icon: ShieldCheck,
    Fields: ValidationFields,
    Details: ValidationDetails,
  },
];

export function formSectionByKey(key: string): FlowFormSection {
  return creatableFormSections.find((section) => section.key === key) ?? creatableFormSections[0];
}

/** La section d'un challenge existant ou d'une proposition, par la clé de son flow. */
export function formSectionFor(flowKey: string | null | undefined): FlowFormSection {
  return creatableFormSections.find((section) => section.covers(flowKey)) ?? creatableFormSections[0];
}
