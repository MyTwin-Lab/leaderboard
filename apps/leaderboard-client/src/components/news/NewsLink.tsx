import Link from "next/link";
import { MYTWIN } from "@/lib/seo";

/**
 * Un lien dans le texte d'une news. Filet sous le mot plutôt que soulignement
 * plein, à l'accent dilué, qui se ravive au survol — la maquette.
 *
 * - Page du Lab → `next/link`.
 * - mytwin.care → même onglet : c'est une suite de lecture, pas une vérification.
 * - Tout le reste (partenaires, sources) → nouvel onglet : un lecteur qui vérifie
 *   une source ne doit pas perdre l'article. Liens éditoriaux, donc sans
 *   `nofollow` ; `noopener` seulement, pour que le partenaire voie d'où vient
 *   la visite.
 */
export function NewsLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className="v-nd-link">
        {children}
      </Link>
    );
  }

  if (href.startsWith(MYTWIN.url)) {
    return (
      <a href={href} className="v-nd-link">
        {children}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener" className="v-nd-link">
      {children}
    </a>
  );
}
