/**
 * Un module du MyTwin Marketplace, et sa fiche : la « MyTwin Module
 * Specification V1 », six sections dans le même ordre pour tous les modules.
 *
 * Le registre (`index.ts`) ne porte que du contenu ; la carte et la fiche
 * (`components/marketplace/`) en tirent tout leur rendu. Ajouter un module au
 * registre le publie à la fois dans le catalogue et à sa propre URL.
 *
 * Règle de contenu : rien d'inventé. Une valeur absente s'affiche « Not
 * documented » ; un prix absent n'est jamais zéro ni gratuit ; un lien de
 * documentation n'existe que s'il mène quelque part (docs/marketplace.md).
 */

/** Qui détient la technologie : MyTwin ou un partenaire, toujours distingués. */
export type ModuleProvider = {
  name: string;
  kind: "mytwin" | "partner";
};

/**
 * Où en est le module. `detail` reprend la nuance de la fiche de référence ;
 * le libellé court, lui, va sur la carte.
 */
export type ModuleAvailability = {
  stage: "core-technology" | "initial-implementation" | "planned" | "not-documented";
  detail?: string;
};

/**
 * Le degré de certitude d'une information : une capacité prévue ou à
 * confirmer ne doit pas se lire comme une capacité acquise.
 */
export type SpecMaturity = "planned" | "to-confirm";

/**
 * Une ligne de fiche. Sans `text` ni `items`, elle s'affiche « Not
 * documented » : c'est ainsi qu'une fiche déclare ce qu'elle ne sait pas.
 */
export type SpecEntry = {
  label: string;
  text?: string;
  items?: string[];
  maturity?: SpecMaturity;
};

export type SpecReference = {
  label: string;
  url: string;
};

/** Une section de fiche : un texte d'introduction, puis des lignes. */
export type SpecSection = {
  intro?: string[];
  entries: SpecEntry[];
  /** Les remarques qui suivent les lignes (limites, frontières, conditions). */
  notes?: string[];
};

/** Les modèles de facturation envisagés ; aucun n'est supposé commun à tous. */
export type PricingModel = "per-patient-per-month" | "per-assessment" | "per-api-call" | "custom";

export type PricingCurrency = "EUR" | "USD";

/** Un palier de volume : `unitPrice` s'applique de `fromUnits` à `toUnits` inclus. */
export type PricingTier = {
  fromUnits: number;
  /** Absent : le dernier palier, sans plafond. */
  toUnits?: number;
  unitPrice: number;
};

/**
 * Les conditions tarifaires, en données et non en texte : c'est ce qu'un futur
 * estimateur multi-modules lira. Chaque champ absent est « Not documented ».
 * Aucun prix n'est publié tant qu'il n'a pas été validé commercialement.
 */
export type PricingTerms = {
  model?: PricingModel;
  /** Ce qui est facturé : « patient », « assessment », « API call »… */
  billingUnit?: string;
  unitPrice?: number;
  currency?: PricingCurrency;
  volumeTiers?: PricingTier[];
  setupFee?: number;
  conditions?: string[];
};

export type PricingSection = SpecSection & {
  terms: PricingTerms;
};

export type ComplianceSection = SpecSection & {
  /** Les textes de référence externes que la fiche cite, jamais une certification. */
  references?: SpecReference[];
};

/** Les six sections, toujours présentes, même vides. */
export type ModuleSpecification = {
  overview: SpecSection;
  capabilities: SpecSection;
  integration: SpecSection;
  pricing: PricingSection;
  licensing: SpecSection;
  complianceAndTrust: ComplianceSection;
};

export type SpecSectionKey = keyof ModuleSpecification;

/** Le pictogramme de la carte et de la fiche, résolu par `components/marketplace/icons.tsx`. */
export type ModuleIcon =
  | "record"
  | "engine"
  | "care-plan"
  | "device"
  | "heart"
  | "metabolic"
  | "mind"
  | "skin"
  | "prevention"
  | "call";

export type MarketplaceModule = {
  /** Identifiant stable ; c'est aussi le slug de l'URL. */
  id: string;
  slug: string;
  name: string;
  provider: ModuleProvider;
  /** « Core Platform Module », « Partner Module »… tel que le catalogue le nomme. */
  moduleType: string;
  /** La couche de la MyTwin Platform, quand elle est documentée. */
  platformLayer?: string;
  availability: ModuleAvailability;
  shortDescription: string;
  icon: ModuleIcon;
  specification: ModuleSpecification;
  /** Uniquement une documentation qui existe : jamais de lien vide ou provisoire. */
  documentationUrl?: string;
  externalProviderUrl?: string;
  /** Date ISO de la dernière mise à jour de la fiche. */
  lastUpdated?: string;
};
