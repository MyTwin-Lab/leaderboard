import { landingDisplay, landingHeading, landingSans } from "./fonts";
import { LandingCommunity } from "./LandingCommunity";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { LandingNews } from "./LandingNews";
import { LandingStatement } from "./LandingStatement";

import "./landing.css";

// La landing de `/` : sa propre DA (polices, couleurs, rythme), scopée sous
// `.landing`. Elle ne lit aucun token du thème du Lab et sort de son chrome
// (voir `components/layout/LabShell.tsx`). Le CTA « Enter the Lab » mène à
// `/home`, où commence la web app.
export function Landing() {
  return (
    <div className={`landing ${landingHeading.variable} ${landingDisplay.variable} ${landingSans.variable}`}>
      {/* Sans JavaScript, rien ne déclenche les apparitions : tout est montré. */}
      <noscript>
        <style>{`.l-reveal{opacity:1;transform:none}`}</style>
      </noscript>
      <main>
        <LandingHero />
        <LandingCommunity />
        <LandingNews />
        <LandingStatement />
      </main>
      <LandingFooter />
    </div>
  );
}
