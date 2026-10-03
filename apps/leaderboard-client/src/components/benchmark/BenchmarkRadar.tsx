import "./benchmark-radar.css";

/**
 * Le radar et les six jauges du benchmark — les mêmes sur l'accueil (section
 * « Benchmark ») et sur `/benchmark` (« How advanced is it? »).
 *
 * Les valeurs sont celles de la maquette : un exemple de jumeau mûr, pas une
 * mesure. Le polygone du radar est tracé à partir des mêmes chiffres.
 */
export const BENCHMARK_SCORES = [
  { label: "Personalization", value: 82 },
  { label: "Multimodality", value: 68 },
  { label: "Longitudinality", value: 76 },
  { label: "Prediction", value: 62 },
  { label: "Validation", value: 58 },
  { label: "Actionability", value: 71 },
] as const;

const AXES = "M150 150V50M150 150L236.6 100M150 150L236.6 200M150 150V250M150 150L63.4 200M150 150L63.4 100";
const MATURE = "150,68 208.9,116 215.8,188 150,212 99.8,179 88.5,114.5";
const EARLY = "150,110 176,135 180.3,167.5 150,175 132.7,160 124,135";
const MATURE_DOTS = [
  [150, 68],
  [208.9, 116],
  [215.8, 188],
  [150, 212],
  [99.8, 179],
  [88.5, 114.5],
];

const line = { stroke: "var(--v-line)" };
const accent = { fill: "var(--v-accent)", stroke: "var(--v-accent)" };
const subtle = { fill: "var(--v-subtle)", stroke: "var(--v-subtle)" };

/**
 * Deux dessins, comme dans la maquette : le radar légendé du cadre PC, et
 * celui du cadre téléphone — recadré, sans libellés ni points, deux anneaux au
 * lieu de quatre. Un `viewBox` ne se change pas en CSS : les deux sont rendus,
 * la feuille n'en affiche qu'un.
 */
export function BenchmarkRadar({
  label,
  earlyStage = false,
}: {
  /** Le nom du graphique pour un lecteur d'écran. */
  label: string;
  /** Ajoute le second polygone, en pointillé : un jumeau à ses débuts. */
  earlyStage?: boolean;
}) {
  return (
    <>
      <svg className="v-radar v-radar-full" viewBox="-34 18 368 268" role="img" aria-label={label}>
        <g fill="none" strokeWidth="1" style={line}>
          <polygon points="150,50 236.6,100 236.6,200 150,250 63.4,200 63.4,100" />
          <polygon points="150,75 215,112.5 215,187.5 150,225 85,187.5 85,112.5" />
          <polygon points="150,100 193.3,125 193.3,175 150,200 106.7,175 106.7,125" />
          <polygon points="150,125 171.7,137.5 171.7,162.5 150,175 128.3,162.5 128.3,137.5" />
          <path d={AXES} />
        </g>
        {earlyStage && (
          <polygon points={EARLY} fillOpacity="0.12" strokeWidth="1.2" strokeDasharray="3 3" style={subtle} />
        )}
        <polygon points={MATURE} fillOpacity="0.16" strokeWidth="1.6" strokeLinejoin="round" style={accent} />
        <g style={{ fill: "var(--v-accent)" }}>
          {MATURE_DOTS.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" />
          ))}
        </g>
        <g fontSize="11" style={{ fill: "var(--v-muted)" }}>
          <text x="150" y="38" textAnchor="middle">Personalization</text>
          <text x="246" y="98" textAnchor="start">Multimodality</text>
          <text x="246" y="208" textAnchor="start">Longitudinality</text>
          <text x="150" y="272" textAnchor="middle">Prediction</text>
          <text x="54" y="208" textAnchor="end">Validation</text>
          <text x="54" y="98" textAnchor="end">Actionability</text>
        </g>
      </svg>

      {/* Les jauges à côté disent déjà les six valeurs : sur téléphone le
          radar n'est plus qu'une silhouette. */}
      <svg className="v-radar v-radar-compact" viewBox="55 45 190 210" aria-hidden="true">
        <g fill="none" strokeWidth="1.2" style={line}>
          <polygon points="150,50 236.6,100 236.6,200 150,250 63.4,200 63.4,100" />
          <polygon points="150,100 193.3,125 193.3,175 150,200 106.7,175 106.7,125" />
          <path d={AXES} />
        </g>
        {earlyStage && (
          <polygon points={EARLY} fillOpacity="0.14" strokeWidth="1.4" strokeDasharray="4 3" style={subtle} />
        )}
        <polygon points={MATURE} fillOpacity="0.16" strokeWidth="2" strokeLinejoin="round" style={accent} />
      </svg>
    </>
  );
}

/** Les six jauges. Leur gabarit (épaisseur, corps du chiffre) vient du parent. */
export function BenchmarkScores({ className }: { className?: string }) {
  return (
    <ul className={className ? `v-scores ${className}` : "v-scores"}>
      {BENCHMARK_SCORES.map((score) => (
        <li key={score.label} className="v-score">
          <span className="v-score-label">{score.label}</span>
          <span className="v-score-track" aria-hidden="true">
            <span style={{ width: `${score.value}%` }} />
          </span>
          <span className="v-score-pct">{score.value}%</span>
        </li>
      ))}
    </ul>
  );
}
