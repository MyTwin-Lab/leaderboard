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
import { KaggleConnectionCard } from "@/components/contributor/KaggleConnectionCard";
import { SlackConnectionCard } from "@/components/contributor/SlackConnectionCard";
import { OpenAIConnectionCard } from "@/components/contributor/OpenAIConnectionCard";
import { ScalewayConnectionCard } from "@/components/contributor/ScalewayConnectionCard";
import { AppSettingsRepository, OnboardingProgressRepository } from "@packages/database-service/repositories";
import { isValidThemeKey, DEFAULT_THEME_KEY } from "@/lib/themes";
import { ModulesSettings } from "@/components/contributor/ModulesSettings";
import { OnboardingProgressTable } from "@/components/contributor/OnboardingProgressTable";
import { EvaluationGridsTab } from "@/components/contributor/evaluation-grids/EvaluationGridsTab";

const appSettingsRepo = new AppSettingsRepository();
const onboardingProgressRepo = new OnboardingProgressRepository();

export default async function ContributorSelfPage({
  searchParams,
}: {
  searchParams?: Promise<{ github_error?: string; tab?: string }>;
}) {
  const session = await fetchContributorSession();

  if (!session) {
    redirect("/api/google-auth/authorize?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id, session.id);

  if (!profile) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const githubError = resolvedSearchParams.github_error ?? null;
  const initialTab = resolvedSearchParams.tab ?? undefined;

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
    const [settings, onboardingRows] = await Promise.all([
      appSettingsRepo.get(),
      onboardingProgressRepo.findAllWithUsers(),
    ]);
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
        <div className="mx-auto max-w-lg lg:max-w-4xl py-2 space-y-8">
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">
              Integrations
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
              <GitHubConnectionCard initialError={githubError} />
              <KaggleConnectionCard />
              <SlackConnectionCard />
              <OpenAIConnectionCard />
              <ScalewayConnectionCard />
            </div>
          </div>
        </div>
      ),
    });
    tabs.push({
      label: "Evaluation Grids",
      panel: (
        <div className="mx-auto max-w-lg py-2 lg:max-w-5xl">
          <EvaluationGridsTab />
        </div>
      ),
    });
    tabs.push({
      label: "Modules",
      panel: (
        <div className="mx-auto max-w-lg py-2">
          <ModulesSettings
            meetingsEnabled={settings.modules_meetings_enabled}
            onboardingEnabled={settings.modules_onboarding_enabled}
          />
        </div>
      ),
    });
    tabs.push({
      label: "Onboarding",
      panel: (
        <div className="mx-auto max-w-2xl py-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
            Onboarding Progress
          </h2>
          <OnboardingProgressTable rows={onboardingRows} />
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

      <ContributorTabs tabs={tabs} initialTab={initialTab} />
    </div>
  );
}
