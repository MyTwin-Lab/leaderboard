import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { MyTasks } from "@/components/contributor/MyTasks";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";

export default async function ContributorSelfPage() {
  const session = await fetchContributorSession();

  if (!session) {
    redirect("/login?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id);

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="mt-6">
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        totalCP={profile.totalCP}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left column: Profile & Challenges */}
        <div className="space-y-6">
          <ChallengeList challenges={profile.challenges} />
        </div>
        
        {/* Right column: My Tasks */}
        <div className="hidden">
          <MyTasks />
        </div>
      </div>
    </div>
  );
}
