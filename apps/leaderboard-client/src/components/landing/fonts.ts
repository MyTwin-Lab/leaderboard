import { Hanken_Grotesk, Plus_Jakarta_Sans } from "next/font/google";

// La landing a sa propre famille typographique, hors du thème du Lab (Geist).

// Le titre : la même famille que la landing MyTwin Health.
export const landingHeading = Plus_Jakarta_Sans({
  variable: "--font-landing-heading",
  subsets: ["latin"],
  display: "swap",
});

export const landingSans = Hanken_Grotesk({
  variable: "--font-landing-sans",
  subsets: ["latin"],
  display: "swap",
});
