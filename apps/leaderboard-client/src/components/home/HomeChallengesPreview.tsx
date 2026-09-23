import { ChallengeCard } from "@/components/public/ChallengeCard";
import type { HomeTrendingChallenge } from "@/lib/types";
import { HomeSectionLink, HomeSectionTitle } from "./HomeSection";

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
 * L'îlot `.vitrine-embed` donne à la carte les jetons `--v-*` dont son CSS a
 * besoin : ils vivent sur `.vitrine`, que cette page n'est pas. Conséquence
 * assumée — les cartes gardent la palette claire de la vitrine, y compris en
 * thème sombre.
 *
 * `index` reste celui de la grille : c'est lui qui choisit l'illustration de
 * repli d'un challenge sans couverture, et il évite que deux cartes voisines
 * portent la même photo.
 */
export function HomeChallengesPreview({ challenges }: HomeChallengesPreviewProps) {
  return (
    <section aria-labelledby="trending-challenges-title" className="flex min-w-0 flex-col gap-4">
      <HomeSectionTitle id="trending-challenges-title">Challenges</HomeSectionTitle>

      {challenges.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/40">
          No active challenge this week.
        </div>
      ) : (
        <div className="vitrine-embed grid gap-3.5 sm:gap-4 md:grid-cols-2">
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

      <HomeSectionLink href="/challenges">All challenges</HomeSectionLink>
    </section>
  );
}
