import { CircleCheck, CircleDashed, FlaskConical, type LucideIcon } from "lucide-react";
import { NewsFigure } from "@/components/news/NewsFigure";

type Step = {
  icon: LucideIcon;
  question: string;
  term: string;
  status: string;
  done: boolean;
};

// Chaque ligne reprend une phrase de la section « What the first benchmark
// shows » : ce qui a été mesuré, ce qui ne l'a pas été, ce qui viendra. Aucune
// valeur qui ne soit dans le texte.
const STEPS: Step[] = [
  {
    icon: CircleCheck,
    question: "How many injuries does it catch?",
    term: "Sensitivity",
    status: "Measured internally: more than 80% of injuries flagged within 14 days",
    done: true,
  },
  {
    icon: CircleDashed,
    question: "How many alerts are false alarms?",
    term: "Precision",
    status: "Not measured yet",
    done: false,
  },
  {
    icon: FlaskConical,
    question: "Does it hold up on data it has never seen?",
    term: "Independent validation",
    status: "The scientific study, with its own news",
    done: false,
  },
];

export function BenchmarkScope() {
  return (
    <NewsFigure caption="What the first benchmark measured, and what the study still has to show.">
      <ol className="v-nd-tiles" data-wide="true">
        {STEPS.map(({ icon: Icon, question, term, status, done }) => (
          <li key={term} className="v-nd-tile" data-on={done} data-dashed={!done}>
            <span className="v-nd-tile-label">
              <Icon aria-hidden className="h-4 w-4" />
              {term}
            </span>
            <span className="v-nd-tile-title" data-lead="true">
              {question}
            </span>
            <span className="v-nd-tile-text">{status}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
