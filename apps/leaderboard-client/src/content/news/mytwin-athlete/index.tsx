import { NewsLink } from "@/components/news/NewsLink";
import { newsPath } from "@/lib/paths";
import type { NewsArticle } from "../types";
import { MyTwinAthleteAppIllustration } from "./app-illustration";

const PROTOTYPE = newsPath("racket-sports-injury-risk");
const MYTWIN = "https://mytwin.care/en";

export const mytwinAthlete: NewsArticle = {
  slug: "mytwin-athlete",
  publishedAt: "2026-09-26",
  eventMonth: "2026-09",
  category: "product",
  readingMinutes: 3,
  title: "MyTwin Athlete: predicting injury risk before it happens",
  overviewTitle: "MyTwin Athlete: a Vigilance Score for tennis players",
  illustration: { kind: "visual", Visual: MyTwinAthleteAppIllustration },
  seoTitle: "MyTwin Athlete: injury risk for tennis players",
  description:
    "MyTwin Athlete, a new MyTwin app for professional tennis players, turns workload, match exposure and history into a continuously updated Vigilance Score.",
  excerpt:
    "MyTwin Lab announces the launch of MyTwin Athlete, a new application of the MyTwin digital twin designed to help professional tennis players better anticipate injury risk.",
  keywords: [
    "MyTwin Athlete",
    "tennis injury risk",
    "Vigilance Score",
    "sports injury prevention",
    "athlete workload management",
    "MyTwin",
  ],
  facts: [
    { label: "When", value: "September 2026" },
    { label: "Stage", value: "Launch; testing and validation with athletes and performance teams continue" },
    { label: "Who", value: "MyTwin Lab, for professional tennis players and their staff" },
    {
      label: "Data",
      value: "More than 6,000 tennis players and approximately 180,000 matches over the past ten years",
    },
    {
      label: "Internal result",
      value: "Up to 80% of injuries occurring within the following 14 days identified, in retrospective testing",
    },
    { label: "Next step", value: "Independent prospective validation" },
  ],
  intro: (
    <>
      <p>
        MyTwin Lab announces the launch of MyTwin Athlete, a new application of the MyTwin digital twin designed to help
        professional tennis players better anticipate injury risk. It builds on the{" "}
        <NewsLink href={PROTOTYPE}>injury-risk prototype built in August 2025</NewsLink>.
      </p>
      <p>
        The objective is simple: move from reacting to an injury after it occurs to identifying periods of increased
        physical vulnerability before the injury happens.
      </p>
      <p>
        MyTwin Athlete uses an algorithm developed from a dataset covering more than 6,000 tennis players and
        approximately 180,000 matches over the past ten years. By analysing the evolution of an athlete’s workload, match
        exposure and individual history, the model generates a continuously updated Vigilance Score.
      </p>
      <p>
        In retrospective testing performed during development, the model was able to identify up to 80% of injuries
        occurring within the following 14 days, according to MyTwin’s internal evaluation data.
      </p>
      <p>
        This percentage should not be presented as an overall 80% prediction accuracy: it describes the proportion of
        subsequent injuries identified by the model under the conditions of the internal evaluation. Independent
        prospective validation will be necessary to establish its performance in real-world use.
      </p>
    </>
  ),
  sections: [
    {
      id: "actionable-signal",
      title: "From data to an actionable signal",
      content: (
        <>
          <p>
            Rather than predicting with certainty whether an athlete will be injured, MyTwin Athlete estimates how
            closely the athlete’s current situation resembles patterns historically associated with injury.
          </p>
          <p>
            The result is translated into a simple vigilance indicator that can evolve as new information becomes
            available.
          </p>
          <p>
            For the athlete and their staff, the purpose is not to replace medical or coaching decisions, but to provide
            an additional signal to support workload management, recovery and prevention strategies.
          </p>
          <p>
            The next step for MyTwin Lab is to continue testing and validating the model with athletes and performance
            teams, while progressively integrating additional physiological and contextual data into each athlete’s
            digital twin.
          </p>
          <p>
            MyTwin Athlete is one more step toward MyTwin Lab’s broader objective: building a continuously evolving
            digital representation of human health, capable not only of describing what is happening today, but of
            helping anticipate what could happen next.
          </p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Does a high Vigilance Score mean a player will get injured?",
      answer:
        "No. The Vigilance Score estimates how closely an athlete's current situation resembles patterns historically associated with injury. It is an additional signal for workload management and recovery, not a certainty, and it does not replace medical or coaching decisions.",
    },
    {
      question: "What does the 80% figure measure?",
      answer:
        "The proportion of injuries occurring within the following 14 days that the model identified, in retrospective testing on MyTwin's internal evaluation data. It is not an overall prediction accuracy: independent prospective validation will be necessary to establish its performance in real-world use.",
    },
  ],
  cta: {
    text: "MyTwin Athlete is part of MyTwin’s digital twin of human health.",
    label: "Discover MyTwin",
    href: MYTWIN,
  },
  sources: [],
  mentions: [{ type: "SoftwareApplication", name: "MyTwin Athlete" }],
};
