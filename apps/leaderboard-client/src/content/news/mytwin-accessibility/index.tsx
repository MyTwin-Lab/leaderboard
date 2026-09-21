import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import type { NewsArticle } from "../types";
import { ScreenReaderPath } from "./screen-reader-path";

const MYTWIN_PATIENTS = "https://mytwin.care/en/patients";

const SOURCES = {
  whoVision: "https://www.who.int/news-room/fact-sheets/detail/blindness-and-visual-impairment",
  webaimMillion: "https://webaim.org/projects/million/",
  webaimSurvey: "https://webaim.org/projects/screenreadersurvey10/",
  ariaReadMeFirst: "https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/",
} as const;

export const mytwinAccessibility: NewsArticle = {
  slug: "mytwin-accessibility",
  publishedAt: "2026-09-21",
  eventMonth: "2026-09",
  category: "research",
  readingMinutes: 5,
  title: "Rethinking MyTwin for blind and visually impaired people: what our first accessibility work taught us",
  overviewTitle: "Designing an app for visually impaired users was harder than we thought",
  seoTitle: "MyTwin accessibility: designing for blind users",
  description:
    "Making MyTwin usable without seeing the screen took more than labels: it meant rethinking the app. Next step to explore: an app you can drive by voice.",
  excerpt:
    "Accessibility is often a checklist added at the end, a label on every button. When we started making MyTwin usable for people who can’t see the screen, it turned out to be a design problem, and one that points to an app you can drive entirely by voice.",
  keywords: [
    "MyTwin accessibility",
    "accessible health app",
    "visually impaired users",
    "screen reader accessibility",
    "voice-controlled app",
    "MyTwin Lab",
  ],
  facts: [
    { label: "When", value: "September 2026" },
    { label: "Stage", value: "Research: a first accessibility pass on the app. Voice control is an idea, not built" },
    { label: "Who", value: "Antoine Tessier and Mahdi Lamriben, MyTwin engineers" },
    { label: "Scope", value: "The MyTwin app, used with a screen reader" },
    { label: "Next", value: "Accessibility challenges on MyTwin Lab" },
  ],
  intro: (
    <>
      <p>
        Accessibility usually arrives at the end of a project, as a checklist: a label on every button, a description on
        every image, a contrast ratio to check. When Antoine Tessier and Mahdi Lamriben started work on making{" "}
        <NewsLink href={MYTWIN_PATIENTS}>the MyTwin app</NewsLink> usable by blind and visually impaired people, they
        began the same way. It wasn’t enough.
      </p>
      <p>
        What they found is that accessibility is a design problem, not a tagging one. Making an app usable without seeing
        the screen meant rethinking its experience as if with your eyes closed, and going back to its fundamentals. It
        also showed where to go next: an app you can drive entirely by voice. That is still an idea. This news tells the
        first step, and the challenges that will follow on MyTwin Lab.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-it-matters",
      title: "A problem most apps haven’t solved",
      content: (
        <>
          <p>
            Vision impairment is common: according to the{" "}
            <NewsLink href={SOURCES.whoVision}>World Health Organization</NewsLink>, at least 2.2 billion people live with a
            near or distance vision impairment. Many still read a screen, with glasses or larger text. Others, blind or with
            very low vision, use a screen reader, which reads the interface aloud, one element at a time.
          </p>
          <p>
            For them, most of the web still falls short. In February 2026, WebAIM’s automated scan of the home pages of one
            million websites{" "}
            <NewsLink href={SOURCES.webaimMillion}>
              found failures of the Web Content Accessibility Guidelines on 95.9% of them
            </NewsLink>
            , and automated tools only catch part of the problems. A health app is no place for that gap: results,
            appointments and treatments are exactly what a person should be able to reach on their own.
          </p>
        </>
      ),
    },
    {
      id: "more-than-labels",
      title: "Accessibility is not a layer of labels",
      content: (
        <>
          <p>
            The classic approach is to annotate what already exists: give each button a name, each image a text
            alternative, each control a role the screen reader can announce. It is necessary, and it is where the work on
            MyTwin started.
          </p>
          <p>
            It quickly showed its limits. Labels make each element readable; they don’t make the whole understandable. Added
            without rethinking the screen, they can even make things worse. The W3C’s guide to ARIA, the attributes that
            describe an interface to assistive technologies, opens on the principle that{" "}
            <NewsLink href={SOURCES.ariaReadMeFirst}>“no ARIA is better than bad ARIA”</NewsLink>. In WebAIM’s scan, home
            pages using ARIA{" "}
            <NewsLink href={SOURCES.webaimMillion}>had more detected errors on average than those without it</NewsLink>, 59.1
            against 42.
          </p>
          <p>
            Real accessibility asks for a design effort, and for code structured to carry it: the order in which elements
            come, how they are grouped, what is announced and when, how many steps a screen asks for.
          </p>
          <NewsCallout>
            <p>Labels make each element readable. Only design makes the whole understandable.</p>
          </NewsCallout>
        </>
      ),
    },
    {
      id: "eyes-closed",
      title: "Designing with your eyes closed",
      content: (
        <>
          <p>
            The deepest difference is in how a screen is read. A sighted user takes it in at a glance, skips what doesn’t
            interest them and goes straight to what they came for. A screen reader user moves through it one element at a
            time, heading, button, text, menu, until they have the whole picture and can decide where to go.
          </p>
          <ScreenReaderPath />
          <p>
            That is why structure matters so much. In WebAIM’s latest survey of screen reader users,{" "}
            <NewsLink href={SOURCES.webaimSurvey}>71.6% find their way on a long page through its headings</NewsLink>:
            headings are how they skim. An interface that only makes sense visually, with meaning carried by position,
            colour or density, leaves them to read everything.
          </p>
          <p>
            Most interfaces designed for sighted people don’t survive that reading. Fixing them sends you back to the
            primitives of product design: what is this screen for, what comes first, what can wait. The questions are
            simple. Answering them honestly is the real work of accessibility.
          </p>
        </>
      ),
    },
    {
      id: "voice",
      title: "Next: an app you can drive by voice",
      content: (
        <>
          <p>
            Even a well-structured app keeps part of the gap: a screen reader user still has to go through a screen to know
            what is on it. Hence the direction we want to explore next, an app you can drive entirely by voice. Instead of
            walking through the interface, you would ask for what you need, “show me my last blood test”, and the app would
            take you there.
          </p>
          <p>
            The idea is to decouple accessibility from the interface: alongside screens that can be read, a way to reach
            what you need without going through them. It doesn’t replace the work on structure, which screen reader users
            still need. And today it is only an idea: none of it is built yet.
          </p>
        </>
      ),
    },
    {
      id: "in-the-open",
      title: "Taking it further, in the open",
      content: (
        <>
          <p>
            This first work is preliminary. The next steps will be taken on MyTwin Lab, as{" "}
            <NewsLink href="/challenges">challenges</NewsLink> open to the community: continuing the work on the app, and
            exploring voice control. Each of them will be told here.
          </p>
          <p>
            They will need people who don’t often work on the same project: designers, developers, and above all people who
            use a screen reader every day, whose experience no checklist replaces.
          </p>
        </>
      ),
    },
  ],
  cta: {
    text: "An idea to make health apps usable without seeing the screen? In the Sandbox, anyone can propose a project.",
    label: "Propose a project in the Sandbox",
    href: "/sandbox",
  },
  sources: [
    {
      label: "World Health Organization, 2026, “Blindness and vision impairment” fact sheet.",
      url: SOURCES.whoVision,
    },
    { label: "WebAIM, 2026, “The WebAIM Million: an annual accessibility analysis of the top 1,000,000 home pages”.", url: SOURCES.webaimMillion },
    { label: "WebAIM, 2024, “Screen Reader User Survey #10 Results”.", url: SOURCES.webaimSurvey },
    { label: "W3C Web Accessibility Initiative, “ARIA Authoring Practices Guide: Read Me First”.", url: SOURCES.ariaReadMeFirst },
  ],
  mentions: [
    { type: "Person", name: "Antoine Tessier" },
    { type: "Person", name: "Mahdi Lamriben" },
  ],
};
