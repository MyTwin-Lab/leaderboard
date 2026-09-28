"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { ToastProvider, useToast } from "@/components/ui/Toast";
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

/**
 * L'explorateur de publications (`/watch`).
 *
 * L'URL porte les filtres (`lib/watch.ts`) : chaque changement la réécrit, et
 * la requête suit. Le champ de recherche attend 400 ms après la dernière
 * frappe, ou Entrée. Sans texte ni filtre, la page montre son aide et ses
 * exemples au lieu de chercher.
 *
 * Une erreur OpenAlex ne vide pas la liste : la dernière réponse reste
 * affichée, un toast le dit, et un bouton relance.
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
    <div className="space-y-3 animate-pulse" aria-hidden>
      {[...Array(5)].map((_, index) => (
        <div key={index} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="mt-3 h-3 w-1/2 rounded bg-white/8" />
          <div className="mt-3 h-3 w-full rounded bg-white/5" />
          <div className="mt-1.5 h-3 w-5/6 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

function Explorer({ highImpactThreshold }: WatchExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

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

  const lastError = useRef<unknown>(null);
  useEffect(() => {
    if (query.error && query.error !== lastError.current) {
      lastError.current = query.error;
      toast(query.error instanceof Error ? query.error.message : "Search failed", "error");
    }
  }, [query.error, toast]);

  const data = query.data;
  const facets = data?.facets.topics ?? [];
  const totalPages = data ? Math.min(MAX_WATCH_PAGE, Math.max(1, Math.ceil(data.total / data.page_size))) : 1;
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Watch</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/55">
          Search the health literature on OpenAlex. Filter by topic, period, open access and journal impact; every
          result links to PubMed when it has a PMID.
        </p>
      </div>

      {/* Barre de recherche */}
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          type="search"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Search health publications…"
          aria-label="Search health publications"
          autoFocus
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-24 text-sm text-white placeholder:text-white/30 focus:border-brandCP/40 focus:outline-none"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {text && (
            <button
              type="button"
              onClick={() => {
                setText("");
                submit("");
              }}
              aria-label="Clear search"
              className="rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 lg:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
        </div>
      </form>

      <div className="flex items-start gap-8">
        {/* Panneau des filtres : colonne à gauche, tiroir sur mobile. */}
        <aside className="hidden w-64 shrink-0 lg:block">{filtersPanel}</aside>
        {filtersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-black/60" />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[var(--background)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Filters</p>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-white/50 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {filtersPanel}
            </div>
          </div>
        )}

        <section className="min-w-0 flex-1 space-y-4">
          {initial ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
              <p className="text-sm text-white/60">Type a query, or start from an example.</p>
              <p className="mt-1 text-xs text-white/35">
                Results cover journal articles in English from the Health Sciences domain, most recent first.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {WATCH_EXAMPLE_QUERIES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setText(example);
                      apply({ q: example });
                    }}
                    className="rounded-full border border-brandCP/30 bg-brandCP/10 px-3 py-1.5 text-xs font-semibold text-brandCP transition-colors hover:bg-brandCP/20"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : !data ? (
            query.isError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] px-6 py-8 text-center">
                <p className="text-sm text-red-300">{query.error instanceof Error ? query.error.message : "Search failed"}</p>
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : (
              <Skeletons />
            )
          ) : data ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
                <span>
                  {data.total.toLocaleString("en-US")} result{data.total === 1 ? "" : "s"}
                  {query.isFetching && <span className="ml-2 text-white/25">updating…</span>}
                </span>
                {query.isError && (
                  <button
                    type="button"
                    onClick={() => void query.refetch()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-2.5 py-1 font-semibold text-red-300 hover:bg-red-500/10"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                )}
              </div>

              {data.high_impact_truncated && (
                <div className="rounded-xl border border-brandCP/20 bg-brandCP/[0.06] px-4 py-2.5 text-xs text-brandCP">
                  Showing the first {data.results.length} high-impact results — narrow your search to see more
                </div>
              )}

              {data.results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
                  <p className="text-sm text-white/60">No publication matches this search.</p>
                  <p className="mt-1 text-xs text-white/35">Try a broader period, fewer topics, or turn off a toggle.</p>
                </div>
              ) : (
                <div className={`space-y-3 ${query.isFetching ? "opacity-70 transition-opacity" : ""}`}>
                  {data.results.map((result) => (
                    <WatchResultCard key={result.id} result={result} highImpactThreshold={highImpactThreshold} />
                  ))}
                </div>
              )}

              {!filters.highImpact && (
                <WatchPagination page={data.page} totalPages={totalPages} onChange={(page) => apply({ page })} />
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export function WatchExplorer(props: WatchExplorerProps) {
  return (
    <ToastProvider>
      <Explorer {...props} />
    </ToastProvider>
  );
}
