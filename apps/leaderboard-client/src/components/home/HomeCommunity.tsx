import Image from "next/image";

import { COMMUNITY_MEMBERS } from "@/content/community";
import { HomeArrow } from "./HomeSection";

/** Deux copies de la liste : la seconde reprend là où la première finit. */
const LOOPS = [0, 1];

/**
 * « Join our community » : l'encart menthe de la maquette.
 *
 * Tous les visages défilent en boucle, lentement, et se dissolvent sur les
 * bords de la carte. La bande est décorative : la liste complète reste lisible
 * par les lecteurs d'écran et les moteurs, juste en dessous.
 */
export function HomeCommunity() {
  return (
    <section aria-labelledby="community-title" className="v-home-community">
      <div className="v-home-community-text">
        <div style={{ display: "grid", gap: "0.4rem" }}>
          <span id="community-title" className="v-home-eyebrow">
            Join our community
          </span>
          <p className="v-home-community-lede">
            Engineers, doctors, researchers, students, patients, building the future of
            health together.
          </p>
        </div>

        <div className="v-home-faces-viewport">
          <ul className="v-home-faces" aria-hidden>
            {LOOPS.map((loop) =>
              COMMUNITY_MEMBERS.map((member, index) => (
                <li
                  key={`${loop}-${index}`}
                  className="v-home-face"
                  title={`${member.name} · ${member.role}`}
                >
                  <Image
                    src={`/landing/contributors/${member.photo}`}
                    alt=""
                    width={64}
                    height={64}
                    loading="lazy"
                  />
                  <Image
                    src={`/landing/flags/${member.country}.png`}
                    alt=""
                    width={40}
                    height={30}
                    loading="lazy"
                    className="v-home-flag"
                  />
                </li>
              )),
            )}
          </ul>
        </div>

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
