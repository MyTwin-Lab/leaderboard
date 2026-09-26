import Link from "next/link";
import { formatCP } from "@/lib/formatters";
import { sandboxPath } from "@/lib/paths";
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
 * Ce qui a été payé, pour chaque ligne du ledger : les paliers d'étoiles
 * franchis, et la prime de promotion. C'est ce qui rend le total vérifiable.
 */
function rewardsLabel(sandbox: ContributorSandbox) {
  const tiers = sandbox.rewards.filter((reward) => reward.ruleKey !== "promotion").length;
  const promoted = sandbox.rewards.some((reward) => reward.ruleKey === "promotion");

  return [
    tiers > 0 ? `${tiers} milestone${tiers === 1 ? "" : "s"} paid` : null,
    promoted ? "promotion bonus paid" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Bloc « Sandbox » de l'onglet Contributions, d'après
 * `Profile Vitrine.dc.html`.
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
    <div className="v-pro-night">
      <div className="v-pro-night-head">
        <span className="v-pro-kicker">Sandbox</span>
        <span className="v-pro-night-total">{formatCP(total)} CP</span>
      </div>

      <div className="v-pro-night-rows">
        {sandboxes.map((sandbox) => {
          const detail = rewardsLabel(sandbox);
          return (
            <Link key={sandbox.id} href={sandboxPath(sandbox.slug)} className="v-pro-night-row">
              <span className="v-pro-night-row-text">
                <span className="v-pro-night-row-title">{sandbox.title}</span>
                <span className="v-pro-night-row-sub">
                  {[STATUS_LABELS[sandbox.status] ?? sandbox.status, detail].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="v-pro-night-row-cp">{formatCP(sandbox.totalCP)} CP</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
