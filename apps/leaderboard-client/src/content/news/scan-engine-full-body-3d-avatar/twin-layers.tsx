import { NewsFigure } from "@/components/news/NewsFigure";
import { cn } from "@/lib/utils";

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
      <ol className="grid gap-3 sm:grid-cols-4">
        {LAYERS.map((layer) => (
          <li
            key={layer.name}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4",
              layer.done ? "border-brandCP/40 bg-brandCP/[0.07]" : "border-dashed border-white/15 bg-white/[0.03]",
            )}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">
              {layer.done ? "This step" : layer.source}
            </span>
            <p className="text-sm font-semibold text-white">{layer.name}</p>
            <p className="text-sm leading-relaxed text-white/60">{layer.text}</p>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
