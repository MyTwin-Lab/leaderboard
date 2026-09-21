// Le principe de la section « Share access, not documents », en image : le
// dossier reste au patient, l'accès part vers une personne et une équipe, pour
// un temps donné (l'horloge), et celui d'un établissement a été révoqué.
const INK = "#11161a";
const MUTED = "#8b9196";
const LINE = "rgb(17 22 26 / 0.14)";
const ACCENT = "#0b7a64";
const PAPER = "#e6e4dd";

// L'animation vit dans le SVG : l'illustration ne dépend d'aucune feuille du
// Lab, et s'arrête avec `prefers-reduced-motion`.
const STYLE = `
.nhg-flow { stroke-dasharray: 1.5 7; animation: nhg-flow 1.6s linear infinite; }
@keyframes nhg-flow { to { stroke-dashoffset: -17; } }
@media (prefers-reduced-motion: reduce) { .nhg-flow { animation: none; } }
`;

function Node({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="22" fill="#fff" stroke={LINE} />
      <g fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </g>
  );
}

export function AccessIllustration() {
  return (
    <svg viewBox="26 22 276 158" className="h-[78%] w-auto max-w-[90%]">
      <style>{STYLE}</style>

      {/* Les accès : deux accordés, qui circulent, un révoqué, en pointillés. */}
      <path d="M132 96 H82" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="2" />
      <path d="M132 96 H82" className="nhg-flow" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M188 84 C 210 84, 222 60, 240 58" fill="none" stroke={ACCENT} strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M188 84 C 210 84, 222 60, 240 58"
        fill="none"
        className="nhg-flow"
        stroke={ACCENT}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M188 112 C 210 112, 222 138, 240 140" fill="none" stroke={MUTED} strokeWidth="1.6" strokeDasharray="3 4" />
      <g transform="translate(216 126)">
        <circle r="7" fill="#fff" stroke={LINE} />
        <path d="M-2.5 -2.5 L2.5 2.5 M2.5 -2.5 L-2.5 2.5" stroke={MUTED} strokeWidth="1.4" strokeLinecap="round" />
      </g>

      {/* Le dossier du patient, et le bouclier qui en garde les accès. */}
      <g>
        <rect x="132" y="56" width="56" height="76" rx="8" fill="#fff" stroke={LINE} />
        <rect x="142" y="68" width="30" height="4" rx="2" fill={PAPER} />
        <rect x="142" y="78" width="36" height="4" rx="2" fill={PAPER} />
        <rect x="142" y="88" width="24" height="4" rx="2" fill={PAPER} />
        <rect x="142" y="98" width="32" height="4" rx="2" fill={PAPER} />
        <rect x="142" y="108" width="20" height="4" rx="2" fill={PAPER} />
        <circle cx="186" cy="130" r="13" fill={ACCENT} />
        <path
          d="M186 122.5 l6 2.3 v4.2 c0 3.6 -2.6 6 -6 7.2 c-3.4 -1.2 -6 -3.6 -6 -7.2 v-4.2 z"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M183.4 129.4 l1.9 1.9 l3.4 -3.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Une personne. */}
      <Node x={60} y={96}>
        <circle cy="-5" r="5" />
        <path d="M-9 11 a9 8 0 0 1 18 0" />
      </Node>

      {/* Une équipe, pour un temps donné. */}
      <Node x={262} y={58}>
        <circle cx="-5" cy="-5" r="4" />
        <circle cx="6" cy="-4" r="3.4" />
        <path d="M-12 10 a7 6.5 0 0 1 14 0 M3 9 a6 5.5 0 0 1 10 0" />
      </Node>
      <g transform="translate(280 40)">
        <circle r="8" fill="#fff" stroke={LINE} />
        <path d="M0 -4 V0 L3 2" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Un établissement, dont l'accès a été retiré. */}
      <g opacity="0.55">
        <Node x={262} y={140}>
          <path d="M-11 -3 L0 -10 L11 -3 M-9 10 H9 M-7 -1 V7 M0 -1 V7 M7 -1 V7" />
        </Node>
      </g>
    </svg>
  );
}
