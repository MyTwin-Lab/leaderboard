import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GradientBackground } from "@/components/layout/GradientBackground";
import { Navbar } from "@/components/layout/Navbar";
import { OnboardingDrawer } from "@/components/onboarding/OnboardingDrawer";
import { fetchContributorSession } from "@/lib/contributor";
import { fetchOnboardingProgress } from "@/lib/server/onboarding";
import { theme } from "@/theme";

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
  title: theme.appName,
  description: "Visualisez le classement des contributeurs du Lab",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await fetchContributorSession();
  const onboarding = session ? await fetchOnboardingProgress(session.id) : null;

  return (
    <html lang="fr">
      <head>
        <style>{`
          :root {
            --background: ${theme.colors.background};
            --background-dark: ${theme.colors.backgroundDark};
            --color-brandCP: ${theme.colors.brandCP};
            --color-primary-100: ${theme.colors.primary100};
            --color-primary-200: ${theme.colors.primary200};
            --color-primary-300: ${theme.colors.primary300};
            --gradient-from: ${theme.colors.gradientFrom};
            --gradient-via: ${theme.colors.gradientVia};
            --gradient-to: ${theme.colors.gradientTo};
          }
        `}</style>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GradientBackground>
          <Navbar
            session={session}
            theme={{
              logoPath: theme.logoPath,
              appName: theme.appName,
              nav: theme.nav,
            }}
          />
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
