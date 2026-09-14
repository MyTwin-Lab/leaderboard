import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { GET as getSandboxes } from "@/app/api/sandboxes/route";
import { SandboxExplorer } from "@/components/sandbox/SandboxExplorer";
import { isCookielessVisitor, readPublicRoute } from "@/lib/server/publicSsr";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sandbox: Community Health Projects",
  description:
    "Propose a health project, no approval needed. The community stars what it wants built, and the best projects are promoted into official MyTwin Lab challenges.",
  path: "/sandbox",
});

/**
 * Le listing des propositions — **page publique**.
 *
 * Tout se lit dans `SandboxExplorer`, côté client : l'état du visiteur (sa
 * star, ses propositions, son droit de créer) dépend de sa session, et
 * `/api/sandboxes/**` étant hors du matcher du proxy, c'est le `meQuery` du
 * composant qui déclenche le refresh silencieux d'un jeton expiré.
 *
 * Seule exception : un visiteur sans aucun cookie — dont tous les crawlers. Sa
 * vue ne dépend de rien, on lui pré-remplit donc le listing, qui arrive dans
 * le HTML avec les liens vers chaque proposition (voir `lib/server/publicSsr.ts`).
 */
export default async function SandboxPage() {
  if (!(await isCookielessVisitor())) return <SandboxExplorer />;

  const queryClient = new QueryClient();
  const listing = await readPublicRoute(getSandboxes, "/api/sandboxes");
  if (listing) queryClient.setQueryData(["sandboxes"], listing);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SandboxExplorer knownAnonymous />
    </HydrationBoundary>
  );
}
