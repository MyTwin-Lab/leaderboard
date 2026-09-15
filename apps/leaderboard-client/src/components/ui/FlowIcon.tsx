import { BrainCircuit, Code2, ShieldCheck, type LucideIcon } from 'lucide-react';

/**
 * Les icônes proposées aux flows. Un flow désigne la sienne par une clé dans
 * son descripteur (`icon`) : le contenu installé n'embarque aucun composant
 * React, et une clé inconnue retombe sur l'icône de code.
 */
const FLOW_ICONS: Record<string, LucideIcon> = {
  code: Code2,
  brain: BrainCircuit,
  shield: ShieldCheck,
};

export function FlowIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = FLOW_ICONS[icon] ?? Code2;
  return <Icon className={className} />;
}
