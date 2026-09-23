import Link from "next/link";

/**
 * La flèche des liens de la maquette. Deux dessins : celle qui va tout droit,
 * et celle qui pointe en diagonale pour un lien qui sort de la page.
 */
export function HomeArrow({ corner = false }: { corner?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={corner ? "M4.5 11.5l7-7m0 0H5.5m6 0v6" : "M3 8h10m0 0L9 4m4 4-4 4"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Le lien « voir tout » d'une section, souligné comme dans la maquette. */
export function HomeMore({
  href,
  children,
  place = "top",
}: {
  href: string;
  children: React.ReactNode;
  /** La maquette met ce lien en haut sur écran, sous le contenu sur téléphone. */
  place?: "top" | "bottom";
}) {
  return (
    <Link href={href} className={"v-home-more v-home-more-" + place}>
      {children}
      <HomeArrow />
    </Link>
  );
}

/**
 * L'en-tête d'une section de l'accueil.
 *
 * La maquette nomme la section par un sur-titre en capitales espacées, et
 * réserve la ligne suivante à une accroche en gris — le titre visuel n'est
 * donc pas le titre du document. Le sur-titre porte l'`id` que la section
 * référence par `aria-labelledby`, et il est rendu comme un `h2` quand il est
 * seul, pour que le plan du document reste lisible sans l'accroche.
 */
export function HomeSectionHead({
  id,
  eyebrow,
  tagline,
  href,
  linkLabel,
}: {
  id: string;
  eyebrow: string;
  /** L'accroche grise sous le sur-titre, quand la section en a une. */
  tagline?: string;
  href?: string;
  linkLabel?: React.ReactNode;
}) {
  return (
    <div className="v-home-head">
      <div className="v-home-head-text">
        {tagline ? (
          <>
            <span id={id} className="v-home-eyebrow">
              {eyebrow}
            </span>
            <h2 className="v-home-tagline">{tagline}</h2>
          </>
        ) : (
          <h2 id={id} className="v-home-eyebrow">
            {eyebrow}
          </h2>
        )}
      </div>
      {href && linkLabel && <HomeMore href={href}>{linkLabel}</HomeMore>}
    </div>
  );
}
