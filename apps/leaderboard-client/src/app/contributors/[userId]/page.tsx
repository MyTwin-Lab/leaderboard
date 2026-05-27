import { notFound } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ProfileTabs } from "@/components/contributor/ProfileTabs";
import { fetchContributorProfile, fetchDiscordEvaluations, fetchDiscordAccount } from "@/lib/server/leaderboard";
import { getSessionUser } from "@/lib/auth";

interface ContributorPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function ContributorPage({ params }: ContributorPageProps) {
  const { userId } = await params;
  const [profile, discordEvaluations, discordAccount, sessionUser] = await Promise.all([
    fetchContributorProfile(userId),
    fetchDiscordEvaluations(userId),
    fetchDiscordAccount(userId),
    getSessionUser(),
  ]);

  if (!profile) {
    notFound();
  }

  const isOwner = sessionUser?.id === userId;

  return (
    <div className="mx-auto mt-4 max-w-2xl space-y-4 sm:mt-6 sm:space-y-6">
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        totalCP={profile.totalCP}
      />
      <ProfileTabs
        challenges={profile.challenges}
        discordEvaluations={discordEvaluations}
        isOwner={isOwner}
        discordAccount={discordAccount}
      />
    </div>
  );
}
