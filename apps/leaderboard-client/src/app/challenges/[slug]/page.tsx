import { notFound, permanentRedirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { GET as getBrief } from "@/app/api/challenges/[id]/brief/route";
import { GET as getOverview } from "@/app/api/challenges/[id]/overview/route";
import { GET as getModules } from "@/app/api/modules/route";
import { challengePath, withSearchParams } from "@/lib/paths";
import { resolveChallengeRef } from "@/lib/server/pageRefs";
import { isCookielessVisitor, readPublicRoute } from "@/lib/server/publicSsr";
import ChallengeDetailClient from "./ChallengeDetailClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * La page d'un challenge, à son slug. Le contenu est rendu par
 * `ChallengeDetailClient` ; cette coquille serveur fait deux choses.
 *
 * 1. **Résoudre l'URL.** Un UUID (les liens d'avant les slugs), un ancien slug
 *    ou un slug en majuscules redirigent en 308 vers le slug courant, query
 *    comprise — un lien d'invitation porte son jeton dans `?group=`. Un segment
 *    qui ne désigne rien répond un vrai 404.
 * 2. **Servir le contenu dans le HTML** à un visiteur sans cookie, dont tous les
 *    crawlers, plutôt qu'un squelette (voir `lib/server/publicSsr.ts`).
 *
 * Le client reçoit l'UUID en prop : toutes les routes d'API, et donc toutes les
 * clés de cache React Query, restent sur l'UUID. Les clés et les formes
 * pré-remplies sont celles des `useQuery` du client : `challenge-overview`,
 * `modules` et `challenge-brief`. Ce qui ne bloque pas le premier rendu
 * (activité des repos, métriques ML) reste chargé côté client.
 */
export default async function ChallengeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const ref = await resolveChallengeRef(slug);
  if (ref.kind === "missing") notFound();
  if (ref.kind === "moved") permanentRedirect(withSearchParams(challengePath(ref.slug), await searchParams));

  const challenge = ref.entity;
  const id = challenge.uuid;

  const queryClient = new QueryClient();
  const [cookieless, modules] = await Promise.all([
    isCookielessVisitor(),
    readPublicRoute(getModules, "/api/modules"),
  ]);
  // L'état des modules, pour tout visiteur : les slots d'un module désactivé
  // (la section meetings…) ne s'affichent pas, pas même le temps d'une requête.
  if (modules) queryClient.setQueryData(["modules"], modules);

  if (!cookieless) {
    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ChallengeDetailClient challengeId={id} challengeSlug={challenge.slug} />
      </HydrationBoundary>
    );
  }

  const [overview, brief] = await Promise.all([
    readPublicRoute(getOverview, `/api/challenges/${id}/overview`, { id }),
    readPublicRoute<{ content: string | null }, { id: string }>(getBrief, `/api/challenges/${id}/brief`, { id }),
  ]);

  // Un challenge non public ne pré-remplit rien d'autre : le client refait la
  // requête, prend le 404, et affiche son propre « not found ».
  if (overview) {
    queryClient.setQueryData(["challenge-overview", id], overview);
    if (brief) queryClient.setQueryData(["challenge-brief", id], brief.content);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChallengeDetailClient challengeId={id} challengeSlug={challenge.slug} knownAnonymous />
    </HydrationBoundary>
  );
}
