import { NOT_DOCUMENTED, SPEC_SECTIONS } from "./spec";
import type {
  MarketplaceModule,
  ModuleAvailability,
  ModuleEvidence,
  ModuleSpecification,
  PricingModel,
  PricingTerms,
  SpecEntry,
  SpecMaturity,
  SpecSection,
  SpecSectionKey,
} from "./types";

/**
 * Ce que la carte et la fiche affichent d'un module, tiré du registre. Pur :
 * aucune décision de contenu ici, seulement la mise en mots — et la règle
 * qu'une valeur absente se lit « Not documented », jamais zéro ni gratuit.
 */

export const AVAILABILITY_LABELS: Record<ModuleAvailability["stage"], string> = {
  "core-technology": "Core technology",
  "initial-implementation": "Initial implementation",
  planned: "Planned",
  "not-documented": NOT_DOCUMENTED,
};

export const MATURITY_LABELS: Record<SpecMaturity, string> = {
  planned: "Planned",
  "to-confirm": "To be confirmed",
};

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  "per-patient-per-month": "Per patient per month",
  "per-assessment": "Per assessment",
  "per-api-call": "Per API call",
  custom: "Custom pricing",
};

export function isEntryDocumented(entry: SpecEntry): boolean {
  return Boolean(entry.text?.trim()) || Boolean(entry.items?.length) || Boolean(entry.links?.length);
}

/**
 * Les preuves d'un module en lignes de fiche : affichées dans Compliance &
 * Trust, et résumées sur la carte.
 */
export function evidenceEntries(evidence: ModuleEvidence): SpecEntry[] {
  return [
    { label: "Validation level", text: evidence.validationLevel },
    { label: "Accuracy", text: evidence.accuracy },
    { label: "Research papers", links: evidence.researchPapers },
  ];
}

/** Vrai pour un module qui n'est pas encore disponible : sa carte dit « Coming soon ». */
export function isComingSoon(module: MarketplaceModule): boolean {
  return module.availability.stage === "planned";
}

function formatAmount(amount: number, currency: PricingTerms["currency"]): string | undefined {
  // Un montant sans devise ne s'affiche pas : il se lirait faux.
  if (!currency) return undefined;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/**
 * Le prix tel que la carte le résume, ou `undefined` : seul un prix publié et
 * validé s'affiche, et son absence ne se lit jamais comme zéro.
 */
export function pricingSummary(terms: PricingTerms): string | undefined {
  if (terms.unitPrice !== undefined && terms.model && terms.model !== "custom") {
    const amount = formatAmount(terms.unitPrice, terms.currency);
    if (amount) return `${amount} · ${PRICING_MODEL_LABELS[terms.model].toLowerCase()}`;
  }
  if (terms.model === "custom") return PRICING_MODEL_LABELS.custom;
  return undefined;
}

/** Les lignes de la section Pricing, toujours les mêmes et dans le même ordre. */
export function pricingEntries(terms: PricingTerms): SpecEntry[] {
  const amount = (value: number | undefined) =>
    value === undefined ? undefined : formatAmount(value, terms.currency);

  return [
    { label: "Pricing model", text: terms.model && PRICING_MODEL_LABELS[terms.model] },
    { label: "Billing unit", text: terms.billingUnit },
    { label: "Unit price", text: amount(terms.unitPrice) },
    { label: "Currency", text: terms.currency },
    {
      label: "Volume-based pricing",
      items: terms.volumeTiers
        ?.map((tier) => {
          const price = amount(tier.unitPrice);
          if (!price) return undefined;
          const range = tier.toUnits === undefined ? `${tier.fromUnits}+` : `${tier.fromUnits}–${tier.toUnits}`;
          return `${range} ${terms.billingUnit ?? "units"}: ${price}`;
        })
        .filter((tier): tier is string => tier !== undefined),
    },
    { label: "Setup fees", text: amount(terms.setupFee) },
    { label: "Additional conditions", items: terms.conditions },
  ];
}

/**
 * Les lignes d'une section à afficher. Pricing commence par les lignes tirées
 * de ses conditions, puis celles propres à la fiche.
 */
export function sectionEntries(spec: ModuleSpecification, key: SpecSectionKey): SpecEntry[] {
  const section = spec[key];
  return key === "pricing" ? [...pricingEntries(spec.pricing.terms), ...section.entries] : section.entries;
}

/** Vrai dès qu'une section dit quelque chose : un texte, une ligne, une remarque. */
export function isSectionDocumented(spec: ModuleSpecification, key: SpecSectionKey): boolean {
  const section: SpecSection = spec[key];
  return (
    Boolean(section.intro?.length) ||
    Boolean(section.notes?.length) ||
    sectionEntries(spec, key).some(isEntryDocumented)
  );
}

/** Vrai quand aucune des six sections n'est encore documentée. */
export function isSpecificationEmpty(module: MarketplaceModule): boolean {
  return !SPEC_SECTIONS.some(({ key }) => isSectionDocumented(module.specification, key));
}
