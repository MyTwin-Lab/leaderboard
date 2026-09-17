import { NewsFigure } from "@/components/news/NewsFigure";
import { cn } from "@/lib/utils";

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
      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4",
              step.planned ? "border-dashed border-brandCP/40 bg-brandCP/[0.05]" : "border-white/10 bg-white/[0.04]",
            )}
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">{step.place}</span>
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="text-sm leading-relaxed text-white/60">{step.text}</p>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
