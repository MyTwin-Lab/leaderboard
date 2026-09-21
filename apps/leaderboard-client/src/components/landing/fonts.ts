import { Hanken_Grotesk, Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";

// La landing a sa propre famille typographique, hors du thème du Lab (Geist).

// Les titres : la même famille que la landing MyTwin Health.
export const landingHeading = Plus_Jakarta_Sans({
  variable: "--font-landing-heading",
  subsets: ["latin"],
  display: "swap",
});

// Le serif à empattements est réservé à une seule phrase, la déclaration sous
// le hero : c'est sa rareté qui lui donne son poids.
export const landingDisplay = Instrument_Serif({
  variable: "--font-landing-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const landingSans = Hanken_Grotesk({
  variable: "--font-landing-sans",
  subsets: ["latin"],
  display: "swap",
});
