"use client";

/** L'interrupteur des formulaires, sur le vocabulaire vitrine (`.v-toggle`). */
export function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className="v-toggle"
      data-on={enabled ? "true" : "false"}
    >
      <span className="v-toggle-knob" />
    </button>
  );
}
