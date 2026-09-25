import { NewsFigure } from "@/components/news/NewsFigure";
import { formatIndex } from "@/content/news/format";

// Les étapes de la section « The vision, and the road to it », dans l'ordre du
// texte. Seule la première est en cours.
const STEPS = [
  { title: "Open challenges", text: "Reproducible models on public data.", current: true },
  { title: "Clinical validation", text: "On independent data." },
  { title: "Medical device certification", text: "Under EU rules." },
  { title: "In women’s and hospitals’ hands", text: "MyTwin for Patients, licences for hospitals." },
];

export function RoadToPatients() {
  return (
    <NewsFigure caption="Where the work stands today, and the steps before any woman can use it.">
      <ol className="v-nd-tiles">
        {STEPS.map((step, index) => (
          <li key={step.title} className="v-nd-tile" data-on={step.current} data-dashed={!step.current}>
            <span className="v-nd-tile-label" data-accent={step.current}>
              {step.current ? (
                <>
                  <span aria-hidden className="v-nd-tile-dot" />
                  Today
                </>
              ) : (
                formatIndex(index)
              )}
            </span>
            <span className="v-nd-tile-title">{step.title}</span>
            <span className="v-nd-tile-text">{step.text}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
