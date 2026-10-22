import type { MarketplaceModule } from "../types";

/**
 * Source : « MyTwin Engine — Official Module Reference ».
 * L'Engine orchestre et gouverne les modèles : il n'est pas lui-même un
 * modèle de score. Les scores (Metabolic Health Score, modèles
 * cardiovasculaires…) sont des modules distincts, exécutés par lui.
 */
export const mytwinEngine: MarketplaceModule = {
  id: "mytwin-engine",
  slug: "mytwin-engine",
  name: "MyTwin Engine",
  provider: { name: "MyTwin", kind: "mytwin" },
  moduleType: "Core Platform Module",
  platformLayer: "Engine",
  availability: {
    stage: "core-technology",
    detail:
      "Existing MyTwin core technology. The standardized third-party module runtime and its documentation are evolving.",
  },
  // Pas de visuel dans la plaquette pour ce module : description tirée de la
  // « Public card description » de la fiche, au format des autres cartes.
  shortDescription:
    "Health models and recommendations, run with traceable inputs, versioned outputs and reproducible execution.",
  image: "/marketplace/modules/mytwin-engine.webp",
  specification: {
    overview: {
      intro: [
        "MyTwin Engine is the orchestration and governance layer for health intelligence. It lets applications execute compatible scoring models, risk projections, what-if simulations and recommendation workflows within a consistent technical framework.",
        "The Engine is not the scoring model itself. Metabolic Health Score, cardiovascular models, risk models and customer-owned formulas are separate modules that can be connected to it. The Engine supplies the common execution contract, routing, versioning, traceability and explanation infrastructure.",
      ],
      entries: [
        {
          label: "Purpose",
          text: "Make health intelligence easier to integrate, review, reproduce and govern, without presenting underlying medical results as automatically validated.",
        },
      ],
    },
    capabilities: {
      entries: [
        {
          label: "Model orchestration",
          text: "Register and execute model modules with declared input requirements, parameters, versions and supported outputs; determine whether sufficient data are available, and provide explicit missing-input or unsupported-use results.",
        },
        {
          label: "Controlled execution",
          text: "Capture a reproducible execution record: input data snapshot or references, source provenance, selected model and version, configuration, parameters, execution timestamp, output, warnings and relevant dependencies. Reproducibility is a design requirement, not a guarantee for every non-deterministic external model.",
        },
        {
          label: "Output classification",
          text: "Separate measured clinical facts, computed scores, estimated values and hypothetical simulation results. Label insufficient data and uncertainty instead of manufacturing certainty.",
        },
        {
          label: "Explanations and recommendations",
          text: "Connect computed findings to contextual explanations and to versioned, clinically reviewed knowledge or recommendation content when such content is available. A language model may help present information, but it must not invent an unreviewed medical rationale or imply that an explanation has been validated without evidence.",
        },
        {
          label: "Projections and what-if workflows",
          text: "Provide a framework in which separately supplied models can evaluate hypothetical inputs. Such outputs must be labeled as scenarios with assumptions and limitations, never as observed patient outcomes.",
        },
        {
          label: "Outputs",
          items: [
            "Structured model results",
            "Execution and run identifiers",
            "Trace and evidence references",
            "Model and knowledge versions",
            "Warnings",
            "Machine-readable events for experiences and care workflows",
          ],
        },
      ],
    },
    integration: {
      entries: [
        { label: "Published API or SDK" },
        {
          label: "Module registration contract",
          text: "Planned standardization; final schema not documented.",
          maturity: "planned",
        },
        { label: "Supported model runtimes, external provider adapters and test sandbox" },
        {
          label: "Input source",
          text: "Authorized, normalized patient data from MyTwin Data Hub, subject to relevant permissions.",
        },
      ],
      notes: [
        "Architectural boundary: the Data Hub owns canonical health data; the Engine owns analysis execution, result lineage and explanation orchestration. Consent and authorization policies must be enforced by the wider platform, not assumed to live solely inside the Engine. Clinical workflow routing and patient-facing interfaces can consume Engine outputs without becoming embedded in the core runtime.",
      ],
    },
    pricing: {
      terms: {},
      entries: [{ label: "Included models, compute allowances and overages" }],
      notes: [
        "Pricing must clearly separate the Engine infrastructure from any independently licensed scoring model, knowledge source or third-party service that it executes.",
      ],
    },
    licensing: {
      entries: [
        {
          label: "Technology owner",
          text: "MyTwin, for generic pre-existing Engine components, subject to project-specific agreements.",
        },
        {
          label: "Third-party and customer model intellectual property",
          text: "Remains governed by the model owner’s agreement; connecting a model to MyTwin Engine does not transfer its ownership.",
        },
        { label: "Commercial use and white-label terms" },
        { label: "Open-source availability" },
      ],
    },
    complianceAndTrust: {
      entries: [
        {
          label: "Positioning",
          text: "A compliance-supporting, audit-ready-by-design architecture, not a regulatory certification or an automatic assurance that an application is compliant.",
        },
        {
          label: "Governance support",
          text: "Versioned runs, data lineage, model governance and evidence references can support documentation, quality management and clinical review. They do not replace clinical validation, intended-use analysis, risk management, regulatory classification, privacy assessments or deployment controls.",
        },
        {
          label: "Clinical governance",
          text: "Models and recommendation libraries require their own evidence, approved scope and maintenance lifecycle. Clinicians must be able to understand the relevant basis and limitations of recommendations when the intended use requires it.",
        },
        { label: "Certifications, regulatory classification, validation results and operational controls" },
      ],
      references: [
        {
          label: "US FDA Clinical Decision Support Software Guidance",
          url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software",
        },
        {
          label: "EU guidance on medical device software qualification",
          url: "https://health.ec.europa.eu/latest-updates/update-mdcg-2019-11-rev1-qualification-and-classification-software-regulation-eu-2017745-and-2025-06-17_en",
        },
      ],
    },
  },
};
