"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { usePathname } from "next/navigation";

import { GradientBackground } from "./GradientBackground";

type LabShellProps = PropsWithChildren<{
  navbar: ReactNode;
  footer: ReactNode;
  /** Ce qui flotte au-dessus des pages du Lab : onboarding, garde de session. */
  overlays?: ReactNode;
}>;

// La landing `/` a sa propre DA, hors du système de thème : elle sort du chrome
// du Lab (fond, navbar, conteneur, footer). Approche conditionnelle assumée,
// plutôt que des route groups, pour ne déplacer aucune page de la web app :
// partout ailleurs, l'arbre rendu est exactement celui d'avant.
export function LabShell({ navbar, footer, overlays, children }: LabShellProps) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <GradientBackground>
      {navbar}
      <main className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24">{children}</main>
      {footer}
      {overlays}
    </GradientBackground>
  );
}
