import { NewsFigure } from "@/components/news/NewsFigure";

// Les étapes reprennent la section « How Skinive works in MyTwin ». La dernière
// est volontairement hors de l'application : c'est le dermatologue qui pose le
// diagnostic.
const STEPS = [
  { actor: "You", title: "Take a photo", text: "Of the area of skin that worries you." },
  { actor: "Skinive’s AI", title: "Probable lesion types", text: "And the risk associated with them." },
  { actor: "MyTwin", title: "Simplified access", text: "To a dermatologist, from the result." },
  { actor: "Dermatologist", title: "Diagnosis", text: "Confirmed or ruled out by the doctor.", human: true },
];

export function SkinCheckFlow() {
  return (
    <NewsFigure caption="The app never makes the diagnosis: the path ends with a dermatologist.">
      <ol className="v-nd-tiles">
        {STEPS.map((step, index) => (
          <li key={step.title} className="v-nd-tile" data-on={step.human}>
            <span className="v-nd-tile-label" data-accent="true">
              <span className="v-nd-step-num" data-small="true">
                {index + 1}
              </span>
              {step.actor}
            </span>
            <span className="v-nd-tile-title">{step.title}</span>
            <span className="v-nd-tile-text">{step.text}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
