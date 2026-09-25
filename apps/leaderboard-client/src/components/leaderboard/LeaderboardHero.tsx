"use client";

import { formatCP } from "@/lib/formatters";
import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import { BackToLab } from "@/components/vitrine/BackToLab";

/**
 * L'en-tête de la maquette : la pastille « Live ranking » qui bat, le titre,
 * l'accroche, et les trois chiffres à droite. Ils suivent le projet choisi,
 * pas la recherche — chercher un nom ne change pas le total distribué.
 */
export function LeaderboardHero() {
  const { scoredEntries, projectId } = useLeaderboardContext();

  const poolCP = scoredEntries.reduce((sum, entry) => sum + entry.totalCP, 0);
  const totalItems = scoredEntries.reduce((sum, entry) => sum + entry.contributionsCount, 0);

  const headStats = [
    { value: formatCP(poolCP), label: projectId === "all" ? "CP distributed" : "CP on this project" },
    { value: String(scoredEntries.length), label: "Contributors" },
    { value: String(totalItems), label: "Scored contributions" },
  ];

  return (
    <section className="v-head">
      <div className="v-head-text">
        <BackToLab />
        <h1 className="v-title">Leaderboard</h1>
        <p className="v-lede">
          Every contribution is detected, evaluated and rewarded, no invisible work.
        </p>
      </div>

      <dl className="v-stats">
        {headStats.map((stat) => (
          <div key={stat.label} className="v-stat">
            <dd className="v-stat-value">{stat.value}</dd>
            <dt className="v-stat-label">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
