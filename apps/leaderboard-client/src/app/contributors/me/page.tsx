import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { MyTasks } from "@/components/contributor/MyTasks";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";
import { LogoutButton } from "@/components/contributor/LogoutButton";
import { AdminButton } from "@/components/contributor/AdminButton";
import { ProfileEditForm } from "@/components/contributor/ProfileEditForm";
import { CheckCircle2, ClipboardList, UserCog } from "lucide-react";

export default async function ContributorSelfPage() {
  const session = await fetchContributorSession();

  if (!session) {
    redirect("/api/google-auth/authorize?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id);

  if (!profile) {
    redirect("/");
  }

  const [firstName, ...lastNameParts] = session.fullName.split(" ");
  const lastName = lastNameParts.join(" ");

  return (
    <div className="mx-auto mt-4 max-w-2xl sm:mt-6">
      <div className="flex items-center justify-between">
        <ContributorHeader
          displayName={profile.displayName}
          githubUsername={profile.githubUsername}
          totalCP={profile.totalCP}
        />
        <div className="flex items-center gap-2">
          {session.role === "admin" && <AdminButton />}
          <LogoutButton />
        </div>
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

        {/* Edit Profile */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <UserCog className="h-5 w-5 text-brandCP" />
            <h2 className="text-base font-semibold text-white sm:text-lg">Mon Profil</h2>
          </div>
          <div className="rounded-md bg-white/5 shadow-md shadow-black/20 p-4 sm:p-5">
            <ProfileEditForm
              initialValues={{
                firstName,
                lastName,
                githubUsername: session.githubUsername,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
