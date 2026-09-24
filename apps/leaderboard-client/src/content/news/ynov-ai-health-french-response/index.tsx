import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { NewsVideoEmbed } from "@/components/news/NewsVideoEmbed";
import { newsPath } from "@/lib/paths";
import type { NewsArticle, NewsVideo } from "../types";

const MYTWIN_PAGES = {
  patients: "https://mytwin.care/en/patients",
  patientDigitalTwin: "https://mytwin.care/en/blog/patient-digital-twin",
} as const;

const SOURCES = {
  ynovEvent: "https://www.ynov.com/articles/actualites/conseil-scientifique-ynov-campus",
} as const;

// L'extrait de l'enregistrement d'Ynov consacré à l'intervention de Rubens
// Valcy, servi par le Lab plutôt qu'intégré depuis YouTube : on reste sur la
// page, et rien n'est chargé avant le clic.
const TALK: NewsVideo = {
  src: "/news/ynov-talk.mp4",
  poster: "/news/ynov-talk-video.webp",
  title: "AI and health: what “French response”? Rubens Valcy at Ynov Campus’s Scientific Council",
  description:
    "Rubens Valcy, founder of MyTwin and MyTwin Lab, on AI applied to health and the “French response”, at Ynov Campus’s Scientific Council in Bordeaux.",
  duration: "PT15M29S",
  uploadDate: "2026-09-24",
  language: "fr",
};

export const ynovAiHealthFrenchResponse: NewsArticle = {
  slug: "ynov-ai-health-french-response",
  publishedAt: "2026-09-24",
  eventMonth: "2026-02",
  category: "community",
  readingMinutes: 6,
  title: "AI and health: what “French response”? MyTwin Lab at Ynov Campus’s Scientific Council",
  overviewTitle: "AI and health: what “French response”?",
  illustration: {
    kind: "image",
    src: "/news/ynov-talk.webp",
    alt: "Rubens Valcy speaks into a microphone on stage, in front of a projection screen, during a conversation",
    position: "60% 40%",
  },
  seoTitle: "AI and health: MyTwin Lab at Ynov Campus",
  description:
    "At Ynov Campus’s Scientific Council, Rubens Valcy presented the vision behind MyTwin and MyTwin Lab, and asked what France’s response to AI in health can be.",
  excerpt:
    "Faced with the accelerating transformation of AI in health, what can the French response be? At Ynov Campus’s Scientific Council, Rubens Valcy presented the vision behind MyTwin and MyTwin Lab.",
  keywords: [
    "MyTwin Lab",
    "Ynov Campus",
    "AI in health",
    "French response AI",
    "Rubens Valcy",
    "patient digital twin",
  ],
  facts: [
    { label: "When", value: "5 February 2026" },
    {
      label: "Where",
      value: "Bordeaux Ynov Campus, at the Scientific Council’s morning “AI, one year after the Paris Summit”",
    },
    { label: "Who", value: "Rubens Valcy, founder of MyTwin and MyTwin Lab" },
    { label: "Stage", value: "A talk: the vision behind MyTwin and MyTwin Lab" },
    { label: "Video", value: "The talk, 15 minutes, in French" },
  ],
  intro: (
    <>
      <p>
        During a talk organised as part of Ynov Campus’s Scientific Council, Rubens Valcy, founder of MyTwin and MyTwin
        Lab, presented the vision behind the project around one central question: faced with the accelerating
        transformation of artificial intelligence in health, what can the French response be?
      </p>
      <p>
        A talk about AI, health, prevention, and how innovation can become truly accessible to patients.
      </p>
      <NewsVideoEmbed
        video={TALK}
        caption="Rubens Valcy at Ynov Campus’s Scientific Council, Bordeaux, 5 February 2026."
      />
    </>
  ),
  sections: [
    {
      id: "twenty-years-of-prevention",
      title: "A story born of nearly twenty years in health prevention",
      content: (
        <>
          <p>
            The MyTwin project first grew out of nearly twenty years of professional experience in health prevention and
            innovation.
          </p>
          <p>But its origin is also deeply personal.</p>
          <p>
            After standing by his mother through her illness, until her death in hospital in a context marked notably by a
            medical error, then losing his father to a cancer that was not detected or prevented well enough, Rubens Valcy
            faced a paradox: how can so many medical innovations exist, when they so often remain unknown or hard to reach
            for the patients who could benefit from them?
          </p>
          <p>
            In hospitals, laboratories, startups and research centres, many technologies are already used to better
            screen, visualise, analyse, predict or personalise patient care.
          </p>
          <p>Yet these innovations often remain fragmented.</p>
          <p>
            A technology may be available in one hospital but not in another. A solution used by some doctors or some
            patients may remain completely unknown to the general public.
          </p>
        </>
      ),
    },
    {
      id: "connecting-innovations",
      title: "MyTwin: identifying, connecting and making innovations accessible",
      content: (
        <>
          <p>
            MyTwin’s first mission was born of this observation: identify and map the best existing health solutions and
            services, then bring them together in a single environment to make them easier to access.
          </p>
          <p>The goal is to link technologies that, today, still too often work in isolation.</p>
          <p>
            Health data analysis, biomarkers, artificial intelligence,{" "}
            <NewsLink href={newsPath("mammography-ai-challenges")}>medical imaging</NewsLink>,{" "}
            <NewsLink href={newsPath("pet-scan-3d-anatomical-model")}>3D models</NewsLink>,{" "}
            <NewsLink href={newsPath("virtuosis-ai-voice-analysis")}>voice analysis</NewsLink> or prevention tools: the
            challenge is not only to create new technologies, but also to make the existing ones work better together.
          </p>
          <p>
            <NewsLink href={MYTWIN_PAGES.patients}>MyTwin</NewsLink> was therefore designed as a platform able to
            gradually connect these technological building blocks around one individual and their health data.
          </p>
        </>
      ),
    },
    {
      id: "from-mytwin-to-mytwin-lab",
      title: "From MyTwin to MyTwin Lab: building a true patient digital twin",
      content: (
        <>
          <p>This logic led to the creation of MyTwin Lab.</p>
          <p>
            Its ambition is to bring researchers, health professionals, engineers, startups, patients and technology
            partners together around a common goal: building one of the most advanced patient digital twins in the world.
          </p>
          <p>
            The principle of the digital twin is to create an evolving digital representation of a patient from their
            health data, as explained in{" "}
            <NewsLink href={MYTWIN_PAGES.patientDigitalTwin}>MyTwin’s guide to the patient digital twin</NewsLink>.
          </p>
          <p>The more the quantity and diversity of available data grow, the more precise this representation can become.</p>
          <p>But the value of a digital twin does not lie only in representing the patient.</p>
          <p>It lies above all in its ability to simulate.</p>
        </>
      ),
    },
    {
      id: "simulate-to-anticipate",
      title: "Simulating today to anticipate tomorrow",
      content: (
        <>
          <p>
            Eventually, a health digital twin should make it possible to explore different scenarios before they happen in
            the real world.
          </p>
          <p>It could notably help to simulate:</p>
          <ul>
            <li>how certain health indicators might evolve;</li>
            <li>different prevention scenarios;</li>
            <li>a patient’s potential response to a medicine;</li>
            <li>certain surgical interventions;</li>
            <li>the impact of changes in behaviour or lifestyle;</li>
            <li>or the potential onset of certain health risks.</li>
          </ul>
          <p>
            This ability to simulate opens the way to a medicine that is ever more predictive, preventive, proactive and
            personalised, the direction set out in <NewsLink href="/vision">MyTwin Lab’s research vision</NewsLink>.
          </p>
          <p>
            The goal is no longer only to intervene once a disease appears, but to gradually understand individual health
            trajectories, so as to act earlier.
          </p>
        </>
      ),
    },
    {
      id: "french-response",
      title: "What “French response” to the global acceleration of AI in health?",
      content: (
        <>
          <p>This vision also raises a strategic question.</p>
          <p>
            Artificial intelligence and health technologies are advancing on a global scale. Data, scientific research, AI
            models and technological innovation naturally cross borders.
          </p>
          <p>Building a digital twin of the human body can therefore only be a collective, international venture.</p>
          <p>
            Even so, France and Europe have major strengths: researchers, doctors, engineers, healthcare institutions,
            startups, infrastructure and scientific expertise.
          </p>
          <p>
            The point of the “French response” is therefore not to build alone, but to know how to connect international
            innovations while developing, in France, the infrastructure, projects and ecosystems able to take part in the
            next great transformations of medicine.
          </p>
          <p>
            That is precisely the ambition of MyTwin Lab: creating an open space where technologies, science, data and
            expertise can be brought together, to speed up the move from innovation to concrete use for patients.
          </p>
          <NewsCallout>
            <p>
              Because the future of health will probably not depend on a single technology, but on our ability to connect
              them all around the same patient.
            </p>
          </NewsCallout>
        </>
      ),
    },
  ],
  cta: {
    text: "MyTwin Lab is the open space this talk describes: researchers, engineers, health professionals and patients, working on the same patient.",
    label: "Explore the challenges",
    href: "/challenges",
  },
  video: TALK,
  sources: [
    {
      label: "Ynov Campus, 2026, “Conseil Scientifique d’Ynov Campus : « IA, un an après le Sommet de Paris »”.",
      url: SOURCES.ynovEvent,
    },
  ],
  mentions: [
    { type: "Organization", name: "Ynov Campus", url: "https://www.ynov.com/" },
    { type: "Person", name: "Rubens Valcy" },
  ],
};
