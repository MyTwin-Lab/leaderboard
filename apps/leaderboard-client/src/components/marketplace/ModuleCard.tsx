import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { isComingSoon, pricingSummary } from "@/content/marketplace/format";
import { NOT_DOCUMENTED } from "@/content/marketplace/spec";
import type { MarketplaceModule } from "@/content/marketplace/types";
import { marketplaceModulePath } from "@/lib/paths";

import { ArrowRightIcon, ExternalIcon } from "./icons";

/**
 * La carte d'un module dans le catalogue `/marketplace`.
 *
 * Toute la carte mène à la fiche : le lien est sur le titre, et son `::after`
 * couvre la carte (`.v-mk-card-link`). Ce n'est pas la carte entière qui est
 * un `<a>`, parce que d'autres liens — une publication, la documentation —
 * ne peuvent pas s'imbriquer dans le premier.
 *
 * Le visuel est décoratif : le titre dit déjà ce que montre la carte. Un
 * module pas encore disponible porte « Coming soon » et une carte grisée.
 */
export function ModuleCard({ module }: { module: MarketplaceModule }) {
  const { evidence } = module;
  const papers = evidence.researchPapers ?? [];
  const pricing = pricingSummary(module.specification.pricing.terms);
  const soon = isComingSoon(module);

  return (
    <article className="v-mk-card" data-soon={soon}>
      <div className="v-mk-shot">
        <Image
          src={module.image}
          alt=""
          fill
          sizes="(min-width: 1152px) 22rem, (min-width: 768px) 33vw, 50vw"
          className="v-mk-shot-img"
        />
        {soon && <span className="v-mk-soon">Coming soon</span>}
      </div>

      <div className="v-mk-card-body">
        <div className="v-mk-card-text">
          <h3 className="v-mk-card-title">
            <Link href={marketplaceModulePath(module.slug)} className="v-mk-card-link">
              {module.name}
            </Link>
          </h3>
          <p className="v-mk-card-desc">{module.shortDescription}</p>
        </div>

        <dl className="v-mk-facts">
          <Fact label="Provider">
            <span className="v-mk-provider" data-kind={module.provider.kind}>
              {module.provider.name}
            </span>
          </Fact>
          <Fact label="Accuracy" value={evidence.accuracy} />
          <Fact label="Research paper">
            {papers.length > 0 ? <ResearchPapers module={module} /> : undefined}
          </Fact>
          <Fact label="Validation level" value={evidence.validationLevel} />
          <Fact label="Pricing" value={pricing} />
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
      </div>
    </article>
  );
}

/** Une ligne de la carte : `value` absente se lit « Not documented ». */
function Fact({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  const content = children ?? value;
  return (
    <div className="v-mk-fact">
      <dt>{label}</dt>
      <dd data-missing={content === undefined}>{content ?? NOT_DOCUMENTED}</dd>
    </div>
  );
}

/**
 * Une publication s'ouvre directement ; plusieurs renvoient à la fiche, qui
 * les liste dans Compliance & Trust.
 */
function ResearchPapers({ module }: { module: MarketplaceModule }) {
  const papers = module.evidence.researchPapers ?? [];

  if (papers.length === 1) {
    return (
      <a href={papers[0].url} className="v-mk-fact-link" target="_blank" rel="noopener noreferrer">
        View paper
        <ExternalIcon />
      </a>
    );
  }

  return (
    <Link href={`${marketplaceModulePath(module.slug)}#compliance-and-trust`} className="v-mk-fact-link">
      {papers.length} papers
    </Link>
  );
}
