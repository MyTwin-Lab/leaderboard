import Image from "next/image";

// L'écran d'accueil de l'app MyTwin Athlete, en présentation produit : le
// téléphone monte du bas du cadre, qui le coupe net. Tout est calé sur la
// hauteur du cadre, quel que soit son format.
//
// Dans un aperçu, le téléphone est grand et le cadre le coupe à mi-hauteur,
// au sommet de la jauge : le logo, l'athlète et son jumeau, « Vigilance
// score ». En tête d'article, il rapetisse pour en montrer davantage, jusqu'à
// « Connect my watch » et « Complete my medical record ».
const STYLE = `
.nma-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(38% 60% at 50% 38%, rgb(79 179 191 / 0.22), transparent 70%),
    radial-gradient(30% 45% at 66% 30%, rgb(96 150 235 / 0.16), transparent 70%),
    linear-gradient(180deg, #f5f8fa, #e2eaf0);
}
.nma-ring {
  position: absolute;
  left: 50%;
  aspect-ratio: 1;
  border: 1px solid rgb(79 179 191 / 0.22);
  border-radius: 50%;
  transform: translateX(-50%);
}
.nma-phone {
  position: absolute;
  left: 50%;
  top: 9%;
  height: 200%;
  aspect-ratio: 1206 / 2622;
  filter: drop-shadow(0 1.2em 2em rgb(17 40 60 / 0.22));
  transform: translateX(-50%);
  transition: transform 700ms ease-out;
}
.group:hover .nma-phone { transform: translateX(-50%) translateY(-2%); }
.nma-stage[data-hero] .nma-phone { top: 6%; height: 112%; }
@media (prefers-reduced-motion: reduce) { .nma-phone { transition: none; } }
`;

export function MyTwinAthleteAppIllustration({ hero = false }: { hero?: boolean }) {
  return (
    <div className="nma-stage" data-hero={hero || undefined}>
      <style>{STYLE}</style>
      <span className="nma-ring" style={{ top: "-4%", height: "96%" }} />
      <span className="nma-ring" style={{ top: "-28%", height: "144%" }} />
      <div className="nma-phone">
        <Image src="/news/mytwin-athlete-app.webp" alt="" fill sizes="(min-width: 768px) 24rem, 60vw" />
      </div>
    </div>
  );
}
