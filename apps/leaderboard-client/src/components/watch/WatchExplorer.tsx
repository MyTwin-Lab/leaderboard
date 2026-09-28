"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { SearchIcon } from "@/components/vitrine/SearchIcon";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import {
  DEFAULT_WATCH_FILTERS,
  MAX_WATCH_PAGE,
  WATCH_EXAMPLE_QUERIES,
  isInitialState,
  parseWatchFilters,
  serializeWatchFilters,
  toWatchApiQuery,
  type WatchFilters as Filters,
  type WatchSearchError,
  type WatchSearchResponse,
} from "@/lib/watch";
import { WatchFilters } from "./WatchFilters";
import { WatchPagination } from "./WatchPagination";
import { WatchResultCard } from "./WatchResultCard";

import "@/components/vitrine/vitrine.css";
import "./watch-vitrine.css";

/**
 * L'explorateur de publications (`/watch`), à la matière des vitrines : le
 * même en-tête et la même gélule de recherche que `/challenges`, les filtres
 * en colonne à gauche (un tiroir sur téléphone), les résultats à droite.
 *
 * L'URL porte les filtres (`lib/watch.ts`) : chaque changement la réécrit, et
 * la requête suit. Le champ de recherche attend 400 ms après la dernière
 * frappe, ou Entrée. Sans texte ni filtre, la page montre son aide et ses
 * exemples au lieu de chercher.
 *
 * Une erreur OpenAlex ne vide pas la liste : la dernière réponse reste
 * affichée, une ligne le dit, et un bouton relance.
 */

const DEBOUNCE_MS = 400;

interface WatchExplorerProps {
  highImpactThreshold: number;
}

/** Une réponse d'erreur de la route, ou le statut seul. */
class SearchRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function fetchSearch(query: string): Promise<WatchSearchResponse> {
  const res = await fetch(`/api/watch/search?${query}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as WatchSearchError | null;
    const message =
      res.status === 429
        ? "OpenAlex is rate limiting the server, try again in a moment"
        : res.status === 504
          ? "OpenAlex took too long to answer"
          : (body?.error ?? `Search failed (${res.status})`);
    throw new SearchRequestError(message, res.status);
  }
  return (await res.json()) as WatchSearchResponse;
}

function Skeletons() {
  return (
    <div className="v-watch-list" aria-hidden>
      {[...Array(5)].map((_, index) => (
        <div key={index} className="v-watch-skeleton">
          <span style={{ width: "72%" }} />
          <span style={{ width: "48%" }} />
          <span style={{ width: "100%" }} />
          <span style={{ width: "86%" }} />
        </div>
      ))}
    </div>
  );
}

function RetryButton({ onClick }: { onClick(): void }) {
  return (
    <button type="button" className="v-watch-retry" onClick={onClick}>
      <RefreshCw />
      Retry
    </button>
  );
}

export function WatchExplorer({ highImpactThreshold }: WatchExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseWatchFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const initial = isInitialState(filters);
  // La date du jour, fixée au montage : la clé de la requête ne bouge pas à chaque rendu.
  const today = useMemo(() => new Date(), []);

  const navigate = useCallback(
    (next: Filters, mode: "push" | "replace") => {
      const params = serializeWatchFilters(next).toString();
      const url = params ? `${pathname}?${params}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router],
  );

  /** Un changement de filtre repart en page 1 ; seul un changement de page la garde. */
  const apply = useCallback(
    (patch: Partial<Filters>, mode: "push" | "replace" = "push") => {
      navigate({ ...filters, ...patch, page: patch.page ?? 1 }, mode);
    },
    [filters, navigate],
  );

  // ── Champ de recherche : brouillon local, appliqué après 400 ms ou sur Entrée.
  const [text, setText] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setText(filters.q);
  }, [filters.q]);

  const submit = useCallback(
    (value: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (value.trim() !== filters.q.trim()) apply({ q: value.trim() }, "replace");
    },
    [apply, filters.q],
  );

  const onTextChange = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => submit(value), DEBOUNCE_MS);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // ── La requête.
  const apiQuery = useMemo(() => toWatchApiQuery(filters, today).toString(), [filters, today]);
  const query = useQuery({
    queryKey: ["watch-search", apiQuery],
    queryFn: () => fetchSearch(apiQuery),
    enabled: !initial,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });

  const data = query.data;
  const facets = data?.facets.topics ?? [];
  const totalPages = data ? Math.min(MAX_WATCH_PAGE, Math.max(1, Math.ceil(data.total / data.page_size))) : 1;
  const errorMessage = query.error instanceof Error ? query.error.message : query.error ? "Search failed" : null;
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Une navigation referme le tiroir des filtres.
  useEffect(() => setFiltersOpen(false), [searchParams]);

  const filtersPanel = (
    <WatchFilters
      filters={filters}
      facets={facets}
      highImpactThreshold={highImpactThreshold}
      onChange={(patch) => apply(patch)}
      onClear={() => navigate({ ...DEFAULT_WATCH_FILTERS, q: filters.q }, "push")}
    />
  );

  return (
    <div className={`vitrine v-watch ${vitrineFontVars}`}>
      <div className="v-main v-watch-main">
        <div className="v-head">
          <div className="v-head-text">
            <BackToLab />
            <h1 className="v-title">Watch</h1>
            <p className="v-lede">
              Search the health literature on OpenAlex. Filter by topic, period, open access and journal impact; every
              result links to PubMed when it has a PMID.
            </p>
          </div>
        </div>

        <form
          className="v-watch-search"
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
        >
          <div className="v-search">
            <span className="v-search-icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Search health publications…"
              aria-label="Search health publications"
              autoFocus
            />
            {text && (
              <button
                type="button"
                className="v-watch-clear"
                aria-label="Clear search"
                onClick={() => {
                  setText("");
                  submit("");
                }}
              >
                <X />
              </button>
            )}
          </div>
          <button type="button" className="v-pill v-watch-filters-btn" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal style={{ width: 14, height: 14 }} />
            Filters
          </button>
        </form>

        <div className="v-watch-body">
          {/* Colonne à gauche ; sur téléphone, un tiroir sous un voile. */}
          {filtersOpen && <button type="button" className="v-watch-scrim" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
          <aside className="v-watch-aside" data-open={filtersOpen ? "true" : "false"}>
            <div className="v-watch-aside-head">
              <span>Filters</span>
              <button type="button" aria-label="Close" onClick={() => setFiltersOpen(false)}>
                <X />
              </button>
            </div>
            {filtersPanel}
          </aside>

          <section className="v-watch-results">
            {initial ? (
              <div className="v-empty">
                <span className="v-empty-title">Type a query, or start from an example</span>
                <span className="v-empty-sub">
                  Results cover journal articles in English from the Health Sciences domain, most recent first.
                </span>
                <div className="v-watch-examples">
                  {WATCH_EXAMPLE_QUERIES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="v-chip"
                      onClick={() => {
                        setText(example);
                        apply({ q: example });
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : !data ? (
              query.isError ? (
                <div className="v-watch-alert">
                  <span>{errorMessage}</span>
                  <RetryButton onClick={() => void query.refetch()} />
                </div>
              ) : (
                <Skeletons />
              )
            ) : (
              <>
                <div className="v-watch-count">
                  <span>
                    {data.total.toLocaleString("en-US")} result{data.total === 1 ? "" : "s"}
                    {query.isFetching && " · updating…"}
                  </span>
                </div>

                {query.isError && (
                  <div className="v-watch-alert">
                    <span>{errorMessage} — showing the last results.</span>
                    <RetryButton onClick={() => void query.refetch()} />
                  </div>
                )}

                {data.high_impact_truncated && (
                  <div className="v-watch-strip">
                    <strong>Showing the first {data.results.length} high-impact results</strong> — narrow your search to see more
                  </div>
                )}

                {data.results.length === 0 ? (
                  <div className="v-empty">
                    <span className="v-empty-title">No publication matches this search</span>
                    <span className="v-empty-sub">Try a broader period, fewer topics, or turn off a toggle.</span>
                  </div>
                ) : (
                  <div className="v-watch-list" data-busy={query.isFetching ? "true" : "false"}>
                    {data.results.map((result) => (
                      <WatchResultCard key={result.id} result={result} highImpactThreshold={highImpactThreshold} />
                    ))}
                  </div>
                )}

                {!filters.highImpact && (
                  <WatchPagination page={data.page} totalPages={totalPages} onChange={(page) => apply({ page })} />
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
