import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsFigure } from "@/components/news/NewsFigure";
import { NewsLink } from "@/components/news/NewsLink";
import { PodcastEpisodeEmbed } from "@/components/podcast/PodcastEpisodeEmbed";
import type { NewsArticle } from "../types";
import { HomeSessionIllustration } from "./home-session-illustration";
import { RehabPathway } from "./rehab-pathway";

const ENSWEET = "https://www.ensweet.fr/";

const MYTWIN_PAGES = {
  clinicians: "https://mytwin.care/en/clinicians",
  workplaceHeartHealth: "https://mytwin.care/en/blog/workplace-heart-health",
} as const;

const SOURCES = {
  esc: "https://doi.org/10.1093/eurheartj/ehad191",
  dibben: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8571912/",
  mcdonagh: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10604509/",
  interaspire: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12412450/",
  ensweetExperiments: "https://www.ensweet.fr/experimentations/",
  ensweetCaregivers: "https://www.ensweet.fr/soignant/",
} as const;

export const ensweetCardiacRehabilitation: NewsArticle = {
  slug: "ensweet-cardiac-rehabilitation",
  publishedAt: "2026-09-16",
  eventMonth: "2026-06",
  category: "partnership",
  readingMinutes: 5,
  title: "Ensweet and MyTwin: keeping cardiac rehabilitation going at home",
  overviewTitle: "Cardiac rehabilitation doesn’t have to stop at the hospital door",
  illustration: { kind: "visual", Visual: HomeSessionIllustration },
  seoTitle: "Ensweet x MyTwin: cardiac rehab at home",
  description:
    "Ensweet brings cardiac rehabilitation home, supervised by the care team. On MyTwin Inside, it announced its post-rehabilitation offer would come to MyTwin.",
  excerpt:
    "After a heart attack, cardiac rehabilitation is recommended for every patient, and too few follow it. Ensweet takes it home, under the supervision of the rehabilitation team. In June 2026, it announced on MyTwin Inside that its post-rehabilitation offer would come to MyTwin.",
  keywords: [
    "Ensweet",
    "cardiac tele-rehabilitation",
    "cardiac rehabilitation at home",
    "post-rehabilitation programme",
    "MyTwin",
  ],
  facts: [
    { label: "When", value: "June 2026, on MyTwin Inside" },
    { label: "Who", value: "Ensweet (Lille, France), with Valentine Antoine, Chief of Staff" },
    { label: "What", value: "Cardiac rehabilitation at home, supervised by the rehabilitation centre’s team" },
    { label: "Stage", value: "In discussion with MyTwin" },
    { label: "Regulatory", value: "Class I medical device, according to Ensweet" },
  ],
  intro: (
    <>
      <p>
        Surviving a heart attack opens another challenge: getting back to everyday life while lowering the risk of a new
        event. Cardiac rehabilitation, a supervised programme of exercise, education and support, is{" "}
        <NewsLink href={SOURCES.esc}>recommended for every patient after an acute coronary syndrome</NewsLink> by
        European guidelines. Yet few patients are referred to it, and fewer still complete it.
      </p>
      <p>
        <NewsLink href={ENSWEET}>Ensweet</NewsLink>, a company from Lille, takes rehabilitation home, under the supervision
        of the rehabilitation centre’s care team. On MyTwin Inside in June 2026, Valentine Antoine, its Chief of Staff,
        announced that Ensweet’s post-rehabilitation offer would be available on MyTwin. The two teams are now working out
        how.
      </p>
    </>
  ),
  sections: [
    {
      id: "gap-after-hospital",
      title: "The gap after the hospital",
      content: (
        <>
          <p>
            The benefits of cardiac rehabilitation are established. A{" "}
            <NewsLink href={SOURCES.dibben}>Cochrane review of 85 trials and 23,430 people</NewsLink> found that
            exercise-based rehabilitation may lead to a large reduction in cardiovascular deaths and heart attacks over the
            long term. European guidelines give it their highest level of recommendation, while noting that referral,
            participation and implementation rates remain low.
          </p>
          <p>
            The numbers bear that out. In a{" "}
            <NewsLink href={SOURCES.interaspire}>survey of 4,548 patients across 14 countries</NewsLink>, only one in three
            had been advised to take part in a rehabilitation programme, and one in five attended at least half of the
            sessions.
          </p>
          <p>
            Valentine Antoine describes the same barriers in France: rehabilitation centres that are few and unevenly
            spread, waits of several months for a place, and younger patients who can’t leave work and family for weeks.
          </p>
        </>
      ),
    },
    {
      id: "how-ensweet-works",
      title: "Rehabilitation at home, supervised by the care team",
      content: (
        <>
          <p>
            Ensweet’s model is hybrid. The patient starts at the rehabilitation centre, with an exercise test and
            interviews. If the care team agrees, the programme continues at home for three to four weeks, designed and
            followed by the same team:
          </p>
          <ul>
            <li>an exercise bike and a heart-rate sensor are delivered to the patient’s home;</li>
            <li>heart rate is monitored during each session, with an alert above a safety limit set by the care team;</li>
            <li>the programme combines adapted physical activity with education on diet, smoking and alcohol;</li>
            <li>
              the care team follows the sessions through a web interface, and the patient through a mobile app,{" "}
              <NewsLink href={SOURCES.ensweetCaregivers}>according to Ensweet</NewsLink>.
            </li>
          </ul>
          <RehabPathway />
          <p>
            Tele-rehabilitation with Ensweet has been{" "}
            <NewsLink href={SOURCES.ensweetExperiments}>tested in real-life conditions in 23 French healthcare facilities</NewsLink>
            , through two experiments under “Article 51”, France’s scheme for testing innovative care pathways. Ensweet
            states that its software is a class I medical device.
          </p>
          <p>
            Does rehabilitation at home work as well as in a centre? A{" "}
            <NewsLink href={SOURCES.mcdonagh}>Cochrane review</NewsLink> found that home-based programmes, with or without
            digital platforms, and centre-based ones seem similarly effective when supported by healthcare staff, though
            the certainty of the evidence is often low. And, as Valentine Antoine stresses, it is the care team that
            decides which path suits each patient.
          </p>
        </>
      ),
    },
    {
      id: "with-mytwin",
      title: "After rehabilitation, with MyTwin",
      content: (
        <>
          <p>
            Rehabilitation ends; the heart condition doesn’t. Keeping up physical activity and healthy habits in the months
            that follow is the hard part. That is where Ensweet wants to go next, with post-rehabilitation programmes, and
            where MyTwin comes in: a place where follow-up continues, and where patients and their doctors can find out that
            such programmes exist. A solution nobody knows about helps nobody, as Valentine Antoine puts it.
          </p>
          <NewsCallout>
            <p>The goal: more patients who start rehabilitation, and keep its benefits once it ends.</p>
          </NewsCallout>
          <p>
            According to Valentine Antoine, Ensweet also plans a clinical study of a fully digital pathway for milder cases,
            and a move toward prevention before any cardiac event, the side our article on{" "}
            <NewsLink href={MYTWIN_PAGES.workplaceHeartHealth}>workplace heart health</NewsLink> covers.
          </p>
          <NewsFigure caption="Valentine Antoine, Chief of Staff at Ensweet, on MyTwin Inside.">
            <PodcastEpisodeEmbed episode="heart" />
          </NewsFigure>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Can I follow Ensweet's programme through MyTwin today?",
      answer:
        "Not yet. Ensweet's post-rehabilitation offer is planned on MyTwin, and the two teams are working on it. Tele-rehabilitation itself goes through a partner rehabilitation centre.",
    },
    {
      question: "Is rehabilitation at home right for every patient?",
      answer:
        "No. After an assessment at the rehabilitation centre, the care team decides whether a patient can continue at home or should follow a programme in the centre.",
    },
  ],
  cta: {
    text: "Continuous follow-up between consultations is what MyTwin is built for.",
    label: "Discover MyTwin for clinicians",
    href: MYTWIN_PAGES.clinicians,
  },
  sources: [
    {
      label: "Byrne R.A. et al., 2023, “2023 ESC Guidelines for the management of acute coronary syndromes”, European Heart Journal.",
      url: SOURCES.esc,
    },
    {
      label: "Dibben G. et al., 2021, “Exercise-based cardiac rehabilitation for coronary heart disease”, Cochrane Database of Systematic Reviews.",
      url: SOURCES.dibben,
    },
    {
      label:
        "Kotseva K. et al., 2025, “Cardiac rehabilitation in patients with coronary heart disease: provision, attendance, and outcomes. Results from the INTERASPIRE study”, Global Heart.",
      url: SOURCES.interaspire,
    },
    {
      label: "McDonagh S.T.J. et al., 2023, “Home-based versus centre-based cardiac rehabilitation”, Cochrane Database of Systematic Reviews.",
      url: SOURCES.mcdonagh,
    },
    { label: "Ensweet, “Expérimentations article 51”.", url: SOURCES.ensweetExperiments },
    { label: "Ensweet, information for healthcare professionals.", url: SOURCES.ensweetCaregivers },
  ],
  mentions: [
    { type: "Organization", name: "Ensweet", url: ENSWEET },
    { type: "Person", name: "Valentine Antoine" },
  ],
};
