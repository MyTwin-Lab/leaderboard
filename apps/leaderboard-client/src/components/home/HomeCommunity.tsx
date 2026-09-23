import { COMMUNITY_MEMBERS } from "@/content/community";
import { HomeCommunityCarousel } from "./HomeCommunityCarousel";
import { HomeSectionHead } from "./HomeSection";

/**
 * « Join our Community » : les visages du Lab, en carousel.
 *
 * La seule section centrée de la page — le bandeau de visages n'a ni début ni
 * fin, et un titre calé à gauche au-dessus de lui aurait désigné un bord qui
 * n'existe pas.
 */
export function HomeCommunity() {
  return (
    <section aria-labelledby="community-title" className="v-home-section v-home-community">
      <HomeSectionHead id="community-title" title="Join our Community" />

      <p className="v-home-lede">
        Students, engineers, clinicians, researchers and citizens, building the future of health together.
      </p>

      {/* Liste lisible par les lecteurs d'écran et les moteurs : le carousel est décoratif. */}
      <ul className="sr-only">
        {COMMUNITY_MEMBERS.map((member, index) => (
          <li key={`${member.name}-${index}`}>
            {member.name}, {member.role}
          </li>
        ))}
      </ul>

      {/* Sur téléphone, le carousel déborde la gouttière de la page : les
          visages défilent jusqu'au bord de l'écran (`home-vitrine.css`). */}
      <div className="v-home-marquee">
        <HomeCommunityCarousel members={COMMUNITY_MEMBERS} />
      </div>
    </section>
  );
}
