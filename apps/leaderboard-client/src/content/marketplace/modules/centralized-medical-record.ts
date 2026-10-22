import type { MarketplaceModule } from "../types";

/**
 * Source : « Centralized Medical Record — Official Module Reference ».
 * Le module est la face patient du MyTwin Data Hub, pas un simple stockage de
 * documents. Rien n'est ajouté à la fiche de référence ; ses consignes
 * internes (« do not imply… ») deviennent des lignes « Not documented ».
 */
export const centralizedMedicalRecord: MarketplaceModule = {
  id: "centralized-medical-record",
  slug: "centralized-medical-record",
  name: "Centralized Medical Record",
  provider: { name: "MyTwin", kind: "mytwin" },
  moduleType: "Core Platform Module",
  platformLayer: "Data Hub",
  availability: {
    stage: "core-technology",
    detail:
      "Existing MyTwin core technology. Individual ingestion and EHR capabilities vary in maturity and require confirmation.",
  },
  shortDescription: "Exams, reports, health data and recommendations gathered in a single, secure space.",
  image: "/marketplace/modules/centralized-medical-record.webp",
  specification: {
    overview: {
      intro: [
        "The Centralized Medical Record gives patients and care teams a unified view of health information collected over time. It is the product-facing entry point to the MyTwin Data Hub, MyTwin’s underlying ingestion, normalization, semantic modeling and longitudinal data infrastructure.",
        "The record is the visible outcome; the Data Hub is the broader technical foundation that connects raw files and observations to a consistent patient-centered data model.",
      ],
      entries: [
        {
          label: "Use cases",
          items: [
            "Consolidate medical history, laboratory results, clinical reports, appointments and measurements.",
            "Associate patient-uploaded documents and medical imaging with the longitudinal record.",
            "Prepare data for downstream assessments, care plans and MyTwin Engine modules.",
            "Connect clinic EHR/EMR workflows where a supported integration exists.",
          ],
        },
        {
          label: "Positioning boundary",
          text: "This module is not a new EHR for clinic administration, and it does not imply universal access to all hospital systems.",
        },
      ],
    },
    capabilities: {
      entries: [
        {
          label: "Ingestion",
          text: "Accept or connect multiple types of health information, including structured measurements, uploaded reports and medical documents.",
        },
        {
          label: "Imaging ingestion",
          text: "Imaging ingestion, including DICOM and MRI studies, is an intended capability subject to implementation and storage-path verification.",
          maturity: "planned",
        },
        {
          label: "Medical ontology",
          text: "Organize patient, observation, condition, history, document, imaging study, care relationship, source and time into linked, semantically meaningful entities. Preserve the link from normalized information to its original source.",
        },
        {
          label: "Longitudinal record",
          text: "Maintain a coherent timeline without losing the difference between source facts, extracted data, manually entered data, computed results and estimates.",
        },
        {
          label: "Quality and provenance",
          text: "Record source, capture time, units, transformation steps and confidence or review status where applicable.",
        },
        { label: "Deduplication, conflict handling and data freshness rules" },
        {
          label: "Interoperability",
          text: "Use standards-based adapters where appropriate. HL7 FHIR and DICOM/DICOMweb are interoperability targets, not claims of current certification or complete coverage.",
          maturity: "planned",
        },
        {
          label: "Outputs",
          items: [
            "A patient-linked longitudinal record",
            "Normalized observations",
            "Document and imaging references",
            "Structured data for MyTwin Engine and care workflows",
          ],
        },
      ],
    },
    integration: {
      entries: [
        { label: "External integration guide" },
        { label: "MyTwin SDK", text: "Planned; not a released integration path.", maturity: "planned" },
        {
          label: "EHR/EMR connectors and supported versions",
          text: "To be confirmed per deployment.",
          maturity: "to-confirm",
        },
        { label: "Supported ingestion formats, size limits and image processing" },
        { label: "API authentication, callbacks, error handling and sandbox" },
      ],
      notes: [
        "The intended architecture exposes MyTwin data contracts and controlled ingestion endpoints. Files can be stored as source assets while structured facts are extracted, mapped and linked in the ontology. External developers should not be expected to manipulate internal storage or ontology objects directly.",
      ],
    },
    pricing: {
      terms: {},
      entries: [{ label: "Storage allowances, ingestion volume, EHR integration and setup fees, overages" }],
      notes: [
        "This foundational capability may be included in a platform agreement rather than priced like a single analysis.",
      ],
    },
    licensing: {
      entries: [
        {
          label: "Technology owner",
          text: "MyTwin, for its pre-existing Data Hub and generic platform components, subject to applicable customer and partner agreements.",
        },
        { label: "Commercial usage terms" },
        { label: "White-label and redistribution rights" },
        { label: "Open-source availability" },
      ],
      notes: [
        "Deployment-specific EHR mappings, customer-owned data and bespoke customer technology must remain distinguishable from reusable MyTwin platform assets.",
      ],
    },
    complianceAndTrust: {
      entries: [
        {
          label: "Design considerations",
          items: [
            "Patient permissions and consent where required",
            "Role- and tenant-based access",
            "Data residency and retention",
            "Encryption and access logs",
            "Correction history and source provenance",
            "Separation of customer environments",
          ],
        },
        {
          label: "Clinical and data integrity",
          text: "Preserve original reports and distinguish unverified extraction from clinician-confirmed information. Semantic normalization must not silently convert uncertain content into verified clinical facts.",
        },
        { label: "Certifications, legal compliance claims and security attestations" },
      ],
      notes: ["A centralized record does not become HIPAA- or GDPR-compliant solely by using this module."],
      references: [
        { label: "HL7 FHIR", url: "https://hl7.org/fhir/" },
        { label: "DICOM", url: "https://www.dicomstandard.org/" },
        { label: "DICOMweb", url: "https://www.dicomstandard.org/using/dicomweb" },
      ],
    },
  },
};
