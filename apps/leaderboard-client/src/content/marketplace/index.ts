import { centralizedMedicalRecord } from "./modules/centralized-medical-record";
import { dynamicCarePlan } from "./modules/dynamic-care-plan";
import { mytwinEngine } from "./modules/mytwin-engine";
import { undocumentedSpecification } from "./spec";
import type { MarketplaceModule } from "./types";

/**
 * Le registre du MyTwin Marketplace : l'ordre de ce tableau est celui du
 * catalogue. Une entrée ajoutée ici apparaît dans `/marketplace` et à
 * `/marketplace/<slug>`, sans autre fichier à toucher (docs/marketplace.md).
 *
 * Les trois premiers modules ont une fiche de référence officielle ; les sept
 * suivants n'ont encore que leur nom, leur fournisseur, leur type et la
 * description de la plaquette commerciale. Leurs six sections existent, en
 * « Not documented », jusqu'à ce que leur fiche arrive.
 */

/**
 * Un module encore sans fiche : identité connue, six sections à documenter.
 * Son visuel est `public/marketplace/modules/<slug>.webp`.
 */
function undocumentedModule(
  module: Omit<MarketplaceModule, "id" | "image" | "specification" | "availability"> &
    Partial<Pick<MarketplaceModule, "availability">>,
): MarketplaceModule {
  return {
    id: module.slug,
    image: `/marketplace/modules/${module.slug}.webp`,
    availability: { stage: "not-documented" },
    specification: undocumentedSpecification(),
    ...module,
  };
}

export const MARKETPLACE_MODULES: MarketplaceModule[] = [
  centralizedMedicalRecord,
  mytwinEngine,
  dynamicCarePlan,
  undocumentedModule({
    slug: "connected-device-integration",
    name: "Connected Device Integration",
    provider: { name: "Terra API", kind: "partner" },
    moduleType: "Partner Integration",
    shortDescription: "Connection to smartwatches, smart rings and other compatible devices.",
  }),
  undocumentedModule({
    slug: "cardiovascular-health-score",
    name: "Cardiovascular Health Score",
    // La technologie Saphere, rachetée par e-sensia (anciennement i-Virtual).
    provider: { name: "e-sensia / Saphere", kind: "partner" },
    moduleType: "Partner Module",
    shortDescription:
      "Regular measurement of cardiovascular indicators from a smartphone to track how they evolve between two consultations.",
  }),
  undocumentedModule({
    slug: "metabolic-health-score",
    name: "Metabolic Health Score",
    provider: { name: "MyTwin", kind: "mytwin" },
    moduleType: "Planned Module",
    availability: { stage: "planned", detail: "Not yet developed as a standalone module." },
    shortDescription: "Personalized monitoring of key metabolic indicators and how they change over time.",
  }),
  undocumentedModule({
    slug: "mental-health-assessment",
    name: "Mental Health Assessment",
    provider: { name: "Virtuosis AI", kind: "partner" },
    moduleType: "Partner Module",
    shortDescription:
      "Voice analysis to track variations associated in particular with stress, anxiety and emotional state.",
  }),
  undocumentedModule({
    slug: "skin-lesion-monitoring",
    name: "Skin Lesion Monitoring",
    provider: { name: "Skinive", kind: "partner" },
    moduleType: "Partner Module",
    shortDescription:
      "Regular analysis of skin lesions and identification of changes that may require a medical opinion.",
  }),
  undocumentedModule({
    slug: "stroke-and-heart-attack-prevention",
    name: "Stroke and Heart Attack Prevention",
    provider: { name: "e-sensia", kind: "partner" },
    moduleType: "Partner Module",
    shortDescription: "Detection of vocal signals that may warrant further medical evaluation.",
  }),
  undocumentedModule({
    slug: "daily-call-from-the-ai-assistant",
    name: "Daily Call from the AI Assistant",
    provider: { name: "e-sensia", kind: "partner" },
    moduleType: "Partner Module",
    shortDescription:
      "Regular conversational support to collect new information from the patient, follow their program and keep them engaged.",
  }),
];

export function getMarketplaceModule(slug: string): MarketplaceModule | undefined {
  return MARKETPLACE_MODULES.find((module) => module.slug === slug);
}

/** Le numéro du module dans le catalogue, sur deux chiffres : « 01 ». */
export function moduleNumber(module: MarketplaceModule): string {
  return String(MARKETPLACE_MODULES.indexOf(module) + 1).padStart(2, "0");
}
