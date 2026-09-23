"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import { challengePath, sandboxPath } from "@/lib/paths";
import type { SandboxDetailResponse, SandboxListResponse, SandboxView } from "@/lib/public/sandbox";
import type { SandboxStarTier } from "../../../../../../packages/database-service/domain/entities";
import { CreateChallengeDrawer } from "@/components/admin/CreateChallengeDrawer";
import { CreateSandboxModal } from "@/components/sandbox/CreateSandboxModal";
import { SandboxVitrine } from "@/components/sandbox/vitrine/SandboxVitrine";
import type { StarState } from "@/components/sandbox/StarButton";

/**
 * Le squelette, à la mesure de la maquette : la photo pleine largeur, puis les
 * deux colonnes de la proposition.
 *
 * Aux couleurs du Lab et non à celles de la vitrine : `useVitrineChrome` ne
 * repeint le fond qu'au montage de `SandboxVitrine`, donc l'attente se passe
 * encore sur le thème ordinaire.
 */
function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-[min(38rem,74svh)] rounded-[1.75rem] bg-white/[0.06]" />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 rounded-full bg-white/5" />
          ))}
        </div>
        <div className="h-56 rounded-[1.25rem] bg-white/5" />
      </div>
    </div>
  );
}

/**
 * La page d'une proposition — **publique**, sur le motif de
 * `challenges/[slug]/ChallengeDetailClient.tsx`.
 *
 * `knownAnonymous` : `page.tsx` sait que le visiteur n'a aucun cookie et a
 * pré-rempli le détail. Pour lui, pas de `meQuery` à attendre — il ne peut
 * répondre qu'un 401, et c'est cette attente qui réduisait le HTML serveur à
 * un squelette.
 *
 * Le `meQuery` n'est pas décoratif : `/api/sandboxes/**` est hors du matcher
 * du proxy, donc aucun refresh silencieux n'y joue. Sans ce fetch vers
 * `/api/contributors/me` — lui dans le matcher — un utilisateur connecté au
 * jeton expiré passerait pour un anonyme : plus de bouton Edit, plus de score,
 * et son étoile disparaîtrait sous ses yeux.
 */
export default function SandboxDetailClient({
  sandboxId,
  knownAnonymous = false,
}: {
  sandboxId: string;
  knownAnonymous?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchJson("/api/contributors/me"),
    staleTime: 5 * 60_000,
    // Un 401 est ici un état normal — la page est publique.
    retry: false,
    enabled: !knownAnonymous,
  });
  // `isPending` reste vrai sur une requête désactivée : c'est donc cette
  // valeur, et non `meQuery.isPending`, qui dit si la session est connue.
  const sessionKnown = knownAnonymous || !meQuery.isPending;

  const sandboxQuery = useQuery({
    queryKey: ["sandbox", sandboxId],
    queryFn: () => fetchJson(`/api/sandboxes/${sandboxId}`) as Promise<SandboxDetailResponse>,
    // Après le refresh de session, sinon le détail se lirait avec le jeton
    // expiré que `meQuery` est en train de renouveler.
    enabled: !!sandboxId && sessionKnown,
    /**
     * Venu de la liste, on connaît déjà la proposition : la page s'affiche
     * avec, et le fetch ne fait plus que confirmer en arrière-plan. Sans cet
     * amorçage la page passe par son squelette, et deux choses en pâtissent —
     * l'attente, visible, et la transition depuis la carte, qui ne peut
     * apparier son en-tête que s'il est rendu dans le même commit que la
     * navigation (un fallback intercalé casse la paire).
     *
     * `initialDataUpdatedAt: 0` date cette graine de l'époque zéro : elle est
     * donc périmée d'emblée et relue tout de suite. On affiche vite, on
     * corrige juste après.
     */
    initialData: () => {
      const liste = queryClient.getQueryData<SandboxListResponse>(["sandboxes"]);
      const connue = liste?.sandboxes.find((s) => s.uuid === sandboxId);
      if (!liste || !connue) return undefined;
      return { sandbox: connue, tiers: liste.tiers, promotion_bonus_cp: liste.promotion_bonus_cp };
    },
    initialDataUpdatedAt: 0,
  });

  const me = meQuery.data?.user ?? null;
  const sandbox = sandboxQuery.data?.sandbox ?? null;
  const isAdmin = me?.role === "admin";

  // Le tiroir de promotion a besoin de la liste des projets : un sandbox n'en a
  // pas, c'est l'admin qui rattache le challenge. Chargée pour lui seul.
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchJson("/api/projects") as Promise<{ uuid: string; title: string }[]>,
    enabled: isAdmin,
    staleTime: 5 * 60_000,
  });

  const applyStarState = (state: StarState) => {
    queryClient.setQueryData<SandboxDetailResponse>(["sandbox", sandboxId], (current) =>
      current
        ? {
            ...current,
            sandbox: {
              ...current.sandbox,
              star_count: state.star_count,
              my_star: state.my_star,
              paid_tier_thresholds: state.paid_tier_thresholds,
            },
          }
        : current,
    );
  };

  const onSaved = (saved: SandboxView) => {
    const previousSlug = sandbox?.slug;
    queryClient.setQueryData<SandboxDetailResponse>(["sandbox", sandboxId], (current) =>
      current ? { ...current, sandbox: saved } : current,
    );
    // Le listing porte la même proposition — le laisser périmé afficherait
    // l'ancien titre au retour.
    void queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    // Slug modifié : l'ancienne adresse redirige, mais la barre d'adresse doit
    // montrer la nouvelle — c'est celle qu'on copie pour partager.
    if (previousSlug && saved.slug !== previousSlug) router.replace(sandboxPath(saved.slug));
  };

  const archive = async () => {
    if (archiving) return;
    if (!window.confirm("Archive this sandbox? It disappears from the public listing. Paid milestones are kept.")) {
      return;
    }
    setArchiving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/sandboxes/${sandboxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Couldn’t archive this sandbox.");
      }
      const payload = (await res.json()) as SandboxDetailResponse;
      queryClient.setQueryData<SandboxDetailResponse>(["sandbox", sandboxId], payload);
      void queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn’t archive this sandbox.");
    } finally {
      setArchiving(false);
    }
  };

  if (!sessionKnown || sandboxQuery.isPending) return <Skeleton />;

  if (sandboxQuery.isError || !sandbox) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
        <p className="text-sm text-white/50">
          This sandbox doesn’t exist, or it has been archived.
        </p>
        <Link
          href="/sandbox"
          className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-white/90"
        >
          Back to the sandbox
        </Link>
      </div>
    );
  }

  return (
    <>
      <SandboxVitrine
        sandbox={sandbox}
        tiers={sandboxQuery.data?.tiers ?? []}
        promotionBonusCp={sandboxQuery.data?.promotion_bonus_cp ?? 0}
        currentUserId={me?.id ?? null}
        isAdmin={isAdmin}
        onEdit={() => setEditOpen(true)}
        onPromote={() => setPromoteOpen(true)}
        onArchive={archive}
        archiving={archiving}
        onStarState={applyStarState}
      />

      {actionError && <p className="mt-4 text-[13px] text-[#b3261e]">{actionError}</p>}

      {/* Monté hors du conteneur animé de `SandboxVitrine` : une modale `fixed`
          rendue dans un sous-arbre transformé serait confinée à sa boîte. */}
      <CreateSandboxModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        sandbox={sandbox}
        onSaved={onSaved}
      />

      {/* Même raison : le tiroir est `fixed`, il doit vivre hors du sous-arbre
          animé. Monté inconditionnellement — il glisse depuis `open`, donc
          conditionner le montage le rendrait déjà en place, sans animation. */}
      {isAdmin && (
        <CreateChallengeDrawer
          open={promoteOpen}
          onClose={() => setPromoteOpen(false)}
          projects={(projectsQuery.data ?? []).map((p) => ({ id: p.uuid, name: p.title }))}
          promotion={{
            uuid: sandbox.uuid,
            title: sandbox.title,
            slug: sandbox.slug,
            // Pas de `type` : une proposition n'en porte pas, c'est l'admin
            // qui choisit la forme du challenge dans le tiroir.
            context: sandbox.context,
            goals: sandbox.goals,
            why: sandbox.why,
          }}
          onCreated={(created) => {
            // La proposition est désormais `promoted` : laisser son détail et
            // le listing en cache afficherait encore « Open » et le bouton.
            void queryClient.invalidateQueries({ queryKey: ["sandbox", sandboxId] });
            void queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
            router.push(challengePath(created.slug));
          }}
        />
      )}
    </>
  );
}
