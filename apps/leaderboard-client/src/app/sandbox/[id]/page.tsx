import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { GET as getSandbox } from "@/app/api/sandboxes/[id]/route";
import { isCookielessVisitor, readPublicRoute } from "@/lib/server/publicSsr";
import SandboxDetailClient from "./SandboxDetailClient";

/**
 * La page d'une proposition. Même coquille que `challenges/[id]/page.tsx` : le
 * contenu est rendu par `SandboxDetailClient`, et un visiteur sans cookie le
 * reçoit dans le HTML (voir `lib/server/publicSsr.ts`).
 *
 * `sb_anon` compte comme un cookie : un anonyme qui a déjà donné une étoile
 * doit voir la sienne, et seul le client lit la réponse qui en tient compte.
 */
export default async function SandboxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!(await isCookielessVisitor())) return <SandboxDetailClient />;

  const queryClient = new QueryClient();
  const detail = await readPublicRoute(getSandbox, `/api/sandboxes/${id}`, { id });
  if (detail) queryClient.setQueryData(["sandbox", id], detail);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SandboxDetailClient knownAnonymous />
    </HydrationBoundary>
  );
}
