import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sandboxMetadata } from "@/lib/server/seo";

/**
 * Ce layout n'existe que pour les métadonnées : `page.tsx` est un composant
 * client, et un composant client ne peut pas exporter `generateMetadata`.
 * Il ne rend donc rien de plus que ses enfants.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return sandboxMetadata(id);
}

export default function SandboxDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
