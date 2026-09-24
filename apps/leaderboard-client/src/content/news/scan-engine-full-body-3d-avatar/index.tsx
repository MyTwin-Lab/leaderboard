import { NewsCallout } from "@/components/news/NewsCallout";
import { NewsLink } from "@/components/news/NewsLink";
import { NewsPhotoRow } from "@/components/news/NewsPhotoRow";
import { newsPath } from "@/lib/paths";
import type { NewsArticle } from "../types";
import { TwinLayers } from "./twin-layers";

// Scan Engine a réalisé la capture en tant que studio : ce n'est pas un
// partenaire intégré à MyTwin. Un seul lien sortant, sur sa première mention
// (playbook §7).
const SCAN_ENGINE = "https://www.scan-engine.fr/";

const MYTWIN_PAGES = {
  patientDigitalTwin: "https://mytwin.care/en/blog/patient-digital-twin",
} as const;

const STUDIO_ALT =
  "Rubens Valcy stands at the centre of Scan Engine’s studio, surrounded by columns of cameras and light panels";

export const scanEngineFullBody3dAvatar: NewsArticle = {
  slug: "scan-engine-full-body-3d-avatar",
  publishedAt: "2026-09-24",
  eventMonth: "2026-02",
  category: "research",
  readingMinutes: 4,
  title: "From real-world capture to 3D avatar: a new layer of the MyTwin digital twin",
  overviewTitle: "From real-world capture to 3D avatar",
  illustration: {
    kind: "image",
    src: "/news/scan-engine-studio.webp",
    alt: STUDIO_ALT,
    position: "50% 35%",
  },
  seoTitle: "From capture to 3D avatar: a new MyTwin layer",
  description:
    "From real-world capture to 3D avatar: Rubens Valcy scanned in full body by Scan Engine in Paris, a new layer of the MyTwin digital twin.",
  excerpt:
    "A new step in building the patient’s digital twin: a full-body 3D avatar, created from a photogrammetric capture in Scan Engine’s studio in Paris.",
  keywords: [
    "MyTwin Lab",
    "Scan Engine",
    "full-body 3D scan",
    "3D body avatar",
    "photogrammetry",
    "MyTwin digital twin",
  ],
  facts: [
    { label: "When", value: "February 2026" },
    { label: "Stage", value: "Experiment: a first full-body 3D capture. Not a medical digital twin on its own" },
    { label: "Who", value: "Rubens Valcy, founder of MyTwin, scanned at Scan Engine in Paris" },
    { label: "How", value: "Photogrammetry: 192 cameras firing at once, according to the studio" },
    { label: "Result", value: "An avatar of the body’s outer shape: proportions, volumes, posture" },
    { label: "Next", value: "Connecting it to internal anatomy, biological data and their evolution over time" },
  ],
  intro: (
    <>
      <p>
        As part of the development of MyTwin Lab, a new step has been taken in building the patient’s digital twin: the
        creation of a full-body 3D avatar from a photogrammetric capture.
      </p>
      <p>
        For this experiment, Rubens Valcy went to the Paris studios of{" "}
        <NewsLink href={SCAN_ENGINE}>Scan Engine</NewsLink> to have his whole body digitised in 3D.
      </p>
      <p>
        Scan Engine specialises in creating digital humans and realistic 3D avatars. Its system relies on
        photogrammetry: a large number of cameras are placed all around the subject and fire simultaneously, capturing
        the body from many angles. The studio says it uses a 360° setup with 192 high-resolution cameras, able to capture
        the subject in a fraction of a second.
      </p>
    </>
  ),
  sections: [
    {
      id: "external-representation",
      title: "Creating the patient’s external representation",
      content: (
        <>
          <p>
            From all the photographs captured at the same instant, the data are processed to generate a three-dimensional
            representation of the body.
          </p>
          <p>
            The result is a digital avatar that reproduces the subject’s external morphology: body proportions, volumes,
            posture and the overall geometry of the body.
          </p>
          <NewsPhotoRow
            caption="In Scan Engine’s studio in Paris, then in 3D: the same body, captured from every angle at once."
            photos={[
              { label: "The capture", src: "/news/scan-engine-studio.webp", width: 1600, height: 1200, alt: STUDIO_ALT },
              {
                label: "The avatar",
                src: "/news/scan-engine-avatar.webp",
                width: 528,
                height: 692,
                alt: "The full-body 3D avatar of Rubens Valcy, a grey mesh in 3D software",
              },
            ]}
          />
          <p>
            This technology is already widely used in fields such as film, visual effects, video games and the creation of
            digital doubles. Scan Engine works on body and face scanning, and on producing realistic digital humans.
          </p>
          <p>
            At MyTwin Lab, the interest is different: gradually integrating this external representation into a much
            broader representation of the patient.
          </p>
        </>
      ),
    },
    {
      id: "visible-to-invisible",
      title: "From the visible body to the invisible body",
      content: (
        <>
          <p>A health digital twin can’t be limited to a single representation.</p>
          <p>On one side, photogrammetry captures the patient’s outer envelope.</p>
          <p>
            On the other,{" "}
            <NewsLink href={newsPath("pet-scan-3d-anatomical-model")}>medical imaging</NewsLink> is gradually making it
            possible to reconstruct what lies inside the body: organs, anatomical structures or specific areas of interest.
          </p>
          <p>
            Other dimensions can then be added to these representations: biological and physiological data, medical history
            and biomarkers.
          </p>
          <p>The goal is to gradually bring several levels of representation together:</p>
          <TwinLayers />
          <p>
            It is the path described in <NewsLink href="/vision">MyTwin Lab’s research vision</NewsLink>, from the body down
            to the molecule.
          </p>
        </>
      ),
    },
    {
      id: "more-complete-patient",
      title: "Towards an ever more complete digital patient",
      content: (
        <>
          <p>This 3D scan is not, on its own, a medical digital twin.</p>
          <p>
            It is, however, a new layer of data that helps build, step by step, a more complete digital representation of
            the patient.
          </p>
          <p>
            In the long run, MyTwin Lab’s challenge is precisely to connect these different dimensions in a single
            environment, to create a model able to evolve alongside the real patient.
          </p>
          <p>
            The logic is simple: the more relevant and complementary data a digital twin brings together about the same
            individual, the more representative of their real situation it can become. What a patient digital twin is, and
            what it is for, is explained in{" "}
            <NewsLink href={MYTWIN_PAGES.patientDigitalTwin}>MyTwin’s guide to the patient digital twin</NewsLink>.
          </p>
          <p>
            And tomorrow, the goal will no longer be only to visualise a digital patient, but gradually to analyse how they
            change, compare different scenarios and simulate some possible futures.
          </p>
          <p>
            This first full-body 3D avatar is a new step in MyTwin Lab’s ambition: building an ever more complete digital
            twin of the patient, from the visible body to the data that describe how it works inside.
          </p>
          <NewsCallout>
            <p>From the real body to the digital body. Then from the digital body to simulation.</p>
          </NewsCallout>
        </>
      ),
    },
  ],
  faq: [
    {
      question: "Is this 3D avatar a medical digital twin?",
      answer:
        "Not on its own. It reproduces the outer shape of the body, not what happens inside it. It is one layer of the digital twin, which still has to be connected to medical imaging, biological data and their evolution over time.",
    },
    {
      question: "Can I get a full-body 3D scan through MyTwin?",
      answer:
        "Not today. This was an internal experiment by the MyTwin Lab team, and no 3D scan is offered to MyTwin users.",
    },
  ],
  cta: {
    text: "The avatar is the outer layer. MyTwin Lab’s research vision tells how the others connect, from the body to the molecule.",
    label: "Read the research vision",
    href: "/vision",
  },
  sources: [],
  mentions: [
    { type: "Organization", name: "Scan Engine", url: SCAN_ENGINE },
    { type: "Person", name: "Rubens Valcy" },
  ],
};
