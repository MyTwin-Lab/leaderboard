import { Hanken_Grotesk, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Les trois familles des maquettes Leaderboard / Challenges / Sandbox.
 *
 * Mêmes polices que la landing (`components/landing/fonts.ts`), déclarées à
 * part : les variables portent un autre nom, et la landing charge des graisses
 * qui ne servent pas ici. Chargées par `next/font`, pas par un `<link>` vers
 * Google : le fichier est servi par l'app, sans requête tierce ni décalage de
 * mise en page au chargement.
 */

/** Les titres et les chiffres : Plus Jakarta Sans. */
export const vitrineHeading = Plus_Jakarta_Sans({
  variable: "--font-vitrine-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Le texte courant : Hanken Grotesk. */
export const vitrineSans = Hanken_Grotesk({
  variable: "--font-vitrine-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** Le display du bandeau de bas de page : Instrument Serif. */
export const vitrineDisplay = Instrument_Serif({
  variable: "--font-vitrine-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/** Les trois variables, à poser sur la racine d'une page vitrine. */
export const vitrineFontVars = `${vitrineHeading.variable} ${vitrineSans.variable} ${vitrineDisplay.variable}`;
