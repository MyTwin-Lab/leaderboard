import Link from "next/link";

/**
 * Le retour au Lab, en tête des pages vitrine.
 *
 * `/#lab` renvoie à l'accueil *derrière* la prépage, là où « Enter the lab »
 * mène : on revient d'où l'on vient, pas à la porte. Même lien et même forme
 * que celui de `/vision`, qui porte encore le sien (`.v-vi-back`, à ses
 * mesures de grille).
 *
 * `/book` le pointe vers la page d'où l'on vient (`BOOKING_ORIGINS`), avec
 * son libellé.
 */
export function BackToLab({
  href = "/#lab",
  label = "Back to the Lab",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link href={href} className="v-back">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M13 8H3m0 0 4-4M3 8l4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </Link>
  );
}
