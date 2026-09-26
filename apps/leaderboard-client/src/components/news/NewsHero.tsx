import type { NewsIllustration } from "@/content/news/types";
import { NewsIllustrationFrame } from "./NewsIllustrationFrame";
import { videoLanguageNote } from "@/content/news/video";
import { NewsVideoPlayer } from "./NewsVideoPlayer";

const HERO_SIZES = "(min-width: 1136px) 68rem, 100vw";

/**
 * L'image de tête d'une news : la bande large de la maquette (21/8 sur écran,
 * 4/3 sur téléphone), sur le noir de nuit.
 *
 * C'est l'illustration que la news porte déjà dans ses aperçus, pas une image
 * de plus : une radiographie y paraît en entier, cernée d'un filet, une photo
 * remplit la bande. Ici elle est du contenu et non un décor — elle reçoit donc
 * le `alt` de l'article, là où la même image est décorative dans une carte.
 *
 * Une vidéo devient ici le lecteur lui-même, en 16:9 à toutes les tailles :
 * la même image, et un clic la lance, sous-titres compris. La légende dit la
 * langue parlée et celle des sous-titres.
 */
export function NewsHero({ illustration }: { illustration: NewsIllustration }) {
  if (illustration.kind === "video") {
    const caption = [illustration.caption, videoLanguageNote(illustration.video)].filter(Boolean).join(" ");
    return (
      <figure className="v-nd-hero-fig">
        <div className="v-nd-hero" data-kind="video">
          <NewsVideoPlayer
            video={illustration.video}
            poster={illustration.src}
            posterPosition={illustration.position}
            sizes={HERO_SIZES}
            priority
          />
        </div>
        {caption && <figcaption className="v-nd-caption">{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure className="v-nd-hero">
      <NewsIllustrationFrame
        illustration={illustration}
        alt={illustration.kind === "image" ? illustration.alt : undefined}
        sizes={HERO_SIZES}
        hero
        className="v-nd-hero-frame bg-[#11161a]"
      />
    </figure>
  );
}
