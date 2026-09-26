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
import { GitHubConnectionCard } from "@/components/contributor/GitHubConnectionCard";
import { KaggleConnectionCard } from "@/components/contributor/KaggleConnectionCard";
import { SlackConnectionCard } from "@/components/contributor/SlackConnectionCard";
import { OpenAIConnectionCard } from "@/components/contributor/OpenAIConnectionCard";
import { ScalewayConnectionCard } from "@/components/contributor/ScalewayConnectionCard";
import { AppSettingsRepository, OnboardingProgressRepository, UserRepository } from "@packages/database-service/repositories";
import { AccountMergePanel } from "@/components/contributor/AccountMergePanel";
import { isValidThemeKey, DEFAULT_THEME_KEY } from "@/lib/themes";
import { ModulesSettings } from "@/components/contributor/ModulesSettings";
import { OnboardingProgressTable } from "@/components/contributor/OnboardingProgressTable";
import { EvaluationGridsTab } from "@/components/contributor/evaluation-grids/EvaluationGridsTab";
import { DigestTab } from "@/components/contributor/DigestTab";
import { NotificationsTab } from "@/components/contributor/NotificationsTab";
import { SandboxSettings } from "@/components/contributor/SandboxSettings";
import { vitrineFontVars } from "@/components/vitrine/fonts";

import "@/components/vitrine/vitrine.css";
import "@/components/contributor/vitrine/profile-vitrine.css";

export const metadata = {
  title: "Profile",
};

const appSettingsRepo = new AppSettingsRepository();
const onboardingProgressRepo = new OnboardingProgressRepository();
const userRepo = new UserRepository();

export default async function ContributorSelfPage({
  searchParams,
}: {
  searchParams?: Promise<{ github_error?: string; tab?: string }>;
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
  const githubError = resolvedSearchParams.github_error ?? null;
  const initialTab = resolvedSearchParams.tab ?? undefined;

  const [firstName, ...lastNameParts] = session.fullName.split(" ");
  const lastName = lastNameParts.join(" ");

  const tabs: { label: string; panel: React.ReactNode }[] = [
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
        <div className="v-pro-cols">
          {/* La carte d'identité prend la place, celle de la photo suit : c'est
              l'ordre de la maquette, et les deux se replient l'une sous
              l'autre sous 22rem de large. */}
          <div className="v-pro-card v-pro-col-main" style={{ gap: "1.5rem" }}>
            <ProfileEditForm
              initialValues={{
                firstName,
                lastName,
                githubUsername: session.githubUsername,
              }}
              initialAvatarUrl={profile.avatarUrl ?? null}
            />
          </div>
          <div className="v-pro-card" style={{ flex: "1 1 16rem", minWidth: 0 }}>
            <span className="v-pro-kicker">Avatar</span>
            <div className="v-pro-avatar-row">
              <ClickableAvatarUpload
                name={profile.displayName}
                size={64}
                initialAvatarUrl={profile.avatarUrl}
              />
              <p>Click your avatar to replace it — PNG or JPG, square works best.</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  if (session.role === "admin") {
    const [settings, onboardingRows, allUsers] = await Promise.all([
      appSettingsRepo.get(),
      onboardingProgressRepo.findAllWithUsers(),
      userRepo.findAll(),
    ]);
    const unlinkedUsers = allUsers.filter((u) => !u.google_user_id);
    const linkedUsers = allUsers.filter((u) => u.google_user_id);
    const themeKey = isValidThemeKey(settings.theme_key) ? settings.theme_key : DEFAULT_THEME_KEY;
    // Les panneaux d'admin ne portent plus de largeur à eux : la maquette leur
    // donne la colonne entière, et chaque composant pose ses propres cartes.
    tabs.push({
      label: "Appearance",
      panel: (
        <ThemeSettings
          currentTheme={themeKey}
          currentPrimaryColor={settings.primary_color ?? null}
          currentBackgroundColor={settings.background_color ?? null}
          currentThemeMode={settings.theme_mode}
        />
      ),
    });
    tabs.push({
      label: "Integrations",
      panel: (
        <>
          <span className="v-pro-kicker">Integrations</span>
          <div className="v-pro-cards">
            <GitHubConnectionCard initialError={githubError} />
            <KaggleConnectionCard />
            <SlackConnectionCard />
            <OpenAIConnectionCard />
            <ScalewayConnectionCard />
          </div>
        </>
      ),
    });
    tabs.push({
      label: "Evaluation Grids",
      panel: <EvaluationGridsTab />,
    });
    tabs.push({
      label: "Modules",
      panel: (
        <ModulesSettings
          meetingsEnabled={settings.modules_meetings_enabled}
          onboardingEnabled={settings.modules_onboarding_enabled}
        />
      ),
    });
    tabs.push({
      label: "Digest",
      panel: (
        <DigestTab
          enabled={settings.digest_enabled}
          frequencyDays={settings.digest_frequency_days}
        />
      ),
    });
    tabs.push({
      label: "Sandbox",
      panel: (
        <SandboxSettings
          tiers={settings.sandbox_star_tiers ?? []}
          promotionBonusCp={settings.sandbox_promotion_bonus_cp ?? 0}
        />
      ),
    });
    tabs.push({
      label: "Onboarding",
      panel: (
        <>
          <span className="v-pro-kicker">Onboarding progress</span>
          <OnboardingProgressTable rows={onboardingRows} />
          <AccountMergePanel unlinkedUsers={unlinkedUsers} linkedUsers={linkedUsers} />
        </>
      ),
    });
  }

  return (
    <div className={`vitrine v-profile ${vitrineFontVars}`}>
      <div className="v-main">
        <ContributorTopBar
          actions={
            <>
              {session.role === "admin" && <AdminButton />}
              <LogoutButton />
            </>
          }
        />

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
            isAdmin={session.role === "admin"}
            avatarSlot={
              <ClickableAvatarUpload
                name={profile.displayName}
                size={72}
                initialAvatarUrl={profile.avatarUrl}
                round
              />
            }
          />

          <div className="v-pro-panels">
            <ContributorTabs tabs={tabs} initialTab={initialTab} />
          </div>
        </div>
      </div>
    </div>
  );
}
