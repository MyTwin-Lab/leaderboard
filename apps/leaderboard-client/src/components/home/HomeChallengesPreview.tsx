import { ChallengeCard } from "@/components/public/ChallengeCard";
import type { TrendingChallenge } from "@/lib/types";

interface HomeChallengesPreviewProps {
  challenges: TrendingChallenge[];
}

export function HomeChallengesPreview({ challenges }: HomeChallengesPreviewProps) {
  if (challenges.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/40">
        Aucun challenge actif cette semaine.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {challenges.map((challenge, i) => (
        <ChallengeCard
          key={challenge.id}
          index={i}
          challengeId={challenge.id}
          challengeIndex={challenge.index}
          challengeTitle={challenge.title}
          challengeType={challenge.type}
          projectName={challenge.projectName}
          description={challenge.description}
          rewardPool={challenge.rewardPool}
          completion={challenge.completion}
          isMember={false}
          isAdmin={false}
          teamMembers={challenge.teamMembers}
          startDate={challenge.startDate}
          endDate={challenge.endDate}
        />
      ))}
    </div>
  );
}
