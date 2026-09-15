import { notFound, permanentRedirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { modules } from "@packages/capabilities/modules";
import { GET as getSandbox } from "@/app/api/sandboxes/[id]/route";
import { sandboxPath, withSearchParams } from "@/lib/paths";
import { resolveSandboxRef } from "@/lib/server/pageRefs";
import { isCookielessVisitor, readPublicRoute } from "@/lib/server/publicSsr";
import SandboxDetailClient from "./SandboxDetailClient";

/**
 * La page d'une proposition, à son slug. Même coquille que
 * `challenges/[slug]/page.tsx` : un UUID ou un ancien slug redirigent en 308,
 * un segment inconnu répond 404, et un visiteur sans cookie reçoit le contenu
 * dans le HTML (voir `lib/server/publicSsr.ts`).
 *
 * `sb_anon` compte comme un cookie : un anonyme qui a déjà donné une étoile
 * doit voir la sienne, et seul le client lit la réponse qui en tient compte.
 */
export default async function SandboxDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Le module désactivé, la page n'existe pas.
  if (!(await modules.enabled("sandbox"))) notFound();

  const { slug } = await params;
  const ref = await resolveSandboxRef(slug);
  if (ref.kind === "missing") notFound();
  if (ref.kind === "moved") permanentRedirect(withSearchParams(sandboxPath(ref.slug), await searchParams));

  const id = ref.entity.uuid;

  if (!(await isCookielessVisitor())) return <SandboxDetailClient sandboxId={id} />;

  const queryClient = new QueryClient();
  const detail = await readPublicRoute(getSandbox, `/api/sandboxes/${id}`, { id });
  if (detail) queryClient.setQueryData(["sandbox", id], detail);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SandboxDetailClient sandboxId={id} knownAnonymous />
    </HydrationBoundary>
  );
}
