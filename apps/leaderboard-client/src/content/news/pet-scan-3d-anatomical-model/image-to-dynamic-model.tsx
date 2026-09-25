import { NewsFigure } from "@/components/news/NewsFigure";

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
      <ol className="v-nd-tiles">
        {STEPS.map((step) => (
          <li key={step.title} className="v-nd-tile" data-on={step.current} data-dashed={step.planned}>
            <span className="v-nd-tile-label" data-accent="true">
              {step.tag}
            </span>
            <span className="v-nd-tile-title">{step.title}</span>
            <span className="v-nd-tile-text">{step.text}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
