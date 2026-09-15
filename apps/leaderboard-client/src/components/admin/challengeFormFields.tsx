import { Lock } from 'lucide-react';

/**
 * Les briques du tiroir de challenge, partagées avec les sections de
 * formulaire des flows (`src/distribution/forms`).
 */

/** Helper for muted foreground color at a given opacity (0–1). */
export function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

export const INPUT_CLASS =
  'rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]';

/** A value shown but not editable, styled to read as deliberate, not broken. */
export function LockedValue({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm"
      style={{ color: fgAt(0.5) }}
    >
      <Lock className="h-3 w-3 shrink-0" style={{ color: fgAt(0.25) }} />
      {text}
    </div>
  );
}

export function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'color-mix(in srgb, var(--foreground) 30%, transparent)' }}>
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}
