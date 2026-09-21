import Link from "next/link";

import { COMMUNITY_MEMBERS } from "@/content/community";

import { ArrowIcon } from "./ArrowIcon";
import { ContributorsCarousel } from "./ContributorsCarousel";
import { Reveal } from "./Reveal";

export function LandingCommunity() {
  return (
    <section className="l-section l-community" aria-labelledby="landing-community-title">
      <div className="l-container">
        <Reveal className="l-community__head">
          <h2 id="landing-community-title" className="l-heading l-community__title">
            Join our Community
          </h2>
          <p className="l-community__lead">
            Students, engineers, clinicians, researchers and citizens, building the future of health together.
          </p>
        </Reveal>
      </div>

      {/* Liste lisible par les lecteurs d'écran et les moteurs : le carousel est décoratif. */}
      <ul className="l-sr-only">
        {COMMUNITY_MEMBERS.map((contributor, index) => (
          <li key={`${contributor.name}-${index}`}>
            {contributor.name}, {contributor.role}
          </li>
        ))}
      </ul>

      <Reveal delay={150}>
        <ContributorsCarousel items={COMMUNITY_MEMBERS} />
      </Reveal>

      <Reveal className="l-community__cta">
        <Link href="/home" className="l-button l-button--large">
          Enter the Lab
          <ArrowIcon />
        </Link>
      </Reveal>
    </section>
  );
}
