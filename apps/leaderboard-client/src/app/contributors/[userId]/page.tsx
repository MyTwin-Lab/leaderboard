import { notFound } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { ContributionHeatmap } from "@/components/contributor/ContributionHeatmap";
import { ContributionDashboard } from "@/components/contributor/ContributionDashboard";
import { ContributorTabs } from "@/components/contributor/ContributorTabs";
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
    <div className="mx-auto mt-4 max-w-4xl px-4 sm:mt-6">
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        totalCP={profile.totalCP}
      />
      <ContributorTabs
        tabs={[
          {
            label: "Overview",
            panel: (
              <div className="space-y-4 sm:space-y-6">
                <ContributionHeatmap challenges={profile.challenges} />
                <ContributionDashboard challenges={profile.challenges} />
              </div>
            ),
          },
          {
            label: "Contributions",
            panel: <ChallengeList challenges={profile.challenges} />,
          },
        ]}
      />
    </div>
  );
}
