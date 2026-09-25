import type { NewsIllustration } from "@/content/news/types";
import { NewsIllustrationFrame } from "./NewsIllustrationFrame";

/**
 * L'image de tête d'une news : la bande large de la maquette (21/8 sur écran,
 * 4/3 sur téléphone), sur le noir de nuit.
 *
 * C'est l'illustration que la news porte déjà dans ses aperçus, pas une image
 * de plus : une radiographie y paraît en entier, cernée d'un filet, une photo
 * remplit la bande. Ici elle est du contenu et non un décor — elle reçoit donc
 * le `alt` de l'article, là où la même image est décorative dans une carte.
 */
export function NewsHero({ illustration }: { illustration: NewsIllustration }) {
  return (
    <figure className="v-nd-hero">
      <NewsIllustrationFrame
        illustration={illustration}
        alt={illustration.kind === "image" ? illustration.alt : undefined}
        sizes="(min-width: 1136px) 68rem, 100vw"
        className="v-nd-hero-frame bg-[#11161a]"
      />
    </figure>
  );
}
