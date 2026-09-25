import { cn } from "@/lib/utils";

/**
 * Le texte courant d'une news s'écrit en balises nues (`<p>`, `<ul>`, `<h3>`) :
 * c'est ce qui garde les fichiers de contenu lisibles.
 *
 * La mise en forme vit dans `news-detail-vitrine.css`, sous `.v-nd-prose`, et
 * ne vise que les enfants **directs** — un bloc visuel posé au milieu du texte
 * garde donc sa propre typographie, sans rien avoir à neutraliser. Le
 * conteneur est une grille : la respiration entre deux blocs est son `gap`, et
 * non une marge que chaque bloc devrait poser.
 */
export function NewsProse({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("v-nd-prose", className)}>{children}</div>;
}
