import { NewsFigure } from "@/components/news/NewsFigure";

// Les étapes reprennent la section « Rehabilitation at home, supervised by the
// care team », et la dernière, la section « After rehabilitation, with MyTwin ».
const STEPS = [
  { place: "Hospital", title: "The cardiac event", text: "Heart attack or acute coronary syndrome." },
  { place: "Rehabilitation centre", title: "Assessment", text: "Exercise test and interviews. The care team decides." },
  { place: "Home", title: "Supervised sessions", text: "Bike and heart-rate sensor, followed remotely by the team." },
  { place: "Everyday life", title: "After rehabilitation", text: "Post-rehabilitation programmes, planned on MyTwin.", planned: true },
];

export function RehabPathway() {
  return (
    <NewsFigure caption="Ensweet’s hybrid pathway, as described on MyTwin Inside. The last step is what the two teams are working on.">
      <ol className="v-nd-tiles">
        {STEPS.map((step) => (
          <li key={step.title} className="v-nd-tile" data-dashed={step.planned} data-on={step.planned}>
            <span className="v-nd-tile-label" data-accent="true">
              {step.place}
            </span>
            <span className="v-nd-tile-title">{step.title}</span>
            <span className="v-nd-tile-text">{step.text}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
