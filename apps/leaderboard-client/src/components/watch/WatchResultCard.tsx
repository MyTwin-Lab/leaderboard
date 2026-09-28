"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { WatchResult } from "@/lib/watch";

/**
 * Une publication : titre (lien externe), revue et son score, date,
 * citations, badge OA, auteurs, topic et abstract replié.
 */

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** Le score d'impact de la revue : teinté au-dessus du seuil, neutre en dessous, discret sans donnée. */
export function JournalScoreBadge({ score, threshold }: { score: number | null; threshold: number }) {
  if (score === null) {
    return <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/35">no score</span>;
  }
  const high = score >= threshold;
  return (
    <span
      title="Journal 2-year mean citedness (OpenAlex)"
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        high ? "bg-brandCP/15 text-brandCP" : "bg-white/8 text-white/60"
      }`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export function WatchResultCard({ result, highImpactThreshold }: { result: WatchResult; highImpactThreshold: number }) {
  const [expanded, setExpanded] = useState(false);
  const date = formatDate(result.publication_date);
  const hiddenAuthors = result.authors_count - result.authors.length;

  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 shadow-md shadow-black/20">
      <h3 className="text-[15px] font-semibold leading-snug text-white">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-start gap-1.5 transition-colors hover:text-brandCP"
        >
          <span>{result.title}</span>
          <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-white/30" />
        </a>
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/50">
        {result.journal.name && <span className="text-white/70">{result.journal.name}</span>}
        <JournalScoreBadge score={result.journal.citedness_2yr} threshold={highImpactThreshold} />
        {date && (
          <>
            <span className="text-white/20">·</span>
            <span>{date}</span>
          </>
        )}
        <span className="text-white/20">·</span>
        <span>
          {formatCount(result.cited_by_count)} citation{result.cited_by_count === 1 ? "" : "s"}
        </span>
        {result.is_oa && (
          <a
            href={result.oa_url ?? result.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open access"
            className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-400"
          >
            OA
          </a>
        )}
      </div>

      {result.authors.length > 0 && (
        <p className="mt-1.5 text-xs text-white/45">
          {result.authors.join(", ")}
          {hiddenAuthors > 0 && <span className="text-white/30"> +{hiddenAuthors}</span>}
        </p>
      )}

      {result.primary_topic && (
        <p className="mt-1 text-[11px] text-white/35">
          {result.primary_topic.name}
          {result.primary_topic.subfield && <span className="text-white/25"> · {result.primary_topic.subfield}</span>}
        </p>
      )}

      <div className="mt-2.5">
        {result.abstract ? (
          <>
            <p className={`text-sm leading-relaxed text-white/60 ${expanded ? "" : "line-clamp-2"}`}>{result.abstract}</p>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 text-xs font-semibold text-brandCP hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          </>
        ) : (
          <p className="text-xs italic text-white/30">No abstract available</p>
        )}
      </div>
    </article>
  );
}
