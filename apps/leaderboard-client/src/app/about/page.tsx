import Link from "next/link";
import { Card, Eyebrow, PrimaryCta, SecondaryCta, SectionHeading, TextLink } from "@/components/about/primitives";
import { JsonLd } from "@/components/seo/JsonLd";
import { flowCatalog } from "@/distribution/mytwin.flows";
import { challengePath } from "@/lib/paths";
import { fetchLabChallenges, type LabChallenge } from "@/lib/server/publicPages";
import {
  LAB_ORGANIZATION_ID,
  MYTWIN,
  SITE_URL,
  WEBSITE_ID,
  jsonLdGraph,
  labOrganizationJsonLd,
  pageMetadata,
  toMetaDescription,
  websiteJsonLd,
} from "@/lib/seo";

/**
 * La landing du Lab — ce qu'est MyTwin Lab, pour qui, et comment y entrer.
 *
 * Deux lecteurs à la fois : l'institution de santé (hôpital, clinique) qui
 * cherche un terrain d'expérimentation, et le contributeur qui veut savoir si
 * le projet a un ancrage réel. Elle remplace l'ancien manifeste de `/about`,
 * dont elle garde les valeurs : deux pages sur « MyTwin Lab » se seraient
 * disputé la même requête.
 *
 * Elle raconte la vision, pas seulement le MVP : des applications connectées à
 * la MyTwin Platform, des projets Sandbox que l'on construit à plusieurs. C'est
 * ce lien Lab → Platform qui justifie le Lab aux yeux d'une institution. Deux
 * choses, en revanche, restent strictement factuelles parce que la santé est
 * un sujet YMYL : la frontière recherche / dispositif médical et la règle sur
 * les données patient. Aucun partenaire n'est nommé tant qu'aucun n'est public.
 *
 * Le territoire « digital twin » appartient à mytwin.care : il n'apparaît ici
 * qu'une fois, dans la description de MyTwin reprise mot pour mot de son site.
 */

export const dynamic = "force-dynamic";

const TITLE = "About MyTwin Lab | Open Health Innovation Sandbox";
const DESCRIPTION =
  "MyTwin Lab is the open health innovation sandbox of MyTwin, where hospitals, clinicians, researchers and developers build applications for the MyTwin Platform.";

export const metadata = pageMetadata({ absoluteTitle: TITLE, description: DESCRIPTION, path: "/about" });

const DOMAINS = [
  "Medical imaging AI",
  "Preventive health",
  "Patient monitoring",
  "Rehabilitation",
  "Clinical decision support",
  "Sports health",
];

const STEPS = [
  {
    title: "Choose a challenge or propose a project",
    body: "Browse the official challenges, or start a community project around the health problem you care about. Sign in with Google to take part.",
  },
  {
    title: "Connect and build",
    body: "Connect your repository and build in the open with contributors from medicine, research, engineering and design, turning the idea into a working application.",
  },
  {
    title: "Get evaluated and credited",
    body: "Work is scored against the challenge's published grid or metric, earns contribution points and shows on the public leaderboard. Validation challenges then check that a deliverable really works.",
  },
];

const INSTITUTION_BENEFITS = [
  {
    title: "Frame a real use case",
    body: "Work with MyTwin to turn a priority need into a challenge: a clear brief, expected deliverables and the criteria that define success.",
  },
  {
    title: "Mobilize a multidisciplinary community",
    body: "Engineers, data scientists, students, clinicians and researchers take on the problem, on their own or in small groups.",
  },
  {
    title: "Compare approaches on equal terms",
    body: "Every submission is scored against the same published grid or metric, so solutions are compared, not just demoed.",
  },
  {
    title: "Keep clinicians in the loop",
    body: "Validation challenges let medical professionals test deliverables against reference cases and record their verdicts.",
  },
  {
    title: "Follow progress in the open",
    body: "Activity, contributions and results stay visible on the challenge page as the work moves forward.",
  },
  {
    title: "Grow what works",
    body: "The strongest projects grow into applications and modules of the MyTwin Platform.",
  },
];

const VALUES = [
  { title: "Collective over individual", body: "Breakthroughs emerge from collaboration." },
  { title: "Action over status", body: "We credit builders, not titles." },
  { title: "Openness over ownership", body: "Knowledge grows by being shared." },
  { title: "Transparency over politics", body: "Every contribution is visible and measurable." },
  { title: "Momentum over permission", body: "If something should exist, build it." },
];

// Chaque réponse se suffit à elle-même : c'est ce qu'un moteur — ou une IA —
// reprend tel quel, sans le reste de la page.
const FAQ = [
  {
    question: "What is MyTwin Lab?",
    answer:
      "MyTwin Lab is the open innovation lab of MyTwin: a collaborative sandbox where hospitals, clinicians, researchers, engineers and students turn health challenges into applications for the MyTwin Platform, through official challenges and community projects, with every contribution evaluated and credited in contribution points.",
  },
  {
    question: "How is MyTwin Lab related to MyTwin?",
    answer:
      "MyTwin makes the best health technologies accessible to everyone through the digital twin of the human body. MyTwin Lab is its open innovation space, where new applications for the MyTwin Platform are explored, built and tested with the community. Both are published by We Are One.",
  },
  {
    question: "Can a hospital, clinic or health organization propose a challenge?",
    answer:
      "Yes. Contact the MyTwin team to present your use case. Together, we frame it as a challenge with a brief, expected deliverables and evaluation criteria, then open it to the community.",
  },
  {
    question: "Is patient data shared in MyTwin Lab?",
    answer:
      "No identifiable patient data should ever be shared in the Lab. Challenges rely on public, de-identified or synthetic data, and the Terms of Use prohibit uploading identifiable health data.",
  },
  {
    question: "Are the applications built in the Lab medical devices?",
    answer:
      "No. Work produced in MyTwin Lab is research and prototyping. It is not a certified medical device and must not be used for diagnosis or treatment; any clinical use would require its own validation and regulatory process.",
  },
  {
    question: "How are contributions evaluated and rewarded?",
    answer:
      "Each challenge publishes how work is assessed: an AI evaluation against a scoring grid for code, or a measurable metric for machine-learning models. Contributions earn contribution points (CP), which rank contributors on the public leaderboard. CP have no monetary value.",
  },
  {
    question: "Who can contribute?",
    answer:
      "Anyone who wants to help build health technology, with no title or prior expertise required. Sign in with a Google account to join a challenge or propose a community project.",
  },
];

/** La vitrine ne doit jamais faire tomber la landing : sans base, on s'en passe. */
async function readChallenges(): Promise<LabChallenge[]> {
  try {
    return await fetchLabChallenges(3);
  } catch (error) {
    console.error("[about] challenges lookup failed", error);
    return [];
  }
}

export default async function AboutPage() {
  const challenges = await readChallenges();

  const jsonLd = jsonLdGraph(labOrganizationJsonLd(), websiteJsonLd(), {
    "@type": "AboutPage",
    "@id": `${SITE_URL}/about#webpage`,
    url: `${SITE_URL}/about`,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": LAB_ORGANIZATION_ID },
    mainEntity: { "@id": LAB_ORGANIZATION_ID },
  });

  return (
    <div className="flex flex-col gap-20 pb-4 sm:gap-28">
      <JsonLd data={jsonLd} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="animate-fade-up flex flex-col gap-6 pt-4 sm:pt-8">
        <Eyebrow>About MyTwin Lab</Eyebrow>
        <h1 className="max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
          The open sandbox where <span className="text-brandCP">health challenges</span> become working
          applications.
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
          MyTwin Lab is the open innovation lab of{" "}
          <a href={MYTWIN.home} className="font-semibold text-white underline-offset-4 hover:text-brandCP hover:underline">
            MyTwin
          </a>
          : the collaborative sandbox where hospitals, clinicians, researchers, engineers and students turn
          health challenges into working applications connected to the MyTwin Platform, with every
          contribution tracked, evaluated and credited.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <PrimaryCta href="/challenges">Explore the challenges</PrimaryCta>
          <SecondaryCta href={MYTWIN.contact}>Partner with MyTwin Lab</SecondaryCta>
        </div>
        <TextLink href="/sandbox">Have your own idea? Propose it in the Sandbox</TextLink>
      </section>

      {/* ── Pourquoi ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionHeading title="Where health ideas get built, not just discussed.">
          <p>
            Health innovation rarely lacks ideas. It stalls between the idea and something that works:
            nobody to build it, no fair way to compare approaches, no clinician to say whether it holds up.
          </p>
          <p>
            MyTwin Lab closes that gap. It brings medical expertise, research, engineering and lived
            experience into one open environment, organized around concrete challenges and a shared way of
            evaluating the work.
          </p>
        </SectionHeading>
        <ul className="flex flex-wrap gap-2.5" aria-label="Fields explored in the Lab">
          {DOMAINS.map((domain) => (
            <li
              key={domain}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/75"
            >
              {domain}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Deux façons de construire ────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="Two ways to build" title="Official challenges and community projects." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="gap-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brandCP">Official challenges</span>
            <h3 className="text-xl font-semibold tracking-tight text-white">Work on priority health problems</h3>
            <p className="text-sm leading-relaxed text-white/65 sm:text-base">
              Challenges are defined by MyTwin around a concrete health need. Each one comes with a brief,
              expected deliverables, contribution points to earn and published evaluation criteria. Join on
              your own or in a small group, work in a dedicated repository or submit datasets and models, and
              get evaluated as you go.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-white/65">
              <li>· Code and machine-learning challenges</li>
              <li>· GPU compute on request for machine-learning work</li>
              <li>· Validation challenges reviewed by medical professionals</li>
            </ul>
            <div className="mt-auto pt-2">
              <TextLink href="/challenges">Explore official challenges</TextLink>
            </div>
          </Card>
          <Card className="gap-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brandCP">
              Community projects · Sandbox
            </span>
            <h3 className="text-xl font-semibold tracking-tight text-white">Launch the project you want built</h3>
            <p className="text-sm leading-relaxed text-white/65 sm:text-base">
              Have an idea for a health application? Launch it in the Sandbox, no approval needed. Describe
              the context, the goals and why it matters, connect your repository and invite others to build it
              with you, with a formative AI review whenever you want feedback.
            </p>
            <p className="text-sm leading-relaxed text-white/65 sm:text-base">
              The community stars the projects it wants built. Star milestones earn contribution points, and
              the most promising projects grow into official MyTwin challenges.
            </p>
            <div className="mt-auto pt-2">
              <TextLink href="/sandbox">Open the Sandbox</TextLink>
            </div>
          </Card>
        </div>
      </section>

      {/* ── Comment ça marche ────────────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="How it works" title="From a health problem to evaluated work." />
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Card className="h-full">
                <span className="font-mono text-sm font-semibold text-brandCP">0{index + 1}</span>
                <h3 className="text-lg font-semibold tracking-tight text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/65">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
        <TextLink href="/leaderboard">View the leaderboard</TextLink>
      </section>

      {/* ── Institutions ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-10 rounded-3xl border border-brandCP/15 bg-brandCP/[0.05] px-5 py-10 sm:px-10 sm:py-14">
        <SectionHeading
          eyebrow="For hospitals, clinics and health organizations"
          title="A living innovation sandbox for your use cases."
        >
          <p>
            MyTwin Lab gives healthcare institutions a structured, open environment to explore emerging
            technologies on their own clinical and organizational challenges, without building a project
            team from scratch.
          </p>
        </SectionHeading>

        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {INSTITUTION_BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex flex-col gap-2">
              <h3 className="text-base font-semibold text-white">{benefit.title}</h3>
              <p className="text-sm leading-relaxed text-white/65">{benefit.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <h3 className="text-base font-semibold text-white">Built for research, not for patient records</h3>
          <p className="text-sm leading-relaxed text-white/65">
            Challenges run on public, de-identified or synthetic data: identifiable patient data has no place
            in the Lab. What is built here is research and prototyping work, not a certified medical device:
            before an application reaches the MyTwin Platform or any clinical use, it goes through its own
            validation and regulatory pathway. See our{" "}
            <Link href="/terms-of-use" className="font-medium text-white underline-offset-4 hover:text-brandCP hover:underline">
              Terms of Use
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PrimaryCta href={MYTWIN.contact}>Partner with MyTwin Lab</PrimaryCta>
          <SecondaryCta href={MYTWIN.clinicians}>MyTwin for clinicians</SecondaryCta>
        </div>
      </section>

      {/* ── Challenges en cours ──────────────────────────────────────── */}
      {challenges.length > 0 && (
        <section className="flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="In the Lab right now" title="Challenges open to contributors." />
            <TextLink href="/challenges">All challenges</TextLink>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {challenges.map((challenge) => (
              <Link
                key={challenge.id}
                href={challengePath(challenge.slug)}
                className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brandCP/25 hover:bg-white/[0.06]"
              >
                <span className="w-fit rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brandCP">
                  {flowCatalog.get(challenge.type)?.longLabel ?? "Challenge"}
                </span>
                <h3 className="text-lg font-semibold tracking-tight text-white transition-colors group-hover:text-brandCP">
                  {challenge.title}
                </h3>
                {challenge.description && (
                  <p className="line-clamp-3 text-sm leading-relaxed text-white/55">
                    {toMetaDescription(challenge.description, 220)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Écosystème MyTwin ────────────────────────────────────────── */}
      <section className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
        <SectionHeading eyebrow="Part of the MyTwin ecosystem" title="The open lab behind MyTwin.">
          <p>
            <a href={MYTWIN.home} className="font-semibold text-white underline-offset-4 hover:text-brandCP hover:underline">
              MyTwin
            </a>{" "}
            makes the best health technologies accessible to everyone through the digital twin of the human
            body, for patients, clinics and companies.
          </p>
          <p>
            MyTwin Lab is where the applications of the MyTwin Platform are explored, built and tested in the
            open, with the contributors, healthcare professionals and researchers who share that mission.
          </p>
        </SectionHeading>
        <Card>
          <span className="text-sm font-semibold text-white">MyTwin, the platform</span>
          <p className="text-sm leading-relaxed text-white/60">
            The platform the Lab builds for, and what it already offers patients, clinicians and employers.
          </p>
          <TextLink href={MYTWIN.home}>Discover MyTwin</TextLink>
        </Card>
      </section>

      {/* ── Valeurs ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="#WeAreNotWaiting" title="What we believe.">
          <p>
            No single company, university or hospital can move health innovation fast enough on its own. An
            open community can.
          </p>
        </SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALUES.map((value) => (
            <div key={value.title} className="flex flex-col gap-1.5 border-l-2 border-brandCP/40 pl-4">
              <h3 className="text-base font-semibold text-white">{value.title}</h3>
              <p className="text-sm text-white/60">{value.body}</p>
            </div>
          ))}
          <div className="flex flex-col gap-1.5 border-l-2 border-brandCP/40 pl-4">
            <h3 className="text-base font-semibold text-white">Anyone can join</h3>
            <p className="text-sm text-white/60">
              Students, developers, designers, clinicians, researchers and citizens. You grow by contributing.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-8">
        <SectionHeading eyebrow="FAQ" title="Questions we are often asked." />
        <div className="flex flex-col divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
          {FAQ.map((entry) => (
            <details key={entry.question} className="group px-5 py-4 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white [&::-webkit-details-marker]:hidden">
                <h3>{entry.question}</h3>
                <span className="shrink-0 text-xl leading-none text-brandCP transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/65 sm:text-base">{entry.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────── */}
      <section className="flex flex-col items-start gap-5 rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-10 sm:px-10 sm:py-12">
        <h2 className="max-w-2xl text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          Help build what healthcare needs next.
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-white/65">
          Join an official challenge, start a community project, or bring your institution’s use case to the
          Lab.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryCta href="/challenges">Explore the challenges</PrimaryCta>
          <SecondaryCta href="/sandbox">Open the Sandbox</SecondaryCta>
          <SecondaryCta href={MYTWIN.contact}>Partner with MyTwin Lab</SecondaryCta>
        </div>
      </section>
    </div>
  );
}
