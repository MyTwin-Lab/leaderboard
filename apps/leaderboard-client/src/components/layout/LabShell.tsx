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
/**
 * Les pages refaites d'après les maquettes Claude Design — les trois listings,
 * et l'accueil depuis. Elles posent elles-mêmes leur largeur, leur gouttière
 * et leur fond : le conteneur du Lab les contraindrait à d'autres valeurs que
 * celles de la maquette. Seule la réserve laissée à la navbar fixe reste ici,
 * identique partout.
 *
 * Égalité stricte : `/challenges/<slug>` et `/sandbox/<slug>` gardent le
 * chrome ordinaire.
 */
const VITRINE_BACKGROUNDS: Record<string, string> = {
  "/": "#fbfaf8",
  "/leaderboard": "#fbfaf8",
  "/challenges": "#fbfaf8",
  "/sandbox": "#fbfaf8",
};

/**
 * Les pages qui sortent entièrement du chrome du Lab.
 *
 * `/signin` seulement : un écran à deux volets, plein cadre, qui porte son
 * propre logo. Une navbar posée sur sa photo pleine hauteur n'aurait rien à
 * dire — pas plus qu'un footer sous un écran dont on ne sort que par « Back
 * to home ». La racine en faisait partie quand elle était la landing ; elle
 * est maintenant l'accueil du Lab, et porte le chrome comme les autres.
 */
const BARE_ROUTES = new Set(["/signin"]);

export function LabShell({ navbar, footer, overlays, children }: LabShellProps) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  const vitrineBackground = VITRINE_BACKGROUNDS[pathname];
  const vitrine = vitrineBackground !== undefined;

  return (
    <GradientBackground background={vitrineBackground}>
      {navbar}
      <main
        className={
          vitrine
            ? "w-full pt-20 md:pt-24"
            : "mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 md:pt-24"
        }
      >
        {children}
      </main>
      {footer}
      {overlays}
    </GradientBackground>
  );
}
