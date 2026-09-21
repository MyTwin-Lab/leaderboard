import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsFigure } from "@/components/news/NewsFigure";
import { NewsLink } from "@/components/news/NewsLink";
import { PodcastEpisodeEmbed } from "@/components/podcast/PodcastEpisodeEmbed";
import type { NewsArticle } from "../types";
import { CameraPulse } from "./camera-pulse";

const I_VIRTUAL = "https://i-virtual.ai/";

const MYTWIN_PAGES = {
  patients: "https://mytwin.care/en/patients",
  predictiveHealth: "https://mytwin.care/en/blog/predictive-health",
  remoteMonitoring: "https://mytwin.care/en/blog/remote-patient-monitoring",
} as const;

const SOURCES = {
  iVirtualAbout: "https://i-virtual.ai/about/",
  whoCvd: "https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)",
  caducyIfu:
    "https://i-virtual.ai/wp-content/uploads/QARA/v1.3.0/OPR02-F01_Caducy1-Instruction-For-Use-Commercial_EN_V21.pdf",
  allado: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9604655/",
  alladoRespiratory: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9267568/",
  pham: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8266631/",
  dasari: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8175478/",
} as const;

export const iVirtualCameraVitalSigns: NewsArticle = {
  slug: "i-virtual-camera-vital-signs",
  publishedAt: "2026-09-16",
  eventMonth: "2025-04",
  category: "partnership",
  readingMinutes: 5,
  title: "i-Virtual brings camera-based vital signs to MyTwin",
  overviewTitle: "Check your cardiovascular health with your smartphone camera",
  illustration: {
    kind: "image",
    src: "/news/i-virtual.webp",
    alt: "A person holds a phone up to their face, a light mesh and a pulse line drawn over it",
    position: "50% 40%",
  },
  seoTitle: "i-Virtual x MyTwin: vital signs from a video",
  description:
    "Since April 2025, MyTwin has piloted i-Virtual's Saphere: a 30-second selfie video for heart rate, breathing, stress and a cardiovascular health score.",
  excerpt:
    "No watch, no cuff, no sensor: a 30-second selfie video. Since April 2025, MyTwin has piloted Saphere, i-Virtual’s vital-sign engine, in its private beta, cardiovascular health score included.",
  keywords: [
    "i-Virtual",
    "Saphere",
    "vital signs from video",
    "remote photoplethysmography",
    "cardiovascular health score",
    "MyTwin",
  ],
  facts: [
    { label: "When", value: "April 2025" },
    { label: "Stage", value: "Pilot in MyTwin’s private beta" },
    { label: "Who", value: "i-Virtual, Metz (France)" },
    { label: "Product", value: "Saphere, video-based vital-sign engine" },
    { label: "Input", value: "A 30-second selfie video" },
    {
      label: "In MyTwin",
      value: "Heart rate, heart rate variability, breathing rate, stress level, cardiovascular health score",
    },
  ],
  intro: (
    <>
      <p>
        Every heartbeat sends a pulse of blood through the vessels of the face, and blood absorbs light. A phone camera can
        pick up those tiny changes in colour, invisible to the eye, and rebuild the pulse wave from them. The technique is
        called remote photoplethysmography, or rPPG.
      </p>
      <p>
        <NewsLink href={I_VIRTUAL}>i-Virtual</NewsLink>, a company from Metz whose{" "}
        <NewsLink href={SOURCES.iVirtualAbout}>work began in 2010 at the University of Lorraine</NewsLink>, has turned it
        into a measurement tool. Since April 2025, MyTwin has piloted Saphere, its video-based vital-sign engine, in the
        app’s private beta: a 30-second selfie video gives heart rate, heart rate variability, breathing rate, a stress
        level and a cardiovascular health score.
      </p>
    </>
  ),
  sections: [
    {
      id: "how-it-works",
      title: "How a camera sees your pulse",
      content: (
        <>
          <p>
            Room light and the light from the screen reflect off the skin of the forehead. With each heartbeat, the amount
            of blood under the skin changes slightly, and so does the light it reflects. The camera records that signal,
            and algorithms rebuild the pulse wave and derive the measurements from it. Benoît Georis, CEO of i-Virtual,
            compares it to the finger pulse oximeter used in hospitals, which works on the same principle with light
            passing through the finger instead of reflected by the face.
          </p>
          <CameraPulse />
          <p>
            Conditions matter: the phone set down and still, the user seated and calm, good light on the face. The
            technology is <NewsLink href={I_VIRTUAL}>designed for spot checks</NewsLink>, not continuous monitoring.
          </p>
        </>
      ),
    },
    {
      id: "in-mytwin",
      title: "What MyTwin measures with it",
      content: (
        <>
          <p>
            Cardiovascular diseases are the world’s leading cause of death, with an estimated 19.8 million deaths in 2022,
            about 32% of all deaths, according to the <NewsLink href={SOURCES.whoCvd}>World Health Organization</NewsLink>.
            Simple indicators that anyone can check often are one way to bring the heart into everyday prevention. With
            Saphere, MyTwin shows:
          </p>
          <ul>
            <li>heart rate;</li>
            <li>heart rate variability, which reflects the balance between the nervous systems of action and rest;</li>
            <li>breathing rate;</li>
            <li>a stress level;</li>
            <li>a cardiovascular health score, computed by Saphere.</li>
          </ul>
          <p>
            Benoît Georis gives the right way to read them: low heart rate variability during exercise is normal; at rest,
            and repeatedly, it is worth checking with a professional. A score estimates, it doesn’t predict: our article on{" "}
            <NewsLink href={MYTWIN_PAGES.predictiveHealth}>what a risk score really means</NewsLink> explains the
            difference.
          </p>
          <p>
            Saphere is not presented as a medical device, and the measurements it gives in MyTwin are indicators, not
            medical measurements. i-Virtual also develops Caducy, a separate product{" "}
            <NewsLink href={SOURCES.caducyIfu}>intended as a medical device for measuring heart rate and respiratory rate</NewsLink>
            , for use under the supervision of healthcare professionals.
          </p>
        </>
      ),
    },
    {
      id: "evidence-and-limits",
      title: "What the studies show, and their limits",
      content: (
        <>
          <p>
            The technology has been tested in hospital. In two studies at Nancy University Hospital, funded by i-Virtual
            and run on 963 patients with its Caducy software, heart rate measured from video{" "}
            <NewsLink href={SOURCES.allado}>agreed with an electrocardiogram for 94.6% of patients</NewsLink>, and breathing
            rate{" "}
            <NewsLink href={SOURCES.alladoRespiratory}>agreed with a reference chest belt for 96% of them</NewsLink>.
          </p>
          <p>
            Reviews of the field are more cautious. Consumer contactless monitors{" "}
            <NewsLink href={SOURCES.pham}>measure heart rate accurately compared with medical devices</NewsLink>, but most
            studies are small and run in laboratory conditions, and motion or poor lighting degrade them. Skin tone matters
            too: the datasets used to develop rPPG methods{" "}
            <NewsLink href={SOURCES.dasari}>often lack diversity in skin tones</NewsLink>, and the Nancy study included too
            few patients with the two darkest skin types to draw conclusions for them. Caducy’s instructions for use
            contraindicate the measurement for those skin types.
          </p>
          <NewsCallout>
            <p>A 30-second video can raise a question about your heart. Answering it is a doctor’s job.</p>
          </NewsCallout>
          <p>
            For professionals, the question is where such indicators fit in a care pathway: our guide to{" "}
            <NewsLink href={MYTWIN_PAGES.remoteMonitoring}>remote patient monitoring</NewsLink> covers how to build one
            that works.
          </p>
          <NewsFigure caption="Benoît Georis, CEO of i-Virtual, on MyTwin Inside.">
            <PodcastEpisodeEmbed episode="face" />
          </NewsFigure>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Is a selfie video as accurate as a medical device?",
      answer:
        "Not in every condition. Hospital studies of i-Virtual's technology found good agreement with reference devices at rest, but accuracy depends on light, movement and skin type. In MyTwin, the measurements are indicators, not medical measurements.",
    },
    {
      question: "What should I do if a result looks worrying?",
      answer:
        "Measure again at rest, in good light. If a result stays abnormal, talk to your doctor: only a professional can interpret it with your history.",
    },
  ],
  cta: {
    text: "Heart rate, breathing, stress: everyday indicators, followed over time in MyTwin.",
    label: "Discover MyTwin for patients",
    href: MYTWIN_PAGES.patients,
  },
  sources: [
    {
      label: "World Health Organization, 2025, “Cardiovascular diseases (CVDs)” fact sheet.",
      url: SOURCES.whoCvd,
    },
    { label: "i-Virtual, “About us”.", url: SOURCES.iVirtualAbout },
    { label: "i-Virtual, “Caducy: instructions for use”, version 21, 2025.", url: SOURCES.caducyIfu },
    {
      label:
        "Allado E. et al., 2022, “Accurate and reliable assessment of heart rate in real-life clinical settings using an imaging photoplethysmography”, Journal of Clinical Medicine.",
      url: SOURCES.allado,
    },
    {
      label:
        "Allado E. et al., 2022, “Remote photoplethysmography is an accurate method to remotely measure respiratory rate: a hospital-based trial”, Journal of Clinical Medicine.",
      url: SOURCES.alladoRespiratory,
    },
    {
      label:
        "Pham C. et al., 2022, “Effectiveness of consumer-grade contactless vital signs monitors: a systematic review and meta-analysis”, Journal of Clinical Monitoring and Computing.",
      url: SOURCES.pham,
    },
    {
      label: "Dasari A. et al., 2021, “Evaluation of biases in remote photoplethysmography methods”, npj Digital Medicine.",
      url: SOURCES.dasari,
    },
  ],
  mentions: [
    { type: "Organization", name: "i-Virtual", url: I_VIRTUAL },
    { type: "SoftwareApplication", name: "Saphere", url: I_VIRTUAL },
    { type: "Person", name: "Benoît Georis" },
  ],
};
