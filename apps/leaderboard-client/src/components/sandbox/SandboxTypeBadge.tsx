import { BrainCircuit, Code2 } from "lucide-react";

/**
 * Le type d'un sandbox, `code` ou `ml`.
 *
 * Volontairement identique au badge de type d'un challenge
 * (`components/public/ChallengeCard.tsx`) : c'est le même vocabulaire, et un
 * sandbox promu devient un challenge de ce type-là. Deux badges différents
 * auraient laissé croire à deux taxonomies.
 */
const TYPE_BADGE: Record<string, { icon: typeof Code2; label: string }> = {
  ml: { icon: BrainCircuit, label: "ML" },
};

export function SandboxTypeBadge({ type, className = "" }: { type: string; className?: string }) {
  const { icon: Icon, label } = TYPE_BADGE[type] ?? { icon: Code2, label: "Code" };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brandCP ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
