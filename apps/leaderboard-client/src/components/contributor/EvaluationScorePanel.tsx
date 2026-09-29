"use client";

import type { ReactNode } from "react";

import "@/components/challenges/challenge-overlays-vitrine.css";

export interface EvaluationScore {
  criterion: string;
  score: number;
  weight: number;
  comment?: string;
}

/**
 * Le rendu d'une évaluation d'agent : la pastille « Global Score » et la liste
 * des critères, barres de progression et commentaires compris. Sur le design
 * vitrine (`.v-co-score*`, `.v-co-crit*`) : à poser sous une racine vitrine,
 * ce que fait `EvaluationModal`.
 *
 * Le composant rend un fragment, pas un conteneur : les blocs deviennent des
 * enfants directs du parent, qui garde donc la main sur l'espacement et sur
 * ce qui les entoure. `subtitle` et `footer` sont les deux seuls endroits où
 * les appelants diffèrent — CP gagnés et date d'évaluation pour une
 * contribution.
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
      <div className="v-co-score">
        <div className="v-co-score-num">{Math.round(globalScore ?? 0)}</div>
        <div>
          <p className="v-co-score-title">Global Score</p>
          {subtitle !== undefined && <p className="v-help" data-size="xs">{subtitle}</p>}
        </div>
      </div>

      {scores && scores.length > 0 && (
        <div className="v-rows">
          {scores.map((s, i) => (
            <div key={i} className="v-co-crit">
              <div className="v-co-crit-head">
                <p className="v-co-crit-name">{s.criterion}</p>
                <div className="v-co-crit-right">
                  <span className="v-row-meta">×{s.weight}</span>
                  <span className="v-badge" data-tone="accent">{s.score}/10</span>
                </div>
              </div>
              <div className="v-bar">
                <div className="v-bar-fill" style={{ width: `${s.score * 10}%` }} />
              </div>
              {s.comment && <p className="v-co-crit-comment">{s.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {footer}
    </>
  );
}
