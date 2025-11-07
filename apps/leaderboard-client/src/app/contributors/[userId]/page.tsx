import { notFound } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { fetchContributorProfile } from "@/lib/server/leaderboard";

interface ContributorPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function ContributorPage({ params }: ContributorPageProps) {
  const { userId } = await params;
  const profile = await fetchContributorProfile(userId);

  if (!profile) {
    notFound();
  }

  return (
    <div className="mt-6 space-y-6">
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        totalCP={profile.totalCP}
      />
      <ChallengeList challenges={profile.challenges} />
    </div>
  );
}
