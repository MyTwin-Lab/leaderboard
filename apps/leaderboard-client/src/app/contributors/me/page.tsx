import { redirect } from "next/navigation";

import { ContributorHeader } from "@/components/contributor/ContributorHeader";
import { ContributorTopBar } from "@/components/contributor/ContributorTopBar";
import { ChallengeList } from "@/components/contributor/ChallengeList";
import { ContributionHeatmap } from "@/components/contributor/ContributionHeatmap";
import { ContributionDashboard } from "@/components/contributor/ContributionDashboard";
import { ContributorTabs } from "@/components/contributor/ContributorTabs";
import { SandboxRewardsList } from "@/components/contributor/SandboxRewardsList";
import { ThemeSettings } from "@/components/contributor/ThemeSettings";
import { fetchContributorProfile, fetchContributorSession } from "@/lib/contributor";
import { LogoutButton } from "@/components/contributor/LogoutButton";
import { AdminButton } from "@/components/contributor/AdminButton";
import { ProfileEditForm } from "@/components/contributor/ProfileEditForm";
import { ClickableAvatarUpload } from "@/components/contributor/ClickableAvatarUpload";
import { IntegrationsPanel } from "@/components/contributor/IntegrationsPanel";
import { AppSettingsRepository, OnboardingProgressRepository, UserRepository } from "@packages/database-service/repositories";
import { AccountMergePanel } from "@/components/contributor/AccountMergePanel";
import { isValidThemeKey, DEFAULT_THEME_KEY } from "@/lib/themes";
import { ModulesPanel } from "@/components/contributor/ModulesPanel";
import { modules } from "@packages/capabilities/modules";
import { OnboardingProgressTable } from "@/components/contributor/OnboardingProgressTable";
import { EvaluationGridsTab } from "@/components/contributor/evaluation-grids/EvaluationGridsTab";
import { DigestTab } from "@/components/contributor/DigestTab";
import { NotificationsTab } from "@/components/contributor/NotificationsTab";

export const metadata = {
  title: "Profile",
};

const appSettingsRepo = new AppSettingsRepository();
const onboardingProgressRepo = new OnboardingProgressRepository();
const userRepo = new UserRepository();

export default async function ContributorSelfPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const session = await fetchContributorSession();

  if (!session) {
    redirect("/signin?from=/contributors/me");
  }

  const profile = await fetchContributorProfile(session.id, session.id);

  if (!profile) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  // `<clé>_error` : le code d'un OAuth refusé (`github_error=no_org_admin`…).
  const integrationErrors = Object.fromEntries(
    Object.entries(resolvedSearchParams)
      .filter((entry): entry is [string, string] => entry[0].endsWith("_error") && typeof entry[1] === "string")
      .map(([name, code]) => [name.slice(0, -"_error".length), code]),
  );
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
      label: "Contributions",
      panel: (
        <>
          <ChallengeList challenges={profile.challenges} />
          <SandboxRewardsList sandboxes={profile.sandboxes} />
        </>
      ),
    },
    // Avant les onglets conditionnels au rôle : tout le monde peut recevoir une
    // invitation de groupe. Atteignable en direct par ?tab=notifications, que
    // `ContributorTabs` résout déjà sur le libellé.
    {
      label: "Notifications",
      panel: <NotificationsTab />,
    },
    {
      label: "Profile",
      panel: (
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2 sm:items-start">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <ProfileEditForm
              initialValues={{
                firstName,
                lastName,
                githubUsername: session.githubUsername,
              }}
              initialAvatarUrl={profile.avatarUrl ?? null}
            />
          </div>
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/30">Avatar</span>
            <div className="flex items-center gap-4">
              <ClickableAvatarUpload
                name={profile.displayName}
                size={64}
                initialAvatarUrl={profile.avatarUrl}
              />
              <p className="text-sm text-white/50">
                Click your avatar to replace it - PNG or JPG, square works best.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  if (session.role === "admin") {
    const [settings, moduleStates, onboardingRows, allUsers] = await Promise.all([
      appSettingsRepo.get(),
      modules.all(),
      onboardingProgressRepo.findAllWithUsers(),
      userRepo.findAll(),
    ]);
    // Les dates ne passent pas la frontière serveur/client : l'écran n'en a pas besoin.
    const moduleEntries = moduleStates.map(({ key, label, description, enabled, settings: moduleSettings }) => ({
      key, label, description, enabled, settings: moduleSettings,
    }));
    const digestEnabled = moduleStates.some((state) => state.key === "digest" && state.enabled);
    const unlinkedUsers = allUsers.filter((u) => !u.google_user_id);
    const linkedUsers = allUsers.filter((u) => u.google_user_id);
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
            <IntegrationsPanel errors={integrationErrors} />
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
        <div className="mx-auto max-w-lg py-2 lg:max-w-4xl">
          <ModulesPanel initialModules={moduleEntries} />
        </div>
      ),
    });
    // Le digest désactivé n'a plus de routes : son onglet disparaît avec lui.
    if (digestEnabled) {
      tabs.push({
        label: "Digest",
        panel: (
          <div className="mx-auto max-w-lg py-2 lg:max-w-4xl">
            <DigestTab />
          </div>
        ),
      });
    }
    tabs.push({
      label: "Onboarding",
      panel: (
        <div className="mx-auto max-w-2xl py-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/30">
            Onboarding Progress
          </h2>
          <OnboardingProgressTable rows={onboardingRows} />
          <AccountMergePanel unlinkedUsers={unlinkedUsers} linkedUsers={linkedUsers} />
        </div>
      ),
    });
  }

  return (
    <div className="mx-auto mt-4 max-w-4xl px-4 sm:mt-6">
      <ContributorTopBar
        actions={
          <>
            {session.role === "admin" && <AdminButton />}
            <LogoutButton />
          </>
        }
      />
      <ContributorHeader
        displayName={profile.displayName}
        githubUsername={profile.githubUsername}
        bio={profile.bio}
        avatarUrl={profile.avatarUrl}
        totalCP={profile.totalCP}
        globalRank={profile.globalRank}
        rankGap={profile.rankGap}
        contributingSince={profile.contributingSince}
        avatarSlot={
          <ClickableAvatarUpload
            name={profile.displayName}
            size={80}
            initialAvatarUrl={profile.avatarUrl}
          />
        }
      />

      <ContributorTabs tabs={tabs} initialTab={initialTab} />
    </div>
  );
}
