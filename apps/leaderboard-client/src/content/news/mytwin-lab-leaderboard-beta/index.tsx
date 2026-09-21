import { NewsLink } from "@/components/news/NewsLink";
import { newsPath } from "@/lib/paths";
import { MYTWIN } from "@/lib/seo";
import type { NewsArticle } from "../types";
import { ContributionLoop } from "./contribution-loop";
import { TopContributorsIllustration } from "./top-contributors";

const GITHUB = "https://github.com/MyTwin-Lab";

export const mytwinLabLeaderboardBeta: NewsArticle = {
  slug: "mytwin-lab-leaderboard-beta",
  publishedAt: "2026-09-16",
  eventMonth: "2026-08",
  category: "community",
  readingMinutes: 4,
  title: "The MyTwin Lab Leaderboard: from a first prototype to a public beta",
  overviewTitle: "Every contribution tracked, evaluated and rewarded",
  illustration: { kind: "visual", Visual: TopContributorsIllustration },
  seoTitle: "MyTwin Lab Leaderboard: from prototype to beta",
  description:
    "Prototyped in June 2025, the MyTwin Lab Leaderboard opened in public beta in August 2026: health challenges, evaluated work and contribution points.",
  excerpt:
    "In June 2025, a first prototype set out to answer one question: how do you fairly credit everyone who helps build health technology in the open? In August 2026, the MyTwin Lab Leaderboard opened in public beta.",
  keywords: [
    "MyTwin Lab Leaderboard",
    "MyTwin Lab",
    "open health innovation",
    "health AI challenges",
    "contribution points",
    "Sandbox",
  ],
  facts: [
    { label: "First prototype", value: "June 2025" },
    { label: "Public beta", value: "August 2026" },
    { label: "Ways to contribute", value: "Code, machine-learning and validation challenges, Sandbox projects" },
    { label: "Rewards", value: "Contribution points (CP), with no monetary value" },
    { label: "Where", value: "mytwinlab.care" },
  ],
  intro: (
    <>
      <p>
        Health innovation rarely lacks ideas. It stalls between the idea and something that works, and the work of the
        people who close that gap, engineers, clinicians, researchers, students, is hard to recognise fairly when it
        happens in the open. In June 2025, MyTwin built a first prototype of a leaderboard to change that: track each
        contribution, evaluate it, reward it.
      </p>
      <p>
        In August 2026, the MyTwin Lab Leaderboard opened in public beta. Anyone can take on a health challenge, propose
        their own project in the Sandbox, and see their work evaluated and credited in contribution points (CP).
      </p>
    </>
  ),
  sections: [
    {
      id: "why-a-leaderboard",
      title: "Why a leaderboard for health innovation",
      content: (
        <>
          <p>
            MyTwin Lab is the open innovation lab of <NewsLink href={MYTWIN.home}>MyTwin</NewsLink>, where health
            challenges become working applications. Open work only holds together if contributions are visible and judged
            on the same terms. The leaderboard is that common ground: the same rules, published in advance, whether the
            contribution is a model trained on a public dataset, a pull request or a clinician’s verdict on a deliverable.
          </p>
          <p>
            It is also what lets profiles that rarely meet work side by side. <NewsLink href="/about">About MyTwin Lab</NewsLink>{" "}
            tells the full picture.
          </p>
        </>
      ),
    },
    {
      id: "how-contributions-count",
      title: "How a contribution becomes CP",
      content: (
        <>
          <p>
            Work is organised around <NewsLink href="/challenges">challenges</NewsLink>, each built around a concrete health
            need, with a brief, expected deliverables, a pool of contribution points and published evaluation criteria.
            There are three kinds:
          </p>
          <ul>
            <li>code challenges, where the work lives in a dedicated repository;</li>
            <li>machine-learning challenges, where datasets and models are scored on the metric the challenge defines;</li>
            <li>validation challenges, where medical professionals check that a deliverable actually works.</li>
          </ul>
          <p>
            Code and datasets are evaluated by AI agents against the challenge’s evaluation grid, and the result is
            converted into contribution points. Contributors can always ask for a human review. Machine-learning
            contributors can request temporary GPU instances for their training runs.
          </p>
          <p>
            CP have no monetary value and give no right to payment. They make each person’s contribution visible, in the{" "}
            <NewsLink href="/leaderboard">leaderboard</NewsLink>.
          </p>
          <ContributionLoop />
        </>
      ),
    },
    {
      id: "the-sandbox",
      title: "The Sandbox: propose what you want built",
      content: (
        <>
          <p>
            Not every good idea starts as an official challenge. In the <NewsLink href="/sandbox">Sandbox</NewsLink>, anyone
            can launch a health project without approval, explain why it matters and connect a repository. The community
            stars the projects it wants built, star milestones earn contribution points, and the most supported projects
            can be promoted into official challenges.
          </p>
          <p>
            <NewsLink href={newsPath("mykine")}>MyKine</NewsLink>, guided physiotherapy sessions measured by the phone camera, is
            one of them.
          </p>
        </>
      ),
    },
    {
      id: "what-beta-means",
      title: "What “beta” means",
      content: (
        <>
          <p>
            The beta is the Lab running for real: challenges open, contributions evaluated, points credited. It is also
            still being built, in the open. The platform itself was developed as a series of challenges, and its
            evaluation grids are refined as challenges run. The code of the Lab’s projects lives in the{" "}
            <NewsLink href={GITHUB}>MyTwin-Lab GitHub organization</NewsLink>.
          </p>
          <p>Every step from here will be told in MyTwin Lab News.</p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Who can take part?",
      answer:
        "Anyone aged 18 or over, signing in with a Google account. Challenges rely on public, anonymised or synthetic data: the Lab is not designed to handle health data.",
    },
    {
      question: "Are contribution points worth money?",
      answer:
        "No. Contribution points have no monetary value and give no right to payment. They measure each person's contribution and make it visible.",
    },
  ],
  cta: {
    text: "Pick a health challenge and make your first contribution count.",
    label: "Explore the challenges",
    href: "/challenges",
  },
  sources: [],
  mentions: [{ type: "Organization", name: "MyTwin", url: MYTWIN.url }],
};
