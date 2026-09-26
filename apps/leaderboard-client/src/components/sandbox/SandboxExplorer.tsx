"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/fetchJson";
import type { SandboxView } from "@/lib/public/sandbox";
import type { SandboxStarTier } from "../../../../../packages/database-service/domain/entities";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { SearchIcon } from "@/components/vitrine/SearchIcon";
import { SandboxCard } from "./SandboxCard";
import {
  filterAndSort,
  searchPool,
  statusCounts,
  type SandboxStatusFilter,
} from "./sandboxFilters";
import type { StarState } from "./StarButton";

import "@/components/vitrine/vitrine.css";
import "./sandbox-vitrine.css";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { CreateSandboxStrip } from "@/components/vitrine/CreateSandboxStrip";

interface SandboxListResponse {
  sandboxes: SandboxView[];
  tiers: SandboxStarTier[];
  promotion_bonus_cp: number;
}

const PILLS: { key: SandboxStatusFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "promoted", label: "Promoted" },
  { key: "mine", label: "Mine" },
];

/**
 * Le listing public des propositions, d'après
 * `Sandbox Redesign Vitrine.dc.html`.
 *
 * Deux écarts assumés par rapport à la maquette, demandés avec elle : le menu
 * déroulant des types disparaît, et le lien « How MyTwin Lab works » reste
 * sous l'accroche.
 *
 * Tout se lit côté client, parce que l'état du visiteur (sa star, ses
 * propositions) dépend de sa session — sauf pour un
 * visiteur sans aucun cookie (`knownAnonymous`), à qui la page serveur
 * pré-remplit le listing pour qu'il arrive dans le HTML.
 */
export function SandboxExplorer({ knownAnonymous = false }: { knownAnonymous?: boolean }) {
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SandboxStatusFilter>("open");
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * **Le fetch qui rafraîchit la session.**
   *
   * `/api/sandboxes/**` est hors du matcher du proxy : aucun refresh silencieux
   * n'y joue, et un access_token expiré y ferait passer un connecté pour un
   * anonyme — plus de « Mine », plus de « my_star ». `/api/contributors/me`, lui, est dans le matcher : c'est ce
   * fetch-là qui renouvelle le jeton.
   *
   * `retry: false` : un 401 est ici un état normal (visiteur non connecté), pas
   * une panne à réessayer trois fois.
   */
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchJson("/api/contributors/me"),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: !knownAnonymous,
  });
  // Une requête désactivée reste `isPending` : c'est cette valeur qui dit si
  // la session est connue.
  const sessionKnown = knownAnonymous || !meQuery.isPending;

  // Attendu délibérément : le listing ne part qu'une fois le refresh joué,
  // sinon il se lirait avec le jeton expiré que `meQuery` est en train de
  // renouveler.
  const listQuery = useQuery({
    queryKey: ["sandboxes"],
    queryFn: () => fetchJson("/api/sandboxes") as Promise<SandboxListResponse>,
    enabled: sessionKnown,
  });

  const me = meQuery.data?.user ?? null;
  const currentUserId: string | null = me?.id ?? null;

  const sandboxes = useMemo(() => listQuery.data?.sandboxes ?? [], [listQuery.data]);

  const pool = useMemo(() => searchPool(sandboxes, query), [sandboxes, query]);
  const counts = useMemo(() => statusCounts(pool, currentUserId), [pool, currentUserId]);
  // Le tri de la maquette : les plus étoilées d'abord.
  const visible = useMemo(
    () => filterAndSort(sandboxes, { query, status, sort: "stars", currentUserId }),
    [sandboxes, query, status, currentUserId],
  );

  const headStats = useMemo(() => {
    const open = sandboxes.filter((sandbox) => sandbox.status === "open").length;
    const promoted = sandboxes.filter((sandbox) => sandbox.status === "promoted").length;
    const stars = sandboxes.reduce((sum, sandbox) => sum + sandbox.star_count, 0);
    return [
      { value: String(open), label: "Open sandboxes" },
      { value: String(stars), label: "Stars given" },
      { value: String(promoted), label: "Promoted so far" },
    ];
  }, [sandboxes]);

  /**
   * Le cache absorbe l'état renvoyé par `/star`, plutôt qu'un refetch complet
   * du listing : la réponse fait déjà autorité sur les trois champs qui
   * bougent, et un rechargement ferait sauter la grille sous le curseur.
   */
  const applyStarState = (sandboxId: string, state: StarState) => {
    queryClient.setQueryData<SandboxListResponse>(["sandboxes"], (current) => {
      if (!current) return current;
      return {
        ...current,
        sandboxes: current.sandboxes.map((sandbox) =>
          sandbox.uuid === sandboxId
            ? {
                ...sandbox,
                star_count: state.star_count,
                my_star: state.my_star,
                paid_tier_thresholds: state.paid_tier_thresholds,
              }
            : sandbox,
        ),
      };
    });
  };

  const loading = listQuery.isPending || !sessionKnown;

  return (
    <div className={`vitrine v-sandbox ${vitrineFontVars}`}>
      <div className="v-main">
        {/* ── En-tête ─────────────────────────────────────────────── */}
        <section className="v-head">
          <div className="v-head-text">
            <BackToLab />
            <h1 className="v-title">Sandbox</h1>
            <p className="v-lede">Anyone can propose a health project here — no committee.</p>
          </div>

          <dl className="v-stats">
            {headStats.map((stat) => (
              <div key={stat.label} className="v-stat">
                <dd className="v-stat-value">{stat.value}</dd>
                <dt className="v-stat-label">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Recherche et pills ──────────────────────────────────── */}
        <section className="v-sb-filters">
          <div className="v-sb-filters-row">
            <div className="v-search">
              <span className="v-search-icon">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sandboxes…"
              />
            </div>

          </div>

          <div className="v-sb-filters-row">
            <div className="v-pills">
              {PILLS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className="v-pill"
                  data-on={status === key ? "true" : "false"}
                  onClick={() => setStatus(key)}
                >
                  {label}
                  <span className="v-pill-count">{counts[key]}</span>
                </button>
              ))}
            </div>
            <span className="v-sb-count">
              {visible.length} sandbox{visible.length === 1 ? "" : "es"} shown
            </span>
          </div>
        </section>

        {/* ── La grille ───────────────────────────────────────────── */}
        {loading ? (
          <div className="v-sb-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="v-sb-skeleton" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="v-empty">
            <span className="v-empty-title">Couldn’t load the sandboxes</span>
            <span className="v-empty-sub">Reload the page to try again.</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="v-empty">
            <span className="v-empty-title">
              {status === "mine" && sandboxes.length > 0
                ? "You haven’t proposed anything yet"
                : "No sandbox matches this filter"}
            </span>
            <span className="v-empty-sub">Try another filter, or clear the search.</span>
          </div>
        ) : (
          <div ref={gridRef} className="v-sb-grid">
            {visible.map((sandbox, index) => (
              <SandboxCard
                key={sandbox.uuid}
                sandbox={sandbox}
                currentUserId={currentUserId}
                index={index}
                onStarState={applyStarState}
              />
            ))}
          </div>
        )}

        {/* ── Le bandeau de bas de page : un projet se propose désormais en
            prenant rendez-vous, pas en déposant soi-même une sandbox. ── */}
        <CreateSandboxStrip />
      </div>
    </div>
  );
}
