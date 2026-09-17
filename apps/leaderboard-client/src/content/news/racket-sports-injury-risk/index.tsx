import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import type { NewsArticle } from "../types";
import { BenchmarkScope } from "./benchmark-scope";

const SOURCES = {
  bahr: "https://pubmed.ncbi.nlm.nih.gov/27095747/",
  bullock: "https://pubmed.ncbi.nlm.nih.gov/35689749/",
  rossi: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6059460/",
  pluim: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2577485/",
  fu: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5825333/",
  padelReport: "https://www.padelfip.com/world-padel-report-2025/",
  padelInjuries: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10277135/",
  pickleballReport:
    "https://sfia.org/resources/sfia-releases-2026-pickleball-single-sport-report-team-sports-reports-to-follow/",
  pickleballInjuries: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11758564/",
  gouttebarge: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6579497/",
  ioc: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13479675/",
} as const;

const VIRTUOSIS = "https://virtuosis.ai";
const PREDICTIVE_HEALTH = "https://mytwin.care/en/blog/predictive-health";
const JOSHUA_STORY = "https://mytwin.care/en/stories/joshua-sports-injury";

export const racketSportsInjuryRisk: NewsArticle = {
  slug: "racket-sports-injury-risk",
  publishedAt: "2026-09-16",
  eventMonth: "2025-08",
  category: "research",
  readingMinutes: 5,
  title: "MyTwin builds a first injury-risk prototype for tennis, padel and pickleball",
  seoTitle: "Racket sports injury risk: a MyTwin prototype",
  description:
    "MyTwin's first prototype flags injury risk in tennis, padel and pickleball players. What the early internal benchmark shows, and what comes next.",
  excerpt:
    "In August 2025, MyTwin built a first model that flags the risk of injury in racket-sport players from their digital twin. Early internal tests on professional tennis data are encouraging. They are also incomplete, and here is exactly why.",
  keywords: [
    "tennis injury prediction",
    "padel injuries",
    "pickleball injuries",
    "sports injury risk",
    "MyTwin",
    "athlete digital twin",
  ],
  facts: [
    { label: "When", value: "August 2025" },
    { label: "Stage", value: "Prototype, internal benchmark" },
    { label: "Sports", value: "Tennis, padel and pickleball" },
    {
      label: "Benchmark data",
      value: "Historical professional tennis data: about 180,000 matches, 6,800 players, injuries reported in the press",
    },
    { label: "First result", value: "More than 80% of injuries flagged within 14 days (sensitivity only)" },
    { label: "Next step", value: "A scientific study, told in its own news" },
  ],
  intro: (
    <>
      <p>
        In August 2025, MyTwin built a first prototype of an injury-risk model for racket sports. Built into the
        athlete’s digital twin, it estimates whether a player is at higher risk of injury over the next 14 days. The
        aim is to give players and their staff a signal early enough to adapt training and recovery.
      </p>
      <p>
        The first tests, run internally on historical data from professional tennis, are encouraging: the prototype
        flagged more than 80% of the injuries that occurred in the following 14 days. That figure tells only half of the
        story, and we would rather say so upfront. False alarms have not been measured yet, and the results have not been
        independently validated. A scientific study comes next, and it will have its own news.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-it-does",
      title: "An injury-risk signal inside the athlete’s twin",
      content: (
        <>
          <p>
            The prototype works on the player’s data in their MyTwin twin, not on a one-off test: training load,
            recovery, physiological indicators and history. It returns an estimated risk for the next 14 days,
            meant to be read by the player and their staff alongside everything else they know.
          </p>
          <p>
            <NewsLink href={JOSHUA_STORY}>Joshua’s story</NewsLink> shows the doubt it is meant to address. An amateur
            competitive tennis player, drained before an important tournament, he had no clear way to decide whether to
            push through or ease off.
          </p>
          <p>
            An estimated risk is not a forecast of what will happen. Our article on{" "}
            <NewsLink href={PREDICTIVE_HEALTH}>what a risk score really means</NewsLink> explains the difference. The
            prototype is a decision aid for training and recovery, not a diagnosis: an injury, or the pain that
            announces one, remains a matter for a doctor or a physiotherapist.
          </p>
        </>
      ),
    },
    {
      id: "first-benchmark",
      title: "What the first benchmark shows, and what it doesn’t",
      content: (
        <>
          <p>
            We tested the prototype on historical professional tennis data: about 180,000 matches involving some 6,800
            players. The injuries it had to anticipate were those reported in the press. On that data, it flagged more
            than 80% of them within the following 14 days.
          </p>
          <p>
            Press reports are a practical reference at that scale, and an imperfect one: they capture the injuries of
            professional players that become public, and miss those that don’t. The study will have to work from more
            complete injury records.
          </p>
          <p>
            In statistical terms, that is <strong>sensitivity</strong>: the share of real injuries the model caught. On
            its own, it is not enough. A model that raised an alert for every player, every fortnight, would catch every
            injury and be useless. What matters just as much is <strong>precision</strong>: how many alerts turn out to
            be real injuries. We have not measured it yet.
          </p>
          <BenchmarkScope />
          <p>
            Published research explains the caution. A study on professional football players found a model that
            detected{" "}
            <NewsLink href={SOURCES.rossi}>around 80% of injuries with about 50% precision</NewsLink>: one alert in two was
            a false alarm. A{" "}
            <NewsLink href={SOURCES.bullock}>systematic review of 204 injury-prediction models in sport</NewsLink> found
            that none had been externally validated, and could recommend none for use in practice. And screening tests
            have long struggled to predict injuries, because{" "}
            <NewsLink href={SOURCES.bahr}>at-risk and not-at-risk players overlap so much</NewsLink>.
          </p>
          <NewsCallout>
            <p>Catching injuries only helps if the alerts can be trusted. That is what the study has to show.</p>
          </NewsCallout>
        </>
      ),
    },
    {
      id: "why-racket-sports",
      title: "Why tennis, padel and pickleball",
      content: (
        <>
          <p>
            In tennis, most injuries affect the lower limbs, according to a{" "}
            <NewsLink href={SOURCES.pluim}>review in the British Journal of Sports Medicine</NewsLink>. Acute
            injuries tend to hit the legs, while{" "}
            <NewsLink href={SOURCES.fu}>overuse injuries more often affect the upper limbs and trunk</NewsLink>: the kind
            of damage that builds up over weeks, which is where an early signal can matter.
          </p>
          <p>
            Padel is growing fast, with more than 35 million players according to the{" "}
            <NewsLink href={SOURCES.padelReport}>International Padel Federation</NewsLink>. Research on its injuries is
            still thin: a{" "}
            <NewsLink href={SOURCES.padelInjuries}>2023 systematic review</NewsLink> found the elbow to be the most common
            injury site, based on limited literature.
          </p>
          <p>
            Pickleball counted{" "}
            <NewsLink href={SOURCES.pickleballReport}>24.3 million players in the United States in 2025</NewsLink>, up
            from 4.2 million in 2020. A{" "}
            <NewsLink href={SOURCES.pickleballInjuries}>ten-year study of US emergency departments</NewsLink> found that
            injured players had a mean age of 64, that most injuries came from falls, and that the wrist was the most
            injured body part.
          </p>
          <p>
            Three sports, three very different populations: professional players, fast-growing recreational communities
            and older adults. So far, the benchmark covers professional tennis only.
          </p>
        </>
      ),
    },
    {
      id: "body-and-mind",
      title: "Body and mind in the same twin",
      content: (
        <>
          <p>
            Physical load is only part of an athlete’s picture. A{" "}
            <NewsLink href={SOURCES.gouttebarge}>meta-analysis in elite sport</NewsLink> found symptoms of anxiety or
            depression in 34% of current elite athletes, and the International Olympic Committee now{" "}
            <NewsLink href={SOURCES.ioc}>recommends routine screening and monitoring of mental health</NewsLink> with
            validated instruments.
          </p>
          <p>
            That is why the same twin can also carry voice analysis from our partner{" "}
            <NewsLink href={VIRTUOSIS}>Virtuosis AI</NewsLink>, in pilot in MyTwin’s private beta: signals associated with
            stress, anxiety and low mood, read alongside physical data. Like the injury-risk signal, it is information to
            act on with a professional, not a diagnosis.
          </p>
        </>
      ),
    },
    {
      id: "whats-next",
      title: "What comes next",
      content: (
        <>
          <p>The scientific study will take the prototype where the first benchmark could not:</p>
          <ul>
            <li>measure false alarms as carefully as missed injuries;</li>
            <li>rely on more complete injury records than press reports;</li>
            <li>test the model on data it has never seen;</li>
            <li>have the method and results reviewed by the scientific community.</li>
          </ul>
          <p>
            Padel and pickleball, whose players and injuries differ from professional tennis, will need their own data.
            Each of these steps will be told here, as its own news.
          </p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Can players use the model today?",
      answer:
        "No. It is a prototype tested internally on historical data. It is not available to players or staff at this stage.",
    },
    {
      question: "Does an alert mean a player will get injured?",
      answer:
        "No. An alert means a higher estimated risk over the next 14 days, not a certainty. And since false alarms have not been measured yet, the prototype's alerts cannot be interpreted on their own.",
    },
  ],
  cta: {
    text: "Sports health is one of the fields the Lab works on. Have an idea to take it further?",
    label: "Propose a project in the Sandbox",
    href: "/sandbox",
  },
  sources: [
    {
      label: "Rossi A. et al., 2018, “Effective injury forecasting in soccer with GPS training data and machine learning”, PLoS One.",
      url: SOURCES.rossi,
    },
    {
      label:
        "Bullock G.S. et al., 2022, “Just how confident can we be in predicting sports injuries? A systematic review of the methodological conduct and performance of existing musculoskeletal injury prediction models in sport”, Sports Medicine.",
      url: SOURCES.bullock,
    },
    {
      label:
        "Bahr R., 2016, “Why screening tests to predict injury do not work—and probably never will…: a critical review”, British Journal of Sports Medicine.",
      url: SOURCES.bahr,
    },
    {
      label: "Pluim B.M. et al., 2006, “Tennis injuries: occurrence, aetiology, and prevention”, British Journal of Sports Medicine.",
      url: SOURCES.pluim,
    },
    {
      label: "Fu M.C. et al., 2018, “Epidemiology of injuries in tennis players”, Current Reviews in Musculoskeletal Medicine.",
      url: SOURCES.fu,
    },
    { label: "International Padel Federation (FIP), 2025, “World Padel Report 2025”.", url: SOURCES.padelReport },
    {
      label:
        "Dahmen J. et al., 2023, “Incidence, prevalence and nature of injuries in padel: a systematic review”, BMJ Open Sport & Exercise Medicine.",
      url: SOURCES.padelInjuries,
    },
    {
      label: "Sports & Fitness Industry Association (SFIA), 2026, “Pickleball Single Sport Report”.",
      url: SOURCES.pickleballReport,
    },
    {
      label:
        "Yu et al., 2025, “Increasing incidence of pickleball injuries presenting to US emergency departments: a 10-year epidemiological analysis”, Orthopaedic Journal of Sports Medicine.",
      url: SOURCES.pickleballInjuries,
    },
    {
      label:
        "Gouttebarge V. et al., 2019, “Occurrence of mental health symptoms and disorders in current and former elite athletes: a systematic review and meta-analysis”, British Journal of Sports Medicine.",
      url: SOURCES.gouttebarge,
    },
    {
      label:
        "Reardon C.L. et al., 2026, “Mental health in elite athletes: International Olympic Committee consensus statement (2026)”, British Journal of Sports Medicine.",
      url: SOURCES.ioc,
    },
  ],
  mentions: [{ type: "Organization", name: "Virtuosis AI", url: VIRTUOSIS }],
};
