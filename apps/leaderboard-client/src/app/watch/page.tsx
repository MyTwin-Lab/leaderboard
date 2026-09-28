import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { modules } from "@packages/capabilities/modules";
import { WatchExplorer } from "@/components/watch/WatchExplorer";
import { fetchContributorSession } from "@/lib/contributor";
import { readWatchSettings, WATCH_MODULE } from "@/lib/server/watch/settings";
import { fetchWatchSpotlight } from "@/lib/server/watch/spotlight";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Watch",
  description: "Search the health literature: topics, period, open access and journal impact, from OpenAlex.",
  robots: { index: false, follow: false },
};

/**
 * `/watch` — l'explorateur de publications santé.
 *
 * Réservé aux comptes connectés, tous rôles : le proxy (matcher `/watch`)
 * rafraîchit un jeton expiré et renvoie l'anonyme vers `/signin` ; la page
 * revérifie. Module désactivé : la page n'existe pas.
 *
 * Avant toute recherche, la page montre une sélection rendue côté serveur —
 * les publications santé les plus citées du mois (`fetchWatchSpotlight`) —
 * pour ne pas s'ouvrir vide. Le reste se lit côté client, depuis
 * `/api/watch/search` : les filtres vivent dans l'URL, et chaque changement
 * est une nouvelle requête.
 */
export default async function WatchPage() {
  if (!(await modules.enabled(WATCH_MODULE))) notFound();

  const session = await fetchContributorSession();
  if (!session) redirect("/signin?from=/watch");

  const settings = await readWatchSettings();
  const spotlight = await fetchWatchSpotlight(settings);
  return (
    // `useSearchParams` dans l'explorateur : Next exige une frontière Suspense.
    <Suspense fallback={null}>
      <WatchExplorer highImpactThreshold={settings.highImpactThreshold} spotlight={spotlight} />
    </Suspense>
  );
}
