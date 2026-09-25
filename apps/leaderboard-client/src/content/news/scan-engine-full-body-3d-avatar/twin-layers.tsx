import { NewsFigure } from "@/components/news/NewsFigure";

// Les couches reprennent la section « From the visible body to the invisible
// body » : le corps extérieur + l'anatomie interne + les données biologiques +
// l'évolution dans le temps. Seule la première est l'objet de cette news ; les
// autres restent à relier, d'où leur bordure en pointillés.
const LAYERS = [
  { name: "The outer body", source: "3D capture", text: "Proportions, volumes, posture, overall shape.", done: true },
  { name: "Internal anatomy", source: "Medical imaging", text: "Organs, anatomical structures, areas of interest." },
  { name: "Biological data", source: "Biology", text: "Biological and physiological data, medical history, biomarkers." },
  { name: "Evolution over time", source: "Follow-up", text: "How all of it changes, alongside the real patient." },
];

export function TwinLayers() {
  return (
    <NewsFigure caption="The full-body capture is the first layer. The others still have to be connected to it.">
      <ol className="v-nd-tiles">
        {LAYERS.map((layer) => (
          <li key={layer.name} className="v-nd-tile" data-on={layer.done} data-dashed={!layer.done}>
            <span className="v-nd-tile-label" data-accent="true">
              {layer.done && <span aria-hidden className="v-nd-tile-dot" />}
              {layer.done ? "This step" : layer.source}
            </span>
            <span className="v-nd-tile-title">{layer.name}</span>
            <span className="v-nd-tile-text">{layer.text}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
