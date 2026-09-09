"use client";

import Link from "next/link";
import { Archive, ArrowLeft, Boxes, Database, GitBranch, Pencil, Rocket } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import type { SandboxView } from "@/lib/public/sandbox";
import type { SandboxStarTier } from "../../../../../packages/database-service/domain/entities";
import { AdminReadPanel } from "./AdminReadPanel";
import { FormativeEvaluationPanel } from "./FormativeEvaluationPanel";
import { PromotedBanner } from "./PromotedBanner";
import { SandboxTypeBadge } from "./SandboxTypeBadge";
import { StarButton, type StarState } from "./StarButton";
import { StarMilestonesPanel } from "./StarMilestonesPanel";

interface SandboxDetailProps {
  sandbox: SandboxView;
  tiers: SandboxStarTier[];
  promotionBonusCp: number;
  currentUserId: string | null;
  isAdmin: boolean;
  onEdit: () => void;
  onArchive: () => void;
  /** Ouvre le tiroir de promotion. Absent = aucun bouton (lecteur non admin). */
  onPromote?: () => void;
  archiving?: boolean;
  onStarState?: (state: StarState) => void;
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

/** Une URL réduite à ce qui l'identifie — le protocole n'apprend rien. */
function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Une pastille cliquable vers une ressource externe du sandbox. */
function LinkChip({ href, icon: Icon }: { href: string; icon: typeof GitBranch }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-2 truncate rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 font-mono text-xs text-white/70 transition-colors hover:border-brandCP/40 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-brandCP" />
      {shortUrl(href)}
    </a>
  );
}

/**
 * La page d'une proposition.
 *
 * Trois sections de lecture à gauche — contexte, buts, pourquoi — et
 * l'économie des stars à droite. Ni tâches, ni équipe, ni bouton « rejoindre » :
 * un sandbox appartient à son auteur, la communauté n'y intervient que par les
 * stars. La collaboration commence à la promotion, pas avant.
 */
export function SandboxDetail({
  sandbox,
  tiers,
  promotionBonusCp,
  currentUserId,
  isAdmin,
  onEdit,
  onArchive,
  onPromote,
  archiving = false,
  onStarState,
}: SandboxDetailProps) {
  const isAuthor = currentUserId !== null && sandbox.user_id === currentUserId;
  const promoted = sandbox.status === "promoted";
  const archived = sandbox.status === "archived";

  const statusLabel = promoted ? "Promoted" : archived ? "Archived" : "Open";
  const statusStyle = promoted
    ? "bg-violet-500/10 text-violet-400"
    : archived
      ? "bg-white/[0.06] text-white/40"
      : "bg-brandCP/10 text-brandCP";
  const statusDot = promoted ? "bg-violet-400" : archived ? "bg-white/30" : "bg-brandCP";

  return (
    <div className="animate-fade-up flex flex-col gap-6 sm:gap-7">
      <Link
        href="/sandbox"
        className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-white/50 transition-colors hover:text-brandCP"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Sandbox
      </Link>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle}`}
          >
            <span className={`h-[7px] w-[7px] rounded-full ${statusDot}`} />
            {statusLabel}
          </span>
          <SandboxTypeBadge type={sandbox.type} />
          <span className="text-xs text-white/50">
            {isAuthor ? "by you" : `by ${sandbox.author?.full_name ?? "someone"}`}
          </span>
          <span className="text-xs text-white/40">Created {formatDate(sandbox.created_at)}</span>
          {isAuthor && (
            <span className="rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold text-brandCP">
              You are the author
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="min-w-0 flex-1 basis-80 text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
            {sandbox.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <StarButton
              sandboxId={sandbox.uuid}
              starCount={sandbox.star_count}
              myStar={sandbox.my_star}
              variant="full"
              disabled={isAuthor || sandbox.status !== "open"}
              disabledReason={
                isAuthor
                  ? "You can’t star your own sandbox"
                  : "This sandbox is no longer open to stars"
              }
              onState={onStarState}
            />

            {/* Éditer : l'auteur seul, et seulement tant que la proposition
                est ouverte — un sandbox promu a désormais un challenge, et
                l'API refuse l'édition (409). */}
            {isAuthor && sandbox.status === "open" && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:border-brandCP/40 hover:text-brandCP"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}

            {/* Promouvoir : l'admin seul (§1.6), et seulement sur une
                proposition encore ouverte — la promotion est définitive, un
                sandbox promu ou archivé n'y revient pas. */}
            {isAdmin && onPromote && sandbox.status === "open" && (
              <button
                type="button"
                onClick={onPromote}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition-colors hover:bg-white/90"
              >
                <Rocket className="h-3.5 w-3.5" />
                Promote to challenge
              </button>
            )}

            {/* Archiver : l'auteur pour le sien, l'admin pour n'importe lequel
                (§1.6). Un manager n'a rien de particulier ici. */}
            {(isAuthor || isAdmin) && sandbox.status !== "archived" && (
              <button
                type="button"
                onClick={onArchive}
                disabled={archiving}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-[13px] font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Archive className="h-3.5 w-3.5" />
                {archiving ? "Archiving…" : "Archive"}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <LinkChip href={sandbox.repo_url} icon={GitBranch} />
          {sandbox.model_url && <LinkChip href={sandbox.model_url} icon={Boxes} />}
          {sandbox.dataset_urls.map((url) => (
            <LinkChip key={url} href={url} icon={Database} />
          ))}
        </div>
      </div>

      {promoted && (
        <PromotedBanner
          challengeId={sandbox.promoted_challenge_id}
          promotionBonusCp={promotionBonusCp}
        />
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)] lg:gap-7">
        <div className="flex min-w-0 flex-col gap-7">
          {sandbox.context && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-white">Context</h2>
              <Markdown source={sandbox.context} variant="prose" />
            </section>
          )}

          {sandbox.goals.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                What I want to build
              </h2>
              <ul className="flex flex-col gap-2">
                {sandbox.goals.map((goal, index) => (
                  <li key={`${index}-${goal}`} className="flex items-start gap-2.5">
                    <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-brandCP" />
                    <span className="text-[15px] leading-relaxed text-white/70">{goal}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sandbox.why && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-white">Why it matters</h2>
              <Markdown source={sandbox.why} variant="prose" />
            </section>
          )}

          {/* Dit une fois, ici : c'est la question que pose tout lecteur qui
              voudrait aider, et la réponse est structurelle, pas un détail. */}
          <p className="border-l-2 border-brandCP/35 pl-3.5 text-sm leading-relaxed text-white/45">
            Only the author works on a sandbox — the community interacts through stars.
            Collaboration starts once it becomes an official challenge.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <StarMilestonesPanel
            tiers={tiers}
            starCount={sandbox.star_count}
            paidThresholds={sandbox.paid_tier_thresholds}
          />

          {/* L'évaluation formative : l'auteur la lance et la lit, un admin ne
              fait que la lire (§1.6). Pour tout autre lecteur, l'API n'a même
              pas servi `evaluation` — il n'y a rien à masquer ici. */}
          {isAuthor ? (
            <FormativeEvaluationPanel sandbox={sandbox} />
          ) : (
            isAdmin && <AdminReadPanel sandbox={sandbox} />
          )}
        </div>
      </div>
    </div>
  );
}
