import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GradientBackground } from "@/components/layout/GradientBackground";
import { Navbar } from "@/components/layout/Navbar";
import { OnboardingDrawer } from "@/components/onboarding/OnboardingDrawer";
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

  const themeStyle = `
    :root {
      --color-primary-100: ${theme.primary100};
      --color-primary-200: ${theme.primary200};
      --color-primary-300: ${theme.primary300};
      --color-brandCP: ${theme.brandCP};
      --background: ${theme.background};
      --background-dark: ${theme.backgroundDark};
      --foreground: ${theme.foreground};
    }
  `;

  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GradientBackground>
          <Navbar session={session} />
          <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24">
            {children}
          </main>
          {session && onboarding && !onboarding.completed_at && (
            <OnboardingDrawer initialProgress={onboarding} />
          )}
        </GradientBackground>
      </body>
    </html>
  );
}
