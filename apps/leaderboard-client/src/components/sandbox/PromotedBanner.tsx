import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { formatCP } from "@/lib/formatters";
import { challengePath } from "@/lib/paths";

interface PromotedBannerProps {
  /**
   * Le slug du challenge promu, ou à défaut son UUID — dont l'URL redirige vers
   * le slug. Absent si la promotion précède le lien (jamais en pratique).
   */
  challengeRef: string | null;
  /** Le bonus configuré au moment de la lecture, pas celui réellement payé. */
  promotionBonusCp: number;
}

/**
 * Le bandeau d'un sandbox promu.
 *
 * Violet et non teal : c'est le seul état terminal heureux d'une proposition,
 * et le distinguer de l'accent courant évite de le confondre avec un simple
 * badge de type. Même couleur que la ligne « Promotion » du ledger dans
 * l'onglet Contributions (`SandboxRewardsList`).
 */
export function PromotedBanner({ challengeRef, promotionBonusCp }: PromotedBannerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
      <ArrowUp className="h-[15px] w-[15px] shrink-0 text-violet-400" />
      <span className="text-[13px] font-semibold text-white">Promoted to an official challenge</span>
      {challengeRef && (
        <Link
          href={challengePath(challengeRef)}
          className="text-[13px] font-semibold text-violet-400 transition-colors hover:text-violet-300"
        >
          See the challenge →
        </Link>
      )}
      <span className="text-xs text-white/50">
        The author was auto-joined with their repo
        {promotionBonusCp > 0 ? ` · ${formatCP(promotionBonusCp)} CP bonus paid` : ""}
      </span>
    </div>
  );
}
