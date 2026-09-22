/**
 * L'illustration d'une carte, quand personne n'en a posé une.
 *
 * Les couvertures se règlent à la création (challenge, sandbox) et à l'édition
 * d'un challenge. Tant qu'une carte n'en a pas, elle reprend la banque
 * d'images de la landing, dans l'ordre des maquettes — la roue est indexée sur
 * la position dans le listing, donc deux cartes voisines ne portent jamais la
 * même photo.
 */

export interface CoverShot {
  src: string;
  /** Le cadrage, tel que la maquette le pose. */
  position: string;
}

/** L'ordre de `Challenges Redesign Vitrine.dc.html`. */
const CHALLENGE_SHOTS: CoverShot[] = [
  { src: "/landing/hero/digital-twin-hologram.webp", position: "52% 45%" },
  { src: "/landing/hero/research-microscope.webp", position: "52% 40%" },
  { src: "/landing/hero/movement-pose-estimation.webp", position: "55% 45%" },
  { src: "/landing/hero/3d-printed-heart.webp", position: "45% 45%" },
];

/** L'ordre de `Sandbox Redesign Vitrine.dc.html`. */
const SANDBOX_SHOTS: CoverShot[] = [
  { src: "/landing/hero/research-microscope.webp", position: "52% 40%" },
  { src: "/landing/hero/digital-twin-hologram.webp", position: "52% 45%" },
  { src: "/landing/hero/3d-printed-heart.webp", position: "45% 45%" },
  { src: "/landing/hero/movement-pose-estimation.webp", position: "55% 45%" },
];

/**
 * La couverture d'une carte : celle qu'on lui a donnée, sinon l'illustration
 * de repli. Une image déposée est cadrée au centre — c'est l'auteur qui a
 * choisi ce qu'elle montre.
 */
export function coverShot(
  coverImageUrl: string | null | undefined,
  index: number,
  kind: "challenge" | "sandbox" = "challenge",
): CoverShot {
  if (coverImageUrl) return { src: coverImageUrl, position: "50% 50%" };
  const shots = kind === "sandbox" ? SANDBOX_SHOTS : CHALLENGE_SHOTS;
  return shots[((index % shots.length) + shots.length) % shots.length];
}
