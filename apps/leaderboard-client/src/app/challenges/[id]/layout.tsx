import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Ce layout n'existe que pour le titre de l'onglet : `page.tsx` est un
 * composant client, et un composant client ne peut pas exporter `metadata`.
 * Il ne rend donc rien de plus que ses enfants.
 */
export const metadata: Metadata = {
  title: "Challenges",
};

export default function ChallengeDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
