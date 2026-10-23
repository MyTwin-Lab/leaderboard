import Image from "next/image";
import Link from "next/link";

import {
  AVAILABILITY_LABELS,
  MATURITY_LABELS,
  evidenceEntries,
  isEntryDocumented,
  isSectionDocumented,
  isSpecificationEmpty,
  sectionEntries,
} from "@/content/marketplace/format";
import { NOT_DOCUMENTED, SPEC_SECTIONS } from "@/content/marketplace/spec";
import type { MarketplaceModule, SpecEntry, SpecSectionKey } from "@/content/marketplace/types";
import { MARKETPLACE_PATH, marketplaceModulePath } from "@/lib/paths";

import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";

import { ExternalIcon } from "./icons";

import "@/components/vitrine/vitrine.css";
import "./marketplace-vitrine.css";

/** L'ancre d'une section dans l'URL : `#compliance-and-trust`, pas `#complianceAndTrust`. */
function sectionAnchor(key: SpecSectionKey): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const PROVIDER_KIND_LABELS: Record<MarketplaceModule["provider"]["kind"], string> = {
  mytwin: "MyTwin technology",
  partner: "Partner technology",
};

/**
 * La fiche d'un module — `/marketplace/<slug>` — au gabarit « MyTwin Module
 * Specification V1 » : les six sections, mêmes titres et même ordre pour
 * tous les modules, remplies par le seul registre.
 *
 * Une ligne sans contenu se lit « Not documented ». Une section dont rien
 * n'est encore documenté se replie sur une seule mention, avec la liste de ce
 * qu'elle couvrira : une fiche encore vide reste lisible, sans six tableaux
 * de « Not documented ».
 */
export function ModuleSpecificationView({
  module,
  number,
  previous,
  next,
}: {
  module: MarketplaceModule;
  number: string;
  previous?: MarketplaceModule;
  next?: MarketplaceModule;
}) {
  const empty = isSpecificationEmpty(module);
  const headFacts = [
    { label: "Provider", value: module.provider.name },
    { label: "Type", value: module.moduleType },
    { label: "Platform layer", value: module.platformLayer },
    {
      label: "Availability",
      value: module.availability.stage === "not-documented" ? undefined : AVAILABILITY_LABELS[module.availability.stage],
    },
  ];

  return (
    <div className={`vitrine v-mk ${vitrineFontVars}`}>
      <div className="v-main">
        <header className="v-mkd-head">
          <BackToLab href={MARKETPLACE_PATH} label="Back to the Marketplace" />

          <div className="v-mkd-hero">
            <div className="v-mkd-hero-text">
              <span className="v-mk-kicker">
                Module {number} · {PROVIDER_KIND_LABELS[module.provider.kind]}
              </span>
              <h1 className="v-title">{module.name}</h1>
              <p className="v-lede">{module.shortDescription}</p>
            </div>
            <div className="v-mkd-figure">
              <Image
                src={module.image}
                alt=""
                fill
                priority
                sizes="(min-width: 900px) 20rem, 100vw"
                className="v-mk-shot-img"
              />
            </div>
          </div>

          <dl className="v-mkd-facts">
            {headFacts.map((fact) => (
              <div key={fact.label} className="v-mkd-fact">
                <dt>{fact.label}</dt>
                <dd data-missing={fact.value === undefined}>{fact.value ?? NOT_DOCUMENTED}</dd>
              </div>
            ))}
          </dl>

          {(module.documentationUrl || module.externalProviderUrl) && (
            <div className="v-mkd-actions">
              {module.documentationUrl && (
                <a href={module.documentationUrl} className="v-mkd-action" data-primary="true" target="_blank" rel="noopener noreferrer">
                  Documentation
                  <ExternalIcon />
                </a>
              )}
              {module.externalProviderUrl && (
                <a href={module.externalProviderUrl} className="v-mkd-action" target="_blank" rel="noopener noreferrer">
                  {module.provider.name}
                  <ExternalIcon />
                </a>
              )}
            </div>
          )}

          {empty && (
            <p className="v-mkd-pending-note">
              This specification is being documented. Its six sections will be completed progressively.
            </p>
          )}
        </header>

        <div className="v-mkd-layout">
          <nav className="v-mkd-toc" aria-label="Specification sections">
            <p className="v-mkd-toc-title">Specification</p>
            <ol>
              {SPEC_SECTIONS.map((section) => (
                <li key={section.key}>
                  <a href={`#${sectionAnchor(section.key)}`}>
                    <span className="v-mkd-num">{section.number}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="v-mkd-sections">
            {SPEC_SECTIONS.map((section) => (
              <SpecSectionView key={section.key} module={module} sectionKey={section.key} />
            ))}

            {module.lastUpdated && (
              <p className="v-mkd-updated">
                Specification updated on{" "}
                <time dateTime={module.lastUpdated}>
                  {new Date(module.lastUpdated).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </p>
            )}
          </div>
        </div>

        <nav className="v-mkd-pager" aria-label="Other modules">
          {previous ? (
            <Link href={marketplaceModulePath(previous.slug)} className="v-mkd-pager-link" data-dir="previous">
              <span className="v-mkd-pager-dir">Previous module</span>
              <span className="v-mkd-pager-name">{previous.name}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={marketplaceModulePath(next.slug)} className="v-mkd-pager-link" data-dir="next">
              <span className="v-mkd-pager-dir">Next module</span>
              <span className="v-mkd-pager-name">{next.name}</span>
            </Link>
          ) : (
            <Link href={MARKETPLACE_PATH} className="v-mkd-pager-link" data-dir="next">
              <span className="v-mkd-pager-dir">All modules</span>
              <span className="v-mkd-pager-name">MyTwin Marketplace</span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}

/**
 * Ce qu'une section montre du module lui-même, connu même sans fiche :
 * l'identité dans l'aperçu, les preuves (celles que résume la carte) dans
 * Compliance & Trust.
 */
function identityEntries(module: MarketplaceModule, key: SpecSectionKey): SpecEntry[] {
  if (key === "complianceAndTrust") return evidenceEntries(module.evidence);
  if (key !== "overview") return [];

  return [
    {
      label: "Provider",
      text: module.provider.kind === "partner" ? `${module.provider.name}, technology partner` : module.provider.name,
    },
    { label: "Platform layer", text: module.platformLayer },
    {
      label: "Availability",
      // Le libellé court est déjà dans l'en-tête ; ici, la nuance de la fiche.
      text:
        module.availability.stage === "not-documented"
          ? undefined
          : (module.availability.detail ?? AVAILABILITY_LABELS[module.availability.stage]),
    },
  ];
}

function SpecSectionView({ module, sectionKey }: { module: MarketplaceModule; sectionKey: SpecSectionKey }) {
  const spec = module.specification;
  const meta = SPEC_SECTIONS.find((candidate) => candidate.key === sectionKey)!;
  const section = spec[sectionKey];
  const anchor = sectionAnchor(sectionKey);

  const identity = identityEntries(module, sectionKey);
  // Les preuves ouvrent Compliance & Trust ; l'identité ferme l'aperçu.
  const entries =
    sectionKey === "complianceAndTrust"
      ? [...identity, ...sectionEntries(spec, sectionKey)]
      : [...sectionEntries(spec, sectionKey), ...identity];
  const documented =
    sectionKey === "overview" || isSectionDocumented(spec, sectionKey) || identity.some(isEntryDocumented);
  const references = sectionKey === "complianceAndTrust" ? spec.complianceAndTrust.references : undefined;

  return (
    <section id={anchor} className="v-mkd-section" aria-labelledby={`${anchor}-title`}>
      <header className="v-mkd-section-head">
        <span className="v-mkd-num">{meta.number}</span>
        <h2 id={`${anchor}-title`} className="v-mkd-section-title">
          {meta.title}
        </h2>
      </header>

      {documented ? (
        <>
          {section.intro?.map((paragraph) => (
            <p key={paragraph} className="v-mkd-intro">
              {paragraph}
            </p>
          ))}

          <dl className="v-mkd-rows">
            {entries.map((entry) => (
              <SpecRow key={entry.label} entry={entry} />
            ))}
          </dl>

          {section.notes?.map((note) => (
            <p key={note} className="v-mkd-note">
              {note}
            </p>
          ))}

          {references && references.length > 0 && (
            <div className="v-mkd-refs">
              <p className="v-mkd-refs-title">References</p>
              <ul>
                {references.map((reference) => (
                  <li key={reference.url}>
                    <a href={reference.url} target="_blank" rel="noopener noreferrer">
                      {reference.label}
                      <ExternalIcon />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="v-mkd-empty">
          <p className="v-mkd-empty-title">{NOT_DOCUMENTED}</p>
          <p className="v-mkd-empty-text">
            Will cover: {entries.map((entry) => entry.label).join(" · ")}
          </p>
        </div>
      )}
    </section>
  );
}

function SpecRow({ entry }: { entry: SpecEntry }) {
  const documented = isEntryDocumented(entry);

  return (
    <div className="v-mkd-row">
      <dt>
        {entry.label}
        {entry.maturity && (
          <span className="v-mkd-badge" data-maturity={entry.maturity}>
            {MATURITY_LABELS[entry.maturity]}
          </span>
        )}
      </dt>
      <dd data-missing={!documented}>
        {!documented && NOT_DOCUMENTED}
        {entry.text && <p>{entry.text}</p>}
        {entry.items && entry.items.length > 0 && (
          <ul>
            {entry.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {entry.links && entry.links.length > 0 && (
          <ul>
            {entry.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} className="v-mkd-link" target="_blank" rel="noopener noreferrer">
                  {link.label}
                  <ExternalIcon />
                </a>
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

