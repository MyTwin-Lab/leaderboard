import type { CSSProperties } from "react";

// Un lecteur d'écran parcourt tout, élément par élément ; la voix va droit au
// but. Le mode vocal est une idée à explorer dans l'article : la phrase dite
// l'illustre, elle ne décrit pas une fonction livrée.
const INK = "#11161a";
const SUBTLE = "#8b9196";
const PAPER = "#f5f4f0";
const MINT = "#0af7c1";

const ROWS = [
  ["Heading", "My health"],
  ["Button", "Add a measurement"],
  ["Menu", "Records, 6 items"],
  ["Link", "Blood test results"],
  ["Button", "Share with my doctor"],
] as const;

// L'animation vit dans le composant : l'illustration ne dépend d'aucune feuille
// du Lab, et s'arrête avec `prefers-reduced-motion`.
const STYLE = `
.nax-focus { animation: nax-focus 7.5s cubic-bezier(0.22, 0.61, 0.21, 1) infinite; }
@keyframes nax-focus {
  0%, 14% { transform: translateY(0); }
  20%, 34% { transform: translateY(100%); }
  40%, 54% { transform: translateY(200%); }
  60%, 74% { transform: translateY(300%); }
  80%, 94% { transform: translateY(400%); }
  100% { transform: translateY(0); }
}
.nax-wave i { animation: nax-wave 1.2s ease-in-out infinite; animation-delay: calc(var(--i) * -0.17s); }
@keyframes nax-wave { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) { .nax-focus, .nax-wave i { animation: none; } }
`;

export function ScreenReaderIllustration() {
  return (
    <div className="flex w-[86%] max-w-[24em] flex-col gap-[0.9em]">
      <style>{STYLE}</style>

      <div className="relative grid text-[0.85em]">
        <div
          className="nax-focus absolute inset-x-0 top-0 h-[2.6em] rounded-[0.75em] border-[1.5px] bg-[rgb(255_255_255/0.6)]"
          style={{ borderColor: INK }}
        />
        {ROWS.map(([role, label]) => (
          <div key={label} className="relative z-10 flex h-[2.6em] items-center gap-[0.9em] px-[0.9em]">
            <span className="w-[6em] flex-none text-[0.85em] uppercase tracking-[0.1em]" style={{ color: SUBTLE }}>
              {role}
            </span>
            <span className="truncate">{label}</span>
          </div>
        ))}
      </div>

      <div
        className="flex items-center gap-[0.9em] rounded-full px-[1.2em] py-[0.75em] text-[0.85em] leading-snug"
        style={{ background: INK, color: PAPER }}
      >
        <span className="nax-wave flex h-[1.2em] flex-none items-center gap-[2px]">
          {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
            <i
              key={bar}
              className="h-full w-[2px] rounded-[2px]"
              style={{ background: MINT, "--i": bar } as CSSProperties}
            />
          ))}
        </span>
        “Show me my last blood test”
      </div>
    </div>
  );
}
