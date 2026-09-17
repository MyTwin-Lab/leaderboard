import { NewsFigure } from "@/components/news/NewsFigure";
import { cn } from "@/lib/utils";

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
      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4",
              step.current ? "border-brandCP/40 bg-brandCP/[0.07]" : "border-dashed border-white/15 bg-white/[0.02]",
            )}
          >
            <span className={cn("text-[11px] font-bold uppercase tracking-[0.18em]", step.current ? "text-brandCP" : "text-white/45")}>
              {step.current ? "Today" : `Step ${index + 1}`}
            </span>
            <p className="text-sm font-semibold leading-snug text-white">{step.title}</p>
            <p className="text-sm leading-relaxed text-white/60">{step.text}</p>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
