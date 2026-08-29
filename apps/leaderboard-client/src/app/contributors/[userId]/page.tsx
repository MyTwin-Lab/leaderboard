import { notFound } from "next/navigation";
import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ContributorTopBar } from "@/components/contributor/ContributorTopBar";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { ContributionHeatmap } from "@/components/contributor/ContributionHeatmap";
import { ContributionDashboard } from "@/components/contributor/ContributionDashboard";
import { ContributorTabs } from "@/components/contributor/ContributorTabs";
import { fetchContributorProfile } from "@/lib/server/leaderboard";
import { getSessionUser } from "@/lib/auth";

interface ContributorPageProps {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function ContributorPage({ params, searchParams }: ContributorPageProps) {
  const { userId } = await params;
  const session = await getSessionUser();
  const profile = await fetchContributorProfile(userId, session?.id);

  if (!profile) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTab = resolvedSearchParams.tab;

  return (
    <div className="mx-auto mt-4 max-w-4xl px-4 sm:mt-6">
      <ContributorTopBar />
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        bio={profile.bio}
        avatarUrl={profile.avatarUrl}
        totalCP={profile.totalCP}
        globalRank={profile.globalRank}
        rankGap={profile.rankGap}
        contributingSince={profile.contributingSince}
      />
      <ContributorTabs
        initialTab={initialTab}
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
