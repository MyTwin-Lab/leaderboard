import { ModuleCatalog } from "@/components/marketplace/ModuleCatalog";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { MARKETPLACE_MODULES } from "@/content/marketplace";
import { MARKETPLACE_PATH } from "@/lib/paths";
import { unlistedMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/marketplace/marketplace-vitrine.css";

// Ouverte à son URL, hors des index et du sitemap, sans lien depuis la navbar,
// le footer ni l'accueil (docs/marketplace.md).
export const metadata = unlistedMetadata({
  title: "MyTwin Marketplace",
  description: "The catalog of reusable health technology modules from MyTwin and its partners.",
  path: MARKETPLACE_PATH,
});

/**
 * `/marketplace` — le catalogue des modules MyTwin, au style vitrine : même
 * en-tête que les listings, puis la grille des modules.
 *
 * Un catalogue, pas une boutique : ni achat, ni compte, ni installation.
 */
export default function MarketplacePage() {
  return (
    <div className={`vitrine v-mk ${vitrineFontVars}`}>
      <div className="v-main">
        <header className="v-head">
          <div className="v-head-text">
            <BackToLab />
            <h1 className="v-title">MyTwin Marketplace</h1>
            <p className="v-lede">
              Reusable health technology modules from MyTwin and its partners, for developers, clinics and partners
              building on the MyTwin Platform.
            </p>
          </div>
        </header>

        <ModuleCatalog modules={MARKETPLACE_MODULES} />
      </div>
    </div>
  );
}
