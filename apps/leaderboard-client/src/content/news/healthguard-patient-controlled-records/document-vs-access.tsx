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
    <div className="v-nd-tile" data-on={highlighted} data-dashed={!highlighted}>
      <span className="v-nd-tile-label">{label}</span>
      <span className="v-nd-tile-title" data-lead="true">
        {title}
      </span>
      <ul className="v-nd-tile-list">
        {lines.map((line) => (
          <li key={line}>
            <span aria-hidden>{highlighted ? "✓" : "·"}</span>
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
      <div className="v-nd-tiles" data-wide="true">
        <Column label="Today" title="Sharing a document" lines={COPY} />
        <Column label="HealthGuard" title="Sharing access to a document" lines={ACCESS} highlighted />
      </div>
    </NewsFigure>
  );
}
