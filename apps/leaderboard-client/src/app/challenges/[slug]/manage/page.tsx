import { notFound, permanentRedirect } from "next/navigation";
import { ChallengeManageView } from "@/components/challenges/ChallengeManageView";
import { challengeManagePath, withSearchParams } from "@/lib/paths";
import { resolveChallengeRef } from "@/lib/server/pageRefs";

/**
 * Manager-facing control room. Access is guarded inside the view against the
 * caller's managed projects. Kept as a distinct route from the admin view on
 * purpose (separate URL for logs/analytics).
 *
 * Même résolution que la page publique : un UUID ou un ancien slug redirigent
 * vers `/challenges/<slug>/manage`. La vue reçoit l'UUID, sur lequel restent
 * ses routes d'API et le cache qu'elle partage avec la page publique.
 */
export default async function ChallengeManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const ref = await resolveChallengeRef(slug);
  if (ref.kind === "missing") notFound();
  if (ref.kind === "moved") permanentRedirect(withSearchParams(challengeManagePath(ref.slug), await searchParams));

  return <ChallengeManageView challengeId={ref.entity.uuid} />;
}
