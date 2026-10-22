import type { MarketplaceModule } from "../types";

/**
 * Source : « Dynamic Care Plan — Official Module Reference ».
 * Un plan de soins suivi entre deux bilans, sous la main du clinicien : le
 * module ne diagnostique pas, ne prescrit pas et ne promet aucune
 * surveillance d'urgence en continu.
 */
export const dynamicCarePlan: MarketplaceModule = {
  id: "dynamic-care-plan",
  slug: "dynamic-care-plan",
  name: "Dynamic Care Plan",
  provider: { name: "MyTwin", kind: "mytwin" },
  moduleType: "Core Care Workflow Module",
  platformLayer: "Experience Layer, powered by Data Hub and Engine",
  availability: {
    stage: "initial-implementation",
    detail:
      "Care-plan capabilities are implemented in an initial client experience. The standalone reusable module and its external integration contract require productization.",
  },
  // Pas de visuel dans la plaquette pour ce module : description tirée de la
  // « Public card description » de la fiche, au format des autres cartes.
  shortDescription:
    "Personalized care plans connected to patient data, so clinicians can review signals and adjust follow-up between checkups.",
  image: "/marketplace/modules/dynamic-care-plan.webp",
  specification: {
    overview: {
      intro: [
        "Dynamic Care Plan connects a patient’s longitudinal digital twin to a clinic-managed, personalized health plan.",
        "A six-month longevity journey might begin with a comprehensive assessment and a clinician-approved plan. Instead of remaining static until the next major checkup, the plan can reflect new measurements, in-app assessments, connected-device data, goals and clinician feedback between visits.",
      ],
      entries: [
        {
          label: "Purpose",
          text: "Turn periodic checkups into a connected follow-up experience, while preserving clinician oversight and a clear record of what changed and why.",
        },
        {
          label: "Primary users",
          text: "Patients following their plan; clinical teams monitoring relevant changes and updating interventions.",
        },
      ],
    },
    capabilities: {
      entries: [
        {
          label: "Personalized plan structure",
          text: "Represent goals, care domains, recommended activities, checkups, educational content, milestones and follow-up tasks. The major plan structure can remain stable while specific actions change.",
        },
        {
          label: "Continuous inputs",
          text: "Use new authorized observations, assessments, patient-reported activity and Engine outputs to track progress between scheduled checkups. Data availability and update frequency depend on connected sources.",
        },
        {
          label: "Configurable monitoring",
          text: "Evaluate selected thresholds, trends and rules with MyTwin Engine or associated workflow services. Thresholds must be defined and reviewed for the intended population and use, not treated as universal clinical cutoffs.",
        },
        {
          label: "Clinician escalation workflow",
          text: "Route qualified signals to a designated care team queue for review, with severity, context, timestamps, status, acknowledgement and ownership where implemented. Notifications are not equivalent to guaranteed real-time emergency monitoring.",
        },
        {
          label: "Plan adjustment and versioning",
          text: "Authorized clinicians can accept, amend, add or close actions, and record the author, reason, effective date and patient-visible change history.",
        },
        {
          label: "Follow-up opportunities",
          text: "Offer appointments, targeted checkups, coaching and optional programs when clinically appropriate. Commercial offers and upsells should be clearly distinguished from medical recommendations, with transparent choice and consent.",
        },
        {
          label: "Outputs",
          items: [
            "Patient-facing current plan",
            "Care-team view",
            "Progress and completion events",
            "Version history",
            "Review and alert tasks",
            "Appointment or program suggestions",
          ],
        },
      ],
    },
    integration: {
      entries: [
        { label: "Published standalone API or SDK" },
        { label: "Reusable module integration contract" },
        {
          label: "Patient application and clinician dashboard interfaces",
          text: "To be documented per deployment.",
          maturity: "to-confirm",
        },
        {
          label: "Data dependencies",
          text: "MyTwin Data Hub for longitudinal information, MyTwin Engine for relevant computed results, and identity, authorization, notification and workflow services for care-team actions.",
        },
        {
          label: "Standards alignment",
          text: "HL7 FHIR CarePlan is an interoperability reference for grouping goals, activities and participants; it does not imply a finished FHIR-compliant MyTwin implementation.",
        },
        {
          label: "Conceptual flow",
          items: [
            "New patient data",
            "Interpretation or threshold evaluation",
            "Clinician review task when indicated",
            "Authorized plan update",
            "Patient notification",
            "Recorded version and outcome",
          ],
        },
      ],
    },
    pricing: {
      terms: {},
      entries: [
        { label: "Care-team seats, communication volume and setup fees" },
        {
          label: "Coaching and optional clinical services",
          text: "Separate commercial terms may apply; external services are not silently bundled into the software price.",
        },
      ],
    },
    licensing: {
      entries: [
        {
          label: "Technology owner",
          text: "MyTwin, for generic reusable care-plan framework components, subject to deployment and customer agreements.",
        },
        {
          label: "Customer-specific protocols, clinician-authored content, branded experiences and clinic data",
          text: "Ownership and reuse rights to be defined by contract.",
          maturity: "to-confirm",
        },
        { label: "Commercial use, white-label and distribution terms" },
        { label: "Open-source availability" },
      ],
    },
    complianceAndTrust: {
      entries: [
        {
          label: "Clinical safety boundary",
          text: "Dynamic Care Plan assists care coordination and follow-up; it does not autonomously diagnose, prescribe, replace clinical decisions or guarantee 24/7 monitoring or emergency response.",
        },
        {
          label: "Operational controls to specify",
          items: [
            "Named clinical owners",
            "Approved thresholds",
            "Sensitivity and alert fatigue management",
            "Escalation destinations",
            "Service hours and response expectations",
            "Failure handling",
            "Consent, audit history and records of clinician approval",
          ],
        },
        {
          label: "Clinical content",
          text: "Recommendations, including supplement or coaching suggestions, require appropriate professional review, evidence and separation from commercial promotion. Major treatment changes require qualified clinical authorization.",
        },
        { label: "Regulatory status, validation evidence, security certifications and response service levels" },
      ],
      references: [
        { label: "HL7 FHIR CarePlan", url: "https://hl7.org/fhir/R4/careplan.html" },
        {
          label: "US Health IT Clinical Decision Support",
          url: "https://healthit.gov/clinical-quality-and-safety/clinical-decision-support/",
        },
      ],
    },
  },
};
