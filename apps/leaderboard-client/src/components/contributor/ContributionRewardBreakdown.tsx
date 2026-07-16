"use client";

import { useState } from "react";
import { formatCP } from "@/lib/formatters";
import { ChevronRight, Loader2 } from "lucide-react";

interface RewardEntry {
  ruleKey: string;
  label: string;
  points: number;
  counterparty: string | null;
  meta: Record<string, unknown> | null;
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
 */
export function ContributionRewardBreakdown({
  contributionId,
  title,
  reward,
  index,
}: {
  contributionId: string;
  title: string;
  reward: number;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RewardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const toggle = async () => {
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
      className="animate-slide-in-left rounded-lg transition-colors hover:bg-white/[0.04]"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
    >
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-none"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brandCP/40" />
        <p className="min-w-0 flex-1 truncate text-sm text-white/70">{title}</p>
        <span
          className={`shrink-0 text-xs font-medium ${reward > 0 ? "text-brandCP" : "text-white/30"}`}
        >
          {reward > 0 ? `+${formatCP(reward)}` : "0"} CP
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-white/20 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-1 px-3 pb-2.5 pl-8">
          {loading && (
            <p className="flex items-center gap-1.5 py-1 text-xs text-white/25">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading breakdown…
            </p>
          )}

          {error && <p className="py-1 text-xs text-red-400/70">Could not load the breakdown.</p>}

          {data && <BreakdownBody data={data} />}
        </div>
      )}
    </div>
  );
}

function BreakdownBody({ data }: { data: RewardsResponse }) {
  if (data.entries.length === 0) {
    return (
      <p className="py-1 text-xs text-white/25">
        {data.evaluationStatus === "skipped_reuse"
          ? "Reused from another contributor — no points for this step, and no dataset to build."
          : data.evaluationStatus === "pending" || data.evaluationStatus === "running"
            ? "Evaluation in progress…"
            : data.evaluationStatus === "failed"
              ? "Evaluation failed — no points awarded."
              : "No points awarded yet."}
      </p>
    );
  }

  return (
    <>
      {data.entries.map((entry, i) => (
        <div key={i} className="flex items-baseline gap-2 py-0.5 text-xs">
          <span className="min-w-0 flex-1 truncate text-white/40">
            {entry.label}
            {entry.counterparty && (
              <span className="text-white/25">
                {entry.points < 0 ? " → " : " ← "}
                {entry.counterparty}
              </span>
            )}
          </span>
          <span
            className={`shrink-0 font-medium tabular-nums ${
              entry.points < 0 ? "text-amber-400/70" : "text-brandCP/70"
            }`}
          >
            {entry.points > 0 ? "+" : ""}
            {formatCP(entry.points)}
          </span>
        </div>
      ))}

      <div className="mt-1 flex items-baseline gap-2 border-t border-white/[0.06] pt-1.5 text-xs">
        <span className="flex-1 font-medium text-white/50">Total</span>
        <span className="shrink-0 font-semibold tabular-nums text-brandCP">
          {formatCP(data.total)} CP
        </span>
      </div>
    </>
  );
}
