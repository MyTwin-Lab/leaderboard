import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import type { NewsArticle } from "../types";
import { SkinCheckFlow } from "./skin-check-flow";

const SKINIVE = "https://skinive.com/";

const MYTWIN_PAGES = {
  patients: "https://mytwin.care/en/patients",
  cindyStory: "https://mytwin.care/en/stories/cindy-suspicious-mole",
} as const;

const SOURCES = {
  skiniveTerms: "https://skinive.com/terms/",
  whoUv: "https://www.who.int/news-room/fact-sheets/detail/ultraviolet-radiation",
  iarcMelanoma:
    "https://www.iarc.who.int/news-events/global-burden-of-cutaneous-melanoma-in-2020-and-projections-to-2040",
  freeman: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7190019/",
  wen: "https://pubmed.ncbi.nlm.nih.gov/34772649/",
  sokolov: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9644746/",
} as const;

export const skiniveAiSkinChecks: NewsArticle = {
  slug: "skinive-ai-skin-checks",
  publishedAt: "2026-09-16",
  eventMonth: "2025-05",
  category: "partnership",
  readingMinutes: 4,
  title: "Skinive brings AI skin checks to MyTwin",
  overviewTitle: "A first look at a skin spot, straight from your phone",
  illustration: {
    kind: "image",
    src: "/news/skinive.webp",
    alt: "A person photographs a mole on their shoulder with a phone, the mole shown magnified",
    position: "50% 60%",
  },
  seoTitle: "Skinive x MyTwin: AI skin checks in pilot",
  description:
    "Since May 2025, MyTwin has piloted Skinive's AI skin checks: a photo, the probable lesion types and their risk, and simpler access to a dermatologist.",
  excerpt:
    "A mole that changes, a dermatologist months away. Since May 2025, MyTwin has piloted Skinive in its private beta: a photo of the skin, the probable types of lesion and their risk, and a simpler way to see a dermatologist, who makes the diagnosis.",
  keywords: ["Skinive", "AI skin check", "mole check app", "skin cancer risk", "dermatologist access", "MyTwin"],
  facts: [
    { label: "When", value: "May 2025" },
    { label: "Stage", value: "Pilot in MyTwin’s private beta" },
    { label: "Who", value: "Skinive, Amsterdam" },
    { label: "Input", value: "A photo of the skin" },
    { label: "In MyTwin", value: "Probable lesion types, their associated risk, simplified access to a dermatologist" },
    { label: "Diagnosis", value: "None by the app: made by the dermatologist" },
  ],
  intro: (
    <>
      <p>
        Cindy noticed a mole changing. The dermatologists she called had nothing available for five months. Her story,{" "}
        <NewsLink href={MYTWIN_PAGES.cindyStory}>told on mytwin.care</NewsLink>, is a common one: a legitimate worry, and a
        long wait for a first look.
      </p>
      <p>
        Since May 2025, MyTwin has piloted <NewsLink href={SKINIVE}>Skinive</NewsLink> in its private beta. The user
        photographs a skin concern; the app shows the probable types of lesion and the risk associated with them, and
        offers simplified access to a dermatologist, who confirms or rules out a diagnosis. The app itself makes none.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-a-first-look",
      title: "Why a first look matters",
      content: (
        <>
          <p>
            Skin cancers are among the most common cancers. In 2020, more than 1.5 million cases were diagnosed worldwide,
            and more than 120,000 deaths were associated with them, according to the{" "}
            <NewsLink href={SOURCES.whoUv}>World Health Organization</NewsLink>. For melanoma alone, the International
            Agency for Research on Cancer{" "}
            <NewsLink href={SOURCES.iarcMelanoma}>projects about 510,000 new cases and 96,000 deaths a year by 2040</NewsLink>
            , increases of roughly 50% and 68% on 2020.
          </p>
          <p>
            Examining a lesion that changes is a dermatologist’s job. The question is what happens while a patient waits for
            one.
          </p>
        </>
      ),
    },
    {
      id: "how-it-works",
      title: "How Skinive works in MyTwin",
      content: (
        <>
          <ol>
            <li>The user takes a photo of the area of skin that worries them.</li>
            <li>
              Skinive’s AI, which covers more than 55 skin conditions according to the company, returns the probable types
              of lesion and the risk associated with them.
            </li>
            <li>From the result, MyTwin offers simplified access to a dermatologist.</li>
            <li>The dermatologist examines the lesion, and confirms or rules out a diagnosis.</li>
          </ol>
          <SkinCheckFlow />
          <p>
            Skinive is explicit about its role: its app{" "}
            <NewsLink href={SOURCES.skiniveTerms}>
              “is not a diagnostic tool and is not intended to replace consultation with healthcare professionals”
            </NewsLink>
            . The company states that it is a class I medical device under the European Medical Device Regulation, a class
            for which the manufacturer declares conformity itself.
          </p>
        </>
      ),
    },
    {
      id: "limits",
      title: "The limits we keep in mind",
      content: (
        <>
          <p>
            AI skin-check apps have been studied closely, and the findings call for humility. A{" "}
            <NewsLink href={SOURCES.freeman}>systematic review in The BMJ</NewsLink> concluded that algorithm-based
            smartphone apps cannot be relied on to detect all cases of melanoma or other skin cancers. And the image
            datasets such tools learn from under-represent darker skin: in a{" "}
            <NewsLink href={SOURCES.wen}>review of public skin cancer image datasets</NewsLink>, skin type was recorded for
            only 2.1% of the images.
          </p>
          <p>
            Skinive’s published accuracy figures{" "}
            <NewsLink href={SOURCES.sokolov}>come from the company itself</NewsLink>; we have not found an independent
            evaluation yet. That is why, in MyTwin, the photo leads to a dermatologist, not to a conclusion.
          </p>
          <NewsCallout>
            <p>A probability is a reason to look closer, never a diagnosis.</p>
          </NewsCallout>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Does Skinive tell me whether I have skin cancer?",
      answer:
        "No. It gives the probable types of lesion and an associated risk, to help decide when to see a dermatologist. Only a dermatologist can make a diagnosis.",
    },
    {
      question: "What if the risk looks low but the lesion keeps changing?",
      answer:
        "See a doctor anyway. A lesion that changes deserves a medical examination, whatever an app says.",
    },
  ],
  cta: {
    text: "In MyTwin, a worrying photo leads to a dermatologist, not to a guess.",
    label: "Discover MyTwin for patients",
    href: MYTWIN_PAGES.patients,
  },
  sources: [
    { label: "World Health Organization, 2022, “Ultraviolet radiation” fact sheet.", url: SOURCES.whoUv },
    {
      label:
        "International Agency for Research on Cancer, 2022, “Global burden of cutaneous melanoma in 2020 and projections to 2040”.",
      url: SOURCES.iarcMelanoma,
    },
    { label: "Skinive, “Terms of use”.", url: SOURCES.skiniveTerms },
    {
      label:
        "Freeman K. et al., 2020, “Algorithm based smartphone apps to assess risk of skin cancer in adults: systematic review of diagnostic accuracy studies”, The BMJ.",
      url: SOURCES.freeman,
    },
    {
      label:
        "Wen D. et al., 2022, “Characteristics of publicly available skin cancer image datasets: a systematic review”, The Lancet Digital Health.",
      url: SOURCES.wen,
    },
    {
      label:
        "Sokolov K., Shpudeiko V., 2022, “Dynamics of the neural network accuracy in the context of modernization of the algorithms of skin pathology recognition”, Indian Journal of Dermatology.",
      url: SOURCES.sokolov,
    },
  ],
  mentions: [{ type: "Organization", name: "Skinive", url: SKINIVE }],
};
