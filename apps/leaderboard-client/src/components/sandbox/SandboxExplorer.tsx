"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatCP } from "@/lib/formatters";
import type { SandboxView } from "@/lib/public/sandbox";
import type { SandboxStarTier } from "../../../../../packages/database-service/domain/entities";
import { CreateSandboxModal } from "./CreateSandboxModal";
import { SandboxCard } from "./SandboxCard";
import {
  filterAndSort,
  searchPool,
  statusCounts,
  type SandboxSort,
  type SandboxStatusFilter,
} from "./sandboxFilters";
import type { StarState } from "./StarButton";

interface SandboxListResponse {
  sandboxes: SandboxView[];
  tiers: SandboxStarTier[];
  promotion_bonus_cp: number;
}

/**
 * Les rôles autorisés à déposer une proposition.
 *
 * Copie assumée de `SANDBOX_CREATOR_ROLES` (`lib/server/sandboxAuth.ts`), que
 * ce composant client ne peut pas importer sans traîner un module serveur dans
 * le bundle. La règle est **appliquée par l'API** : ici, elle ne fait que
 * cacher un bouton qui mènerait à un 403.
 *
 * Un manager n'y figure pas : sur un sandbox, il est un contributeur ordinaire.
 */
const CREATOR_ROLES = ["admin", "contributor", "medical_pro"];

const SORTS: { key: SandboxSort; label: string }[] = [
  { key: "stars", label: "Most starred" },
  { key: "recent", label: "Newest" },
];

const PILLS: { key: SandboxStatusFilter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "promoted", label: "Promoted" },
  { key: "mine", label: "Mine" },
];

/**
 * Le listing public des propositions.
 *
 * Rendu par `app/sandbox/page.tsx`, qui est un composant serveur sans autre
 * rôle que de le monter : tout se lit ici, côté client, parce que la page est
 * publique et que l'état du visiteur (sa star, ses propositions) doit rester
 * hors du cache de rendu serveur.
 */
export function SandboxExplorer() {
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SandboxSort>("stars");
  const [status, setStatus] = useState<SandboxStatusFilter>("open");
  const [createOpen, setCreateOpen] = useState(false);

  /**
   * **Le fetch qui rafraîchit la session.**
   *
   * `/api/sandboxes/**` est hors du matcher du proxy : aucun refresh silencieux
   * n'y joue, et un access_token expiré y ferait passer un connecté pour un
   * anonyme — plus de « Mine », plus de « my_star », plus de bouton de
   * création. `/api/contributors/me`, lui, est dans le matcher : c'est ce
   * fetch-là qui renouvelle le jeton, exactement comme sur `challenges/[id]`.
   *
   * `retry: false` : un 401 est ici un état normal (visiteur non connecté), pas
   * une panne à réessayer trois fois.
   */
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchJson("/api/contributors/me"),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Attendu délibérément : le listing ne part qu'une fois le refresh joué,
  // sinon il se lirait avec le jeton expiré que `meQuery` est en train de
  // renouveler.
  const listQuery = useQuery({
    queryKey: ["sandboxes"],
    queryFn: () => fetchJson("/api/sandboxes") as Promise<SandboxListResponse>,
    enabled: !meQuery.isPending,
  });

  const me = meQuery.data?.user ?? null;
  const currentUserId: string | null = me?.id ?? null;
  const canCreate = !!me && CREATOR_ROLES.includes(me.role);

  const sandboxes = useMemo(() => listQuery.data?.sandboxes ?? [], [listQuery.data]);
  const tiers = listQuery.data?.tiers ?? [];
  const promotionBonusCp = listQuery.data?.promotion_bonus_cp ?? 0;

  const pool = useMemo(() => searchPool(sandboxes, query), [sandboxes, query]);
  const counts = useMemo(() => statusCounts(pool, currentUserId), [pool, currentUserId]);
  const visible = useMemo(
    () => filterAndSort(sandboxes, { query, status, sort, currentUserId }),
    [sandboxes, query, status, sort, currentUserId],
  );

  const headStats = useMemo(() => {
    const open = sandboxes.filter((s) => s.status === "open").length;
    const promoted = sandboxes.filter((s) => s.status === "promoted").length;
    const stars = sandboxes.reduce((sum, s) => sum + s.star_count, 0);
    return [
      { value: String(open), label: "Open sandboxes" },
      { value: formatCP(stars), label: "Stars given" },
      { value: String(promoted), label: "Promoted" },
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
        sandboxes: current.sandboxes.map((s) =>
          s.uuid === sandboxId
            ? {
                ...s,
                star_count: state.star_count,
                my_star: state.my_star,
                paid_tier_thresholds: state.paid_tier_thresholds,
              }
            : s,
        ),
      };
    });
  };

  const onCreated = (created: SandboxView) => {
    queryClient.setQueryData<SandboxListResponse>(["sandboxes"], (current) =>
      current ? { ...current, sandboxes: [created, ...current.sandboxes] } : current,
    );
    // La proposition part `open`, mais c'est sous « Mine » que son auteur la
    // cherchera juste après l'avoir déposée.
    setStatus("mine");
  };

  const loading = listQuery.isPending || meQuery.isPending;

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* ── En-tête ─────────────────────────────────────────────── */}
        <div className="animate-fade-up flex flex-wrap items-end justify-between gap-6">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="h-[2px] w-7 rounded-full bg-brandCP" />
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-brandCP">
                Community proposals
              </span>
            </div>
            <h1 className="text-4xl font-bold leading-[1.06] tracking-tight text-white sm:text-5xl">
              Sandbox
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              Anyone can propose an open challenge in the health domain — no approval needed to
              exist. The community stars what it wants built, star milestones pay the author, and
              the best ideas get promoted into official challenges.
            </p>
          </div>

          <div className="hidden flex-wrap gap-2.5 sm:flex">
            {headStats.map((stat) => (
              <div key={stat.label} className="flex min-w-[104px] flex-col gap-0.5 px-4 py-3">
                <span className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {stat.value}
                </span>
                <span className="text-[11px] text-white/45">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recherche, tri, création ────────────────────────────── */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sandboxes…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 transition-colors focus:border-brandCP/60 focus:outline-none"
              />
            </div>

            <div className="flex shrink-0 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
              {SORTS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    sort === key
                      ? "bg-white text-black"
                      : "text-white/45 hover:bg-white/[0.06] hover:text-white/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-brandCP/25 bg-brandCP/10 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/20 hover:shadow-[0_0_16px_rgba(10,247,193,0.15)]"
              >
                <Plus className="h-4 w-4" />
                New sandbox
              </button>
            )}
          </div>

          {/* ── Pills de statut ──────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5">
            <div className="flex flex-wrap gap-1.5">
              {PILLS.map(({ key, label }) => {
                const active = status === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      active
                        ? "bg-brandCP/20 text-brandCP shadow-[0_0_10px_rgba(10,247,193,0.12)]"
                        : "text-white/45 hover:bg-white/[0.05] hover:text-white/70"
                    }`}
                  >
                    {label}
                    <span
                      className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                        active ? "bg-brandCP/20 text-brandCP" : "bg-white/[0.06] text-white/40"
                      }`}
                    >
                      {counts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-white/40">
              {visible.length} sandbox{visible.length !== 1 ? "es" : ""} shown
            </span>
          </div>
        </div>

        {/* ── Grille ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-14 text-center text-sm text-white/40">
            Couldn’t load the sandboxes. Reload the page to try again.
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] py-16 text-center">
            <svg
              className="h-8 w-8 text-white/20"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803M10.5 7.5v6m3-3h-6"
              />
            </svg>
            <p className="text-sm text-white/40">
              {status === "mine" && sandboxes.length > 0
                ? "You haven’t proposed anything yet."
                : "No sandbox matches this filter."}
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-brandCP/20 bg-brandCP/10 px-5 py-2 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/20"
              >
                <Plus className="h-4 w-4" />
                Propose something
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        {tiers.length > 0 && (
          <p className="text-center text-[11px] text-white/25">
            Star milestones: {tiers.map((tier) => `${tier.stars}★ = ${formatCP(tier.cp)} CP`).join(" · ")}
            {promotionBonusCp > 0 && ` · promotion bonus ${formatCP(promotionBonusCp)} CP`}
          </p>
        )}
      </div>

      {/* Monté hors du conteneur animé : une modale `fixed` rendue dans un
          sous-arbre transformé se retrouverait confinée dans sa boîte. */}
      <CreateSandboxModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={onCreated}
      />
    </>
  );
}
