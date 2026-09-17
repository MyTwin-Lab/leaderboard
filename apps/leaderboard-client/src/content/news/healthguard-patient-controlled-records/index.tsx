import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsFigure } from "@/components/news/NewsFigure";
import { NewsLink } from "@/components/news/NewsLink";
import { PodcastEpisodeEmbed } from "@/components/podcast/PodcastEpisodeEmbed";
import type { NewsArticle } from "../types";
import { DocumentVsAccess } from "./document-vs-access";

const HEALTHGUARD = "https://www.healthguard-project.com/";

const MYTWIN_PAGES = {
  patients: "https://mytwin.care/en/patients",
  personalHealthRecord: "https://mytwin.care/en/blog/personal-health-record",
  kevinStory: "https://mytwin.care/en/stories/kevin-medical-reports",
} as const;

const SOURCES = {
  bell: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7284300/",
  tam: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1188190/",
  kripalani: "https://pubmed.ncbi.nlm.nih.gov/17327525/",
  who: "https://www.who.int/publications/i/item/WHO-UHC-SDS-2019.9",
  ehds: "https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en",
} as const;

export const healthguardPatientControlledRecords: NewsArticle = {
  slug: "healthguard-patient-controlled-records",
  publishedAt: "2026-09-16",
  eventMonth: "2026-07",
  category: "partnership",
  readingMinutes: 5,
  title: "HealthGuard: a hospital pharmacist’s project to put patients in control of their medical records",
  seoTitle: "HealthGuard: patient-controlled medical records",
  description:
    "Hospital pharmacist Sébastien Saliques builds HealthGuard: medical documents shared as traced, revocable access, not copies. MyTwin plans to build it in.",
  excerpt:
    "A missing report, a lab result nobody can find, a document only some staff can open: Sébastien Saliques has seen it all from the hospital pharmacy. With HealthGuard, he is building another way to share medical records, where patients hand out access, not copies.",
  keywords: [
    "HealthGuard",
    "patient-controlled medical records",
    "medical document sharing",
    "health data access control",
    "Sébastien Saliques",
    "MyTwin",
  ],
  facts: [
    { label: "When", value: "July 2026, on MyTwin Inside" },
    { label: "Who", value: "Sébastien Saliques, hospital pharmacist and founder of HealthGuard" },
    { label: "Stage", value: "Alpha, not yet available" },
    { label: "Principle", value: "Traced, revocable access to documents instead of copies" },
    { label: "With MyTwin", value: "Planned integration into the records patients create in MyTwin" },
  ],
  intro: (
    <>
      <p>
        Sébastien Saliques has been a hospital pharmacist for more than ten years. From that seat, he has watched the same
        scene again and again: a patient arrives, and a prescription, a lab result, an imaging report or a hospital letter
        is missing. Medical information, as he puts it, is “everywhere and nowhere at once”.
      </p>
      <p>
        For the past few years, he has been building <NewsLink href={HEALTHGUARD}>HealthGuard</NewsLink>, a project to
        give patients full ownership of their medical documents while making professionals’ work easier. He presented it
        on MyTwin Inside in July 2026, and MyTwin plans to build its technology into the records patients create in the
        MyTwin app. HealthGuard is at alpha stage and not yet available.
      </p>
    </>
  ),
  sections: [
    {
      id: "missing-information",
      title: "The cost of information that isn’t there",
      content: (
        <>
          <p>
            The problem is well documented. When patients read their clinical notes, one in five reports finding a
            mistake, and 42% of them consider it serious,{" "}
            <NewsLink href={SOURCES.bell}>according to a US study of more than 22,000 patients</NewsLink>. At hospital
            admission,{" "}
            <NewsLink href={SOURCES.tam}>errors in medication histories occur in up to 67% of cases</NewsLink>. After
            discharge, the hospital summary is{" "}
            <NewsLink href={SOURCES.kripalani}>available at the first follow-up visit in only 12% to 34% of cases</NewsLink>.
            And according to the <NewsLink href={SOURCES.who}>World Health Organization</NewsLink>, medication discrepancies
            affect almost every patient who moves across transitions of care.
          </p>
          <p>
            Public tools exist. In France, every citizen has a Mon espace santé account and a shared medical record. But,
            Sébastien Saliques explains, few people use them before they have a medical history, hospital data often don’t
            reach them, and many professionals, lacking card readers in consultation rooms, fall back on email.
          </p>
        </>
      ),
    },
    {
      id: "access-not-documents",
      title: "Share access, not documents",
      content: (
        <>
          <p>
            HealthGuard’s idea fits in one sentence, the one its founder uses: “we no longer share a document, we share
            access to a document”. A document sent by email is a copy: nobody can say who still has it, and it can’t be
            taken back. With HealthGuard, the patient keeps their documents in one place and grants access instead, to a
            person, a team or an institution, for part of their record and for a set time, from an hour to a year. Every
            access is traced, and the patient can revoke it at any time.
          </p>
          <DocumentVsAccess />
          <p>Under the hood, according to the project:</p>
          <ul>
            <li>documents are encrypted before being stored;</li>
            <li>storage is decentralised, on the IPFS network, rather than on a single server;</li>
            <li>a blockchain records only the access permissions and their history, never a medical document.</li>
          </ul>
          <p>
            The founder’s argument is security by design: with no central store of documents, there is no single place to
            attack, and access rules don’t depend on trusting one institution.
          </p>
        </>
      ),
    },
    {
      id: "where-it-stands",
      title: "Where HealthGuard stands",
      content: (
        <>
          <p>
            HealthGuard is an alpha. It is not available to patients yet. Before it is, it will have to show how it meets
            the rules that govern health data, from the GDPR to certified health data hosting in France.
          </p>
          <p>
            The context is moving its way. The{" "}
            <NewsLink href={SOURCES.ehds}>European Health Data Space regulation</NewsLink>, in force since March 2025,
            gives patients fast and free access to their own electronic health data across the European Union.
          </p>
          <NewsCallout>
            <p>Medical information that follows the patient, with the patient deciding who sees it.</p>
          </NewsCallout>
        </>
      ),
    },
    {
      id: "with-mytwin",
      title: "Why it matters for MyTwin",
      content: (
        <>
          <p>
            Bringing a patient’s medical documents together in one place is at the heart of MyTwin.{" "}
            <NewsLink href={MYTWIN_PAGES.kevinStory}>Kevin’s story</NewsLink> shows what medical reports a patient can’t
            make sense of cost in worry and waiting, and our guide to{" "}
            <NewsLink href={MYTWIN_PAGES.personalHealthRecord}>keeping a personal health record</NewsLink> explains how to
            organise and share one safely. HealthGuard’s access model would let the records created in MyTwin be shared
            this way, possibly without patients even noticing the technology underneath.
          </p>
          <NewsFigure caption="Sébastien Saliques, hospital pharmacist and founder of HealthGuard, on MyTwin Inside.">
            <PodcastEpisodeEmbed episode="records" />
          </NewsFigure>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Can I use HealthGuard today?",
      answer: "No. HealthGuard is an alpha-stage project and is not yet available to patients.",
    },
    {
      question: "Are medical documents stored on a blockchain?",
      answer:
        "No. According to HealthGuard, the blockchain only records access permissions and their history. The documents themselves are encrypted and stored on decentralised storage.",
    },
  ],
  cta: {
    text: "Your medical documents, brought together in one place.",
    label: "Discover MyTwin for patients",
    href: MYTWIN_PAGES.patients,
  },
  sources: [
    {
      label:
        "Bell S.K. et al., 2020, “Frequency and types of patient-reported errors in electronic health record ambulatory care notes”, JAMA Network Open.",
      url: SOURCES.bell,
    },
    {
      label:
        "Tam V.C. et al., 2005, “Frequency, type and clinical importance of medication history errors at admission to hospital: a systematic review”, CMAJ.",
      url: SOURCES.tam,
    },
    {
      label:
        "Kripalani S. et al., 2007, “Deficits in communication and information transfer between hospital-based and primary care physicians”, JAMA.",
      url: SOURCES.kripalani,
    },
    { label: "World Health Organization, 2019, “Medication safety in transitions of care”.", url: SOURCES.who },
    { label: "European Commission, “European Health Data Space Regulation (EHDS)”.", url: SOURCES.ehds },
    { label: "HealthGuard, project website.", url: HEALTHGUARD },
  ],
  mentions: [
    { type: "Organization", name: "HealthGuard", url: HEALTHGUARD },
    { type: "Person", name: "Sébastien Saliques" },
  ],
};
