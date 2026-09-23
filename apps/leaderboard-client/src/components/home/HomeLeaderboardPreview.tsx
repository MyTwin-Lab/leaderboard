import { LeaderboardList } from "@/components/leaderboard/LeaderboardList";
import type { HomeLeaderboardEntry, LeaderboardEntry } from "@/lib/types";
import { HomeSectionLink, HomeSectionTitle } from "./HomeSection";

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
 * L'îlot `.vitrine-embed` donne au composant les jetons `--v-*` dont son CSS a
 * besoin : ils vivent sur `.vitrine`, que cette page n'est pas. Conséquence
 * assumée — la carte garde la palette claire de la vitrine, y compris en
 * thème sombre.
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
    <section aria-labelledby="leaderboard-title" className="flex flex-col gap-4">
      <HomeSectionTitle id="leaderboard-title">Top 3 contributors</HomeSectionTitle>

      <div className="vitrine-embed">
        <LeaderboardList
          leader={leader ?? null}
          rest={rest}
          emptyTitle="No contributions yet"
          emptySubtitle="The ranking fills up as soon as the first contribution lands."
        />
      </div>

      <HomeSectionLink href="/leaderboard">Full ranking</HomeSectionLink>
    </section>
  );
}
