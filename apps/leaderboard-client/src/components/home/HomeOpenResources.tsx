import Image from "next/image";

import { HomeArrow, HomeSectionHead } from "./HomeSection";

/**
 * « Open resources » : les outils que le Lab met à disposition pour travailler
 * sur les challenges. Une seule ressource aujourd'hui, posée en dur comme
 * « Create your twin » — une liste et son carrousel viendront avec la deuxième.
 *
 * La carte est celle de la une de News (`.v-home-feature`) : la maquette leur
 * donne la même forme — photo à gauche, titre, texte et appel à ouvrir — et
 * les règles téléphone de `home-vitrine.css` la remettent d'aplomb sans rien
 * ajouter ici.
 *
 * La ressource est hébergée ailleurs : le lien sort du site, donc `<a>` et
 * nouvel onglet. L'image est décorative (`alt=""`), sans quoi son texte
 * s'ajouterait au nom du lien — toute la carte est le lien, pas le seul
 * libellé souligné.
 */
export function HomeOpenResources() {
  return (
    <section aria-labelledby="resources-title" className="v-home-section">
      <HomeSectionHead
        id="resources-title"
        eyebrow="Open resources"
        tagline="Tools and resources to help the community work on health challenges."
      />

      <a
        href="https://lnkd.in/p/gJ5e_bEq"
        target="_blank"
        rel="noopener noreferrer"
        className="v-home-feature"
      >
        <div className="v-home-shot">
          <Image
            src="/home/resources/articles-scientifiques.jpg"
            alt=""
            width={542}
            height={372}
            sizes="(min-width: 768px) 38rem, 82vw"
            loading="lazy"
          />
        </div>
        <div className="v-home-feature-body">
          <h3>Latest Scientific Research</h3>
          <p>Stay up to date with scientific publications from the last 15 days.</p>
          <span className="v-home-read">
            View resource
            <HomeArrow />
          </span>
          {/* Hors de `.v-home-read` : le téléphone masque cet appel, et la
              mention disparaîtrait avec lui de l'arbre d'accessibilité. */}
          <span className="sr-only">Opens in a new tab</span>
        </div>
      </a>
    </section>
  );
}
