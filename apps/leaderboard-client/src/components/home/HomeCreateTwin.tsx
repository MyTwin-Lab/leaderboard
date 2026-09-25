import Image from "next/image";

import { HomeArrow } from "./HomeSection";

/**
 * « Create your twin » : un encart qui renvoie vers mytwin.care, où l'on crée
 * son jumeau.
 *
 * Toute la carte est le lien, pas seulement le libellé souligné : l'image est
 * la plus grande cible de la section. Elle y est décorative (`alt=""`), sans
 * quoi son texte s'ajouterait au nom du lien — et « digital twin » reste la
 * seule phrase de mission du Lab (voir docs/seo.md).
 */
export function HomeCreateTwin() {
  return (
    <section aria-labelledby="create-twin-title" className="v-home-section">
      <div className="v-home-head-text">
        <span id="create-twin-title" className="v-home-eyebrow">
          Create your twin
        </span>
        <h2 className="v-home-tagline">
          Create a digital twin for yourself, your patients, or your employees.
        </h2>
      </div>

      <a href="https://mytwin.care" className="v-home-twin-card">
        <Image
          src="/home/twin/create-your-twin.webp"
          alt=""
          width={1600}
          height={533}
          sizes="(min-width: 768px) 60vw, 100vw"
          loading="lazy"
          className="v-home-twin-card-img"
        />
        <span className="v-home-more v-home-twin-card-link">
          Create Your Twin
          <HomeArrow />
        </span>
      </a>
    </section>
  );
}
