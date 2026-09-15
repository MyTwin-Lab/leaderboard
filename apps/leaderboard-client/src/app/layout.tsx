import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { Providers } from "./providers";
import { GET as getModules } from "@/app/api/modules/route";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OnboardingDrawer } from "@/components/onboarding/OnboardingDrawer";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { fetchContributorSession } from "@/lib/contributor";
import type { ModulesResponse } from "@/lib/moduleSlots";
import { fetchOnboardingQuests } from "@/lib/server/onboarding";
import { readPublicRoute } from "@/lib/server/publicSsr";
import { modules } from "@packages/capabilities/modules";
import { AppSettingsRepository } from "@packages/database-service/repositories";
import { THEMES, DEFAULT_THEME_KEY, isValidThemeKey } from "@/lib/themes";
import { resolveTheme } from "@/lib/color-utils";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

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
  // Base des URL relatives (canonical, og:url, og:image) : sans elle, les
  // aperçus de lien reçoivent des chemins qu'ils ne savent pas résoudre.
  metadataBase: new URL(SITE_URL),
  // `template` habille le titre des pages enfants, `default` sert à celles qui
  // n'en déclarent pas : le nom de l'app reste dans l'onglet partout. Même
  // séparateur que mytwin.care (« Page | MyTwin »), pour une famille cohérente.
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  // Pas de `canonical` ici : hérité, il désignerait chaque page comme un
  // doublon de l'accueil. Chaque page publique pose le sien (lib/seo.ts).
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
};

const appSettingsRepo = new AppSettingsRepository();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session, settings, moduleStates] = await Promise.all([
    fetchContributorSession(),
    appSettingsRepo.get(),
    readPublicRoute<ModulesResponse>(getModules, "/api/modules"),
  ]);
  // Le tiroir d'onboarding : module actif, et au moins une quête à accomplir.
  const onboardingQuests = session && (await modules.enabled("onboarding"))
    ? await fetchOnboardingQuests(session.id)
    : [];
  const showOnboarding = onboardingQuests.some((quest) => !quest.completed);

  // L'état des modules dans le cache dès le rendu serveur : les entrées de
  // navigation des modules actifs (la sandbox) sont dans le HTML initial —
  // lues par les crawlers, sans apparaître après coup — et celles d'un module
  // désactivé n'y sont jamais.
  const queryClient = new QueryClient();
  if (moduleStates) queryClient.setQueryData(["modules"], moduleStates);

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
    <html lang="en" style={themeVars} data-mode={settings.theme_mode}>
      <head />
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <Providers>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <GradientBackground>
              <Navbar session={session} />
              <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24">
                {children}
              </main>
              <Footer />
              {showOnboarding && <OnboardingDrawer quests={onboardingQuests} />}
              {session && <SessionGuard />}
            </GradientBackground>
          </HydrationBoundary>
        </Providers>
      </body>
    </html>
  );
}
