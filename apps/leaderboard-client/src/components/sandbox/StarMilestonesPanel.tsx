import { Star } from "lucide-react";
import { formatCP } from "@/lib/formatters";
// Modules purs du service : `starTiers` n'importe que des types, rien de la
// base ne suit dans le bundle navigateur. Même geste que `groupPolicy` dans
// la page challenge.
import { nextTier, sortTiers, tierProgress } from "../../../../../packages/services/sandbox/starTiers";
import type { SandboxStarTier } from "../../../../../packages/database-service/domain/entities";

interface StarMilestonesPanelProps {
  tiers: SandboxStarTier[];
  starCount: number;
  /**
   * Les seuils réellement payés, lus dans `sandbox_rewards` par l'API.
   *
   * **C'est la seule source de l'état « payé ».** Le rattachement des stars
   * anonymes à un compte peut faire repasser `starCount` sous un seuil déjà
   * payé — un palier n'étant jamais repris, le déduire du compteur afficherait
   * « pending » sur un palier que l'auteur a bel et bien touché.
   */
  paidThresholds: number[];
}

/**
 * Les paliers de stars d'un sandbox : ce qui a été payé, et ce qu'il reste
 * avant le prochain.
 */
export function StarMilestonesPanel({ tiers, starCount, paidThresholds }: StarMilestonesPanelProps) {
  const ordered = sortTiers(tiers);
  const paid = new Set(paidThresholds);

  const progress = tierProgress(starCount, ordered);
  const next = nextTier(starCount, ordered);

  // Le total payé est **sommé depuis les seuils réellement payés**, pas repris
  // du `hint` de `tierProgress` : celui-ci additionne les paliers configurés,
  // et devient optimiste dès qu'un admin a supprimé une reward après un
  // nettoyage anti-abus (docs/sandbox.md).
  const paidCP = ordered
    .filter((tier) => paid.has(tier.stars))
    .reduce((sum, tier) => sum + tier.cp, 0);

  const hint =
    ordered.length === 0
      ? progress.hint
      : next
        ? progress.hint
        : `All milestones reached · ${formatCP(paidCP)} CP paid`;

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
          Star milestones
        </span>
        <span className="text-xs text-white/50">
          {starCount} star{starCount !== 1 ? "s" : ""}
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="text-xs leading-relaxed text-white/40">
          No milestone is configured yet - stars are a signal here, and pay nothing.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {ordered.map((tier) => {
              const isPaid = paid.has(tier.stars);
              return (
                <div
                  key={tier.stars}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                    isPaid ? "border-brandCP/25 bg-brandCP/[0.06]" : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <Star
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isPaid ? "fill-yellow-400 text-yellow-400" : "text-white/25"
                    }`}
                  />
                  <span className="text-[13px] font-semibold text-white">{tier.stars} stars</span>
                  <span
                    className={`ml-auto text-xs font-semibold ${isPaid ? "text-brandCP" : "text-white/40"}`}
                  >
                    +{formatCP(tier.cp)} CP
                  </span>
                  <span className="text-[11px] text-white/40">{isPaid ? "paid" : "pending"}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-brandCP transition-[width] duration-500 ease-out"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="text-xs text-white/50">{hint}</span>
          </div>
        </>
      )}

      <span className="text-[11px] leading-relaxed text-white/25">
        Paid once per milestone, out of pool. Unstarring never claws back a paid milestone.
      </span>
    </div>
  );
}
