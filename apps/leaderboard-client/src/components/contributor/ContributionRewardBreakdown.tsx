"use client";

import { useState } from "react";
import { formatCP } from "@/lib/formatters";
import { ChevronRight, Loader2 } from "lucide-react";
import { EvaluationModal } from "./EvaluationModal";
import { TeamAvatars } from "@/components/ui/TeamAvatars";
import type { TeamMember } from "@/lib/types";

interface RewardEntry {
  ruleKey: string;
  label: string;
  points: number;
  counterparty: string | null;
  createdAt: string;
}

interface RewardsResponse {
  total: number;
  evaluationStatus: string | null;
  entries: RewardEntry[];
}

/**
 * A contribution's reward is an aggregate of ledger rows, and the aggregate
 * alone lies by omission: an author's row grows on its own as others reuse
 * their work, and a reuser's dataset row sits at a bare 0. Both only make
 * sense once the rows behind them are visible.
 *
 * Forme de `Profile Vitrine.dc.html` : la ligne grise de la maquette, avec sa
 * pastille d'évaluation. La maquette y met une note ; la fiche ne la connaît
 * pas sans aller la chercher, donc la pastille dit seulement qu'il y en a une —
 * et un second clic l'ouvre.
 */
export function ContributionRewardBreakdown({
  contributionId,
  title,
  reward,
  index,
  hasEvaluation,
  coMembers,
}: {
  contributionId: string;
  title: string;
  reward: number;
  index: number;
  hasEvaluation?: boolean;
  /** Co-équipiers sur une contribution de groupe — `reward` est alors une part. */
  coMembers?: TeamMember[];
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const toggle = async () => {
    // Already open: a second click goes deeper — the full evaluation, when
    // there is one — instead of just collapsing back.
    if (open && hasEvaluation) {
      setShowEvaluation(true);
      return;
    }

    const next = !open;
    setOpen(next);
    if (!next || data || loading) return;

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/contributions/${contributionId}/rewards`);
      if (res.ok) setData(await res.json());
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="v-pro-item"
      data-open={open}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <button onClick={toggle} aria-expanded={open} className="v-pro-item-btn">
        <span className="v-pro-item-title">{title}</span>

        {/* Contribution de groupe : les co-équipiers, et un CP qui est une part
            du total et non le tout. */}
        {coMembers && coMembers.length > 0 && (
          <span style={{ flexShrink: 0 }} title={`With ${coMembers.map(m => m.fullName).join(', ')}`}>
            <TeamAvatars members={coMembers} size={20} maxDisplay={3} />
          </span>
        )}

        {hasEvaluation && <span className="v-pro-score">Evaluated</span>}

        <span className="v-pro-item-cp" data-zero={reward <= 0}>
          {reward > 0 ? `+${formatCP(reward)}` : "0"} CP
        </span>

        <ChevronRight className="v-pro-item-chev" />
      </button>

      {open && (
        <div className="v-pro-break">
          {loading && (
            <p className="v-pro-note" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading breakdown…
            </p>
          )}

          {error && <p className="v-pro-error">Could not load the breakdown.</p>}

          {data && <BreakdownBody data={data} />}

          {hasEvaluation && !loading && (
            <p className="v-pro-note">Click again for the full evaluation</p>
          )}
        </div>
      )}

      {showEvaluation && (
        <EvaluationModal contributionId={contributionId} onClose={() => setShowEvaluation(false)} />
      )}
    </div>
  );
}

function BreakdownBody({ data }: { data: RewardsResponse }) {
  if (data.entries.length === 0) {
    return (
      <p className="v-pro-note">
        {data.evaluationStatus === "skipped_reuse"
          ? "Reused from another contributor - no points for this step, and no dataset to build."
          : data.evaluationStatus === "pending" || data.evaluationStatus === "running"
            ? "Evaluation in progress…"
            : data.evaluationStatus === "failed"
              ? "Evaluation failed - no points awarded."
              : "No points awarded yet."}
      </p>
    );
  }

  return (
    <>
      {data.entries.map((entry, i) => (
        <div key={i} className="v-pro-break-row">
          <span className="v-pro-break-label">
            {entry.label}
            {entry.counterparty && (
              <span className="v-pro-break-who">
                {entry.points < 0 ? " → " : " ← "}
                {entry.counterparty}
              </span>
            )}
          </span>
          <span className="v-pro-break-cp" data-negative={entry.points < 0}>
            {entry.points > 0 ? "+" : ""}
            {formatCP(entry.points)}
          </span>
        </div>
      ))}

      <div className="v-pro-break-total">
        <span className="v-pro-break-total-label">Total</span>
        <span className="v-pro-break-cp">{formatCP(data.total)} CP</span>
      </div>
    </>
  );
}
