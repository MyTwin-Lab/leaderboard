import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GradientBackground } from "@/components/layout/GradientBackground";
import { Navbar } from "@/components/layout/Navbar";
import { OnboardingDrawer } from "@/components/onboarding/OnboardingDrawer";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { fetchContributorSession } from "@/lib/contributor";
import { fetchOnboardingProgress } from "@/lib/server/onboarding";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { THEMES, DEFAULT_THEME_KEY, isValidThemeKey } from "@/lib/themes";
import { resolveTheme } from "@/lib/color-utils";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyTwin Leaderboard",
  description: "Visualisez le classement des contributeurs du Lab",
};

const appSettingsRepo = new AppSettingsRepository();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, settings] = await Promise.all([
    fetchContributorSession(),
    appSettingsRepo.get(),
  ]);
  const onboarding = session ? await fetchOnboardingProgress(session.id) : null;

  const themeKey = isValidThemeKey(settings.theme_key) ? settings.theme_key : DEFAULT_THEME_KEY;
  const palette = THEMES[themeKey];

  const theme = resolveTheme({
    primaryColor: settings.primary_color,
    backgroundColor: settings.background_color,
    themeMode: settings.theme_mode,
    paletteTokens: palette,
  });

  // Set the intermediate vars that globals.css @theme inline references via var().
  // Inline style on <html> wins over :root in the stylesheet (higher specificity).
  // Tailwind utility classes then resolve dynamically through the var() chain.
  const themeVars = {
    "--theme-primary": theme.brandCP,
    "--theme-primary-100": theme.primary100,
    "--theme-primary-200": theme.primary200,
    "--theme-primary-300": theme.primary300,
    "--background": theme.background,
    "--background-dark": theme.backgroundDark,
    "--foreground": theme.foreground,
  } as React.CSSProperties;

  return (
    <html lang="fr" style={themeVars} data-mode={settings.theme_mode}>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <GradientBackground>
          <Navbar session={session} />
          <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24">
            {children}
          </main>
          {session && onboarding && !onboarding.completed_at && settings.modules_onboarding_enabled && (
            <OnboardingDrawer initialProgress={onboarding} />
          )}
          {session && <SessionGuard />}
        </GradientBackground>
      </body>
    </html>
  );
}
