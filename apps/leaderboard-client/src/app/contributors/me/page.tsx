import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { MyTasks } from "@/components/contributor/MyTasks";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";
import { LogoutButton } from "@/components/contributor/LogoutButton";
import { CheckCircle2, ClipboardList } from "lucide-react";

export default async function ContributorSelfPage() {
  const session = await fetchContributorSession();

  const openSyncMeetings = () => {
    redirect("/sync-meetings");
  };

  if (!session) {
    redirect("/api/google-auth/authorize?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id);

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="mx-auto mt-4 max-w-2xl sm:mt-6">
      <div className="flex items-center justify-between">
        <ContributorHeader
          displayName={profile.displayName}
          githubUsername={profile.githubUsername}
          totalCP={profile.totalCP}
        />
        <LogoutButton />
      </div>
      
      <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
        {/* My Tasks */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-brandCP" />
            <h2 className="text-base font-semibold text-white sm:text-lg">My Tasks</h2>
          </div>
          <MyTasks />
        </div>

        {/* Profile & Challenges */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-5 w-5 text-brandCP" />
            <h2 className="text-base font-semibold text-white sm:text-lg">My Contributions</h2>
          </div>
          <ChallengeList challenges={profile.challenges} />
          </div>
        </div>
    </div>
  );
}
