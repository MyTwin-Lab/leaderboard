// Ce que le prototype estime : le risque de blessure d'un joueur jour après
// jour sur les 14 prochains jours, et le moment où il passe au-dessus du seuil
// d'alerte. Une courbe illustrative, pas un résultat : ni chiffre ni échelle.
const INK = "#11161a";
const MUTED = "#586067";
const LINE = "rgb(17 22 26 / 0.1)";
const ACCENT = "#0b7a64";
const ALERT = "#e5484d";
const BALL = "#c5dc3a";

// La hauteur de chaque jour, et le seuil au-dessus duquel le jour est signalé.
const DAYS = [22, 26, 24, 30, 34, 40, 50, 62, 74, 82, 77, 62, 50, 42];
const THRESHOLD = 68;
const BASELINE = 172;
const STEP = 16;
const FIRST_X = 64;
const BAR_WIDTH = 9;
const PEAK = DAYS.indexOf(Math.max(...DAYS));

// Les barres montent une à une, les jours signalés s'allument, puis tout
// redescend. L'animation vit dans le SVG : l'illustration ne dépend d'aucune
// feuille du Lab, et s'arrête avec `prefers-reduced-motion`.
const STYLE = `
.nrs-bar { transform-box: fill-box; transform-origin: 50% 100%; animation: nrs-bar 7s cubic-bezier(0.22, 0.61, 0.21, 1) infinite both; }
@keyframes nrs-bar {
  0% { transform: scaleY(0.08); }
  14%, 86% { transform: scaleY(1); }
  100% { transform: scaleY(0.08); }
}
.nrs-alert { transform-box: fill-box; transform-origin: center; animation: nrs-alert 7s ease-out infinite both; }
@keyframes nrs-alert {
  0%, 24% { opacity: 0; transform: scale(0.6); }
  30%, 84% { opacity: 1; transform: scale(1); }
  90%, 100% { opacity: 0; transform: scale(0.6); }
}
@media (prefers-reduced-motion: reduce) { .nrs-bar, .nrs-alert { animation: none; } }
`;

export function RiskWindowIllustration() {
  const peakX = FIRST_X + PEAK * STEP + BAR_WIDTH / 2;
  const peakTop = BASELINE - DAYS[PEAK];

  return (
    <div className="relative size-full">
      {/* Cadré en 16:10, le format des cartes. */}
      <svg viewBox="0 0 352 220" preserveAspectRatio="xMidYMid slice" fill="none" className="absolute inset-0 size-full">
        <style>{STYLE}</style>

        <path d={`M ${FIRST_X - 8} ${BASELINE + 0.5} H ${FIRST_X + 13 * STEP + BAR_WIDTH + 8}`} stroke={LINE} strokeWidth="1.2" />

        {DAYS.map((height, index) => (
          <rect
            key={index}
            className="nrs-bar"
            x={FIRST_X + index * STEP}
            y={BASELINE - height}
            width={BAR_WIDTH}
            height={height}
            rx="3"
            fill={height > THRESHOLD ? ALERT : ACCENT}
            fillOpacity={height > THRESHOLD ? 0.9 : 0.28}
            style={{ animationDelay: `${index * 0.07}s` }}
          />
        ))}

        {/* Le seuil d'alerte. */}
        <path
          d={`M ${FIRST_X - 8} ${BASELINE - THRESHOLD} H ${FIRST_X + 13 * STEP + BAR_WIDTH + 8}`}
          stroke={ALERT}
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <text
          x={FIRST_X - 8}
          y={BASELINE - THRESHOLD - 5}
          fill={MUTED}
          fontSize="8.5"
          fontWeight="500"
          letterSpacing="0.6"
        >
          HIGHER RISK
        </text>

        {/* L'alerte, au-dessus du jour le plus exposé. */}
        <g className="nrs-alert">
          <circle cx={peakX} cy={peakTop - 16} r="8" fill={ALERT} />
          <path d={`M ${peakX} ${peakTop - 20} V ${peakTop - 15.5}`} stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx={peakX} cy={peakTop - 12} r="1.1" fill="#fff" />
        </g>

        <g fill={MUTED} fontSize="8.5" fontWeight="500" letterSpacing="0.6">
          <text x={FIRST_X} y={BASELINE + 16}>
            TODAY
          </text>
          <text x={FIRST_X + 13 * STEP + BAR_WIDTH} y={BASELINE + 16} textAnchor="end">
            DAY 14
          </text>
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
          {/* Une balle de tennis. */}
          <svg viewBox="0 0 12 12" className="size-[1.1em]">
            <circle cx="6" cy="6" r="5.5" fill={BALL} />
            <path d="M 1.6 2.6 C 4.4 4 4.4 8 1.6 9.4 M 10.4 2.6 C 7.6 4 7.6 8 10.4 9.4" fill="none" stroke="#fff" strokeWidth="0.9" />
          </svg>
          Injury risk
        </small>
        Next 14 days
      </div>
    </div>
  );
}
