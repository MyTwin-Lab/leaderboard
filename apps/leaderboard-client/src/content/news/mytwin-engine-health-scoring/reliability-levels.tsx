import { NewsFigure } from "@/components/news/NewsFigure";

type Level = {
  dot: string;
  term: string;
  title: string;
  example: string;
};

// Les quatre niveaux de la section « A reliability level on every score »,
// chacun avec l'exemple que le texte en donne. Aucune valeur de score.
const LEVELS: Level[] = [
  {
    dot: "#2f9e6a",
    term: "Validated",
    title: "A clinically validated model, used as published",
    example: "Fracture risk with QFracture",
  },
  {
    dot: "#d9a400",
    term: "Estimate",
    title: "Grounded in validated literature and risk factors",
    example: "Biological age with PhenoAge, a prognostic measure rather than a diagnosis",
  },
  {
    dot: "#e07b39",
    term: "Composite",
    title: "A wellness index of our own, not clinically validated",
    example: "The overall Health Score",
  },
  {
    dot: "#c9cdd1",
    term: "Not yet",
    title: "Not enough data or evidence for a reliable score",
    example: "Cancer: no composite score until screening data supports one",
  },
];

export function ReliabilityLevels() {
  return (
    <NewsFigure caption="Every score in the engine carries one of these four levels, shown next to the result.">
      <ol className="v-nd-tiles" data-wide="true">
        {LEVELS.map(({ dot, term, title, example }) => (
          <li key={term} className="v-nd-tile" data-dashed={term === "Not yet"}>
            <span className="v-nd-tile-label">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: dot }} />
              {term}
            </span>
            <span className="v-nd-tile-title" data-lead="true">
              {title}
            </span>
            <span className="v-nd-tile-text">{example}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
