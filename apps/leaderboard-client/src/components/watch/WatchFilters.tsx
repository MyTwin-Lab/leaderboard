"use client";

import { useEffect, useState } from "react";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { Toggle } from "@/components/ui/Toggle";
import {
  VISIBLE_TOPIC_FACETS,
  WATCH_PERIODS,
  WATCH_SCOPES,
  WATCH_SORTS,
  type WatchFacet,
  type WatchFilters as Filters,
  type WatchSort,
} from "@/lib/watch";

/**
 * Le panneau des filtres de `/watch`. Il ne garde aucun état de filtre : tout
 * remonte à l'explorateur, qui l'écrit dans l'URL. Seul le champ « Min.
 * citations » a un brouillon local, validé à la sortie ou sur Entrée.
 */

export interface WatchFiltersProps {
  filters: Filters;
  facets: WatchFacet[];
  highImpactThreshold: number;
  onChange(patch: Partial<Filters>): void;
  onClear(): void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">{title}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`max-w-full truncate rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-brandCP/40 bg-brandCP/15 text-brandCP"
          : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function formatThreshold(threshold: number): string {
  return Number.isInteger(threshold) ? String(threshold) : threshold.toFixed(1);
}

export function WatchFilters({ filters, facets, highImpactThreshold, onChange, onClear }: WatchFiltersProps) {
  const [minCited, setMinCited] = useState(filters.minCited === null ? "" : String(filters.minCited));
  const [showAllTopics, setShowAllTopics] = useState(false);

  // L'URL a changé (retour arrière, lien) : le brouillon suit.
  useEffect(() => {
    setMinCited(filters.minCited === null ? "" : String(filters.minCited));
  }, [filters.minCited]);

  const commitMinCited = () => {
    const trimmed = minCited.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      setMinCited(filters.minCited === null ? "" : String(filters.minCited));
      return;
    }
    const next = value && value > 0 ? value : null;
    if (next !== filters.minCited) onChange({ minCited: next });
  };

  // Les topics choisis qui ne sont plus dans les facettes (une autre requête)
  // restent visibles : on doit pouvoir les retirer.
  const knownIds = new Set(facets.map((facet) => facet.id));
  const orphanTopics = filters.topics.filter((id) => !knownIds.has(id));
  const visibleFacets = showAllTopics ? facets : facets.slice(0, VISIBLE_TOPIC_FACETS);

  const toggleTopic = (id: string) => {
    const topics = filters.topics.includes(id) ? filters.topics.filter((topic) => topic !== id) : [...filters.topics, id];
    onChange({ topics });
  };

  const hasActiveFilter =
    filters.scope !== "all" ||
    filters.period !== "1y" ||
    filters.topics.length > 0 ||
    filters.oa ||
    filters.highImpact ||
    filters.minCited !== null ||
    filters.sort !== "relevance";

  return (
    <div className="space-y-5">
      <Section title="Search in">
        <div className="flex flex-col gap-1.5">
          {WATCH_SCOPES.map((scope) => (
            <label key={scope.key} className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
              <input
                type="radio"
                name="watch-scope"
                value={scope.key}
                checked={filters.scope === scope.key}
                onChange={() => onChange({ scope: scope.key })}
                className="accent-brandCP"
              />
              {scope.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Period">
        <div className="flex flex-wrap gap-1.5">
          {WATCH_PERIODS.map((period) => (
            <Chip key={period.key} active={filters.period === period.key} onClick={() => onChange({ period: period.key })}>
              {period.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Topics">
        {facets.length === 0 && orphanTopics.length === 0 ? (
          <p className="text-xs text-white/30">Topics appear once a search runs.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {orphanTopics.map((id) => (
              <Chip key={id} active onClick={() => toggleTopic(id)} title="Selected topic, not among the current facets">
                #{id}
              </Chip>
            ))}
            {visibleFacets.map((facet) => (
              <Chip key={facet.id} active={filters.topics.includes(facet.id)} onClick={() => toggleTopic(facet.id)} title={facet.name}>
                {facet.name} <span className="opacity-60">{facet.count.toLocaleString("en-US")}</span>
              </Chip>
            ))}
            {facets.length > VISIBLE_TOPIC_FACETS && (
              <button
                type="button"
                onClick={() => setShowAllTopics((value) => !value)}
                className="px-1 text-xs font-semibold text-brandCP hover:underline"
              >
                {showAllTopics ? "less" : `more (${facets.length - VISIBLE_TOPIC_FACETS})`}
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="Access & impact">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm text-white/70">
            <span>Open access only</span>
            <Toggle enabled={filters.oa} onChange={(value) => onChange({ oa: value })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-white/70">
            <span>
              High-impact journals only
              <span className="block text-xs text-white/35">journals with 2yr citedness ≥ {formatThreshold(highImpactThreshold)}</span>
            </span>
            <Toggle enabled={filters.highImpact} onChange={(value) => onChange({ highImpact: value })} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm text-white/70">
            <span>Min. citations</span>
            <input
              type="number"
              min={0}
              value={minCited}
              placeholder="any"
              onChange={(e) => setMinCited(e.target.value)}
              onBlur={commitMinCited}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitMinCited();
              }}
              className="w-20 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-right text-sm text-white focus:border-brandCP/40 focus:outline-none"
            />
          </label>
        </div>
      </Section>

      <Section title="Sort">
        <SelectDropdown
          options={WATCH_SORTS.map((sort) => ({ value: sort.key, label: sort.label }))}
          value={filters.sort}
          onChange={(value) => onChange({ sort: value as WatchSort })}
        />
        {filters.sort === "relevance" && !filters.q.trim() && (
          <p className="mt-1.5 text-xs text-white/35">Without a query, results are sorted by date.</p>
        )}
      </Section>

      {hasActiveFilter && (
        <button type="button" onClick={onClear} className="text-xs font-semibold text-white/50 hover:text-white">
          Reset filters
        </button>
      )}
    </div>
  );
}
