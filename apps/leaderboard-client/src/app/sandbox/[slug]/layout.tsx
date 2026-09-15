import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveSandboxRef } from "@/lib/server/pageRefs";
import { sandboxJsonLd, sandboxMetadata } from "@/lib/server/seo";
import { unindexedMetadata } from "@/lib/seo";

/**
 * Ce layout n'existe que pour ce que lisent les moteurs : `page.tsx` est une
 * coquille autour d'un composant client, qui ne peut ni exporter
 * `generateMetadata` ni lire la base. Il ne rend rien de visible de plus que
 * ses enfants. La redirection d'un UUID ou d'un ancien slug est faite par la
 * page ; ici une telle URL reçoit des métadonnées neutres.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ref = await resolveSandboxRef(slug);
  return ref.kind === "found" ? sandboxMetadata(ref.entity) : unindexedMetadata("Sandbox");
}

export default async function SandboxDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ref = await resolveSandboxRef(slug);
  const jsonLd = ref.kind === "found" ? sandboxJsonLd(ref.entity) : null;

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {children}
    </>
  );
}
