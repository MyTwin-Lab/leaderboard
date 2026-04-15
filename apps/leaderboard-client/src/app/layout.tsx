import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GradientBackground } from "@/components/layout/GradientBackground";
import { Navbar } from "@/components/layout/Navbar";
// import { OnboardingDrawer } from "@/components/onboarding/OnboardingDrawer";
import { fetchContributorSession } from "@/lib/contributor";
// import { fetchOnboardingProgress } from "@/lib/server/onboarding";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await fetchContributorSession();
  // const onboarding = session ? await fetchOnboardingProgress(session.id) : null;

  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GradientBackground>
          <Navbar session={session} />
          <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24">
            {children}
          </main>
          {/* OnboardingDrawer désactivé temporairement (composant manquant) */}
        </GradientBackground>
      </body>
    </html>
  );
}
