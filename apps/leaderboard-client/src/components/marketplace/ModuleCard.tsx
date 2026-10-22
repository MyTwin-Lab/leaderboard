import Image from "next/image";
import Link from "next/link";

import { pricingSummary } from "@/content/marketplace/format";
import { NOT_DOCUMENTED } from "@/content/marketplace/spec";
import type { MarketplaceModule } from "@/content/marketplace/types";
import { marketplaceModulePath } from "@/lib/paths";

import { ArrowRightIcon, ExternalIcon } from "./icons";

/**
 * La carte d'un module dans le catalogue `/marketplace`.
 *
 * Toute la carte mène à la fiche : le lien est sur le titre, et son `::after`
 * couvre la carte (`.v-mk-card-link`). Ce n'est pas la carte entière qui est
 * un `<a>`, parce qu'un second lien — la documentation, quand elle existe —
 * ne peut pas s'imbriquer dans le premier.
 *
 * Le visuel est décoratif : le titre dit déjà ce que montre la carte. La
 * carte ne garde que le fournisseur et le prix : le reste est dans la fiche.
 */
export function ModuleCard({ module, number }: { module: MarketplaceModule; number: string }) {
  const pricing = pricingSummary(module.specification.pricing.terms);

  return (
    <article className="v-mk-card">
      <div className="v-mk-shot">
        <Image
          src={module.image}
          alt=""
          fill
          sizes="(min-width: 1152px) 22rem, (min-width: 720px) 50vw, 100vw"
          className="v-mk-shot-img"
        />
        <span className="v-mk-card-num" aria-hidden="true">
          {number}
        </span>
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
          <div className="v-mk-fact">
            <dt>Provider</dt>
            <dd>
              <span className="v-mk-provider" data-kind={module.provider.kind}>
                {module.provider.name}
              </span>
            </dd>
          </div>
          <div className="v-mk-fact">
            <dt>Pricing</dt>
            <dd data-missing={pricing === undefined}>{pricing ?? NOT_DOCUMENTED}</dd>
          </div>
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
