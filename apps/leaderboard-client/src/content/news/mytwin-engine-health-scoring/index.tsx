import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { newsPath } from "@/lib/paths";
import type { NewsArticle } from "../types";
import { MyTwinEngineIllustration } from "./engine-illustration";
import { ReliabilityLevels } from "./reliability-levels";

const SOURCES = {
  phenoAge: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6312200/",
  qFracture: "https://pubmed.ncbi.nlm.nih.gov/22619194/",
  ctt: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2988224/",
  dpp: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1762038/",
} as const;

const LONGEVITY = newsPath("mytwin-longevity");
const PREDICTIVE_HEALTH = "https://mytwin.care/en/blog/predictive-health";
const MYTWIN = "https://mytwin.care/en";

export const mytwinEngineHealthScoring: NewsArticle = {
  slug: "mytwin-engine-health-scoring",
  publishedAt: "2026-10-03",
  eventMonth: "2026-06",
  category: "research",
  readingMinutes: 4,
  title: "MyTwin Engine: a first scoring engine built on published health models",
  overviewTitle: "Turning a check-up into scores that say how far they can be trusted",
  illustration: { kind: "visual", Visual: MyTwinEngineIllustration },
  seoTitle: "MyTwin Engine: a first health-scoring prototype",
  description:
    "In June 2026, MyTwin Lab prototyped the MyTwin Engine: scores built on published models, each labelled with how far it can be trusted.",
  excerpt:
    "In June 2026, MyTwin Lab built a first prototype of the MyTwin Engine, the layer of the digital twin that turns test results, wearable data and lifestyle into health scores, using published, scientifically validated models wherever they exist.",
  keywords: ["MyTwin Engine", "health scoring", "PhenoAge", "QFracture", "what-if health simulation", "MyTwin"],
  facts: [
    { label: "When", value: "June 2026" },
    {
      label: "Stage",
      value: "Research prototype, tested on fictional profiles",
    },
    { label: "Who", value: "MyTwin Lab" },
    {
      label: "What it computes",
      value: "Biological age, organ-system scores, risk projections, what-if simulations",
    },
    { label: "Next step", value: "MyTwin Longevity, launched in August 2026" },
  ],
  intro: (
    <>
      <NewsCallout label="Update">
        <p>
          August 2026: the engine now powers{" "}
          <NewsLink href={LONGEVITY}>MyTwin Longevity, an app built around biological age</NewsLink>.
        </p>
      </NewsCallout>
      <p>
        In June 2026, MyTwin Lab built a first prototype of the MyTwin Engine: the layer of the digital twin that turns
        a person’s data into health scores. Test results, wearable data and lifestyle habits go in; a biological age,
        scores for the main organ systems, risk projections and what-if simulations come out.
      </p>
      <p>
        The principle is simple: wherever a scientifically validated model exists, the engine uses it rather than
        inventing its own. And every score says how far it can be trusted. The prototype was tested on fictional
        profiles only, with no patient data.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-it-computes",
      title: "What the engine computes",
      content: (
        <>
          <p>
            <strong>Biological age.</strong> From a routine blood test, the engine computes Phenotypic Age, or{" "}
            <NewsLink href={SOURCES.phenoAge}>PhenoAge</NewsLink>: a measure that combines chronological age with nine
            common biomarkers, such as albumin, glucose, creatinine and C-reactive protein. In the original study, on US
            population data, each additional year of Phenotypic Age was associated with a 9% higher risk of death,
            independently of chronological age.
          </p>
          <p>
            <strong>Organ-system scores.</strong> A view of the main systems of the body (cardiovascular, respiratory,
            musculoskeletal), each built on the markers and clinical criteria that medicine already uses for it.
          </p>
          <p>
            <strong>Risk projections.</strong> How a risk may evolve over the coming years. Fracture risk, for instance,
            relies on <NewsLink href={SOURCES.qFracture}>QFracture</NewsLink>, a model derived and validated on several
            million patients in UK primary care.
          </p>
          <p>
            <strong>What-if simulations.</strong> What would change under a concrete decision: losing weight, starting a
            treatment, changing one’s lifestyle (see below).
          </p>
          <p>
            A score is an estimate, not a forecast: our article on{" "}
            <NewsLink href={PREDICTIVE_HEALTH}>what a risk score really means</NewsLink> explains the difference. None
            of these scores is a diagnosis; they are meant to be read with a doctor.
          </p>
        </>
      ),
    },
    {
      id: "reliability",
      title: "A reliability level on every score",
      content: (
        <>
          <p>
            Health scores rarely say how much they can be trusted. The engine does, for each of them, with one of four
            levels: a clinically validated model used as published; an estimate grounded in validated literature; a
            composite index of our own, not clinically validated; or no score at all, when the data or the evidence
            isn’t there yet.
          </p>
          <ReliabilityLevels />
          <p>
            The last level matters as much as the first. Rather than guess, the engine leaves a domain empty: there is
            no composite cancer score, for instance, until screening data can support one.
          </p>
          <NewsCallout>
            <p>A score that says how far it can be trusted is worth more than a precise-looking number.</p>
          </NewsCallout>
        </>
      ),
    },
    {
      id: "what-if",
      title: "What-if: simulating a change before making it",
      content: (
        <>
          <p>
            A simulation changes the person’s own biomarkers the way an intervention would, then runs them back through
            the same models. The result depends on where the person starts: lowering a high cholesterol level moves the
            projection more than lowering one that is already low.
          </p>
          <p>
            The size of each effect comes from published trials. For a statin, cardiovascular risk is lowered using the
            effect measured by the{" "}
            <NewsLink href={SOURCES.ctt}>Cholesterol Treatment Trialists’ meta-analysis</NewsLink> (a 22% lower rate of
            major vascular events per 1 mmol/L of LDL cholesterol lowered). For weight loss, diabetes risk follows the{" "}
            <NewsLink href={SOURCES.dpp}>Diabetes Prevention Program</NewsLink>, where each kilogram lost was associated
            with a 16% lower risk.
          </p>
          <p>
            These are evidence-based projections, not promises. They use trial averages, not yet the person’s own
            response: a statin may lower one person’s cholesterol more than another’s. Repeated tests over time are what
            will close that gap.
          </p>
        </>
      ),
    },
    {
      id: "next",
      title: "From prototype to MyTwin Longevity",
      content: (
        <>
          <p>
            The prototype ran on a handful of fictional profiles, from a very active 52-year-old executive to a
            67-year-old with high blood pressure, to check that the scores, their reliability levels and the simulations
            held together. It made no claim about real patients, and none is made here.
          </p>
          <p>
            Two months later, the engine went into a product: <NewsLink href={LONGEVITY}>MyTwin Longevity</NewsLink>,
            where biological age, organ-system scores, risk projections and what-if simulations are read with a doctor
            specialised in prevention and longevity. More models will be added as the data and the evidence allow.
          </p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Was the MyTwin Engine tested on real patients?",
      answer:
        "No. The June 2026 prototype was tested on fictional profiles only, with no patient data. It checked that the scores, their reliability levels and the simulations held together; it makes no claim about clinical performance.",
    },
    {
      question: "Does a score from the engine replace a diagnosis?",
      answer:
        "No. Each score is an estimate built on a published model, with its reliability level shown next to it. It is meant to be read with a doctor, never instead of one.",
    },
  ],
  cta: {
    text: "The MyTwin Engine is part of MyTwin, the health digital twin.",
    label: "Discover MyTwin",
    href: MYTWIN,
  },
  sources: [
    {
      label:
        "Liu Z. et al., A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV, PLOS Medicine, 2018",
      url: SOURCES.phenoAge,
    },
    {
      label:
        "Hippisley-Cox J., Coupland C., Derivation and validation of updated QFracture algorithm to predict risk of osteoporotic fracture in primary care in the United Kingdom, BMJ, 2012",
      url: SOURCES.qFracture,
    },
    {
      label:
        "Cholesterol Treatment Trialists’ Collaboration, Efficacy and safety of more intensive lowering of LDL cholesterol, The Lancet, 2010",
      url: SOURCES.ctt,
    },
    {
      label:
        "Hamman R. F. et al., Effect of weight loss with lifestyle intervention on risk of diabetes, Diabetes Care, 2006",
      url: SOURCES.dpp,
    },
  ],
  mentions: [
    { type: "SoftwareApplication", name: "MyTwin Engine" },
    { type: "SoftwareApplication", name: "MyTwin Longevity" },
  ],
};
