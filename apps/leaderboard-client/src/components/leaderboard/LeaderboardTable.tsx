"use client";

import { useLeaderboardContext } from "@/components/leaderboard/LeaderboardProvider";
import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";

/**
 * Le classement : une seule carte, la ligne du leader en tête sur fond vert,
 * puis les suivantes séparées d'un filet.
 *
 * Toutes les lignes ont la même hauteur, leader compris : c'est son fond et
 * son rang en vert qui le distinguent, pas sa taille.
 *
 * Ce composant-ci ne fait que brancher le contexte sur `LeaderboardList`, qui
 * porte le rendu. La séparation existe pour l'accueil du Lab, qui affiche le
 * même podium sans avoir de `LeaderboardProvider` au-dessus de lui.
 */
export function LeaderboardTable() {
  const { leader, rest, currentUserId, error, isLoading } = useLeaderboardContext();

  return (
    <LeaderboardList
      leader={leader}
      rest={rest}
      currentUserId={currentUserId}
      error={error}
      isLoading={isLoading}
    />
  );
}
