// Ce que fait le moteur, en un schéma : trois familles de données entrent,
// quatre familles de résultats sortent. Les libellés sont ceux de l'article ;
// ni score, ni valeur.
const INK = "#11161a";
const MUTED = "#586067";
const LINE = "rgb(17 22 26 / 0.1)";
const ACCENT = "#0b7a64";
const SURFACE = "rgb(255 255 255 / 0.82)";

const CENTER = { x: 176, y: 110 };
const INPUTS = ["Blood tests", "Wearables", "Lifestyle"];
const OUTPUTS = ["Biological age", "Organ systems", "Risk projections", "What-if"];

const INPUT_X = 16;
const INPUT_WIDTH = 86;
const OUTPUT_X = 246;
const OUTPUT_WIDTH = 92;
const PILL_HEIGHT = 24;

function rowsY(count: number, gap: number) {
  const first = CENTER.y - ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => first + index * gap);
}

// Les données courent le long des liens, vers le moteur puis vers les
// résultats : un filet en pointillés qui avance, rien de plus.
const STYLE = `
.nme-flow { stroke-dasharray: 2 6; animation: nme-flow 1.6s linear infinite; }
@keyframes nme-flow { to { stroke-dashoffset: -16; } }
.nme-core { transform-box: fill-box; transform-origin: center; animation: nme-core 3.2s ease-in-out infinite; }
@keyframes nme-core { 0%, 100% { transform: scale(1); opacity: 0.18; } 50% { transform: scale(1.18); opacity: 0.08; } }
@media (prefers-reduced-motion: reduce) { .nme-flow, .nme-core { animation: none; } }
`;

function Pill({ x, y, width, label }: { x: number; y: number; width: number; label: string }) {
  return (
    <g>
      <rect
        x={x}
        y={y - PILL_HEIGHT / 2}
        width={width}
        height={PILL_HEIGHT}
        rx={PILL_HEIGHT / 2}
        fill={SURFACE}
        stroke={LINE}
      />
      <text x={x + width / 2} y={y + 3} textAnchor="middle" fill={INK} fontSize="8.5" fontWeight="500">
        {label}
      </text>
    </g>
  );
}

export function MyTwinEngineIllustration() {
  const inputYs = rowsY(INPUTS.length, 44);
  const outputYs = rowsY(OUTPUTS.length, 38);

  return (
    <div className="relative size-full">
      {/* Cadré en 16:10, le format des cartes ; `meet` : aucune étiquette n’est coupée dans un cadre plus large. */}
      <svg
        viewBox="0 0 352 220"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        className="absolute inset-0 size-full"
      >
        <style>{STYLE}</style>

        <g stroke={ACCENT} strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round">
          {inputYs.map((y) => (
            <path
              key={`in-${y}`}
              className="nme-flow"
              d={`M ${INPUT_X + INPUT_WIDTH} ${y} C ${CENTER.x - 34} ${y}, ${CENTER.x - 46} ${CENTER.y}, ${CENTER.x - 30} ${CENTER.y}`}
            />
          ))}
          {outputYs.map((y) => (
            <path
              key={`out-${y}`}
              className="nme-flow"
              d={`M ${CENTER.x + 30} ${CENTER.y} C ${CENTER.x + 46} ${CENTER.y}, ${OUTPUT_X - 30} ${y}, ${OUTPUT_X} ${y}`}
            />
          ))}
        </g>

        <circle className="nme-core" cx={CENTER.x} cy={CENTER.y} r="40" fill={ACCENT} />
        <circle cx={CENTER.x} cy={CENTER.y} r="30" fill="#fff" stroke={ACCENT} strokeOpacity="0.5" strokeWidth="1.2" />
        <text x={CENTER.x} y={CENTER.y - 2} textAnchor="middle" fill={MUTED} fontSize="6.5" letterSpacing="0.8">
          MYTWIN
        </text>
        <text x={CENTER.x} y={CENTER.y + 9} textAnchor="middle" fill={INK} fontSize="10" fontWeight="600">
          Engine
        </text>

        {INPUTS.map((label, index) => (
          <Pill key={label} x={INPUT_X} y={inputYs[index]} width={INPUT_WIDTH} label={label} />
        ))}
        {OUTPUTS.map((label, index) => (
          <Pill key={label} x={OUTPUT_X} y={outputYs[index]} width={OUTPUT_WIDTH} label={label} />
        ))}
      </svg>
    </div>
  );
}
