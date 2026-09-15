import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveChallengeRef } from "@/lib/server/pageRefs";
import { challengeJsonLd, challengeMetadata } from "@/lib/server/seo";
import { unindexedMetadata } from "@/lib/seo";

/**
 * Ce layout n'existe que pour ce que lisent les moteurs : `page.tsx` est une
 * coquille autour d'un composant client, qui ne peut ni exporter
 * `generateMetadata` ni lire la base. Il ne rend rien de visible de plus que
 * ses enfants.
 *
 * `/manage` en hérite aussi : son URL canonique pointe donc vers la page
 * publique du challenge, et next.config.ts lui pose un `noindex`.
 *
 * Il ne redirige pas : il ne connaît pas le sous-chemin (`/manage` ou non).
 * Chaque page le fait vers sa propre URL canonique ; ici, une URL qui va
 * rediriger ou répondre 404 reçoit simplement des métadonnées neutres.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ref = await resolveChallengeRef(slug);
  return ref.kind === "found" ? challengeMetadata(ref.entity) : unindexedMetadata("Challenges");
}

export default async function ChallengeDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ref = await resolveChallengeRef(slug);
  const jsonLd = ref.kind === "found" ? challengeJsonLd(ref.entity) : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {children}
    </>
  );
}
