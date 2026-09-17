import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsFigure } from "@/components/news/NewsFigure";
import { NewsLink } from "@/components/news/NewsLink";
import { PodcastEpisodeEmbed } from "@/components/podcast/PodcastEpisodeEmbed";
import { newsPath } from "@/lib/paths";
import type { NewsArticle } from "../types";
import { VoiceSignal } from "./voice-signal";

const VIRTUOSIS = "https://www.virtuosis.ai/";

const MYTWIN_PAGES = {
  patients: "https://mytwin.care/en/patients",
} as const;

const SOURCES = {
  virtuosisAbout: "https://www.virtuosis.ai/about-us",
  voiceBiomarkers: "https://www.virtuosis.ai/what-are-voice-biomarkers",
  clinicalValidation: "https://www.virtuosis.ai/clinical-validation",
  maran: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12590051/",
  low: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7042657/",
} as const;

export const virtuosisAiVoiceAnalysis: NewsArticle = {
  slug: "virtuosis-ai-voice-analysis",
  publishedAt: "2026-09-16",
  eventMonth: "2025-05",
  category: "partnership",
  readingMinutes: 5,
  title: "Virtuosis AI brings voice analysis to MyTwin",
  seoTitle: "Virtuosis AI x MyTwin: voice analysis in pilot",
  description:
    "Since May 2025, MyTwin has piloted Virtuosis AI's voice analysis in its private beta: 30 seconds of speech for signals linked to stress, anxiety and mood.",
  excerpt:
    "We all know blood tests; Virtuosis AI works on voice tests. Since May 2025, MyTwin has piloted its voice analysis in the app’s private beta: about thirty seconds of speech, analysed for how you speak rather than what you say.",
  keywords: [
    "Virtuosis AI",
    "voice biomarkers",
    "voice analysis stress anxiety",
    "speech analysis depression",
    "MyTwin",
  ],
  facts: [
    { label: "When", value: "May 2025" },
    { label: "Stage", value: "Pilot in MyTwin’s private beta" },
    { label: "Who", value: "Virtuosis AI, an EPFL spin-off based in Lausanne" },
    { label: "Input", value: "About 30 seconds of speech" },
    { label: "In MyTwin", value: "A level (low, moderate, high) for stress, anxiety and depressive mood" },
  ],
  intro: (
    <>
      <p>
        Speaking involves the brain, the lungs, the larynx and dozens of muscles. When something affects them, it can show
        in the voice: in its pitch, its rhythm, its pauses. <NewsLink href={VIRTUOSIS}>Virtuosis AI</NewsLink>, a{" "}
        <NewsLink href={SOURCES.virtuosisAbout}>spin-off of the Swiss Federal Institute of Technology in Lausanne (EPFL)</NewsLink>{" "}
        founded by Lara Gervaise and Edoardo Giudice, turns those changes into health signals.
      </p>
      <p>
        Since May 2025, MyTwin has piloted Virtuosis AI’s voice analysis in its private beta. About thirty seconds of
        speech are enough for the app to show signals associated with stress, anxiety and depressive mood. They are
        information to act on with a professional, not a diagnosis.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-a-voice-carries",
      title: "What a voice carries",
      content: (
        <>
          <p>
            Virtuosis AI analyses the acoustic characteristics of speech, not its meaning: pitch, pace, voice quality and
            rhythm. According to Lara Gervaise, more than 400 such parameters are extracted several times per second from a
            recording of about 30 to 40 seconds.
          </p>
          <VoiceSignal />
          <p>
            Its models were trained on recordings collected in hospital clinical studies, each matched with a full medical
            assessment that includes confounding factors such as smoking or respiratory conditions, she explains on MyTwin
            Inside.
          </p>
        </>
      ),
    },
    {
      id: "in-mytwin",
      title: "What it looks like in MyTwin",
      content: (
        <>
          <p>
            In the MyTwin pilot, the user records a short voice sample. After processing, which can take a few minutes, the
            app shows a level for stress, anxiety and depressive mood: low, moderate or high.
          </p>
          <p>
            A result is a signal to watch, not a verdict. Lara Gervaise gives a concrete example: a recording made while
            very tired produces more false positives for depression, so the right reflex is to test again another day.
            Virtuosis AI itself stresses that its results are designed to{" "}
            <NewsLink href={SOURCES.voiceBiomarkers}>complement, not replace, professional judgment</NewsLink>.
          </p>
          <p>
            Voice analysis also sits alongside physical data in MyTwin’s work on athletes, as in our{" "}
            <NewsLink href={newsPath("racket-sports-injury-risk")}>injury-risk prototype for racket sports</NewsLink>.
          </p>
        </>
      ),
    },
    {
      id: "what-the-evidence-says",
      title: "What the evidence says",
      content: (
        <>
          <p>
            Voice biomarkers are a fast-moving and promising research field. A{" "}
            <NewsLink href={SOURCES.maran}>2025 meta-analysis of 105 studies</NewsLink> on detecting depression from speech
            concluded that the approach shows promise, but should be regarded as a complementary method rather than a
            standalone clinical tool. An{" "}
            <NewsLink href={SOURCES.low}>earlier systematic review of 127 studies</NewsLink> on psychiatric disorders came
            to a similar view: speech analysis could aid mental health assessments, with many obstacles still to overcome.
          </p>
          <p>
            Virtuosis AI publishes its own performance figures. For depression, measured against the PHQ-9 questionnaire,
            the company reports{" "}
            <NewsLink href={SOURCES.clinicalValidation}>a sensitivity of 77% and a specificity of 83% on 1,933 people</NewsLink>
            . These results have been presented as conference abstracts and posters; they have not yet been published as
            peer-reviewed articles.
          </p>
          <NewsCallout>
            <p>Your voice can raise a flag. A professional decides what it means.</p>
          </NewsCallout>
          <NewsFigure caption="Lara Gervaise, co-founder of Virtuosis AI, on MyTwin Inside.">
            <PodcastEpisodeEmbed episode="voice" />
          </NewsFigure>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Does Virtuosis AI listen to what I say?",
      answer:
        "No. The analysis looks at how you speak, such as pitch, pace, rhythm and voice quality, not at the meaning of your words.",
    },
    {
      question: "Can it diagnose depression?",
      answer:
        "No. It gives signals associated with stress, anxiety or depressive mood. A diagnosis can only come from a health professional, who takes other information into account.",
    },
  ],
  cta: {
    text: "Voice is one of the signals MyTwin brings together to follow your health over time.",
    label: "Discover MyTwin for patients",
    href: MYTWIN_PAGES.patients,
  },
  sources: [
    { label: "Virtuosis AI, “About us”.", url: SOURCES.virtuosisAbout },
    { label: "Virtuosis AI, “What are voice biomarkers?”.", url: SOURCES.voiceBiomarkers },
    { label: "Virtuosis AI, “Clinical validation”.", url: SOURCES.clinicalValidation },
    {
      label:
        "Maran P.L. et al., 2025, “Performance of automatic speech analysis in detecting depression: systematic review and meta-analysis”, JMIR Mental Health.",
      url: SOURCES.maran,
    },
    {
      label:
        "Low D.M., Bentley K.H., Ghosh S.S., 2020, “Automated assessment of psychiatric disorders using speech: a systematic review”, Laryngoscope Investigative Otolaryngology.",
      url: SOURCES.low,
    },
  ],
  mentions: [
    { type: "Organization", name: "Virtuosis AI", url: VIRTUOSIS },
    { type: "Person", name: "Lara Gervaise" },
  ],
};
