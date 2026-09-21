// Les deux challenges sur une même image : la lecture qui parcourt la
// mammographie (classification : y a-t-il quelque chose ?), puis le contour de
// la lésion (segmentation : où ?). Mammographie stylisée, vue craniocaudale,
// comme dans « That and where » : ce n'est pas une image médicale, et aucun
// score n'est affiché.
const INK = "#11161a";
const MUTED = "#586067";
const LINE = "rgb(17 22 26 / 0.1)";
const FILM = "#0d1316";
const MASK = "#0af7c1";

// La lecture balaie l'image, puis le contour se trace, tient, et s'efface.
// L'animation vit dans le SVG : l'illustration ne dépend d'aucune feuille du
// Lab, et s'arrête avec `prefers-reduced-motion`, qui montre l'état final.
const STYLE = `
.nmg-scan { animation: nmg-scan 6s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
@keyframes nmg-scan {
  0% { transform: translateY(0); opacity: 0; }
  5% { opacity: 1; }
  40% { transform: translateY(164px); opacity: 1; }
  45%, 100% { transform: translateY(164px); opacity: 0; }
}
.nmg-contour { stroke-dasharray: 100; animation: nmg-contour 6s ease-out infinite; }
@keyframes nmg-contour {
  0%, 42% { stroke-dashoffset: 100; opacity: 1; }
  62% { stroke-dashoffset: 0; opacity: 1; }
  90% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
.nmg-fill { animation: nmg-fill 6s ease-out infinite; }
@keyframes nmg-fill { 0%, 58% { opacity: 0; } 68%, 90% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .nmg-contour, .nmg-fill { animation: none; }
  .nmg-contour { stroke-dashoffset: 0; }
  .nmg-scan { display: none; }
}
`;

// Le contour de la lésion : une forme irrégulière, comme un masque de segmentation.
const LESION = "M 170 74 C 175 66 187 65 192 71 C 198 77 197 86 191 91 C 185 97 174 95 169 88 C 165 83 166 79 170 74 Z";

function Chip({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div
      className={`absolute grid gap-[0.1em] rounded-[0.8em] border bg-[rgb(255_255_255/0.78)] px-[0.8em] py-[0.5em] text-[1.05em] font-medium leading-tight backdrop-blur-[8px] ${className}`}
      style={{ borderColor: LINE, color: INK }}
    >
      <small className="text-[0.66em] font-normal uppercase tracking-[0.12em]" style={{ color: MUTED }}>
        {label}
      </small>
      {value}
    </div>
  );
}

export function MammogramIllustration() {
  return (
    <div className="relative size-full">
      {/* Cadré en 16:10, le format des cartes. */}
      <svg viewBox="0 0 352 220" preserveAspectRatio="xMidYMid slice" fill="none" className="absolute inset-0 size-full">
        <style>{STYLE}</style>
        <defs>
          <clipPath id="nmg-film">
            <rect x="108" y="28" width="136" height="164" rx="12" />
          </clipPath>
          <radialGradient id="nmg-tissue" cx="0" cy="0.5" r="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
            <stop offset="0.75" stopColor="#fff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.08" />
          </radialGradient>
          <linearGradient id="nmg-glow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={MASK} stopOpacity="0" />
            <stop offset="1" stopColor={MASK} stopOpacity="0.22" />
          </linearGradient>
          <filter id="nmg-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Le cliché. */}
        <rect x="108" y="28" width="136" height="164" rx="12" fill={FILM} />
        <g clipPath="url(#nmg-film)">
          <path d="M 108 36 C 190 42 232 94 232 110 C 232 126 190 178 108 184 Z" fill="url(#nmg-tissue)" />
          {/* Les travées de la glande, vers le mamelon. */}
          <g stroke="#fff" strokeOpacity="0.1" strokeWidth="1.2" strokeLinecap="round">
            <path d="M 112 60 C 150 70 190 90 224 108" />
            <path d="M 112 84 C 150 90 186 100 224 110" />
            <path d="M 112 110 C 150 110 190 110 226 110" />
            <path d="M 112 136 C 150 130 186 120 224 112" />
            <path d="M 112 160 C 150 150 190 130 224 112" />
          </g>
          {/* Les zones denses, et la lésion. */}
          <g fill="#fff" filter="url(#nmg-soft)">
            <ellipse cx="146" cy="96" rx="22" ry="30" fillOpacity="0.08" />
            <ellipse cx="160" cy="138" rx="18" ry="14" fillOpacity="0.07" />
            <ellipse cx="181" cy="80" rx="8" ry="6.5" fillOpacity="0.6" />
          </g>

          {/* La lecture qui parcourt l'image. */}
          <g className="nmg-scan">
            <rect x="108" y="4" width="136" height="24" fill="url(#nmg-glow)" />
            <path d="M 108 28 H 244" stroke={MASK} strokeWidth="1.4" />
          </g>

          {/* Le masque de segmentation. */}
          <path className="nmg-fill" d={LESION} fill={MASK} fillOpacity="0.16" />
          <path
            className="nmg-contour"
            d={LESION}
            pathLength={100}
            stroke={MASK}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      <Chip label="Classification" value="Suspicious?" className="top-[1.4em] left-[1.4em]" />
      <Chip label="Segmentation" value="Where exactly?" className="right-[1.4em] bottom-[1.4em]" />
    </div>
  );
}
