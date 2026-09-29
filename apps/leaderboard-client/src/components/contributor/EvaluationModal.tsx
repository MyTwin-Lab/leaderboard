"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";
import { Modal } from "@/components/vitrine/Modal";
import { EvaluationScorePanel, type EvaluationScore } from "./EvaluationScorePanel";

import "@/components/challenges/challenge-overlays-vitrine.css";

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
 * Sur la modale du design vitrine.
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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contributions/${contributionId}`)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(json => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [contributionId]);

  return (
    <Modal open onClose={onClose} title="Evaluation" subtitle={data?.title} icon={<BarChart2 />} size="lg">
      {error && <p className="v-quiet">Could not load the evaluation.</p>}

      {!error && !data && <p className="v-quiet">Loading…</p>}

      {data && (
        // Le bloc « Global Score », la liste des critères et la date de
        // l'évaluation viennent du composant partagé. Le fragment qu'il rend
        // laisse la carte de la modale espacer ses blocs.
        <EvaluationScorePanel
          globalScore={data.evaluation?.globalScore}
          scores={data.evaluation?.scores}
          subtitle={`${data.evaluation?.scores?.length ?? 0} criteria · ${data.reward.toLocaleString()} CP earned`}
          footer={
            <p className="v-help" data-size="xs">
              Evaluated {new Date(data.submitted_at).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          }
        />
      )}
    </Modal>
  );
}
