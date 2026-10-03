import Image from "next/image";

// L'écran d'accueil de l'app MyTwin Longevity, même mise en scène que celle
// de MyTwin Athlete : le téléphone monte du bas du cadre, qui le coupe net.
//
// Dans un aperçu, le cadre le coupe à mi-hauteur : le logo, la personne et
// son jumeau, « My biological age ». En tête d'article, il rapetisse jusqu'au
// parcours en quatre étapes. L'âge biologique y reste masqué, comme dans
// l'app tant que le bilan n'est pas fait : ce n'est pas une valeur de l'article.
const STYLE = `
.nml-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(38% 60% at 50% 38%, rgb(79 179 191 / 0.22), transparent 70%),
    radial-gradient(30% 45% at 66% 30%, rgb(96 150 235 / 0.16), transparent 70%),
    linear-gradient(180deg, #f5f8fa, #e2eaf0);
}
.nml-ring {
  position: absolute;
  left: 50%;
  aspect-ratio: 1;
  border: 1px solid rgb(79 179 191 / 0.22);
  border-radius: 50%;
  transform: translateX(-50%);
}
.nml-phone {
  position: absolute;
  left: 50%;
  top: 9%;
  height: 200%;
  aspect-ratio: 1206 / 2622;
  filter: drop-shadow(0 1.2em 2em rgb(17 40 60 / 0.22));
  transform: translateX(-50%);
  transition: transform 700ms ease-out;
}
.group:hover .nml-phone { transform: translateX(-50%) translateY(-2%); }
.nml-stage[data-hero] .nml-phone { top: 6%; height: 112%; }
@media (prefers-reduced-motion: reduce) { .nml-phone { transition: none; } }
`;

export function MyTwinLongevityAppIllustration({ hero = false }: { hero?: boolean }) {
  return (
    <div className="nml-stage" data-hero={hero || undefined}>
      <style>{STYLE}</style>
      <span className="nml-ring" style={{ top: "-4%", height: "96%" }} />
      <span className="nml-ring" style={{ top: "-28%", height: "144%" }} />
      <div className="nml-phone">
        <Image src="/news/mytwin-longevity-app.webp" alt="" fill sizes="(min-width: 768px) 24rem, 60vw" />
      </div>
    </div>
  );
}
