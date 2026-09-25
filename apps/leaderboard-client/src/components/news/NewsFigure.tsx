import { cn } from "@/lib/utils";

/**
 * Le cadre commun des blocs visuels d'une news : même respiration et même
 * légende partout, pour que chaque article dessine ses propres schémas sans que
 * la page change de grammaire.
 *
 * Un bloc illustre l'article, il n'y ajoute rien : il reprend des phrases du
 * texte, jamais une valeur ou un résultat qui n'y figure pas.
 *
 * La légende est alignée à gauche, sous le bloc, comme la maquette : centrée,
 * elle se lisait comme un titre plutôt que comme une note.
 */
export function NewsFigure({
  children,
  caption,
  className,
}: {
  children: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={cn("v-nd-figure", className)}>
      {children}
      {caption && <figcaption className="v-nd-caption">{caption}</figcaption>}
    </figure>
  );
}
