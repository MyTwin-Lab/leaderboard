import { CircleCheck, CircleDashed, FlaskConical, type LucideIcon } from "lucide-react";
import { NewsFigure } from "@/components/news/NewsFigure";
import { cn } from "@/lib/utils";

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
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, question, term, status, done }) => (
          <li
            key={term}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border p-5",
              done ? "border-brandCP/40 bg-brandCP/[0.07]" : "border-dashed border-white/15 bg-white/[0.02]",
            )}
          >
            <span className={cn("flex items-center gap-2", done ? "text-brandCP" : "text-white/45")}>
              <Icon aria-hidden className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em]">{term}</span>
            </span>
            <p className="text-balance text-base font-semibold leading-snug text-white">{question}</p>
            <p className="mt-auto text-sm leading-relaxed text-white/60">{status}</p>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
