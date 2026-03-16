import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { MyTasks } from "@/components/contributor/MyTasks";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";
import Link from "next/link";

export default async function ContributorSelfPage() {
  const session = await fetchContributorSession();

  const openSyncMeetings = () => {
    redirect("/sync-meetings");
  };

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
        <div>
          <MyTasks />
        </div>
      </div>

      <div className="flex items-center mt-8 justify-center gap-10">
        <Link
          href="/settings/google-account"
          className="rounded-full bg-white/10 px-4 py-2 text-m font-medium text-white/90 shadow-md shadow-black/20 transition hover:bg-white/20"
        >
          Connect Google
        </Link>
      </div>
    </div>
  );
}
