"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart2, X } from "lucide-react";
import { EvaluationScorePanel, type EvaluationScore } from "./EvaluationScorePanel";

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

            {/* Le bloc « Global Score », la liste des critères et la date de
                l'évaluation viennent du composant partagé avec le sandbox. Le
                fragment qu'il rend laisse `space-y-4` s'appliquer à ses blocs
                comme s'ils étaient écrits ici. */}
            <EvaluationScorePanel
              globalScore={data.evaluation?.globalScore}
              scores={data.evaluation?.scores}
              subtitle={`${data.evaluation?.scores?.length ?? 0} criteria · ${data.reward.toLocaleString()} CP earned`}
              footer={
                <p className="text-[11px] text-white/25">
                  Evaluated {new Date(data.submitted_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              }
            />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
