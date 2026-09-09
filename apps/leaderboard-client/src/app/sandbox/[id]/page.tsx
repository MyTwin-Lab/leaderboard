"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import type { SandboxView } from "@/lib/public/sandbox";
import type { SandboxStarTier } from "../../../../../../packages/database-service/domain/entities";
import { CreateChallengeDrawer } from "@/components/admin/CreateChallengeDrawer";
import { CreateSandboxModal } from "@/components/sandbox/CreateSandboxModal";
import { SandboxDetail } from "@/components/sandbox/SandboxDetail";
import type { StarState } from "@/components/sandbox/StarButton";

interface SandboxDetailResponse {
  sandbox: SandboxView;
  // Réglages d'instance servis avec le détail. Les charger depuis le listing
  // reviendrait à tirer toutes les propositions pour afficher deux valeurs.
  tiers: SandboxStarTier[];
  promotion_bonus_cp: number;
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6 pt-2">
      <div className="h-4 w-24 rounded-full bg-white/8" />
      <div className="space-y-3">
        <div className="h-3 w-40 rounded-full bg-white/8" />
        <div className="h-9 w-2/3 rounded-xl bg-white/10" />
        <div className="h-3 w-full max-w-lg rounded-full bg-white/6" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 rounded-full bg-white/5" />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}

/**
 * La page d'une proposition — **publique**, sur le motif de
 * `challenges/[id]/page.tsx`.
 *
 * Le `meQuery` n'est pas décoratif : `/api/sandboxes/**` est hors du matcher
 * du proxy, donc aucun refresh silencieux n'y joue. Sans ce fetch vers
 * `/api/contributors/me` — lui dans le matcher — un utilisateur connecté au
 * jeton expiré passerait pour un anonyme : plus de bouton Edit, plus de score,
 * et son étoile disparaîtrait sous ses yeux.
 */
export default function SandboxDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sandboxId = params.id as string;

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
  });

  const sandboxQuery = useQuery({
    queryKey: ["sandbox", sandboxId],
    queryFn: () => fetchJson(`/api/sandboxes/${sandboxId}`) as Promise<SandboxDetailResponse>,
    // Après le refresh de session, sinon le détail se lirait avec le jeton
    // expiré que `meQuery` est en train de renouveler.
    enabled: !!sandboxId && !meQuery.isPending,
    // L'évaluation formative est fire-and-forget : son statut vit sur le
    // sandbox. Tant qu'un run est en vol, on relit toutes les 3 s — c'est ce
    // qui fait passer `FormativeEvaluationPanel` d'« Evaluating… » au score.
    // Piloté ici, sur la seule requête qui porte le sandbox, plutôt que dans le
    // panneau : deux `useQuery` sur la même clé se disputeraient les options.
    refetchInterval: (query) => {
      const status = query.state.data?.sandbox.evaluation_status;
      return status === "pending" || status === "running" ? 3000 : false;
    },
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
    queryClient.setQueryData<SandboxDetailResponse>(["sandbox", sandboxId], (current) =>
      current ? { ...current, sandbox: saved } : current,
    );
    // Le listing porte la même proposition — le laisser périmé afficherait
    // l'ancien titre au retour.
    void queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
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

  if (meQuery.isPending || sandboxQuery.isPending) return <Skeleton />;

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
    <div className="mx-auto max-w-5xl">
      <SandboxDetail
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

      {actionError && <p className="mt-4 text-xs text-red-400">{actionError}</p>}

      {/* Monté hors du conteneur animé de `SandboxDetail` : une modale `fixed`
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
            type: sandbox.type,
            context: sandbox.context,
            goals: sandbox.goals,
            why: sandbox.why,
          }}
          onCreated={(challengeId) => {
            // La proposition est désormais `promoted` : laisser son détail et
            // le listing en cache afficherait encore « Open » et le bouton.
            void queryClient.invalidateQueries({ queryKey: ["sandbox", sandboxId] });
            void queryClient.invalidateQueries({ queryKey: ["sandboxes"] });
            router.push(`/challenges/${challengeId}`);
          }}
        />
      )}
    </div>
  );
}
