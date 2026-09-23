import Link from "next/link";

import { coverShot } from "@/lib/coverImage";
import { formatCP } from "@/lib/formatters";
import { challengePath } from "@/lib/paths";
import type { HomeTrendingChallenge } from "@/lib/types";
import { HomeCarousel } from "./HomeCarousel";
import { HomeArrow, HomeMore, HomeSectionHead } from "./HomeSection";

/** Le rythme du carrousel sur téléphone : le temps de lire une carte. */
const CAROUSEL_INTERVAL_MS = 5000;

interface HomeChallengesPreviewProps {
  challenges: HomeTrendingChallenge[];
}

/**
 * Les challenges qui bougent, dans la forme de la maquette.
 *
 * `ChallengeCard` n'est pas réutilisée : la maquette pose ici une carte
 * horizontale — vignette, texte, puis pool et bouton séparés par un filet —
 * là où le listing empile une photo pleine largeur et son corps. La carte de
 * `/challenges` garde la sienne.
 */
export function HomeChallengesPreview({ challenges }: HomeChallengesPreviewProps) {
  return (
    <section aria-labelledby="ch-title" className="v-home-section">
      <HomeSectionHead
        id="ch-title"
        eyebrow="Challenges"
        href="/challenges"
        linkLabel="All challenges"
      />

      {challenges.length === 0 ? (
        <div className="v-home-empty">No active challenge this week.</div>
      ) : (
        <HomeCarousel
          railClassName="v-home-challenges"
          itemNoun="challenge"
          autoAdvanceMs={CAROUSEL_INTERVAL_MS}
        >
          {challenges.map((challenge, index) => {
            const shot = coverShot(challenge.coverImageUrl, index, "challenge");
            return (
              <Link
                key={challenge.id}
                href={challengePath(challenge.slug)}
                className="v-home-challenge"
              >
                <div className="v-home-challenge-shot">
                  {/* eslint-disable-next-line @next/next/no-img-element -- couverture libre ou repli de la banque */}
                  <img src={shot.src} alt="" style={{ objectPosition: shot.position }} />
                </div>
                <div className="v-home-challenge-body">
                  <span className="v-home-tag">
                    {challenge.typeLabel} · {challenge.projectName}
                  </span>
                  <h3>{challenge.title}</h3>
                  {challenge.description && <p>{challenge.description}</p>}
                </div>
                <div className="v-home-challenge-aside">
                  <span className="v-home-pool">
                    <b>{formatCP(challenge.rewardPool)}</b> CP pool
                  </span>
                  <span className="v-home-contribute">
                    Contribute
                    <HomeArrow />
                  </span>
                </div>
              </Link>
            );
          })}
        </HomeCarousel>
      )}

      <HomeMore href="/challenges" place="bottom">
        All challenges
      </HomeMore>
    </section>
  );
}
