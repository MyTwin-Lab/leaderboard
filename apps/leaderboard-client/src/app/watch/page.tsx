import { notFound } from "next/navigation";
import { Suspense } from "react";
import { modules } from "@packages/capabilities/modules";
import { WatchExplorer } from "@/components/watch/WatchExplorer";
import { isCookielessVisitor } from "@/lib/server/publicSsr";
import { readWatchSettings, WATCH_MODULE } from "@/lib/server/watch/settings";
import { fetchWatchSpotlight } from "@/lib/server/watch/spotlight";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "Watch: Latest Health Research",
  description:
    "The most cited health publications of the month, and a search over the health literature: topics, period, open access and journal impact, from OpenAlex.",
  path: "/watch",
});

/**
 * `/watch` — l'explorateur de publications santé. **Page publique.**
 *
 * Avant toute recherche, la page montre une sélection rendue côté serveur —
 * les publications santé les plus citées du mois (`fetchWatchSpotlight`) —
 * que tout le monde lit, crawlers compris : elle est dans le HTML initial.
 *
 * La recherche, elle, demande un compte : `/api/watch/search` est derrière le
 * proxy, et l'explorateur propose la connexion à l'anonyme qui cherche. Comme
 * sur la sandbox, seul un visiteur sans aucun cookie est tenu pour anonyme dès
 * le serveur ; pour les autres, c'est le `meQuery` du client qui tranche, et
 * rafraîchit au passage un jeton expiré. Module désactivé : la page n'existe pas.
 */
export default async function WatchPage() {
  if (!(await modules.enabled(WATCH_MODULE))) notFound();

  const [settings, knownAnonymous] = await Promise.all([readWatchSettings(), isCookielessVisitor()]);
  const spotlight = await fetchWatchSpotlight(settings);
  return (
    // `useSearchParams` dans l'explorateur : Next exige une frontière Suspense.
    <Suspense fallback={null}>
      <WatchExplorer highImpactThreshold={settings.highImpactThreshold} spotlight={spotlight} knownAnonymous={knownAnonymous} />
    </Suspense>
  );
}
