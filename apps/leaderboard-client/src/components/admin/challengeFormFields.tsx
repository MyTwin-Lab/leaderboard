import { Lock } from 'lucide-react';

/**
 * Les briques du tiroir de challenge, partagées avec les sections de
 * formulaire des flows (`src/distribution/forms`). Sur le vocabulaire commun
 * des tiroirs (`components/vitrine/forms-vitrine.css`).
 */

/**
 * Une couleur de texte atténuée (0–1). Sous une racine vitrine, c'est l'encre
 * de la maquette qui s'atténue ; ailleurs, le premier plan du Lab. Réservé
 * aux restes de style en ligne — un texte nouveau prend `.v-help` ou
 * `.v-label`.
 */
export function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--v-ink, var(--foreground)) ${Math.round(opacity * 100)}%, transparent)`;
}

/** La boîte d'un champ isolé, hors `.v-field`. */
export const INPUT_CLASS = 'v-input';

/** A value shown but not editable, styled to read as deliberate, not broken. */
export function LockedValue({ text }: { text: string }) {
  return (
    <div className="v-locked">
      <Lock />
      {text}
    </div>
  );
}

export function Field({ label, icon, hint, children }: { label: string; icon?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="v-field">
      <p className="v-label">
        {icon}
        {label}
      </p>
      {children}
      {hint && <p className="v-help" data-size="xs">{hint}</p>}
    </div>
  );
}
