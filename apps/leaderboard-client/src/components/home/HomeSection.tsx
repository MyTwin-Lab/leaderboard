import Link from "next/link";
import { ArrowIcon } from "./ArrowIcon";

/**
 * L'en-tête d'une section de l'accueil : son titre, et le lien « voir tout »
 * au bout de la même ligne quand la section en a un.
 *
 * Le lien vivait sous le contenu, en bas à droite. Sur une page qui enchaîne
 * six sections, il se lisait comme la fin de l'une plutôt que comme la sortie
 * de celle qu'il prolonge ; au bout du titre, il est au même endroit dans
 * toutes les sections et se trouve sans avoir à parcourir la grille.
 */
export function HomeSectionHead({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: React.ReactNode;
  /** Ensemble avec `linkLabel` : sans les deux, le titre est seul sur sa ligne. */
  href?: string;
  linkLabel?: React.ReactNode;
}) {
  return (
    <div className="v-home-head">
      <h2 id={id} className="v-home-h">
        {title}
      </h2>
      {href && linkLabel && (
        <Link href={href} className="v-home-more">
          {linkLabel}
          <ArrowIcon className="" />
        </Link>
      )}
    </div>
  );
}
