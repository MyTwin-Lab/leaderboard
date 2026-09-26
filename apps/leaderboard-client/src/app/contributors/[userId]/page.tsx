import { notFound } from "next/navigation";
import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ContributorTopBar } from "@/components/contributor/ContributorTopBar";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { ContributionHeatmap } from "@/components/contributor/ContributionHeatmap";
import { ContributionDashboard } from "@/components/contributor/ContributionDashboard";
import { ContributorTabs } from "@/components/contributor/ContributorTabs";
import { SandboxRewardsList } from "@/components/contributor/SandboxRewardsList";
import { fetchContributorProfile } from "@/lib/server/leaderboard";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { contributorMetadata } from "@/lib/server/seo";
import { vitrineFontVars } from "@/components/vitrine/fonts";

import "@/components/vitrine/vitrine.css";
import "@/components/contributor/vitrine/profile-vitrine.css";

interface ContributorPageProps {
  params: Promise<{
    userId: string;
  }>;
  searchParams?: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: ContributorPageProps): Promise<Metadata> {
  const { userId } = await params;
  return contributorMetadata(userId);
}

/**
 * La page publique d'un contributeur, d'après `Profile Vitrine.dc.html`.
 *
 * Deux colonnes sur écran : l'identité à gauche, qui reste au défilement, les
 * onglets à droite. La page pose sa propre largeur et sa gouttière —
 * `LabShell` lui laisse la pleine largeur sur cette route.
 */
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
    <div className={`vitrine v-profile ${vitrineFontVars}`}>
      <div className="v-main">
        <ContributorTopBar />

        <div className="v-pro-grid">
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

          <div className="v-pro-panels">
            <ContributorTabs
              initialTab={initialTab}
              tabs={[
                {
                  label: "Overview",
                  panel: (
                    <>
                      <ContributionHeatmap challenges={profile.challenges} />
                      <ContributionDashboard challenges={profile.challenges} />
                    </>
                  ),
                },
                {
                  label: "Contributions",
                  panel: (
                    <>
                      <ChallengeList challenges={profile.challenges} />
                      <SandboxRewardsList sandboxes={profile.sandboxes} />
                    </>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
