import { ChallengeCard } from "@/components/public/ChallengeCard";
import type { HomeTrendingChallenge } from "@/lib/types";
import { HomeSectionHead } from "./HomeSection";

import "@/components/vitrine/vitrine.css";
import "@/components/public/challenges-vitrine.css";

interface HomeChallengesPreviewProps {
  challenges: HomeTrendingChallenge[];
}

/**
 * Les challenges qui bougent, rendus par la carte de `/challenges` elle-même.
 *
 * `HomeTrendingChallenge` porte déjà tout ce que `ChallengeCard` attend —
 * couverture, statut, pool, avancement, équipe, activité des sept derniers
 * jours. Ni `isMember` ni `isAdmin` ne sont passés : cette page est lue sans
 * session, la carte n'a donc ni pastille « joined » ni menu d'administration.
 *
 * Les jetons `--v-*` dont le CSS de la carte a besoin viennent désormais de la
 * page elle-même : l'accueil est une page vitrine, comme `/challenges`. La
 * grille, en revanche, est la sienne (`.v-home-challenges`) — voir le
 * commentaire qui la définit dans `home-vitrine.css`.
 *
 * `index` reste celui de la grille : c'est lui qui choisit l'illustration de
 * repli d'un challenge sans couverture, et il évite que deux cartes voisines
 * portent la même photo.
 */
export function HomeChallengesPreview({ challenges }: HomeChallengesPreviewProps) {
  return (
    <section aria-labelledby="trending-challenges-title" className="v-home-section">
      <HomeSectionHead
        id="trending-challenges-title"
        title="Challenges"
        href="/challenges"
        linkLabel="All challenges"
      />

      {challenges.length === 0 ? (
        <div className="v-home-empty">No active challenge this week.</div>
      ) : (
        <div className="v-home-challenges">
          {challenges.map((challenge, index) => (
            <ChallengeCard
              key={challenge.id}
              index={index}
              challengeId={challenge.id}
              challengeSlug={challenge.slug}
              challengeTitle={challenge.title}
              challengeType={challenge.type}
              challengeStatus={challenge.status}
              projectName={challenge.projectName}
              description={challenge.description}
              rewardPool={challenge.rewardPool}
              completion={challenge.completion}
              coverImageUrl={challenge.coverImageUrl}
              teamMembers={challenge.teamMembers}
              recentContributions={challenge.recentContributions}
              spark={challenge.spark}
            />
          ))}
        </div>
      )}
    </section>
  );
}
