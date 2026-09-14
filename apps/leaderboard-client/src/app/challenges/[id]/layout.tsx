import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { challengeJsonLd, challengeMetadata } from "@/lib/server/seo";

/**
 * Ce layout n'existe que pour ce que lisent les moteurs : `page.tsx` est un
 * composant client, qui ne peut ni exporter `generateMetadata` ni lire la base.
 * Il ne rend rien de visible de plus que ses enfants.
 *
 * `/manage` en hérite aussi : son URL canonique pointe donc vers la page
 * publique du challenge, et next.config.ts lui pose un `noindex`.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return challengeMetadata(id);
}

export default async function ChallengeDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jsonLd = await challengeJsonLd(id);

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {children}
    </>
  );
}
