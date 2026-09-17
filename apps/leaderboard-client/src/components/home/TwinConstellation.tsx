import type { CSSProperties } from "react";
import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";
// Imports statiques → noms de fichiers hashés : remplacer le fichier sous le
// même nom invalide le cache.
import twinImage from "../../../public/home/twin/digital-twin-light.webp";
import appIcon1 from "../../../public/home/app-icons/app-icon-1.webp";
import appIcon2 from "../../../public/home/app-icons/app-icon-2.webp";
import appIcon3 from "../../../public/home/app-icons/app-icon-3.webp";
import appIcon4 from "../../../public/home/app-icons/app-icon-4.webp";
import appIcon5 from "../../../public/home/app-icons/app-icon-5.webp";
import appIcon6 from "../../../public/home/app-icons/app-icon-6.webp";
import appIcon7 from "../../../public/home/app-icons/app-icon-7.webp";
import appIcon8 from "../../../public/home/app-icons/app-icon-8.webp";
import appIcon9 from "../../../public/home/app-icons/app-icon-9.webp";
import appIcon10 from "../../../public/home/app-icons/app-icon-10.webp";

/**
 * Le Twin entouré de ses applications — la même illustration que le hero de
 * mytwin.care/clinicians (`twin-constellation.tsx` du repo
 * mytwin-health-landing), mêmes images, mêmes positions, mêmes inclinaisons.
 * Seule change l'échelle : là-bas un hero plein écran, ici une section de
 * l'accueil, d'où des hauteurs en rem au lieu de vh.
 *
 * Volontairement statique, aucune animation. Les images sont celles du thème
 * clair : la direction artistique du Lab est figée sur ce thème.
 */
type FloatingApp = {
  src: StaticImageData;
  top: number; // % dans la boîte visuelle, ancré au centre
  left: number;
  size: number; // rem
  opacity: number;
  z: number; // px — translateZ : + vers le spectateur, - en retrait
  layer: number; // ordre de peinture entre icônes
  shadow?: boolean;
  behind?: boolean; // passe derrière la figure du Twin
};

// Point de fuite vers lequel les icônes s'orientent — là où se tient le Twin.
const CENTER = { x: 45, y: 50 };
// Degrés d'inclinaison par % d'écart à CENTER, plafonnés : presque chaque icône
// s'incline nettement sur au moins un axe, sans que celles du bord pivotent trop.
const TILT_PER_PCT = 0.7;
const MAX_TILT = 16;

const FLOATING_APPS: FloatingApp[] = [
  // plan avant — les plus grandes, ombrées, poussées vers le spectateur
  { src: appIcon1, top: 30, left: 84, size: 6.5, opacity: 1, z: 55, layer: 30, shadow: true },
  { src: appIcon7, top: 64, left: 15, size: 6, opacity: 1, z: 50, layer: 30, shadow: true },
  { src: appIcon3, top: 87, left: 55, size: 5.2, opacity: 1, z: 40, layer: 29, shadow: true },
  // plan médian
  { src: appIcon2, top: 9, left: 63, size: 4.2, opacity: 0.95, z: 0, layer: 20, shadow: true },
  { src: appIcon8, top: 73, left: 82, size: 3.8, opacity: 0.92, z: -10, layer: 19 },
  { src: appIcon4, top: 43, left: 4, size: 4, opacity: 0.92, z: 0, layer: 20 },
  { src: appIcon10, top: 19, left: 17, size: 3.7, opacity: 0.88, z: -20, layer: 18 },
  // plan arrière — les plus petites, les plus pâles, tirées derrière les autres
  { src: appIcon5, top: 4, left: 88, size: 3, opacity: 0.72, z: -75, layer: 10 },
  { src: appIcon6, top: 53, left: 71, size: 2.9, opacity: 0.72, z: -80, layer: 9, behind: true },
  { src: appIcon9, top: 91, left: 23, size: 2.7, opacity: 0.68, z: -70, layer: 10 },
];

// Sous `lg`, la boîte prend toute la largeur de l'écran : les positions en %
// s'écartent bien plus autour d'un Twin mince que dans la demi-colonne du
// desktop. Mettre le conteneur à l'échelle resserre la grappe en une seule
// transformation, même disposition.
const MOBILE_CLUSTER_SCALE = 0.78;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

// Une icône à droite du Twin tourne sa face vers la gauche (et inversement) ;
// une icône au-dessus penche sa face vers le bas (et inversement). Axes CSS
// (X vers la droite, Y vers le bas) : rotateY(+) regarde à droite, rotateX(+)
// regarde en haut — d'où les signes asymétriques.
function tiltTransform(app: FloatingApp): string {
  const rotY = clamp((CENTER.x - app.left) * TILT_PER_PCT, -MAX_TILT, MAX_TILT);
  const rotX = clamp((app.top - CENTER.y) * TILT_PER_PCT, -MAX_TILT, MAX_TILT);
  return `translate(-50%, -50%) translateZ(${app.z}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
}

// Rendue deux fois — devant et derrière la figure — avec la même perspective
// et la même échelle, pour que les deux moitiés partagent une seule géométrie.
function AppCluster({ apps, className }: { apps: FloatingApp[]; className: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 origin-center [perspective:1000px] [perspective-origin:46%_48%] [transform:scale(var(--cluster-scale))] lg:[transform:scale(1)]",
        className,
      )}
      style={{ "--cluster-scale": MOBILE_CLUSTER_SCALE } as CSSProperties}
    >
      {apps.map((app, i) => (
        <div
          key={i}
          className="pointer-events-none absolute"
          style={{
            top: `${app.top}%`,
            left: `${app.left}%`,
            width: `${app.size}rem`,
            opacity: app.opacity,
            transform: tiltTransform(app),
            filter: app.shadow ? "drop-shadow(0 14px 26px rgb(10 31 51 / 0.16))" : undefined,
            zIndex: app.layer,
          }}
        >
          <Image src={app.src} alt="" sizes="120px" className="h-auto w-full select-none" />
        </div>
      ))}
    </div>
  );
}

export function TwinConstellation({ twinAlt }: { twinAlt: string }) {
  return (
    <div className="relative h-[30rem] sm:h-[34rem] lg:h-[36rem]">
      <AppCluster apps={FLOATING_APPS.filter((a) => a.behind)} className="z-0" />

      {/* Le PNG est détouré sur fond transparent, avec une marge et un reflet
          en bas : un peu plus haut que sa boîte, il déborde sur le vide et non
          sur la figure. */}
      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
        <div className="relative lg:-translate-x-[2%] lg:translate-y-[4%]">
          <Image
            src={twinImage}
            alt={twinAlt}
            sizes="(min-width: 1024px) 24rem, 60vw"
            className="h-[31rem] w-auto max-w-none select-none sm:h-[36rem] lg:h-[39rem]"
          />
        </div>
      </div>

      <AppCluster apps={FLOATING_APPS.filter((a) => !a.behind)} className="z-10" />
    </div>
  );
}
