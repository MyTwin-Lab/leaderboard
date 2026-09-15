import { BrainCircuit, Code2, type LucideIcon } from 'lucide-react';
import { codeFlowDescriptor } from '../../../../../content/flows/code/descriptor';
import { mlFlowDescriptor } from '../../../../../content/flows/ml/descriptor';

/** Ce qu'une proposition deviendra à la promotion, et ce qu'elle demande à sa création. */
export interface SandboxKind {
  /** La clé du flow du challenge issu de la promotion (`sandboxes.type`). */
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Une URL de dataset requise et une URL de modèle optionnelle. */
  artifacts: boolean;
}

export const sandboxKinds: readonly SandboxKind[] = [
  { key: codeFlowDescriptor.key, label: 'Code', hint: 'A repository to build on', icon: Code2, artifacts: false },
  { key: mlFlowDescriptor.key, label: 'ML', hint: 'Dataset, model, evaluation', icon: BrainCircuit, artifacts: true },
];

/** La sorte d'une proposition ; la première pour un type inconnu. */
export function sandboxKindOf(type: string | null | undefined): SandboxKind {
  return sandboxKinds.find((kind) => kind.key === type) ?? sandboxKinds[0];
}
