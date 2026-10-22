import { Plus } from "lucide-react";

import type { MarketplaceModule } from "@/content/marketplace/types";

import { ModuleCard } from "./ModuleCard";

function CalculatorIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="1.75" width="10" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.75 4.75h4.5M5.75 8h.01M8 8h.01M10.25 8h.01M5.75 10.75h.01M8 10.75h.01M10.25 10.75h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** La grille du catalogue : les modules dans l'ordre du registre, puis l'annonce des suivants. */
export function ModuleCatalog({ modules }: { modules: { module: MarketplaceModule; number: string }[] }) {
  return (
    <section className="v-mk-catalog" aria-labelledby="marketplace-catalog">
      <div className="v-mk-catalog-head">
        <h2 id="marketplace-catalog" className="v-mk-section-title">
          Choose your modules
        </h2>
        {/* L'estimateur multi-modules n'existe pas encore : le bouton est posé,
            il sera branché sur `PricingTerms` (docs/marketplace.md). */}
        <button type="button" className="v-mk-calc">
          <CalculatorIcon />
          Modules Pricing Calculator
        </button>
      </div>

      <div className="v-mk-grid">
        {modules.map(({ module, number }) => (
          <div key={module.slug} className="v-mk-grid-item">
            <ModuleCard module={module} number={number} />
          </div>
        ))}

        {/* « Others » dans la plaquette : pas un module, l'annonce des suivants. */}
        <div className="v-mk-more">
          <span className="v-mk-more-icon">
            <Plus strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="v-mk-more-title">More modules coming</p>
          <p className="v-mk-more-text">The catalog grows as new MyTwin and partner modules are documented.</p>
        </div>
      </div>
    </section>
  );
}
