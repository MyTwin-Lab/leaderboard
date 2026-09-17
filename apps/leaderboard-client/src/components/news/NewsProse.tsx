import { cn } from "@/lib/utils";

/**
 * Le texte courant d'une news s'écrit en balises nues (`<p>`, `<ul>`, `<h3>`) :
 * c'est ce qui garde les fichiers de contenu lisibles. Les règles ne visent que
 * les enfants **directs** — un bloc visuel posé au milieu du texte garde donc sa
 * propre typographie, sans rien avoir à neutraliser.
 *
 * Les enfants stylés d'ici prennent `text-foreground`, jamais `text-white` : en
 * mode clair, globals.css ne corrige `text-white` que sur l'élément qui porte la
 * classe. Posée sur ce conteneur, elle laisserait un `<strong>` ou un `<h3>`
 * réellement blanc sur fond clair.
 */
const PROSE = [
  "text-pretty text-[15px] leading-[1.75] text-white/65 sm:text-base sm:leading-[1.8]",
  "[&>p]:mt-5 [&>ul]:mt-5 [&>ol]:mt-5",
  "[&>h3]:mt-10 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:tracking-tight [&>h3]:text-foreground",
  "[&>h3+p]:mt-3",
  "[&>ul]:flex [&>ul]:list-disc [&>ul]:flex-col [&>ul]:gap-2 [&>ul]:pl-5 [&>ul]:marker:text-brandCP",
  "[&>ol]:flex [&>ol]:list-decimal [&>ol]:flex-col [&>ol]:gap-2 [&>ol]:pl-5 [&>ol]:marker:font-semibold [&>ol]:marker:text-brandCP",
  "[&>:first-child]:mt-0",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
].join(" ");

export function NewsProse({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(PROSE, className)}>{children}</div>;
}
