"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart2, X } from "lucide-react";

interface EvaluationScore {
  criterion: string;
  score: number;
  weight: number;
  comment?: string;
}

interface ContributionEvaluation {
  title: string;
  reward: number;
  submitted_at: string;
  evaluation: {
    scores?: EvaluationScore[];
    globalScore?: number;
  } | null;
}

/**
 * Same evaluation layout as the task detail page (grid criteria + AI score),
 * but as an overlay so a contributor never has to leave their profile to see it.
 */
export function EvaluationModal({
  contributionId,
  onClose,
}: {
  contributionId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ContributionEvaluation | null>(null);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contributions/${contributionId}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(json => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [contributionId]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-background p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/50">
            <BarChart2 className="h-3.5 w-3.5" />
            Evaluation
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="py-4 text-center text-sm text-red-400/70">Could not load the evaluation.</p>}

        {!error && !data && (
          <p className="py-4 text-center text-sm text-white/40">Loading…</p>
        )}

        {data && (
          <div className="space-y-4">
            <p className="truncate text-sm font-medium text-white">{data.title}</p>

            <div className="flex items-center gap-4 rounded-xl border border-brandCP/15 bg-brandCP/[0.04] px-4 py-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brandCP/15">
                <span className="text-2xl font-bold text-brandCP">
                  {Math.round(data.evaluation?.globalScore ?? 0)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Global Score</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {data.evaluation?.scores?.length ?? 0} criteria · {data.reward.toLocaleString()} CP earned
                </p>
              </div>
            </div>

            {data.evaluation?.scores && data.evaluation.scores.length > 0 && (
              <div className="space-y-2">
                {data.evaluation.scores.map((s, i) => (
                  <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{s.criterion}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] text-white/25">×{s.weight}</span>
                        <span className="rounded-full bg-brandCP/15 px-2.5 py-0.5 text-xs font-bold text-brandCP">
                          {s.score}/10
                        </span>
                      </div>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brandCP/60 to-brandCP"
                        style={{ width: `${s.score * 10}%` }}
                      />
                    </div>
                    {s.comment && (
                      <p className="mt-2.5 text-xs italic leading-relaxed text-white/40">{s.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-white/25">
              Evaluated {new Date(data.submitted_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
