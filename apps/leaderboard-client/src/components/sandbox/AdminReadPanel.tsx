"use client";

import { BarChart2 } from "lucide-react";
import type { SandboxView } from "@/lib/public/sandbox";
import {
  EvaluationScorePanel,
  type EvaluationScore,
} from "@/components/contributor/EvaluationScorePanel";
import { toScore10 } from "../../../../../packages/services/challenge/repo-score";

interface StoredEvaluation {
  scores?: EvaluationScore[];
  globalScore?: number;
}

/**
 * L'évaluation d'un sandbox vue par un admin qui n'en est pas l'auteur.
 *
 * En lecture seule, et c'est délibéré : lancer l'évaluation est un geste de
 * l'auteur (§1.6), parce que la note dit où *son* travail en est. Un admin la
 * lit pour décider d'une promotion, il n'a pas à la déclencher.
 *
 * Le panneau ne s'affiche que si un score existe — un sandbox jamais évalué
 * n'a rien à montrer à quelqu'un qui ne peut pas y remédier.
 */
export function AdminReadPanel({ sandbox }: { sandbox: SandboxView }) {
  const evaluation = (sandbox.evaluation ?? null) as StoredEvaluation | null;
  const globalScore = evaluation?.globalScore;
  const hasScore =
    sandbox.evaluation_status === "done" &&
    typeof globalScore === "number" &&
    !Number.isNaN(globalScore);

  if (!hasScore) return null;

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/50">
          <BarChart2 className="h-3.5 w-3.5" />
          Evaluation
        </h3>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/50">
          Admin view
        </span>
      </div>

      <div className="space-y-4">
        <EvaluationScorePanel
          globalScore={globalScore}
          scores={evaluation?.scores}
          subtitle={`${toScore10(globalScore as number).toFixed(1)}/10 · ${evaluation?.scores?.length ?? 0} criteria`}
          footer={
            sandbox.evaluated_at ? (
              <p className="text-[11px] text-white/25">
                Evaluated{" "}
                {new Date(sandbox.evaluated_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            ) : null
          }
        />
      </div>
    </section>
  );
}
