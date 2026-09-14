import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/seo/JsonLd";
import { sandboxJsonLd, sandboxMetadata } from "@/lib/server/seo";

/**
 * Ce layout n'existe que pour ce que lisent les moteurs : `page.tsx` est un
 * composant client, qui ne peut ni exporter `generateMetadata` ni lire la base.
 * Il ne rend rien de visible de plus que ses enfants.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return sandboxMetadata(id);
}

export default async function SandboxDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jsonLd = await sandboxJsonLd(id);

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      {children}
    </>
  );
}
