// Une séance de réadaptation à la maison : le vélo livré chez le patient, et
// la fréquence cardiaque suivie pendant l'effort, sous la limite de sécurité
// que fixe l'équipe soignante. L'onde est générique, pas une mesure, et aucun
// chiffre n'est affiché : le visuel illustre, il n'invente pas de résultat.
const INK = "#11161a";
const MUTED = "#586067";
const LINE = "rgb(17 22 26 / 0.1)";
const ACCENT = "#0b7a64";
const PULSE = "#e5484d";

// Un battement stylisé, large de 50 unités, qui revient à la ligne de base :
// répété, il défile sans raccord (voir `nes-wave`).
const BEAT = "l 10 0 l 4 -4 l 4 4 l 6 0 l 3 6 l 5 -28 l 5 30 l 3 -8 l 10 0";
const WAVE = `M 0 206 ${Array.from({ length: 9 }, () => BEAT).join(" ")}`;

// L'animation vit dans le SVG : l'illustration ne dépend d'aucune feuille du
// Lab, et s'arrête avec `prefers-reduced-motion`.
const STYLE = `
.nes-wave { animation: nes-wave 0.9s linear infinite; }
@keyframes nes-wave { to { transform: translateX(-50px); } }
.nes-crank { transform-origin: 175px 149px; animation: nes-crank 1.8s linear infinite; }
@keyframes nes-crank { to { transform: rotate(360deg); } }
.nes-heart { transform-box: fill-box; transform-origin: center; animation: nes-heart 0.9s ease-out infinite; }
@keyframes nes-heart { 0%, 100% { transform: scale(1); } 20% { transform: scale(1.18); } }
@media (prefers-reduced-motion: reduce) { .nes-wave, .nes-crank, .nes-heart { animation: none; } }
`;

export function HomeSessionIllustration() {
  return (
    <div className="relative size-full">
      {/* Cadré en 16:10, le format des cartes. */}
      <svg viewBox="0 0 352 220" preserveAspectRatio="xMidYMid slice" fill="none" className="absolute inset-0 size-full">
        <style>{STYLE}</style>
        <defs>
          <linearGradient id="nes-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.25" stopColor="#fff" />
            <stop offset="0.75" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="nes-wave-mask">
            <rect x="40" y="170" width="272" height="44" fill="url(#nes-fade)" />
          </mask>
        </defs>

        {/* La maison. */}
        <path d="M 124 84 L 176 44 L 228 84" stroke={INK} strokeOpacity="0.75" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 134 77 V 168 H 218 V 77" stroke={INK} strokeOpacity="0.3" strokeWidth="1.4" strokeLinejoin="round" />

        {/* Le vélo d'appartement, et le pédalier qui tourne. */}
        <g stroke={INK} strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 146 166 H 206" strokeWidth="2.4" />
          <path d="M 152 166 L 164 149 L 196 147 L 200 166" />
          <path d="M 164 149 L 160 116" />
          <path d="M 151 114 H 168" strokeWidth="3.2" />
          <path d="M 192 136 L 199 105 L 209 108" />
          <circle cx="196" cy="147" r="12" fill="#fff" />
          <circle cx="196" cy="147" r="2" fill={INK} stroke="none" />
          <g className="nes-crank">
            <path d="M 175 149 L 175 159 M 170 159 H 180" />
          </g>
          <circle cx="175" cy="149" r="3.5" fill="#fff" />
        </g>

        {/* Le capteur de fréquence cardiaque. */}
        <g transform="translate(203 84)">
          <circle r="11" fill="#fff" stroke={LINE} />
          <path
            className="nes-heart"
            d="M 0 4.6 C -1.6 3.2 -6 0.4 -6 -2.4 C -6 -4.4 -4.4 -5.6 -2.9 -5.6 C -1.6 -5.6 -0.6 -4.8 0 -3.8 C 0.6 -4.8 1.6 -5.6 2.9 -5.6 C 4.4 -5.6 6 -4.4 6 -2.4 C 6 0.4 1.6 3.2 0 4.6 Z"
            fill={PULSE}
          />
        </g>

        {/* La limite de sécurité fixée par l'équipe soignante, et l'onde qui
            reste en dessous. */}
        <path d="M 40 178 H 312" stroke={PULSE} strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="4 4" />
        <text x="312" y="173" textAnchor="end" fill={MUTED} fontSize="8.5" fontWeight="500" letterSpacing="0.6">
          SAFETY LIMIT
        </text>
        <g mask="url(#nes-wave-mask)">
          <path className="nes-wave" d={WAVE} stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

      <div
        className="absolute top-[1.4em] left-[1.4em] grid gap-[0.1em] rounded-[0.8em] border bg-[rgb(255_255_255/0.7)] px-[0.8em] py-[0.5em] text-[1.05em] font-medium leading-tight backdrop-blur-[8px]"
        style={{ borderColor: LINE, color: INK }}
      >
        <small
          className="flex items-center gap-[0.55em] text-[0.66em] font-normal uppercase tracking-[0.12em]"
          style={{ color: MUTED }}
        >
          <i className="size-[0.55em] rounded-full" style={{ background: PULSE }} />
          At home
        </small>
        3 to 4 weeks
      </div>
    </div>
  );
}
