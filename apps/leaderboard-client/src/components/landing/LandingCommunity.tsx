import Link from "next/link";

import { ArrowIcon } from "./ArrowIcon";
import { ContributorsCarousel, type CarouselItem } from "./ContributorsCarousel";
import { Reveal } from "./Reveal";

// Même liste que le carousel de la landing MyTwin Health (`/patients`), rôles
// de son dictionnaire anglais. Photos : `public/landing/contributors/`.
const CONTRIBUTORS: ReadonlyArray<CarouselItem> = [
  { name: "Alix", role: "Student, Engineer", photo: "alix_chagot.webp", country: "fr" },
  { name: "Antoine", role: "Entrepreneur, Developer", photo: "antoine_tessier.webp", country: "fr" },
  { name: "Eric", role: "Researcher, Entrepreneur", photo: "eric_seuillet.webp", country: "fr" },
  { name: "FAANG", role: "Developer", photo: "faang.webp", country: "jp" },
  { name: "Julien et Delphine", role: "Patients", photo: "julien_et_delphine.webp", country: "fr" },
  { name: "Lara", role: "Researcher, Entrepreneur", photo: "lara_gervaise.webp", country: "ch" },
  { name: "Mahdi", role: "Professor, Developer", photo: "mahdi_lamriben.webp", country: "fr" },
  { name: "Patricia", role: "AI Engineer", photo: "patricia_novi.webp", country: "my" },
  { name: "Samir", role: "Community Manager", photo: "samir_touinssi.webp", country: "fr" },
  { name: "Camille", role: "Student, Developer", photo: "camille.webp", country: "fr" },
  { name: "Mickaël", role: "Student, Data Engineer", photo: "mickael_andrieu.webp", country: "fr" },
  { name: "Christyl", role: "Student, Data Engineer", photo: "christyl_hodonou.webp", country: "fr" },
  { name: "Dorian", role: "Student, Cybersecurity", photo: "dorian_giraud.webp", country: "fr" },
  { name: "Victor", role: "AI Engineer", photo: "victor_xu.webp", country: "fr" },
  { name: "Fabrice", role: "Patient", photo: "fabrice.webp", country: "fr" },
  { name: "Chloé et Christine", role: "Mother and Daughter, Patients", photo: "chloe_et_christine.webp", country: "fr" },
  { name: "Eric", role: "Data Engineer", photo: "eric_de_rochefort.webp", country: "fr" },
  { name: "Jean-Marc", role: "ePHD, Entrepreneur", photo: "jean-marc_bouillon.webp", country: "fr" },
  { name: "Laurent", role: "Former Surgeon", photo: "laurent_blasco.webp", country: "th" },
  { name: "Sarah", role: "3D Artist", photo: "sarah_rouchou.webp", country: "fr" },
  { name: "Shane", role: "Nurse, Professor, Entrepreneur", photo: "shane_grindle.webp", country: "us" },
  { name: "Thomas", role: "Entrepreneur", photo: "thomas_landrain.webp", country: "fr" },
  { name: "André", role: "Medical Student", photo: "andre_murilo.webp", country: "py" },
  { name: "Duncan", role: "Developer", photo: "no_photo.webp", country: "ke" },
  { name: "Asmaa", role: "AI Engineer", photo: "asmaa.webp", country: "eg" },
  { name: "Shriya", role: "AI Engineer", photo: "no_photo.webp", country: "us" },
  { name: "Kunal", role: "AI Engineer", photo: "kunal.webp", country: "in" },
  { name: "Nahum", role: "Doctor", photo: "nahum.webp", country: "us" },
  { name: "Shamus", role: "AI Engineer", photo: "shamus.webp", country: "my" },
  { name: "Gaurav", role: "AI Engineer", photo: "gaurav.webp", country: "in" },
  { name: "Aurélie", role: "Nurse", photo: "aurelie.webp", country: "fr" },
  { name: "Mathieu", role: "Finance, IT", photo: "mathieu.webp", country: "fr" },
  { name: "Régis", role: "Doctor", photo: "regis.webp", country: "fr" },
  { name: "Vincent", role: "Media", photo: "vincent.webp", country: "fr" },
];

export function LandingCommunity() {
  return (
    <section className="l-section l-community" aria-labelledby="landing-community-title">
      <div className="l-container">
        <Reveal className="l-community__head">
          <h2 id="landing-community-title" className="l-heading l-community__title">
            Join our Community
          </h2>
          <p className="l-community__lead">
            Students, engineers, clinicians, researchers and citizens, building the future of health together.
          </p>
        </Reveal>
      </div>

      {/* Liste lisible par les lecteurs d'écran et les moteurs : le carousel est décoratif. */}
      <ul className="l-sr-only">
        {CONTRIBUTORS.map((contributor, index) => (
          <li key={`${contributor.name}-${index}`}>
            {contributor.name}, {contributor.role}
          </li>
        ))}
      </ul>

      <Reveal delay={150}>
        <ContributorsCarousel items={CONTRIBUTORS} />
      </Reveal>

      <Reveal className="l-community__cta">
        <Link href="/home" className="l-button l-button--large">
          Enter the Lab
          <ArrowIcon />
        </Link>
      </Reveal>
    </section>
  );
}
