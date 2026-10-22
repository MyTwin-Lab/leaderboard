import Link from "next/link";

import { ArrowRightIcon } from "@/components/marketplace/icons";
import { ModuleCard } from "@/components/marketplace/ModuleCard";
import { ModuleCatalog } from "@/components/marketplace/ModuleCatalog";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { MARKETPLACE_MODULES, moduleNumber } from "@/content/marketplace";
import { MARKETPLACE_PATH, PLATFORM_SDK_PATH } from "@/lib/paths";
import { unlistedMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/marketplace/marketplace-vitrine.css";

// Ouverte à son URL, hors des index et du sitemap, sans lien depuis la navbar,
// le footer ni l'accueil (docs/marketplace.md).
export const metadata = unlistedMetadata({
  title: "MyTwin Marketplace",
  description:
    "The catalog of reusable health technology modules from MyTwin and its partners, each documented with the same six-section specification.",
  path: MARKETPLACE_PATH,
});

const LAYERS = [
  {
    name: "Data Hub",
    text: "Centralized ingestion, normalization, semantic modeling and management of longitudinal patient health data.",
  },
  {
    name: "Engine",
    text: "Orchestration of scoring models, risk projections, simulations, contextual explanations and recommendations, with traceability and reproducibility.",
  },
  {
    name: "Experience Layer",
    text: "Patient and clinician applications, personalized care experiences and workflows.",
  },
];

/**
 * `/marketplace` — le catalogue des modules MyTwin, au style vitrine : même
 * en-tête que les listings, les trois couches de la plateforme pour lire les
 * cartes, la grille, puis le bandeau vers la vision du SDK.
 *
 * Un catalogue, pas une boutique : ni achat, ni compte, ni installation.
 */
export default function MarketplacePage() {
  const items = MARKETPLACE_MODULES.map((module) => ({
    slug: module.slug,
    kind: module.provider.kind,
    card: <ModuleCard module={module} number={moduleNumber(module)} />,
  }));

  return (
    <div className={`vitrine v-mk ${vitrineFontVars}`}>
      <div className="v-main">
        <header className="v-head">
          <div className="v-head-text">
            <BackToLab />
            <span className="v-eyebrow">
              <span className="v-eyebrow-dot" aria-hidden="true" />
              Module catalog
            </span>
            <h1 className="v-title">MyTwin Marketplace</h1>
            <p className="v-lede">
              Reusable health technology modules from MyTwin and its partners, for developers, clinics and partners
              building on the MyTwin Platform. Every module follows the same six-section specification, completed
              progressively.
            </p>
          </div>
        </header>

        <section className="v-mk-layers" aria-labelledby="marketplace-layers">
          <h2 id="marketplace-layers" className="v-mk-section-title">
            Built on the MyTwin Platform
          </h2>
          <dl className="v-mk-layers-grid">
            {LAYERS.map((layer) => (
              <div key={layer.name} className="v-mk-layer">
                <dt>{layer.name}</dt>
                <dd>{layer.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <ModuleCatalog items={items} />

        <aside className="v-strip" aria-label="MyTwin Platform SDK">
          <div className="v-strip-text">
            <p className="v-strip-title">MyTwin Platform SDK: integrate once, access the MyTwin ecosystem.</p>
            <p className="v-mk-strip-sub">Coming soon</p>
          </div>
          <Link href={PLATFORM_SDK_PATH} className="v-strip-cta">
            Discover the SDK
            <ArrowRightIcon />
          </Link>
        </aside>
      </div>
    </div>
  );
}
