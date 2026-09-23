import Image from "next/image";

import { COMMUNITY_MEMBERS } from "@/content/community";
import { HomeArrow } from "./HomeSection";

/** Les visages montrés ; le reste est compté dans la pastille finale. */
const FACES_SHOWN = 7;

/**
 * « Join our community » : l'encart menthe de la maquette.
 *
 * Le carousel qui défilait tout seul disparaît — la maquette pose une rangée
 * de visages fixes, et compte ceux qu'elle ne montre pas. La liste complète
 * reste lisible par les lecteurs d'écran et les moteurs.
 */
export function HomeCommunity() {
  const shown = COMMUNITY_MEMBERS.slice(0, FACES_SHOWN);
  const others = COMMUNITY_MEMBERS.length - shown.length;

  return (
    <section aria-labelledby="community-title" className="v-home-community">
      <div className="v-home-community-text">
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <span id="community-title" className="v-home-eyebrow">
            Join our community
          </span>
          <p className="v-home-community-lede">
            Students, engineers, clinicians, researchers and citizens, building the future of
            health together.
          </p>
        </div>

        <ul className="v-home-faces">
          {shown.map((member) => (
            <li
              key={member.photo}
              className="v-home-face"
              title={`${member.name} · ${member.role}`}
            >
              <Image
                src={`/landing/contributors/${member.photo}`}
                alt={member.name}
                width={64}
                height={64}
                loading="lazy"
              />
              <Image
                src={`/landing/flags/${member.country}.png`}
                alt=""
                aria-hidden
                width={40}
                height={30}
                loading="lazy"
                className="v-home-flag"
              />
            </li>
          ))}
          {others > 0 && <li className="v-home-face-more">+{others}</li>}
        </ul>

        {/* La liste complète, pour les lecteurs d'écran et les moteurs. */}
        <ul className="sr-only">
          {COMMUNITY_MEMBERS.map((member, index) => (
            <li key={`${member.name}-${index}`}>
              {member.name}, {member.role}
            </li>
          ))}
        </ul>
      </div>

      <a href="/signin" className="v-home-cta">
        Join the Lab
        <HomeArrow />
      </a>
    </section>
  );
}
