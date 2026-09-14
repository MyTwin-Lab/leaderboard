import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { GET as getBrief } from "@/app/api/challenges/[id]/brief/route";
import { GET as getOverview } from "@/app/api/challenges/[id]/overview/route";
import { GET as getModules } from "@/app/api/modules/route";
import { isCookielessVisitor, readPublicRoute } from "@/lib/server/publicSsr";
import ChallengeDetailClient from "./ChallengeDetailClient";

/**
 * La page d'un challenge. Le contenu est rendu par `ChallengeDetailClient` ;
 * cette coquille serveur n'existe que pour qu'un visiteur sans cookie — dont
 * tous les crawlers — reçoive ce contenu dans le HTML plutôt qu'un squelette
 * (voir `lib/server/publicSsr.ts`).
 *
 * Les clés et les formes pré-remplies sont celles des `useQuery` du client :
 * `challenge-overview`, `modules` et `challenge-brief`. Ce qui ne bloque pas
 * le premier rendu (activité des repos, métriques ML) reste chargé côté client.
 */
export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!(await isCookielessVisitor())) return <ChallengeDetailClient />;

  const queryClient = new QueryClient();
  const [overview, modules, brief] = await Promise.all([
    readPublicRoute(getOverview, `/api/challenges/${id}/overview`, { id }),
    readPublicRoute(getModules, "/api/modules"),
    readPublicRoute<{ content: string | null }, { id: string }>(getBrief, `/api/challenges/${id}/brief`, { id }),
  ]);

  // Un challenge introuvable ou non public ne pré-remplit rien : le client
  // refait la requête, prend le 404, et affiche son propre « not found ».
  if (overview) {
    queryClient.setQueryData(["challenge-overview", id], overview);
    if (modules) queryClient.setQueryData(["modules"], modules);
    if (brief) queryClient.setQueryData(["challenge-brief", id], brief.content);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChallengeDetailClient knownAnonymous />
    </HydrationBoundary>
  );
}
