"use client";

import type { ReactNode } from "react";

export interface EvaluationScore {
  criterion: string;
  score: number;
  weight: number;
  comment?: string;
}

/**
 * Le rendu d'une évaluation d'agent : la pastille « Global Score » et la liste
 * des critères, barres de progression et commentaires compris.
 *
 * Extrait d'`EvaluationModal` pour être partagé avec les panneaux du sandbox,
 * dont l'évaluation formative affiche exactement la même chose — dans une carte
 * plutôt que dans une modale, et sans CP.
 *
 * Le composant rend un fragment, pas un conteneur : les blocs deviennent des
 * enfants directs du parent, qui garde donc la main sur l'espacement
 * (`space-y-4` dans la modale) et sur ce qui les entoure. `subtitle` et
 * `footer` sont les deux seuls endroits où les appelants diffèrent — CP gagnés
 * et date d'évaluation pour une contribution, décompte de critères et badge
 * « 0 CP » pour un sandbox.
 */
export function EvaluationScorePanel({
  globalScore,
  scores,
  subtitle,
  footer,
}: {
  globalScore?: number;
  scores?: EvaluationScore[];
  subtitle?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-4 rounded-xl border border-brandCP/15 bg-brandCP/[0.04] px-4 py-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brandCP/15">
          <span className="text-2xl font-bold text-brandCP">{Math.round(globalScore ?? 0)}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Global Score</p>
          {subtitle !== undefined && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
        </div>
      </div>

      {scores && scores.length > 0 && (
        <div className="space-y-2">
          {scores.map((s, i) => (
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

      {footer}
    </>
  );
}
