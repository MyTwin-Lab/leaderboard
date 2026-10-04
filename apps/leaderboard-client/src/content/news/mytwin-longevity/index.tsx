import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { newsPath } from "@/lib/paths";
import type { NewsArticle } from "../types";
import { MyTwinLongevityAppIllustration } from "./app-illustration";
import { LongevityJourney } from "./longevity-journey";

const SOURCES = {
  who: "https://www.who.int/news/item/24-05-2024-covid-19-eliminated-a-decade-of-progress-in-global-level-of-life-expectancy",
  phenoAge: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6312200/",
  qFracture: "https://pubmed.ncbi.nlm.nih.gov/22619194/",
} as const;

const ENGINE = newsPath("mytwin-engine-health-scoring");
const ATHLETE = newsPath("mytwin-athlete");
const HEALTH_CHECKUP = "https://mytwin.care/en/blog/preventive-health-checkup";
const HEALTHSPAN = "https://mytwin.care/en/blog/healthy-longevity";
const BIOLOGICAL_AGE = "https://mytwin.care/en/blog/biological-age";
const MYTWIN = "https://mytwin.care/en";

export const mytwinLongevity: NewsArticle = {
  slug: "mytwin-longevity",
  publishedAt: "2026-10-03",
  eventMonth: "2026-08",
  category: "product",
  readingMinutes: 4,
  title: "MyTwin Longevity: from biological age to a personal longevity plan",
  overviewTitle: "MyTwin Longevity: know your biological age, then act on it with a doctor",
  illustration: { kind: "visual", Visual: MyTwinLongevityAppIllustration },
  seoTitle: "MyTwin Longevity: a new app for healthy ageing",
  description:
    "MyTwin Longevity, a new MyTwin app, estimates biological age from a blood check-up, projects health risks and connects you with a longevity doctor.",
  excerpt:
    "MyTwin Lab announces the launch of MyTwin Longevity, a new application of the MyTwin digital twin designed to help people add years in good health: biological age, organ-system scores, risk projections and a doctor specialised in prevention and longevity.",
  keywords: ["MyTwin Longevity", "longevity app", "PhenoAge", "healthy ageing", "longevity doctor", "MyTwin"],
  facts: [
    { label: "When", value: "August 2026" },
    { label: "Stage", value: "Launch; more scores will be added over time" },
    {
      label: "Who",
      value: "MyTwin Lab, with a network of partner doctors specialised in prevention and longevity",
    },
    {
      label: "What it shows",
      value: "Biological age (PhenoAge), organ-system scores, risk projections, what-if simulations",
    },
    { label: "Built on", value: "The MyTwin Engine, prototyped in June 2026" },
  ],
  intro: (
    <>
      <p>
        MyTwin Lab announces the launch of MyTwin Longevity, a new application of the MyTwin digital twin, in August
        2026. It builds on the{" "}
        <NewsLink href={ENGINE}>MyTwin Engine, the scoring engine prototyped in June 2026</NewsLink>, and follows{" "}
        <NewsLink href={ATHLETE}>MyTwin Athlete</NewsLink> as the second app built on the twin.
      </p>
      <p>
        The objective: help people add years in good health, not only years. Starting from a blood check-up, the app
        estimates a biological age, maps the main organ systems and projects how risks may evolve. A doctor specialised
        in prevention and longevity then reads the results with the person and turns them into a plan.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-longevity",
      title: "Years in good health, not only years",
      content: (
        <>
          <p>
            According to the <NewsLink href={SOURCES.who}>World Health Organization</NewsLink>, global life expectancy
            was 71.4 years in 2021, and healthy life expectancy 61.9 years: close to ten years lived, on average, in
            less than full health. That gap is what longevity medicine works on, and what MyTwin Longevity is designed
            for.
          </p>
          <p>
            The idea is to look early, while there is still room to act: measure where the body stands today, see which
            levers matter most for this person, and follow how things change over time. Our article on{" "}
            <NewsLink href={HEALTHSPAN}>healthspan</NewsLink> sorts what science really knows about living longer in
            good health.
          </p>
        </>
      ),
    },
    {
      id: "journey",
      title: "A four-step journey",
      content: (
        <>
          <p>
            The app lays the journey out in four steps. It starts with a health check-up: the blood biomarkers feed the
            twin, and the biological age appears once the check-up is done. Our article on the{" "}
            <NewsLink href={HEALTH_CHECKUP}>preventive health check-up</NewsLink> explains what such a check-up covers.
          </p>
          <LongevityJourney />
          <p>
            The second step is a consultation of at least 30 minutes with a doctor specialised in prevention and
            longevity, from MyTwin’s network of partner doctors. The results are not left for the person to interpret
            alone: they are read with a doctor, who helps build the personal plan of the third step. New tests then
            update the twin, and the journey starts again.
          </p>
          <NewsCallout>
            <p>Every score in MyTwin Longevity is read with a doctor, never instead of one.</p>
          </NewsCallout>
        </>
      ),
    },
    {
      id: "biological-age",
      title: "Biological age, from a routine blood test",
      content: (
        <>
          <p>
            MyTwin Longevity computes biological age with Phenotypic Age, or{" "}
            <NewsLink href={SOURCES.phenoAge}>PhenoAge</NewsLink>, a measure published in 2018. It combines
            chronological age with nine biomarkers found in a routine blood test, among them albumin, glucose,
            creatinine and C-reactive protein. In the original study, each additional year of Phenotypic Age was
            associated with a 9% higher risk of death, independently of chronological age, including among people who
            reported no disease.
          </p>
          <p>
            A biological age is a signal, not a diagnosis. A single measurement is a snapshot; its value grows with
            repeated tests, which turn one number into a trajectory. That is why the journey loops back. Our article on{" "}
            <NewsLink href={BIOLOGICAL_AGE}>biological age</NewsLink> explains what the tests really measure, and what
            they don’t.
          </p>
        </>
      ),
    },
    {
      id: "beyond-one-number",
      title: "Beyond one number",
      content: (
        <>
          <p>Biological age is the entry point. Around it, the app brings three more views from the MyTwin Engine:</p>
          <ul>
            <li>
              <strong>Organ-system scores</strong> for the main systems of the body, such as cardiovascular, respiratory
              and musculoskeletal health.
            </li>
            <li>
              <strong>Risk projections</strong>: how a risk may evolve over the coming years, using validated models
              wherever they exist, such as <NewsLink href={SOURCES.qFracture}>QFracture</NewsLink> for fracture risk.
            </li>
            <li>
              <strong>What-if simulations</strong>: what would change under a concrete decision, such as losing weight
              or changing one’s lifestyle, projected from the effects measured in published trials.
            </li>
          </ul>
          <p>
            Each score carries the reliability level the engine gives it, from a clinically validated model to a
            composite index of our own. Not every domain has a score yet: more will be added as the data and the
            evidence allow.
          </p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Does MyTwin Longevity replace my doctor?",
      answer:
        "No. The app estimates and projects; it does not diagnose. Its results are read during a consultation with a doctor specialised in prevention and longevity, and they don't replace your own doctor's follow-up.",
    },
    {
      question: "When does my biological age appear?",
      answer:
        "Once the first step, the health check-up, is done: biological age is computed from blood biomarkers with PhenoAge. Before that, the app shows where it will appear.",
    },
    {
      question: "Who are the longevity doctors?",
      answer:
        "Doctors specialised in prevention and longevity, from MyTwin's network of partner doctors. The consultation lasts at least 30 minutes.",
    },
  ],
  cta: {
    text: "MyTwin Longevity is part of MyTwin, the health digital twin.",
    label: "Discover MyTwin",
    href: MYTWIN,
  },
  sources: [
    {
      label:
        "World Health Organization, COVID-19 eliminated a decade of progress in global level of life expectancy, 2024",
      url: SOURCES.who,
    },
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
  ],
  mentions: [
    { type: "SoftwareApplication", name: "MyTwin Longevity" },
    { type: "SoftwareApplication", name: "MyTwin Engine" },
  ],
};
