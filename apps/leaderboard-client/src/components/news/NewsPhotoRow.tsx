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
 *
 * Les pastilles sont en couleurs fixes, claires sur l'image dans les deux
 * thèmes : `text-white` serait réécrit en mode clair.
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
            <div key={photo.src} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <Image
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes={`(min-width: 768px) ${Math.ceil(48 * share)}rem, ${Math.ceil(100 * share)}vw`}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-2 top-2 rounded-full bg-[#f1f0eb]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#0b7a64] backdrop-blur-sm sm:left-3 sm:top-3 sm:text-[11px]">
                {photo.label}
              </span>
            </div>
          );
        })}
      </div>
    </NewsFigure>
  );
}
