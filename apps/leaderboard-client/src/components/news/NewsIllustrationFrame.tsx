import Image from "next/image";
import { Play } from "lucide-react";
import type { NewsIllustration } from "@/content/news/types";
import { cn } from "@/lib/utils";

/**
 * Le cadre de l'illustration d'une news dans un aperçu. Le cadre fixe le
 * format, l'illustration le remplit : une image est recadrée (ou montrée en
 * entier sur fond noir, avec `fit: "contain"`), un visuel se centre sur un
 * panneau clair, quel que soit le thème du Lab.
 *
 * Une vidéo s'y montre par son image, un petit bouton lecture dans l'angle
 * bas droit : il signale la vidéo, le clic va à l'article, qui la pose en tête
 * (`NewsHero`). Le bouton suit la largeur du cadre (`cqw`), de la vignette de
 * l'accueil à la une de `/news`.
 *
 * Décoratif par défaut : dans un aperçu, le titre dit déjà ce que montre
 * l'image. En tête d'article elle est du contenu, et `alt` la décrit.
 */
export function NewsIllustrationFrame({
  illustration,
  sizes,
  alt,
  hero = false,
  className,
}: {
  illustration: NewsIllustration;
  /** `sizes` de l'image : la largeur du cadre dans la grille qui l'accueille. */
  sizes: string;
  /** Le texte de remplacement, quand l'image porte le contenu et non l'aperçu. */
  alt?: string;
  /** En tête d'article : un visuel peut y montrer davantage qu'en aperçu. */
  hero?: boolean;
  className?: string;
}) {
  const decorative = alt === undefined;

  if (illustration.kind === "image") {
    if (illustration.fit === "contain") {
      // L'image entière, en retrait sur le fond noir, cernée d'un filet discret.
      return (
        <div
          aria-hidden={decorative || undefined}
          className={cn("relative flex items-center justify-center overflow-hidden bg-black", className)}
        >
          <div
            className="relative h-[84%] max-w-[90%] overflow-hidden rounded-[3px] border border-[rgb(255_255_255/0.16)] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            style={{ aspectRatio: illustration.ratio ?? 1 }}
          >
            <Image src={illustration.src} alt={alt ?? ""} fill sizes={sizes} className="object-cover" />
          </div>
        </div>
      );
    }

    return (
      <div aria-hidden={decorative || undefined} className={cn("relative overflow-hidden", className)}>
        <Image
          src={illustration.src}
          alt={alt ?? ""}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          style={{ objectPosition: illustration.position }}
        />
      </div>
    );
  }

  if (illustration.kind === "video") {
    return (
      <div aria-hidden={decorative || undefined} className={cn("@container relative overflow-hidden", className)}>
        <Image
          src={illustration.src}
          alt={alt ?? ""}
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          style={{ objectPosition: illustration.position }}
        />
        <span className="absolute bottom-[clamp(0.375rem,4cqw,0.875rem)] right-[clamp(0.375rem,4cqw,0.875rem)] flex size-[clamp(1.5rem,11cqw,2.75rem)] items-center justify-center rounded-full bg-[rgb(255_255_255/0.92)] text-[#11161a] shadow-[0_2px_12px_rgb(17_22_26/0.25)] backdrop-blur-sm transition-transform duration-300 ease-out group-hover:scale-110">
          <Play className="size-[42%] translate-x-[6%] fill-current" strokeWidth={0} />
        </span>
      </div>
    );
  }

  const { Visual } = illustration;
  // Le visuel est dessiné en `em` : la police du cadre suit sa largeur (`cqw`),
  // et tout le dessin avec elle. Le panneau clair est peint sur le calque
  // intérieur : le fond sombre que les aperçus donnent au cadre pour leurs
  // photos (`.v-news-shot`, `.v-nd-card-shot`), hors couche Tailwind, ne peut
  // pas le recouvrir.
  return (
    <div
      aria-hidden
      className={cn("@container relative flex items-center justify-center overflow-hidden", className)}
    >
      <div className="flex size-full items-center justify-center bg-[radial-gradient(60%_55%_at_70%_30%,rgb(11_122_100/0.08),transparent_70%),linear-gradient(180deg,#f1f0eb,#e9e7e0)] text-[#11161a] text-[length:clamp(9px,3.6cqw,16px)]">
        <Visual hero={hero} />
      </div>
    </div>
  );
}
