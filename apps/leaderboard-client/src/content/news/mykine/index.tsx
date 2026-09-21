import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { sandboxPath } from "@/lib/paths";
import { SITE_URL } from "@/lib/seo";
import type { NewsArticle } from "../types";
import { OnDevicePipeline } from "./on-device-pipeline";
import { PoseIllustration } from "./pose-illustration";

const SANDBOX = sandboxPath("mykine-guided-physio-sessions-with-on-device-pose-estimation");
const REAL_WORLD_DATA = "https://mytwin.care/en/blog/real-world-data-patient-monitoring";

const SOURCES = {
  essery: "https://pubmed.ncbi.nlm.nih.gov/27097761/",
  smith: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10462806/",
  whoMusculoskeletal: "https://www.who.int/news-room/fact-sheets/detail/musculoskeletal-conditions",
  whoRehabilitation: "https://www.who.int/news-room/fact-sheets/detail/rehabilitation",
  mediapipe: "https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker",
  mdcg: "https://health.ec.europa.eu/document/download/b45335c5-1679-4c71-a91c-fc7a4d37f12b_en?filename=mdcg_2019_11_en.pdf",
  wade: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8884063/",
  lam: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10155325/",
} as const;

export const mykine: NewsArticle = {
  slug: "mykine",
  publishedAt: "2026-09-16",
  eventMonth: "2026-09",
  category: "sandbox",
  readingMinutes: 5,
  title: "MyKine: guided physiotherapy sessions with on-device pose estimation",
  overviewTitle: "MyKine turns a phone camera into a physio’s measuring tool",
  illustration: { kind: "visual", Visual: PoseIllustration },
  seoTitle: "MyKine: home physio with pose estimation",
  description:
    "MyKine, a MyTwin Lab Sandbox project, uses the phone camera to count reps and measure joint angles in home physio, with no image leaving the device.",
  excerpt:
    "Physiotherapists prescribe exercises to do at home, then have no way of knowing what actually happened. MyKine, proposed in the MyTwin Lab Sandbox in September 2026, turns the phone camera into a measuring tool, without a single image leaving the device.",
  keywords: [
    "MyKine",
    "home physiotherapy exercises",
    "pose estimation physiotherapy",
    "home exercise adherence",
    "MediaPipe pose",
    "MyTwin Lab Sandbox",
  ],
  facts: [
    { label: "When", value: "September 2026" },
    { label: "Stage", value: "Sandbox proposal, web demo" },
    { label: "Who", value: "Alix Chagot, MyTwin Lab contributor" },
    { label: "Technology", value: "MediaPipe Pose Landmarker, running on the device" },
    { label: "Privacy", value: "No image leaves the phone: only body landmarks are kept" },
  ],
  intro: (
    <>
      <p>
        When a physiotherapy session ends, much of the work moves home: exercises repeated between visits, alone, with
        nobody to check the movement or count the repetitions. The physiotherapist, in the words of the project, “has no
        way to know what actually happened”.
      </p>
      <p>
        <NewsLink href={SANDBOX}>MyKine</NewsLink>, proposed by Alix Chagot in the MyTwin Lab Sandbox in September 2026,
        starts from a simple observation: a phone camera is the one sensor every patient already has. MyKine uses it to
        count repetitions and measure joint angles during each exercise, and not a single image leaves the device. It is
        an early project, a web demo, and it is looking for the community’s support to go further.
      </p>
    </>
  ),
  sections: [
    {
      id: "the-gap",
      title: "The weak link between two sessions",
      content: (
        <>
          <p>
            Home exercise programmes are a pillar of physiotherapy, and following them is hard. A systematic review found
            that{" "}
            <NewsLink href={SOURCES.essery}>non-adherence to home-based physical therapy can reach 70%</NewsLink>, with
            self-efficacy, motivation and social support among its predictors.
          </p>
          <p>
            Adherence is also poorly measured. In a{" "}
            <NewsLink href={SOURCES.smith}>systematic review of 176 trials on knee osteoarthritis</NewsLink>, only 40.9%
            reported exercise adherence at all. Without a measurement, a physiotherapist adjusting a programme works from
            what the patient remembers. Following patients between visits with real-world data is exactly the question our
            article on <NewsLink href={REAL_WORLD_DATA}>real-world data in patient monitoring</NewsLink> explores.
          </p>
          <p>
            The need is anything but marginal. About{" "}
            <NewsLink href={SOURCES.whoMusculoskeletal}>1.71 billion people live with a musculoskeletal condition</NewsLink>
            , the leading contributor to disability worldwide, and an estimated{" "}
            <NewsLink href={SOURCES.whoRehabilitation}>2.4 billion people could benefit from rehabilitation</NewsLink>,
            according to the World Health Organization.
          </p>
        </>
      ),
    },
    {
      id: "how-it-works",
      title: "How MyKine measures a session",
      content: (
        <>
          <p>
            The patient opens the session of the day, from the programme their physiotherapist prescribed, and sets the
            phone down facing them. During each exercise:
          </p>
          <ul>
            <li>
              a pose-estimation model, Google’s <NewsLink href={SOURCES.mediapipe}>MediaPipe Pose Landmarker</NewsLink>,
              tracks body landmarks in real time, on the device;
            </li>
            <li>
              a scoring layer turns those landmarks into joint angles and repetitions, with explicit angle thresholds for
              each exercise rather than a black-box model;
            </li>
            <li>
              at the end comes a summary of the session, and a skeleton replay of each set: the landmarks are kept, never
              the video.
            </li>
          </ul>
          <OnDevicePipeline />
          <p>The exercise library is designed so that a physiotherapist can extend it without touching the code.</p>
        </>
      ),
    },
    {
      id: "what-it-doesnt-do",
      title: "What it deliberately doesn’t do",
      content: (
        <>
          <p>
            MyKine shows measurements. It does not tell the patient how to correct a movement, and it does not change their
            programme. That line matters: under European guidance, software that recommends personalised rehabilitation
            exercises for a musculoskeletal condition{" "}
            <NewsLink href={SOURCES.mdcg}>qualifies as a medical device</NewsLink>. Measuring stays on one side of that
            line; prescribing is the physiotherapist’s job.
          </p>
          <NewsCallout>
            <p>The phone measures. The physiotherapist decides.</p>
          </NewsCallout>
          <p>
            The measurement itself has limits, and the project doesn’t hide them. Markerless motion capture is progressing
            fast, but a review of the field found that its{" "}
            <NewsLink href={SOURCES.wade}>joint angles are not yet accurate enough for clinical applications</NewsLink>,
            and another that its use in clinical measurement is{" "}
            <NewsLink href={SOURCES.lam}>still at a preliminary stage</NewsLink>. MyKine’s angle thresholds have not yet
            been reviewed by a physiotherapist or checked against real recordings.
          </p>
        </>
      ),
    },
    {
      id: "whats-next",
      title: "From a Sandbox project to a challenge",
      content: (
        <>
          <p>
            In the Sandbox, a project is carried by its author, and the community stars the projects it wants built. The
            most supported ones can be promoted into official MyTwin Lab challenges, where other contributors can join the
            work.
          </p>
          <p>
            For MyKine, the next steps are the ones a demo can’t skip: a review of the exercises and thresholds by
            physiotherapists, and tests on real sessions. Each of them will be told here.
          </p>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Can patients use MyKine today?",
      answer:
        "Not yet. MyKine is a web demo proposed in the MyTwin Lab Sandbox. It is not a medical device and does not replace a physiotherapist.",
    },
    {
      question: "Does MyKine record video?",
      answer:
        "No. The camera image is processed on the device to find the body landmarks. Only those landmarks are kept, for the session summary and the skeleton replay.",
    },
    {
      question: "I'm a physiotherapist. How can I help?",
      answer:
        "Star the project in the Sandbox to show it is worth building. Once promoted into a challenge, it opens to contributors, and a physiotherapist's review of the exercises and thresholds is exactly what it needs.",
    },
  ],
  cta: {
    text: "Want MyKine to become an official challenge? Stars are how the community decides.",
    label: "Star MyKine in the Sandbox",
    href: SANDBOX,
  },
  sources: [
    {
      label: "Essery R. et al., 2017, “Predictors of adherence to home-based physical therapies: a systematic review”, Disability and Rehabilitation.",
      url: SOURCES.essery,
    },
    {
      label:
        "Smith K.M. et al., 2023, “What are the unsupervised exercise adherence rates in clinical trials for knee osteoarthritis? A systematic review”, Brazilian Journal of Physical Therapy.",
      url: SOURCES.smith,
    },
    { label: "World Health Organization, 2022, “Musculoskeletal health” fact sheet.", url: SOURCES.whoMusculoskeletal },
    { label: "World Health Organization, 2024, “Rehabilitation” fact sheet.", url: SOURCES.whoRehabilitation },
    { label: "Google AI Edge, “MediaPipe Pose Landmarker” documentation.", url: SOURCES.mediapipe },
    {
      label:
        "Medical Device Coordination Group, MDCG 2019-11 rev.1, 2025, “Qualification and classification of software”, European Commission.",
      url: SOURCES.mdcg,
    },
    {
      label:
        "Wade L. et al., 2022, “Applications and limitations of current markerless motion capture methods for clinical gait biomechanics”, PeerJ.",
      url: SOURCES.wade,
    },
    {
      label:
        "Lam W.W.T. et al., 2023, “A systematic review of the applications of markerless motion capture technology for clinical measurement in rehabilitation”, Journal of NeuroEngineering and Rehabilitation.",
      url: SOURCES.lam,
    },
  ],
  mentions: [
    { type: "SoftwareApplication", name: "MyKine", url: `${SITE_URL}${SANDBOX}` },
    { type: "Person", name: "Alix Chagot" },
    { type: "SoftwareApplication", name: "MediaPipe Pose Landmarker", url: SOURCES.mediapipe },
  ],
};
