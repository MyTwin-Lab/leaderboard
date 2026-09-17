import { NewsFigure } from "@/components/news/NewsFigure";
import { cn } from "@/lib/utils";

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
      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-4",
              step.human ? "border-brandCP/40 bg-brandCP/[0.07]" : "border-white/10 bg-white/[0.04]",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brandCP/15 text-xs font-bold text-brandCP">
                {index + 1}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">{step.actor}</span>
            </span>
            <p className="text-sm font-semibold text-white">{step.title}</p>
            <p className="text-sm leading-relaxed text-white/60">{step.text}</p>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
