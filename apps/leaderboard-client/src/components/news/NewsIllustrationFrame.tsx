import Image from "next/image";
import type { NewsIllustration } from "@/content/news/types";
import { cn } from "@/lib/utils";

/**
 * Le cadre de l'illustration d'une news dans un aperçu. Le cadre fixe le
 * format, l'illustration le remplit : une image est recadrée, un visuel se
 * centre sur le panneau clair de la landing, quel que soit le thème du Lab.
 *
 * Toujours décoratif : le titre de l'aperçu dit déjà ce que montre l'image.
 */
export function NewsIllustrationFrame({
  illustration,
  sizes,
  className,
}: {
  illustration: NewsIllustration;
  /** `sizes` de l'image : la largeur du cadre dans la grille qui l'accueille. */
  sizes: string;
  className?: string;
}) {
  if (illustration.kind === "image") {
    return (
      <div aria-hidden className={cn("relative overflow-hidden", className)}>
        <Image
          src={illustration.src}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          style={{ objectPosition: illustration.position }}
        />
      </div>
    );
  }

  const { Visual } = illustration;
  // Le visuel est dessiné en `em` : la police du cadre suit sa largeur (`cqw`),
  // et tout le dessin avec elle.
  return (
    <div
      aria-hidden
      className={cn(
        "@container relative flex items-center justify-center overflow-hidden bg-[radial-gradient(60%_55%_at_70%_30%,rgb(11_122_100/0.08),transparent_70%),linear-gradient(180deg,#f1f0eb,#e9e7e0)] text-[#11161a]",
        className,
      )}
    >
      <div className="flex size-full items-center justify-center text-[length:clamp(9px,3.6cqw,16px)]">
        <Visual />
      </div>
    </div>
  );
}
