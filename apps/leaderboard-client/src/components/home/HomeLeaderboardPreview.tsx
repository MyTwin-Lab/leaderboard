import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";
import type { HomeLeaderboardEntry, LeaderboardEntry } from "@/lib/types";
import { HomeSectionHead } from "./HomeSection";

interface HomeLeaderboardPreviewProps {
  podium: HomeLeaderboardEntry[];
}

/**
 * Le top 3 du classement, rendu par le composant de `/leaderboard` lui-même —
 * `LeaderboardList` — pour qu'une ligne se lise ici exactement comme là-bas.
 *
 * Le podium arrive dans la forme de l'accueil (`HomeLeaderboardEntry`) et non
 * dans celle du classement : les deux décrivent la même personne sous d'autres
 * noms, d'où la traduction ci-dessous. `contributionsCount` ne sert à aucune
 * des colonnes rendues, il est posé à 0 plutôt que remonté jusqu'ici.
 *
 * Les jetons `--v-*` dont le CSS du composant a besoin viennent désormais de
 * la page elle-même : l'accueil est une page vitrine, comme `/leaderboard`.
 */
function toLeaderboardEntry(entry: HomeLeaderboardEntry): LeaderboardEntry {
  return {
    rank: entry.rank,
    userId: entry.userId,
    displayName: entry.name,
    bio: entry.bio,
    avatarUrl: entry.avatarUrl,
    totalCP: entry.cp,
    contributionsCount: 0,
  };
}

export function HomeLeaderboardPreview({ podium }: HomeLeaderboardPreviewProps) {
  const entries = podium.map(toLeaderboardEntry);
  const [leader, ...rest] = entries;

  return (
    <section aria-labelledby="leaderboard-title" className="v-home-section">
      <HomeSectionHead
        id="leaderboard-title"
        title="Top 3 contributors"
        href="/leaderboard"
        linkLabel="Full ranking"
      />

      <LeaderboardList
        leader={leader ?? null}
        rest={rest}
        emptyTitle="No contributions yet"
        emptySubtitle="The ranking fills up as soon as the first contribution lands."
      />
    </section>
  );
}
