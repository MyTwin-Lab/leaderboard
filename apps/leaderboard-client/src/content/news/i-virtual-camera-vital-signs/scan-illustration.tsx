// Une vidéo selfie de 30 secondes, dont la caméra tire l'onde de pouls. L'onde
// est une forme de pouls générique, pas une mesure, et aucun chiffre n'est
// affiché : le visuel illustre, il n'invente pas de résultat.
const INK = "#11161a";
const MUTED = "#586067";
const LINE = "rgb(17 22 26 / 0.1)";
const ACCENT = "#0b7a64";
const PULSE = "#e5484d";

// Un battement stylisé, large de 50 unités, qui revient à la ligne de base :
// répété, il défile sans raccord (voir `niv-wave`).
const BEAT = "l 10 0 l 7 -30 l 7 26 l 5 -7 l 7 9 l 14 2";
const WAVE = `M 0 206 ${Array.from({ length: 8 }, () => BEAT).join(" ")}`;

// L'animation vit dans le SVG : l'illustration ne dépend d'aucune feuille du
// Lab, et s'arrête avec `prefers-reduced-motion`.
const STYLE = `
.niv-progress { stroke-dasharray: 100; animation: niv-progress 6s linear infinite; }
@keyframes niv-progress {
  0% { stroke-dashoffset: 100; opacity: 1; }
  85% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
.niv-skin { animation: niv-beat 1.1s ease-in-out infinite; }
@keyframes niv-beat { 0%, 100% { opacity: 0.04; } 25% { opacity: 0.2; } }
.niv-wave { animation: niv-wave 1.1s linear infinite; }
@keyframes niv-wave { to { transform: translateX(-50px); } }
@media (prefers-reduced-motion: reduce) { .niv-progress, .niv-skin, .niv-wave { animation: none; } }
`;

export function ScanIllustration() {
  return (
    <div className="relative size-full">
      {/* Cadré en 16:10, le format des cartes. */}
      <svg
        viewBox="-16 14 352 220"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        className="absolute inset-0 size-full"
      >
        <style>{STYLE}</style>
        <defs>
          <clipPath id="niv-scan-frame">
            <circle cx="160" cy="96" r="58" />
          </clipPath>
          <linearGradient id="niv-scan-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.3" stopColor="#fff" />
            <stop offset="0.7" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="niv-scan-wave-mask">
            <rect x="40" y="160" width="240" height="60" fill="url(#niv-scan-fade)" />
          </mask>
        </defs>

        {/* L'anneau qui se remplit pendant les 30 secondes de la vidéo. */}
        <circle cx="160" cy="96" r="64" stroke={LINE} strokeWidth="2" />
        <circle
          className="niv-progress"
          cx="160"
          cy="96"
          r="64"
          pathLength={100}
          transform="rotate(-90 160 96)"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* La peau qui change imperceptiblement de teinte à chaque battement :
            c'est ce que la caméra lit. */}
        <ellipse className="niv-skin" cx="160" cy="86" rx="21" ry="26" fill={ACCENT} />
        <g clipPath="url(#niv-scan-frame)" stroke={INK} strokeOpacity="0.75" strokeWidth="1.5">
          <ellipse cx="160" cy="86" rx="21" ry="26" />
          <path d="M 108 170 C 110 138 134 122 160 122 C 186 122 210 138 212 170" />
        </g>

        <g mask="url(#niv-scan-wave-mask)">
          <path
            className="niv-wave"
            d={WAVE}
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
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
          Selfie video
        </small>
        30 seconds
      </div>
    </div>
  );
}
