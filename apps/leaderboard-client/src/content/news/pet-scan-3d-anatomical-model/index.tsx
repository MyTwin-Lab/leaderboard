import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { NewsPhotoRow } from "@/components/news/NewsPhotoRow";
import { newsPath } from "@/lib/paths";
import { MYTWIN } from "@/lib/seo";
import type { NewsArticle } from "../types";
import { ImageToDynamicModel } from "./image-to-dynamic-model";

// Le patient dont l'examen a servi n'est pas nommé : un TEP scan est une donnée
// de santé, et le texte n'en dit rien.
const MYTWIN_PAGES = {
  aiMedicalImaging: "https://mytwin.care/en/blog/ai-medical-imaging",
  patientDigitalTwin: "https://mytwin.care/en/blog/patient-digital-twin",
} as const;

const SOURCES = {
  katsoulakis: "https://www.nature.com/articles/s41746-024-01073-0",
  laubenbacher: "https://www.nature.com/articles/s43588-024-00607-6",
  shen: "https://www.nature.com/articles/s41746-024-01146-0",
} as const;

const MODEL_ALT =
  "The 3D anatomical model: skeleton, lungs and abdominal organs in colour, inside the translucent outline of the body";

export const petScan3dAnatomicalModel: NewsArticle = {
  slug: "pet-scan-3d-anatomical-model",
  publishedAt: "2026-09-24",
  eventMonth: "2025-02",
  category: "research",
  readingMinutes: 5,
  title: "From PET scan to 3D model: a new building block of the patient’s digital twin",
  overviewTitle: "From PET scan to 3D model",
  illustration: {
    kind: "image",
    src: "/news/pet-scan-3d-model.webp",
    alt: MODEL_ALT,
    position: "50% 42%",
  },
  seoTitle: "From PET scan to a 3D anatomical model",
  description:
    "From a full-body PET scan to a 3D anatomical model: organs segmented and rebuilt in 3D, a new building block of the patient’s digital twin at MyTwin Lab.",
  excerpt:
    "A new step in building the patient’s digital twin: a 3D anatomical model, reconstructed from a full-body PET scan by segmenting the structures visible on the exam.",
  keywords: [
    "PET scan 3D model",
    "3D anatomical model",
    "medical image segmentation",
    "PET-CT 3D reconstruction",
    "patient-specific anatomy",
    "MyTwin Lab",
  ],
  facts: [
    { label: "When", value: "February 2025" },
    { label: "Stage", value: "Experiment: a 3D anatomical model from one full-body PET scan. A visualisation, not a diagnosis" },
    { label: "Who", value: "The MyTwin Lab team" },
    { label: "Input", value: "The images of a full-body PET scan" },
    { label: "Method", value: "Anatomical structures segmented, then reconstructed in 3D, in the open-source software 3D Slicer" },
    { label: "Next", value: "Enriching the model with other data, towards a dynamic model that evolves over time" },
  ],
  intro: (
    <>
      <p>
        As part of the development of MyTwin Lab, we have taken a new step in building{" "}
        <NewsLink href={MYTWIN.url}>the patient’s digital twin</NewsLink>: the creation of a 3D anatomical model from a
        full-body PET scan.
      </p>
      <p>
        Starting from the medical imaging data, the different anatomical structures were segmented, then reconstructed in
        three dimensions, to obtain an individualised representation of the patient’s anatomy, especially the thorax and
        the organs visible on the exam.
      </p>
      <NewsPhotoRow
        caption="The segmentation: each structure visible on the exam becomes its own segment, then a 3D surface."
        photos={[
          {
            label: "Segmentation",
            src: "/news/pet-scan-segmentation.webp",
            width: 1600,
            height: 709,
            alt: "3D Slicer showing the list of segmented structures (spleen, kidneys, liver, lung lobes…) next to the 3D reconstruction of the skeleton and organs",
          },
        ]}
      />
      <p>
        This approach is one of the fundamental building blocks of a health digital twin: starting from a patient’s real
        data to gradually build a digital representation that is their own. Scientific work on medical digital twins
        describes exactly this logic: an individualised virtual representation, combined with the patient’s own data
        and, eventually, with analysis and simulation capabilities.
      </p>
    </>
  ),
  sections: [
    {
      id: "see-the-anatomy",
      title: "Seeing the patient’s anatomy differently",
      content: (
        <>
          <p>
            3D reconstruction turns a series of cross-section medical images into a much more intuitive spatial
            representation of the anatomy.
          </p>
          <NewsPhotoRow
            caption="From one cross-section of the exam to the reconstructed model of the same body."
            photos={[
              {
                label: "A slice",
                src: "/news/pet-scan-ct-slice.webp",
                width: 316,
                height: 816,
                alt: "A coronal slice of the full-body exam, in greyscale, from the head to the thighs",
              },
              { label: "The 3D model", src: "/news/pet-scan-3d-model.webp", width: 1170, height: 1545, alt: MODEL_ALT },
            ]}
          />
          <p>
            It can help to better understand the anatomical variations specific to each patient, the relationships between
            organs, and where certain areas of interest sit in space.
          </p>
          <p>
            Personalised anatomical modelling is already being studied in several medical fields, notably for therapeutic
            or surgical planning and for building patient-specific models.
          </p>
          <p>
            In oncological imaging, PET combined with CT provides complementary functional and anatomical information. 3D
            reconstruction obviously does not replace the medical reading of a PET scan, but it can add a layer of
            visualisation and analysis around the patient’s data. What AI can and can’t do with medical images is covered
            in <NewsLink href={MYTWIN_PAGES.aiMedicalImaging}>MyTwin’s guide to AI in medical imaging</NewsLink>.
          </p>
        </>
      ),
    },
    {
      id: "towards-simulation",
      title: "A first step towards a model able to simulate",
      content: (
        <>
          <p>At MyTwin Lab, though, the goal goes beyond 3D visualisation.</p>
          <p>
            A true digital twin is more than a graphic representation of the body. The scientific literature describes the
            medical digital twin as an individualised model that can gradually integrate different sources of data, to
            contribute to monitoring, prediction and the simulation of health scenarios.
          </p>
          <p>
            Anatomical modelling is therefore a first layer, alongside the outer envelope of the body, captured in{" "}
            <NewsLink href={newsPath("scan-engine-full-body-3d-avatar")}>a full-body 3D avatar</NewsLink>.
          </p>
          <p>
            Over time, it can be enriched with other information: biological data, medical history, biomarkers,
            physiological data, imaging, functional data or predictive models.
          </p>
          <p>The challenge is to move, step by step:</p>
          <ImageToDynamicModel />
        </>
      ),
    },
    {
      id: "most-advanced-twin",
      title: "Building the most advanced patient digital twin possible",
      content: (
        <>
          <p>
            MyTwin Lab’s ambition is to gradually connect these building blocks into an ever more complete and
            individualised representation of the patient, as described in{" "}
            <NewsLink href="/vision">MyTwin Lab’s research vision</NewsLink>.
          </p>
          <p>
            This representation could, eventually, support different kinds of simulation: how a state of health evolves,
            the potential response to certain treatments, preparing interventions, comparing scenarios or identifying some
            risks early.
          </p>
          <p>
            Current research on medical digital twins explores exactly these applications, notably in personalised
            medicine, oncology and individual risk prediction. What a patient digital twin is, and what it is for, is
            explained in <NewsLink href={MYTWIN_PAGES.patientDigitalTwin}>MyTwin’s guide to the patient digital twin</NewsLink>
            .
          </p>
          <p>
            This reconstruction from a PET scan is therefore one more step towards the goal MyTwin Lab pursues: building a
            digital twin of the human body that is ever more precise, personalised and able, tomorrow, to simulate
            different possible futures for the same patient.
          </p>
          <NewsCallout>
            <p>See today. Understand more. Simulate tomorrow.</p>
          </NewsCallout>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Does the 3D model replace the reading of the PET scan?",
      answer:
        "No. The PET scan is read and interpreted by physicians. The 3D reconstruction adds a layer of visualisation and analysis around the patient’s data; it makes no diagnosis.",
    },
    {
      question: "Can I get a 3D model of my own scans in MyTwin?",
      answer:
        "Not today. This reconstruction is a MyTwin Lab experiment, and no 3D model of medical images is offered to MyTwin users yet.",
    },
  ],
  cta: {
    text: "The anatomical model is one building block. The Lab’s research vision tells how the others connect, from the body to the molecule.",
    label: "Read the research vision",
    href: "/vision",
  },
  sources: [
    {
      label: "Katsoulakis E. et al., 2024, “Digital twins for health: a scoping review”, npj Digital Medicine.",
      url: SOURCES.katsoulakis,
    },
    { label: "Laubenbacher R. et al., 2024, “Digital twins in medicine”, Nature Computational Science.", url: SOURCES.laubenbacher },
    {
      label:
        "Shen M. et al., 2024, “The effectiveness of digital twins in promoting precision health across the entire population: a systematic review”, npj Digital Medicine.",
      url: SOURCES.shen,
    },
  ],
  mentions: [{ type: "SoftwareApplication", name: "3D Slicer", url: "https://www.slicer.org/" }],
};
