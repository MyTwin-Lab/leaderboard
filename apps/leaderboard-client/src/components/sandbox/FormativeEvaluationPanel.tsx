"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart2, Loader2, Rocket } from "lucide-react";
import type { SandboxView } from "@/lib/public/sandbox";
import {
  EvaluationScorePanel,
  type EvaluationScore,
} from "@/components/contributor/EvaluationScorePanel";
import { toScore10 } from "../../../../../packages/services/challenge/repo-score";

/** La forme stockée dans `sandboxes.evaluation` — la même que pour une contribution. */
interface StoredEvaluation {
  scores?: EvaluationScore[];
  globalScore?: number;
}

/**
 * L'évaluation d'un sandbox, telle que son auteur la voit.
 *
 * Formative : elle ne paie rien, et le badge « 0 CP » le dit sans détour —
 * sinon un contributeur habitué aux challenges attendrait des points. Les CP
 * d'un sandbox viennent de ses paliers de stars et de sa promotion.
 *
 * Le repo est snapshoté dans les deux cas (`code` comme `ml`), avec la grille
 * `code` : c'est déjà ce qu'un challenge ML fait de son code.
 *
 * Le polling ne vit pas ici mais sur la requête de la page, seule source du
 * sandbox : la voir se rafraîchir toutes les 3 s tant que le statut est
 * `pending` ou `running` remet à jour ce panneau comme le reste de la page.
 */
export function FormativeEvaluationPanel({ sandbox }: { sandbox: SandboxView }) {
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = sandbox.evaluation_status ?? null;
  const inFlight = status === "pending" || status === "running";
  const evaluation = (sandbox.evaluation ?? null) as StoredEvaluation | null;
  const globalScore = evaluation?.globalScore;
  const hasScore =
    status === "done" && typeof globalScore === "number" && !Number.isNaN(globalScore);

  const run = async () => {
    if (starting || inFlight) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sandboxes/${sandbox.uuid}/evaluation`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Couldn’t start the evaluation.");
      }
      // Le statut passe à `running` côté serveur : refaire lire la page est ce
      // qui arme le polling de 3 s.
      await queryClient.invalidateQueries({ queryKey: ["sandbox", sandbox.uuid] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t start the evaluation.");
    } finally {
      setStarting(false);
    }
  };

  const busy = starting || inFlight;
  const label = busy ? "Evaluating…" : hasScore || status === "failed" ? "Re-run" : "Run";

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-white/50">
          <BarChart2 className="h-3.5 w-3.5" />
          Evaluation
        </h3>
        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-white/50">
          0 CP
        </span>
      </div>

      <p className="text-xs leading-relaxed text-white/45">
        A formative read on your repo — it earns no CP. Only you and the admins can see it.
      </p>

      {hasScore ? (
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
      ) : (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-xs text-white/40">
          {inFlight
            ? "The agent is reading your repo — this takes a minute."
            : status === "failed"
              ? "The last run didn’t make it through. Try again."
              : "No evaluation yet."}
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={busy}
        // L'accent du theme, pas un bouton plein : lancer une evaluation est
        // une action offerte a l'auteur, pas l'action principale de la page.
        // C'est le bouton teal de la maquette, traduit en token.
        // `w-fit` en plus de `self-start` : dans une colonne flex, un enfant
        // s'etire par defaut, et le bouton se retrouvait pleine largeur avec
        // son libelle au milieu.
        className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-brandCP/15 px-4.5 py-2.5 text-[13px] font-semibold text-brandCP transition-all duration-200 hover:-translate-y-0.5 hover:bg-brandCP/25 hover:shadow-[0_0_16px_rgba(10,247,193,0.15)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-white/35 disabled:shadow-none"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Rocket className="h-3.5 w-3.5" />
        )}
        {label}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
