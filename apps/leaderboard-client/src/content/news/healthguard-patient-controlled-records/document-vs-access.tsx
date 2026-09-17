import { NewsFigure } from "@/components/news/NewsFigure";

// Les deux colonnes reprennent la section « Share access, not documents » :
// le principe tel que le décrit le fondateur, rien de plus.
const COPY = ["A copy is sent by email.", "Nobody can say who still has it.", "It can’t be taken back."];

const ACCESS = [
  "The patient grants access to a person, a team or an institution.",
  "For part of the record, and for a set time.",
  "Every access is traced, and can be revoked at any time.",
];

function Column({ label, title, lines, highlighted }: { label: string; title: string; lines: string[]; highlighted?: boolean }) {
  return (
    <div
      className={
        highlighted
          ? "flex flex-col gap-3 rounded-2xl border border-brandCP/40 bg-brandCP/[0.07] p-5"
          : "flex flex-col gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5"
      }
    >
      <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${highlighted ? "text-brandCP" : "text-white/45"}`}>{label}</p>
      <p className="text-base font-semibold text-white">{title}</p>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-white/60">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className={highlighted ? "text-brandCP" : "text-white/35"}>
              {highlighted ? "✓" : "·"}
            </span>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocumentVsAccess() {
  return (
    <NewsFigure caption="HealthGuard’s principle, as its founder describes it.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Column label="Today" title="Sharing a document" lines={COPY} />
        <Column label="HealthGuard" title="Sharing access to a document" lines={ACCESS} highlighted />
      </div>
    </NewsFigure>
  );
}
