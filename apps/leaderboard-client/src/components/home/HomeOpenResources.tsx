import Image from "next/image";

import { HomeArrow, HomeSectionHead } from "./HomeSection";
import { HomeResourceCard } from "./HomeResourceCard";

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
 * Où mène la carte dépend du module watch (`HomeResourceCard`) : actif, elle
 * ouvre l'explorateur de publications de la plateforme (`/watch`) ; sinon, le
 * script de veille hébergé ailleurs. L'image est décorative (`alt=""`), sans
 * quoi son texte s'ajouterait au nom du lien — toute la carte est le lien,
 * pas le seul libellé souligné.
 */
export function HomeOpenResources() {
  return (
    <section aria-labelledby="resources-title" className="v-home-section">
      <HomeSectionHead
        id="resources-title"
        eyebrow="Open resources"
        tagline="Tools and resources to help the community work on health challenges."
      />

      <HomeResourceCard fallbackHref="https://github.com/alaur/PubMed-OpenAlex">
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
          <p>Search the health literature: topics, period, open access and journal impact.</p>
          <span className="v-home-read">
            View resource
            <HomeArrow />
          </span>
        </div>
      </HomeResourceCard>
    </section>
  );
}
