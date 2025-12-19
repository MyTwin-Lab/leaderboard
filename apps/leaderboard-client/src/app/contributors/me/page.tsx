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
    <div className="mx-auto mt-4 max-w-2xl sm:mt-6">
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        totalCP={profile.totalCP}
      />

      <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
        {/* Profile & Challenges */}
        <ChallengeList challenges={profile.challenges} />

        {/* My Tasks */}
        <div className="hidden">
          <MyTasks />
        </div>
      </div>
    </div>
  );
}
