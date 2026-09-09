import Link from "next/link";
import { Sparkles, Star, Trophy } from "lucide-react";
import { formatCP } from "@/lib/formatters";
import type { ContributorSandbox } from "@/lib/types";

interface SandboxRewardsListProps {
  sandboxes: ContributorSandbox[];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  promoted: "Promoted",
  archived: "Archived",
};

/**
 * Bloc « Sandbox » de l'onglet Contributions.
 *
 * Volontairement sobre : la vraie page d'un sandbox est ailleurs et ce bloc
 * n'a qu'un rôle, expliquer d'où viennent des CP que le total affiche mais
 * qu'aucun challenge ne porte. Un sandbox sans reward n'apparaît donc pas —
 * ce n'est pas un listing de propositions, c'est un extrait de ledger.
 */
export function SandboxRewardsList({ sandboxes }: SandboxRewardsListProps) {
  if (sandboxes.length === 0) return null;

  const total = sandboxes.reduce((sum, sandbox) => sum + sandbox.totalCP, 0);

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/30">
          <Sparkles className="h-3.5 w-3.5" />
          Sandbox
        </h3>
        <span className="text-xs font-semibold text-brandCP">{formatCP(total)} CP</span>
      </div>

      <div className="space-y-1">
        {sandboxes.map((sandbox) => (
          <Link
            key={sandbox.id}
            href={`/sandbox/${sandbox.id}`}
            className="block rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{sandbox.title}</p>
                <p className="mt-0.5 text-xs text-white/25">
                  {STATUS_LABELS[sandbox.status] ?? sandbox.status}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-brandCP">
                {formatCP(sandbox.totalCP)} CP
              </span>
            </div>

            {/* Le détail des entrées : un palier de stars franchi ou la
                promotion. C'est ce qui rend le total vérifiable. */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sandbox.rewards.map((reward) => (
                <span
                  key={reward.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/50"
                >
                  {reward.ruleKey === "promotion" ? (
                    <>
                      <Trophy className="h-3 w-3 text-violet-400" />
                      Promotion
                    </>
                  ) : (
                    <>
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {reward.tierStars} stars
                    </>
                  )}
                  <span className="text-white/70">+{reward.cp}</span>
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
