import type { Metadata } from "next";
import type { ReactNode } from "react";

import { UNLISTED_ROBOTS } from "@/lib/seo";

/**
 * Le segment `/marketplace` entier est hors des index : posé ici, le
 * `noindex, follow` vaut pour le catalogue et pour chaque fiche, y compris
 * celles qu'un ajout au registre fera naître. Chaque page le redit
 * (`unlistedMetadata`) ; le layout garantit qu'aucune ne l'oublie.
 */
export const metadata: Metadata = { robots: UNLISTED_ROBOTS };

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return children;
}
