"use client";

import Link from "next/link";
import { CheckCircle2, GitBranch } from "lucide-react";
import type { SandboxView } from "@/lib/public/sandbox";
import { SandboxTypeBadge } from "./SandboxTypeBadge";
import { StarButton, type StarState } from "./StarButton";
import { toScore10 } from "../../../../../packages/services/challenge/repo-score";

interface SandboxCardProps {
  sandbox: SandboxView;
  /** L'utilisateur connecté, ou `null` — sert à reconnaître « ma » proposition. */
  currentUserId: string | null;
  index?: number;
  onStarState?: (sandboxId: string, state: StarState) => void;
}

/** Le repo, sans le protocole ni l'hôte : c'est `owner/name` qui identifie. */
function repoLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^(www\.)?github\.com\//i, "");
}

/**
 * Le score formatif sur 10, ou `null`.
 *
 * La conversion /9 → /10 est celle du pipeline de scoring (`toScore10`), pas
 * une seconde implémentation : le score affiché sur une carte est exactement
 * celui que l'évaluation a produit.
 *
 * L'API a déjà filtré : `evaluation` n'est servi qu'à l'auteur et aux admins.
 * Ce composant n'a donc aucune règle de visibilité à appliquer.
 */
function score10(sandbox: SandboxView): string | null {
  if (sandbox.evaluation_status !== "done") return null;
  const global = (sandbox.evaluation as { globalScore?: number } | null)?.globalScore;
  if (typeof global !== "number" || Number.isNaN(global)) return null;
  return toScore10(global).toFixed(1);
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

export function SandboxCard({ sandbox, currentUserId, index = 0, onStarState }: SandboxCardProps) {
  const mine = currentUserId !== null && sandbox.user_id === currentUserId;
  const promoted = sandbox.status === "promoted";
  const archived = sandbox.status === "archived";
  const score = score10(sandbox);

  const statusLabel = promoted ? "Promoted" : archived ? "Archived" : mine ? "Your sandbox" : "Open";
  const statusStyle = promoted
    ? "bg-violet-500/10 text-violet-400"
    : archived
      ? "bg-white/[0.06] text-white/40"
      : mine
        ? "bg-brandCP/10 text-brandCP"
        : "bg-white/[0.06] text-white/50";

  // Un sandbox promu ou archivé n'accepte plus de star (409 côté service) ;
  // l'auteur, lui, n'a jamais pu starer le sien (403).
  const starDisabled = mine || sandbox.status !== "open";
  const starReason = mine
    ? "You can’t star your own sandbox"
    : "This sandbox is no longer open to stars";

  // Le CTA d'un sandbox promu mène au challenge, pas à la proposition : c'est
  // là qu'il y a désormais quelque chose à faire. Le titre, lui, continue
  // d'ouvrir le détail du sandbox.
  const ctaHref =
    promoted && sandbox.promoted_challenge_id
      ? `/challenges/${sandbox.promoted_challenge_id}`
      : `/sandbox/${sandbox.uuid}`;
  const ctaLabel = promoted && sandbox.promoted_challenge_id ? "See challenge" : "Open";

  return (
    <div
      className={`animate-fade-up group flex min-w-0 flex-col gap-3.5 rounded-2xl border p-4 shadow-[0_14px_40px_-26px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.06] sm:p-5 ${
        promoted
          ? "border-violet-500/20 bg-white/[0.04] hover:border-violet-500/35"
          : "border-white/10 bg-white/[0.04] hover:border-brandCP/25"
      }`}
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyle}`}
            >
              {statusLabel}
            </span>
            <SandboxTypeBadge type={sandbox.type} />
            <span className="text-xs text-white/45">
              {mine ? "by you" : `by ${sandbox.author?.full_name ?? "someone"}`}
            </span>
          </div>
          <Link
            href={`/sandbox/${sandbox.uuid}`}
            className="text-lg font-semibold leading-snug tracking-tight text-white transition-colors duration-200 hover:text-brandCP"
          >
            {sandbox.title}
          </Link>
        </div>

        <StarButton
          sandboxId={sandbox.uuid}
          starCount={sandbox.star_count}
          myStar={sandbox.my_star}
          disabled={starDisabled}
          disabledReason={starReason}
          onState={(state) => onStarState?.(sandbox.uuid, state)}
        />
      </div>

      {sandbox.context && (
        <p className="line-clamp-2 text-sm leading-relaxed text-white/55">{sandbox.context}</p>
      )}

      <div className="mt-auto flex flex-col gap-3.5">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-white/[0.05] px-2.5 py-1 font-mono text-[11px] text-white/50">
            <GitBranch className="h-3 w-3 shrink-0" />
            {repoLabel(sandbox.repo_url)}
          </span>
          {score && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-brandCP/10 px-2.5 py-1 text-[11px] font-semibold text-brandCP">
              <CheckCircle2 className="h-3 w-3" />
              {score}/10
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3.5">
          <span className="text-xs text-white/45">
            {promoted ? "Now an official challenge" : `Created ${formatDate(sandbox.created_at)}`}
          </span>
          <Link
            href={ctaHref}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 group-hover:gap-2.5 ${
              promoted
                ? "bg-violet-500/15 text-violet-300"
                : "bg-white/[0.06] text-white hover:bg-white/10"
            }`}
          >
            {ctaLabel}
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
