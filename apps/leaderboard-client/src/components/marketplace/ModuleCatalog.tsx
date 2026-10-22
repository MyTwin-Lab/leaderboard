import Image from "next/image";

import type { MarketplaceModule } from "@/content/marketplace/types";

import { ModuleCard } from "./ModuleCard";

/**
 * La mosaïque de la case « Others » de la plaquette : quatre visuels à la
 * fois, pour qu'aucun ne passe pour un module précis.
 */
const MORE_IMAGES = [
  "/marketplace/more/surgical-modeling.webp",
  "/marketplace/more/medication-guidance.webp",
  "/marketplace/more/care-coordinator.webp",
  "/marketplace/more/second-opinion.webp",
];

/** La grille du catalogue : les modules dans l'ordre du registre, puis l'annonce des suivants. */
export function ModuleCatalog({ modules }: { modules: { module: MarketplaceModule; number: string }[] }) {
  return (
    <section className="v-mk-catalog" aria-labelledby="marketplace-catalog">
      <h2 id="marketplace-catalog" className="v-mk-section-title">
        Choose your modules
      </h2>

      <div className="v-mk-grid">
        {modules.map(({ module, number }) => (
          <div key={module.slug} className="v-mk-grid-item">
            <ModuleCard module={module} number={number} />
          </div>
        ))}

        {/* « Others » dans la plaquette : pas un module, l'annonce des suivants. */}
        <div className="v-mk-more">
          <div className="v-mk-more-shots">
            {MORE_IMAGES.map((src) => (
              <div key={src} className="v-mk-more-shot">
                <Image src={src} alt="" fill sizes="(min-width: 1152px) 11rem, (min-width: 720px) 25vw, 50vw" />
              </div>
            ))}
          </div>
          <div className="v-mk-more-body">
            <p className="v-mk-more-title">More modules coming</p>
            <p className="v-mk-more-text">The catalog grows as new MyTwin and partner modules are documented.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
