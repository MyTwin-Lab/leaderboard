import type { Metadata } from "next";
import type { ReactNode } from "react";
import { challengeMetadata } from "@/lib/server/seo";

/**
 * Ce layout n'existe que pour les métadonnées : `page.tsx` est un composant
 * client, et un composant client ne peut pas exporter `generateMetadata`.
 * Il ne rend donc rien de plus que ses enfants.
 *
 * `/manage` en hérite aussi : son URL canonique pointe donc vers la page
 * publique du challenge, et robots.txt en interdit l'exploration.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return challengeMetadata(id);
}

export default function ChallengeDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
