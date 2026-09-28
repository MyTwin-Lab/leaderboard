"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { WatchResult } from "@/lib/watch";

/**
 * Une publication, sur la surface des cartes vitrine : titre (lien externe),
 * revue et son score, date, citations, badge OA, auteurs, topic et abstract
 * replié sur deux lignes.
 */

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Le score d'impact de la revue : teinté au-dessus du seuil, gris en dessous, pointillé sans donnée. */
export function JournalScoreBadge({ score, threshold }: { score: number | null; threshold: number }) {
  if (score === null) {
    return (
      <span className="v-watch-score" data-none="true">
        no score
      </span>
    );
  }
  return (
    <span className="v-watch-score" data-high={score >= threshold ? "true" : "false"} title="Journal 2-year mean citedness (OpenAlex)">
      {score.toFixed(1)}
    </span>
  );
}

export function WatchResultCard({ result, highImpactThreshold }: { result: WatchResult; highImpactThreshold: number }) {
  const [expanded, setExpanded] = useState(false);
  const date = formatDate(result.publication_date);
  const hiddenAuthors = result.authors_count - result.authors.length;

  return (
    <article className="v-watch-result">
      <h3 className="v-watch-result-title">
        <a href={result.url} target="_blank" rel="noopener noreferrer">
          <span>{result.title}</span>
          <ExternalLink />
        </a>
      </h3>

      <div className="v-watch-meta">
        {result.journal.name && <span className="v-watch-meta-journal">{result.journal.name}</span>}
        <JournalScoreBadge score={result.journal.citedness_2yr} threshold={highImpactThreshold} />
        {date && (
          <>
            <span className="v-watch-dot">·</span>
            <span>{date}</span>
          </>
        )}
        <span className="v-watch-dot">·</span>
        <span>
          {result.cited_by_count.toLocaleString("en-US")} citation{result.cited_by_count === 1 ? "" : "s"}
        </span>
        {result.is_oa && (
          <a href={result.oa_url ?? result.url} target="_blank" rel="noopener noreferrer" title="Open access" className="v-watch-oa">
            OA
          </a>
        )}
      </div>

      {result.authors.length > 0 && (
        <p className="v-watch-authors">
          {result.authors.join(", ")}
          {hiddenAuthors > 0 && <span className="v-watch-authors-more"> +{hiddenAuthors}</span>}
        </p>
      )}

      {result.primary_topic && (
        <p className="v-watch-topic">
          {result.primary_topic.name}
          {result.primary_topic.subfield && <> · {result.primary_topic.subfield}</>}
        </p>
      )}

      {result.abstract ? (
        <>
          <p className="v-watch-abstract" data-folded={expanded ? "false" : "true"}>
            {result.abstract}
          </p>
          <button type="button" className="v-watch-fold" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Show less" : "Show more"}
          </button>
        </>
      ) : (
        <p className="v-watch-abstract-none">No abstract available</p>
      )}
    </article>
  );
}
