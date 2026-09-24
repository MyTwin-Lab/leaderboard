import { NewsFigure } from "@/components/news/NewsFigure";
import { cn } from "@/lib/utils";

// Les étapes reprennent la phrase de la section « A first step towards a model
// able to simulate » : de l'image du patient, à son modèle 3D, puis à un modèle
// dynamique. La dernière reste à construire, d'où sa bordure en pointillés.
const STEPS = [
  { tag: "Before", title: "The image of the patient", text: "A series of cross-section images from the exam." },
  { tag: "This step", title: "Their 3D model", text: "Structures segmented, then reconstructed in three dimensions.", current: true },
  { tag: "To come", title: "A dynamic model", text: "Enriched with other data, able to evolve over time.", planned: true },
];

export function ImageToDynamicModel() {
  return (
    <NewsFigure caption="The 3D anatomical model is the step in the middle: the dynamic model is still to be built.">
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4",
              step.current && "border-brandCP/40 bg-brandCP/[0.07]",
              step.planned && "border-dashed border-white/15 bg-white/[0.03]",
              !step.current && !step.planned && "border-white/10 bg-white/[0.04]",
            )}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">{step.tag}</span>
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="text-sm leading-relaxed text-white/60">{step.text}</p>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
