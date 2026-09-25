import Link from "next/link";

import { VitrineAvatar } from "@/components/vitrine/VitrineAvatar";
import { formatCP } from "@/lib/formatters";
import type { HomeLeaderboardEntry } from "@/lib/types";
import { HomeMore, HomeSectionHead } from "./HomeSection";

interface HomeLeaderboardPreviewProps {
  podium: HomeLeaderboardEntry[];
}

/**
 * Le top 3 du classement, dans la forme de la maquette.
 *
 * `LeaderboardList` n'est pas réutilisé ici : la maquette donne à ces trois
 * lignes une géométrie propre — quatre colonnes fixes, un premier d'un cran
 * au-dessus, pas de pastille « leader ». Le composant de `/leaderboard` garde
 * la sienne.
 */
export function HomeLeaderboardPreview({ podium }: HomeLeaderboardPreviewProps) {
  return (
    <section aria-labelledby="top-title" className="v-home-section">
      <HomeSectionHead
        id="top-title"
        eyebrow="Top three contributors"
        href="/leaderboard"
        linkLabel="Full ranking"
      />

      {podium.length === 0 ? (
        <div className="v-home-empty">
          The ranking fills up as soon as the first contribution lands.
        </div>
      ) : (
        <ol className="v-home-rank">
          {podium.map((entry, index) => (
            <li key={entry.userId}>
              <Link
                href={`/contributors/${entry.userId}`}
                className="v-home-rank-row"
                data-first={index === 0 ? "true" : "false"}
              >
                <span className="v-home-rank-num">{entry.rank}</span>
                <VitrineAvatar
                  name={entry.name}
                  avatarUrl={entry.avatarUrl}
                  size="3rem"
                  ring={false}
                />
                <span className="v-home-rank-text">
                  <span className="v-home-rank-name">{entry.name}</span>
                  {entry.bio && <span className="v-home-rank-bio">{entry.bio}</span>}
                </span>
                <span className="v-home-rank-cp">
                  {formatCP(entry.cp)}
                  <small>CP</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <HomeMore href="/leaderboard" place="bottom">
        Full ranking
      </HomeMore>
    </section>
  );
}
