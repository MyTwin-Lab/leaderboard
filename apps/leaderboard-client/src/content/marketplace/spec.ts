import type { ModuleSpecification, SpecSection, SpecSectionKey } from "./types";

/**
 * La « MyTwin Module Specification V1 » : six sections, dans cet ordre, avec
 * les mêmes titres pour tous les modules. `fields` liste les lignes types de
 * chaque section : ce qu'une fiche encore vide déclare « Not documented ».
 */
export const SPEC_SECTIONS: { key: SpecSectionKey; number: string; title: string; fields: string[] }[] = [
  { key: "overview", number: "01", title: "Overview", fields: ["Description", "Purpose", "Use cases"] },
  {
    key: "capabilities",
    number: "02",
    title: "Capabilities",
    fields: ["Main capabilities", "Inputs", "Processing", "Outputs", "Requirements and limitations"],
  },
  {
    key: "integration",
    number: "03",
    title: "Integration",
    fields: ["Integration type", "Prerequisites", "API or SDK documentation", "Getting started", "Sandbox availability"],
  },
  // Les lignes de prix viennent des conditions (`PricingTerms`), pas d'ici.
  { key: "pricing", number: "04", title: "Pricing", fields: [] },
  {
    key: "licensing",
    number: "05",
    title: "Licensing",
    fields: [
      "Technology owner",
      "Licensing model",
      "Commercial usage rights",
      "White-label availability",
      "Redistribution restrictions",
      "Open-source availability",
    ],
  },
  {
    key: "complianceAndTrust",
    number: "06",
    title: "Compliance & Trust",
    fields: [
      "Intended use",
      "Clinical validation",
      "Regulatory status",
      "Data categories",
      "Data handling",
      "Security and privacy",
      "Limitations",
    ],
  },
];

export const NOT_DOCUMENTED = "Not documented";

function undocumentedSection(key: SpecSectionKey): SpecSection {
  const section = SPEC_SECTIONS.find((candidate) => candidate.key === key);
  return { entries: (section?.fields ?? []).map((label) => ({ label })) };
}

/** Une fiche aux six sections présentes, dont aucune ligne n'est encore documentée. */
export function undocumentedSpecification(): ModuleSpecification {
  return {
    overview: undocumentedSection("overview"),
    capabilities: undocumentedSection("capabilities"),
    integration: undocumentedSection("integration"),
    pricing: { ...undocumentedSection("pricing"), terms: {} },
    licensing: undocumentedSection("licensing"),
    complianceAndTrust: undocumentedSection("complianceAndTrust"),
  };
}
