import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { challengePath } from "@/lib/paths";
import type { NewsArticle } from "../types";
import { RoadToPatients } from "./road-to-patients";
import { ThatAndWhere } from "./that-and-where";

const CLASSIFICATION = challengePath("mammography-classification");
const SEGMENTATION = challengePath("mammography-segmentation");

const MYTWIN_PAGES = {
  patients: "https://mytwin.care/en/patients",
  aiMedicalImaging: "https://mytwin.care/en/blog/ai-medical-imaging",
  secondOpinion: "https://mytwin.care/en/blog/second-medical-opinion",
} as const;

const SOURCES = {
  who: "https://www.who.int/news-room/fact-sheets/detail/breast-cancer",
  whoInitiative: "https://www.who.int/initiatives/global-breast-cancer-initiative",
  iarcProjection: "https://www.iarc.who.int/news-events/breast-cancer-cases-and-deaths-are-projected-to-rise-globally",
  lancetCommission: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8444235/",
  rcr: "https://www.rcr.ac.uk/news-policy/workforce-censuses/2025-clinical-radiology-workforce-census-report/",
  masaiSafety: "https://doi.org/10.1016/S1470-2045(23)00298-X",
  masaiPerformance: "https://doi.org/10.1016/S2589-7500(24)00267-X",
  masaiInterval: "https://doi.org/10.1016/S0140-6736(25)02464-X",
  praim: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11922743/",
  rsnaChallenge: "https://doi.org/10.1148/radiol.241447",
  mdcg: "https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf",
  cbisDdsm: "https://www.cancerimagingarchive.net/collection/cbis-ddsm/",
  metrics: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11182665/",
} as const;

export const mammographyAiChallenges: NewsArticle = {
  slug: "mammography-ai-challenges",
  publishedAt: "2026-09-16",
  eventMonth: "2026-07",
  category: "challenge",
  readingMinutes: 7,
  title: "Two open challenges toward an AI second opinion on mammograms",
  overviewTitle: "Open-source AI for a second look at mammograms",
  seoTitle: "Mammography AI: two open challenges",
  description:
    "MyTwin Lab opens two mammography AI challenges, classification and segmentation, on open models and public data: a first step toward an AI second opinion.",
  excerpt:
    "In July 2026, MyTwin Lab opened two challenges on mammography: one to tell whether an image is suspicious, the other to show where. They are the first step of a long road, toward an AI second opinion within reach of every woman.",
  keywords: [
    "mammography AI challenge",
    "breast cancer screening AI",
    "mammogram second opinion",
    "open-source mammography model",
    "CBIS-DDSM",
    "MyTwin Lab",
  ],
  facts: [
    { label: "When", value: "July 2026" },
    { label: "Stage", value: "Open challenges, research" },
    { label: "Tasks", value: "Classification (AUC) and segmentation (Dice, IoU)" },
    { label: "Data", value: "Public datasets only, starting from CBIS-DDSM" },
    { label: "First contributors", value: "Alix and Hedi" },
    { label: "Next step", value: "Clinical validation" },
  ],
  intro: (
    <>
      <p>
        In July 2026, MyTwin Lab opened two machine-learning challenges on mammography. The first asks contributors to
        classify a mammogram as normal, benign or malignant; the second, to outline lesions at pixel level. Both require
        open-source models, trained exclusively on public data, with a pipeline anyone can reproduce.
      </p>
      <p>
        They serve a vision MyTwin has set itself: an AI second opinion on mammograms, free and simple to access through
        the MyTwin for Patients app, for every woman, including where radiologists are scarce. Nothing of the kind is
        available today, and the road to it is long. These two challenges are its first step.
      </p>
    </>
  ),
  sections: [
    {
      id: "two-challenges",
      title: "Classification says that, segmentation says where",
      content: (
        <>
          <p>
            In the words of their briefs, classification tells you <em>that</em> something is suspicious, segmentation
            tells you <em>where</em>.
          </p>
          <ul>
            <li>
              <NewsLink href={CLASSIFICATION}>Mammography Classification</NewsLink>: fine-tune an open-source model to
              classify mammograms as normal, benign or malignant, or by BI-RADS category, scored on the area under the ROC
              curve (AUC).
            </li>
            <li>
              <NewsLink href={SEGMENTATION}>Mammography Segmentation</NewsLink>: produce a mask of each lesion, scored on
              Dice and IoU, two{" "}
              <NewsLink href={SOURCES.metrics}>closely related measures of overlap</NewsLink> between the predicted mask
              and the reference.
            </li>
          </ul>
          <ThatAndWhere />
          <p>
            Both start from <NewsLink href={SOURCES.cbisDdsm}>CBIS-DDSM</NewsLink>, a curated public collection of
            mammography images with lesion annotations. Each expects the same four deliverables: a documented dataset, a
            model with its reported score, the training code, and the model packaged as a callable API. The goal is not a
            leaderboard trick but a reproducible building block for a clinical validation phase.
          </p>
          <p>Among the Lab’s contributors, Alix and Hedi were the first to take them on.</p>
        </>
      ),
    },
    {
      id: "why-mammography",
      title: "Why mammography",
      content: (
        <>
          <p>
            Breast cancer is the most common cancer in women in 164 of 186 countries. In 2024, an estimated 2.4 million
            women were diagnosed with it and 694,000 died of it, according to the{" "}
            <NewsLink href={SOURCES.who}>World Health Organization</NewsLink>. By 2050, the International Agency for
            Research on Cancer{" "}
            <NewsLink href={SOURCES.iarcProjection}>projects 3.2 million new cases and 1.1 million deaths a year</NewsLink>,
            weighing disproportionately on countries with a low Human Development Index.
          </p>
          <p>
            Survival depends on where a woman lives: five-year survival exceeds 90% in high-income countries, against 66%
            in India and 40% in South Africa, according to the{" "}
            <NewsLink href={SOURCES.whoInitiative}>WHO Global Breast Cancer Initiative</NewsLink>. So does access to the
            people who read the images. Low-income countries count around one to two radiologists per million people,
            against more than 90 in high-income countries, according to a{" "}
            <NewsLink href={SOURCES.lancetCommission}>Lancet Oncology Commission</NewsLink>. Even wealthy health systems
            fall short: the United Kingdom lacks{" "}
            <NewsLink href={SOURCES.rcr}>32% of the clinical radiology consultants it needs</NewsLink>.
          </p>
        </>
      ),
    },
    {
      id: "what-the-evidence-says",
      title: "What the evidence says about AI in screening",
      content: (
        <>
          <p>
            AI support for reading mammograms is one of the most closely studied uses of AI in medicine. In Sweden, the
            MASAI randomised trial found that AI-supported screening{" "}
            <NewsLink href={SOURCES.masaiPerformance}>
              detected more cancers without increasing false positives
            </NewsLink>
            , and{" "}
            <NewsLink href={SOURCES.masaiSafety}>reduced the radiologists’ screen-reading workload by 44%</NewsLink>. Its
            final analysis showed it was{" "}
            <NewsLink href={SOURCES.masaiInterval}>non-inferior on interval cancers</NewsLink>, those diagnosed between
            two screening rounds. In Germany, the PRAIM study, covering 463,094 women screened in routine practice, found
            a{" "}
            <NewsLink href={SOURCES.praim}>17.6% higher cancer detection rate</NewsLink> when radiologists used AI.
          </p>
          <p>
            Two things matter in these results. In each of them, radiologists still read the images: AI supports them, it
            does not replace them. And they were obtained with mature commercial systems. Open models have a long way to
            go: in the RSNA 2023 screening mammography challenge, the{" "}
            <NewsLink href={SOURCES.rsnaChallenge}>median sensitivity of 1,537 submitted algorithms was 27.6%</NewsLink>,
            and the best reached 48.6%.
          </p>
          <NewsCallout>
            <p>
              An open model trained on public data is a starting point, not a second opinion. Clinical validation is what
              turns one into the other.
            </p>
          </NewsCallout>
          <p>
            The conditions for trusting such a tool are well established: a defined task and population, external
            validation, human oversight, monitoring after deployment. Our article on{" "}
            <NewsLink href={MYTWIN_PAGES.aiMedicalImaging}>AI in medical imaging</NewsLink> details all five.
          </p>
        </>
      ),
    },
    {
      id: "the-vision",
      title: "The vision, and the road to it",
      content: (
        <>
          <p>
            MyTwin’s ambition is to make an AI second opinion on mammograms freely and easily accessible through{" "}
            <NewsLink href={MYTWIN_PAGES.patients}>MyTwin for Patients</NewsLink>: to every woman who wants one, and first
            to those living in medical deserts, far from a radiologist. A second opinion here means information for a woman
            and her doctor, never a diagnosis. Our guide to the{" "}
            <NewsLink href={MYTWIN_PAGES.secondOpinion}>second medical opinion</NewsLink> explains when and how one helps.
          </p>
          <p>
            Hospitals that read large volumes of mammograms are the other side of the model: the technology is meant to be
            offered to them under licence.
          </p>
          <p>The road there has steps that can’t be skipped:</p>
          <ol>
            <li>open challenges to build reproducible models, the stage we are at today;</li>
            <li>clinical validation on independent data;</li>
            <li>
              certification as a medical device: under European rules, software that supports a cancer diagnosis from
              images can{" "}
              <NewsLink href={SOURCES.mdcg}>fall into the highest risk class</NewsLink>;
            </li>
            <li>availability in MyTwin for Patients, and licences for hospitals.</li>
          </ol>
          <RoadToPatients />
          <p>Each of these steps will have its own news.</p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Can women use this AI second opinion today?",
      answer:
        "No. The challenges are research work on public data. No model from them is available to patients, and none will be before clinical validation and certification as a medical device.",
    },
    {
      question: "Why public data only?",
      answer:
        "So that anyone can reproduce and check the work, and because the Lab is not designed to handle patient data. Clinical validation, the next step, will require independent data under the rules that apply to it.",
    },
    {
      question: "Can I contribute?",
      answer:
        "Yes. Both challenges are open to Lab members: join from the challenge page, submit a dataset and a model, and earn contribution points.",
    },
  ],
  cta: {
    text: "Segmentation is the less explored of the two challenges. Bring your model.",
    label: "Join the segmentation challenge",
    href: SEGMENTATION,
  },
  sources: [
    { label: "World Health Organization, 2026, “Breast cancer” fact sheet.", url: SOURCES.who },
    {
      label:
        "International Agency for Research on Cancer, 2025, “Breast cancer cases and deaths are projected to rise globally”.",
      url: SOURCES.iarcProjection,
    },
    { label: "World Health Organization, “Global Breast Cancer Initiative”.", url: SOURCES.whoInitiative },
    {
      label: "Hricak H. et al., 2021, “Medical imaging and nuclear medicine: a Lancet Oncology Commission”, The Lancet Oncology.",
      url: SOURCES.lancetCommission,
    },
    { label: "The Royal College of Radiologists, 2026, “Clinical radiology workforce census 2025”.", url: SOURCES.rcr },
    {
      label:
        "Lång K. et al., 2023, “Artificial intelligence-supported screen reading versus standard double reading in the Mammography Screening with Artificial Intelligence trial (MASAI)”, The Lancet Oncology.",
      url: SOURCES.masaiSafety,
    },
    {
      label:
        "Hernström V. et al., 2025, “Screening performance and characteristics of breast cancer detected in the Mammography Screening with Artificial Intelligence trial (MASAI)”, The Lancet Digital Health.",
      url: SOURCES.masaiPerformance,
    },
    {
      label:
        "Gommers J. et al., 2026, “Interval cancer, sensitivity, and specificity comparing AI-supported mammography screening with standard double reading”, The Lancet.",
      url: SOURCES.masaiInterval,
    },
    {
      label:
        "Eisemann N. et al., 2025, “Nationwide real-world implementation of AI for cancer detection in population-based mammography screening”, Nature Medicine.",
      url: SOURCES.praim,
    },
    {
      label:
        "Chen Y. et al., 2025, “Performance of algorithms submitted in the 2023 RSNA Screening Mammography Breast Cancer Detection AI Challenge”, Radiology.",
      url: SOURCES.rsnaChallenge,
    },
    {
      label:
        "Medical Device Coordination Group, MDCG 2019-11 rev.1, 2025, “Qualification and classification of software”, European Commission.",
      url: SOURCES.mdcg,
    },
    { label: "The Cancer Imaging Archive, “CBIS-DDSM” collection.", url: SOURCES.cbisDdsm },
    {
      label: "Maier-Hein L. et al., 2024, “Metrics reloaded: recommendations for image analysis validation”, Nature Methods.",
      url: SOURCES.metrics,
    },
  ],
  mentions: [
    { type: "SoftwareApplication", name: "MyTwin for Patients", url: MYTWIN_PAGES.patients },
    { type: "Organization", name: "The Cancer Imaging Archive", url: "https://www.cancerimagingarchive.net" },
  ],
};
