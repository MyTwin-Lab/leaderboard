import Link from "next/link";

import { AVAILABILITY_LABELS, integrationSummary, pricingSummary } from "@/content/marketplace/format";
import { NOT_DOCUMENTED } from "@/content/marketplace/spec";
import type { MarketplaceModule } from "@/content/marketplace/types";
import { marketplaceModulePath } from "@/lib/paths";

import { ArrowRightIcon, ExternalIcon, ModuleIcon } from "./icons";

/**
 * La carte d'un module dans le catalogue `/marketplace`.
 *
 * Toute la carte mène à la fiche : le lien est sur le titre, et son `::after`
 * couvre la carte (`.v-mk-card-link`). Ce n'est pas la carte entière qui est
 * un `<a>`, parce qu'un second lien — la documentation, quand elle existe —
 * ne peut pas s'imbriquer dans le premier.
 */
export function ModuleCard({ module, number }: { module: MarketplaceModule; number: string }) {
  const facts = [
    {
      label: "Availability",
      value: module.availability.stage === "not-documented" ? undefined : AVAILABILITY_LABELS[module.availability.stage],
    },
    { label: "Pricing", value: pricingSummary(module.specification.pricing.terms) },
    { label: "Integration", value: integrationSummary(module) },
  ];

  return (
    <article className="v-mk-card">
      <div className="v-mk-card-top">
        <span className="v-mk-icon">
          <ModuleIcon name={module.icon} />
        </span>
        <span className="v-mk-card-num" aria-hidden="true">
          {number}
        </span>
      </div>

      <div className="v-mk-card-text">
        <span className="v-mk-kicker">{module.moduleType}</span>
        <h3 className="v-mk-card-title">
          <Link href={marketplaceModulePath(module.slug)} className="v-mk-card-link">
            {module.name}
          </Link>
        </h3>
        <p className="v-mk-card-desc">{module.shortDescription}</p>
      </div>

      <dl className="v-mk-facts">
        <div className="v-mk-fact">
          <dt>Provider</dt>
          <dd>
            <span className="v-mk-provider" data-kind={module.provider.kind}>
              {module.provider.name}
            </span>
          </dd>
        </div>
        {facts.map((fact) => (
          <div key={fact.label} className="v-mk-fact">
            <dt>{fact.label}</dt>
            <dd data-missing={fact.value === undefined}>{fact.value ?? NOT_DOCUMENTED}</dd>
          </div>
        ))}
      </dl>

      <div className="v-mk-card-foot">
        <span className="v-mk-card-go" aria-hidden="true">
          View specification
          <ArrowRightIcon />
        </span>
        {module.documentationUrl && (
          <a href={module.documentationUrl} className="v-mk-card-doc" target="_blank" rel="noopener noreferrer">
            Documentation
            <ExternalIcon />
          </a>
        )}
      </div>
    </article>
  );
}
