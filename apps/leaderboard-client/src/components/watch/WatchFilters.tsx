"use client";

import { useEffect, useState } from "react";
import {
  VISIBLE_TOPIC_FACETS,
  WATCH_PERIODS,
  WATCH_SCOPES,
  WATCH_SORTS,
  type WatchFacet,
  type WatchFilters as Filters,
} from "@/lib/watch";

/**
 * La colonne des filtres de `/watch`, à la matière des vitrines : des pills
 * pour les choix exclusifs (où chercher, période, tri) comme pour les topics,
 * des interrupteurs pour l'accès ouvert et l'impact, un champ pour les
 * citations. Elle ne garde aucun état de filtre : tout remonte à
 * l'explorateur, qui l'écrit dans l'URL. Seul « Min. citations » a un
 * brouillon local, validé à la sortie ou sur Entrée.
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
    <div className="v-watch-section">
      <span className="v-eyebrow">{title}</span>
      {children}
    </div>
  );
}

function Pill({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick(): void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button type="button" className="v-pill" data-on={on ? "true" : "false"} onClick={onClick} title={title} aria-pressed={on}>
      {children}
    </button>
  );
}

function Switch({
  on,
  label,
  sub,
  onChange,
}: {
  on: boolean;
  label: string;
  sub?: string;
  onChange(value: boolean): void;
}) {
  return (
    <label className="v-watch-switch">
      <span className="v-watch-switch-text">
        <span>{label}</span>
        {sub && <span className="v-watch-switch-sub">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="v-watch-toggle"
        data-on={on ? "true" : "false"}
        onClick={() => onChange(!on)}
      >
        <span />
      </button>
    </label>
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
    <>
      <Section title="Search in">
        <div className="v-pills">
          {WATCH_SCOPES.map((scope) => (
            <Pill key={scope.key} on={filters.scope === scope.key} onClick={() => onChange({ scope: scope.key })}>
              {scope.label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Period">
        <div className="v-pills">
          {WATCH_PERIODS.map((period) => (
            <Pill key={period.key} on={filters.period === period.key} onClick={() => onChange({ period: period.key })}>
              {period.label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title="Topics">
        {facets.length === 0 && orphanTopics.length === 0 ? (
          <span className="v-watch-switch-sub">Topics appear once a search runs.</span>
        ) : (
          <div className="v-pills">
            {orphanTopics.map((id) => (
              <Pill key={id} on onClick={() => toggleTopic(id)} title="Selected topic, not among the current facets">
                <span>#{id}</span>
              </Pill>
            ))}
            {visibleFacets.map((facet) => (
              <Pill key={facet.id} on={filters.topics.includes(facet.id)} onClick={() => toggleTopic(facet.id)} title={facet.name}>
                <span>{facet.name}</span>
                <span className="v-pill-count">{facet.count.toLocaleString("en-US")}</span>
              </Pill>
            ))}
            {facets.length > VISIBLE_TOPIC_FACETS && (
              <button type="button" className="v-watch-more" onClick={() => setShowAllTopics((value) => !value)}>
                {showAllTopics ? "less" : `more (${facets.length - VISIBLE_TOPIC_FACETS})`}
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="Access & impact">
        <Switch on={filters.oa} label="Open access only" onChange={(value) => onChange({ oa: value })} />
        <Switch
          on={filters.highImpact}
          label="High-impact journals only"
          sub={`journals with 2yr citedness ≥ ${formatThreshold(highImpactThreshold)}`}
          onChange={(value) => onChange({ highImpact: value })}
        />
        <label className="v-watch-switch">
          <span className="v-watch-switch-text">
            <span>Min. citations</span>
          </span>
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
            className="v-watch-num"
          />
        </label>
      </Section>

      <Section title="Sort">
        <div className="v-pills">
          {WATCH_SORTS.map((sort) => (
            <Pill key={sort.key} on={filters.sort === sort.key} onClick={() => onChange({ sort: sort.key })}>
              {sort.label}
            </Pill>
          ))}
        </div>
        {filters.sort === "relevance" && !filters.q.trim() && (
          <span className="v-watch-switch-sub">Without a query, results are sorted by date.</span>
        )}
      </Section>

      {hasActiveFilter && (
        <button type="button" className="v-watch-reset" onClick={onClear}>
          Reset filters
        </button>
      )}
    </>
  );
}
