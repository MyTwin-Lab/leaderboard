import Image from "next/image";
import { NewsFigure } from "./NewsFigure";

export type NewsPhoto = {
  /** La pastille posée sur l'image : ce qu'elle montre, en deux ou trois mots. */
  label: string;
  /** Dans `public/news/`. */
  src: string;
  width: number;
  height: number;
  /** Dans le corps d'une news, l'image est du contenu : un vrai `alt`. */
  alt: string;
};

const MAX_ROW_HEIGHT = "28rem";

/**
 * Des photos côte à côte dans le corps d'une news, sur une seule ligne et à
 * la même hauteur : chaque colonne prend une largeur proportionnelle au format
 * de son image, quels que soient les formats mêlés (paysage, portrait).
 * Une ligne ne dépasse pas `MAX_ROW_HEIGHT` : des images en portrait
 * resserrent la ligne, centrée, plutôt que de s'étirer sur tout l'écran.
 */
export function NewsPhotoRow({ photos, caption }: { photos: NewsPhoto[]; caption?: string }) {
  const ratios = photos.map((photo) => photo.width / photo.height);
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);

  return (
    <NewsFigure caption={caption}>
      <div
        className="mx-auto grid gap-3"
        style={{
          gridTemplateColumns: ratios.map((ratio) => `${ratio}fr`).join(" "),
          maxWidth: `calc(${total} * ${MAX_ROW_HEIGHT})`,
        }}
      >
        {photos.map((photo, index) => {
          const share = ratios[index] / total;
          return (
            <div key={photo.src} className="v-nd-photo">
              <Image
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes={`(min-width: 768px) ${Math.ceil(48 * share)}rem, ${Math.ceil(100 * share)}vw`}
              />
              <span className="v-nd-photo-label">{photo.label}</span>
            </div>
          );
        })}
      </div>
    </NewsFigure>
  );
}
