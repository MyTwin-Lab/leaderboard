import Image, { getImageProps } from "next/image";
import Link from "next/link";

import { ArrowIcon } from "./ArrowIcon";
import { landingHeading, landingSans } from "./fonts";

import "./landing.css";

// Deux cadrages de la même scène : paysage pour un écran plus large que haut,
// portrait (téléphone, tablette debout). Le navigateur ne charge que le sien.
// Image décorative : le message est dans le titre, d'où l'`alt` vide.
const BACKDROP = { alt: "", sizes: "100vw", priority: true } as const;
const {
  props: { srcSet: landscapeSrcSet },
} = getImageProps({ ...BACKDROP, src: "/landing/hero/digital-twin-hologram.webp", width: 1774, height: 887 });
const {
  props: { srcSet: portraitSrcSet, ...backdropProps },
} = getImageProps({ ...BACKDROP, src: "/landing/hero/digital-twin-hologram-mobile.webp", width: 941, height: 1672 });

// La landing de `/` : un seul écran, sans scroll. Le titre, puis « Enter the
// Lab », qui mène à `/home`, où commence la web app. Sa propre DA (polices,
// couleurs), scopée sous `.landing` : elle ne lit aucun token du thème du Lab
// et sort de son chrome (voir `components/layout/LabShell.tsx`).
export function Landing() {
  return (
    <div className={`landing ${landingHeading.variable} ${landingSans.variable}`}>
      <picture>
        <source media="(orientation: landscape)" srcSet={landscapeSrcSet} />
        {/* eslint-disable-next-line @next/next/no-img-element -- art direction : `getImageProps` + <picture> */}
        <img {...backdropProps} srcSet={portraitSrcSet} alt="" className="l-backdrop" />
      </picture>
      <div className="l-scrim" aria-hidden />

      <header className="l-bar">
        <Image
          src="/landing/logo/mytwin-lab-logo-dark.png"
          alt="MyTwin Lab"
          width={644}
          height={246}
          priority
          className="l-logo"
        />
      </header>

      <main className="l-hero">
        <h1 className="l-heading l-hero__title">Building the world’s most advanced human digital twin</h1>
        <Link href="/home" className="l-button">
          Enter the Lab
          <ArrowIcon />
        </Link>
      </main>
    </div>
  );
}
