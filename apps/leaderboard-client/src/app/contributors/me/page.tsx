import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { ContributionHeatmap } from "@/components/contributor/ContributionHeatmap";
import { ContributionDashboard } from "@/components/contributor/ContributionDashboard";
import { ContributorTabs } from "@/components/contributor/ContributorTabs";
import { MyTasks } from "@/components/contributor/MyTasks";
import { ThemeSettings } from "@/components/contributor/ThemeSettings";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";
import { LogoutButton } from "@/components/contributor/LogoutButton";
import { AdminButton } from "@/components/contributor/AdminButton";
import { ProfileEditForm } from "@/components/contributor/ProfileEditForm";
import { ClickableAvatarUpload } from "@/components/contributor/ClickableAvatarUpload";
import { GitHubConnectionCard } from "@/components/contributor/GitHubConnectionCard";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { isValidThemeKey, DEFAULT_THEME_KEY } from "@/lib/themes";

const appSettingsRepo = new AppSettingsRepository();

export default async function ContributorSelfPage({
  searchParams,
}: {
  searchParams?: Promise<{ github_error?: string }>;
}) {
  const session = await fetchContributorSession();

  if (!session) {
    redirect("/api/google-auth/authorize?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id);

  if (!profile) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const githubError = resolvedSearchParams.github_error ?? null;

  const [firstName, ...lastNameParts] = session.fullName.split(" ");
  const lastName = lastNameParts.join(" ");

  const tabs: { label: string; panel: React.ReactNode }[] = [
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
      label: "My Tasks",
      panel: <MyTasks />,
    },
    {
      label: "Contributions",
      panel: <ChallengeList challenges={profile.challenges} />,
    },
    {
      label: "Profile",
      panel: (
        <div className="mx-auto max-w-sm py-2">
          <ProfileEditForm
            initialValues={{
              firstName,
              lastName,
              githubUsername: session.githubUsername,
            }}
            initialAvatarUrl={profile.avatarUrl ?? null}
          />
        </div>
      ),
    },
  ];

  if (session.role === "admin") {
    const settings = await appSettingsRepo.get();
    const themeKey = isValidThemeKey(settings.theme_key) ? settings.theme_key : DEFAULT_THEME_KEY;
    tabs.push({
      label: "Appearance",
      panel: (
        <div className="mx-auto max-w-lg py-2">
          <ThemeSettings
            currentTheme={themeKey}
            currentPrimaryColor={settings.primary_color ?? null}
            currentBackgroundColor={settings.background_color ?? null}
            currentThemeMode={settings.theme_mode}
          />
        </div>
      ),
    });
    tabs.push({
      label: "Integrations",
      panel: (
        <div className="mx-auto max-w-lg py-2">
          <GitHubConnectionCard initialError={githubError} />
        </div>
      ),
    });
  }

  return (
    <div className="mx-auto mt-4 max-w-4xl px-4 sm:mt-6">
      <div className="flex items-start justify-between mb-6">
        <ContributorHeader
          displayName={profile.displayName}
          githubUsername={profile.githubUsername}
          avatarUrl={profile.avatarUrl}
          totalCP={profile.totalCP}
          avatarSlot={
            <ClickableAvatarUpload
              name={profile.displayName}
              size={64}
              initialAvatarUrl={profile.avatarUrl}
            />
          }
        />
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {session.role === "admin" && <AdminButton />}
          <LogoutButton />
        </div>
      </div>

      <ContributorTabs tabs={tabs} />
    </div>
  );
}
