import { cn } from "@/lib/utils";

/**
 * Le cadre commun des blocs visuels d'une news : même respiration et même
 * légende partout, pour que chaque article dessine ses propres schémas sans que
 * la page change de grammaire.
 *
 * Un bloc illustre l'article, il n'y ajoute rien : il reprend des phrases du
 * texte, jamais une valeur ou un résultat qui n'y figure pas.
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
    <figure className={cn("my-10 sm:my-12", className)}>
      {children}
      {caption && (
        <figcaption className="mt-4 text-pretty text-center text-sm leading-relaxed text-white/45">{caption}</figcaption>
      )}
    </figure>
  );
}
