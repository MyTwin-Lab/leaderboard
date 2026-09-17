import Link from "next/link";
import { MYTWIN } from "@/lib/seo";

const CLASSES =
  "font-medium text-brandCP underline decoration-brandCP/30 underline-offset-4 transition-colors hover:decoration-brandCP";

/**
 * Un lien dans le texte d'une news.
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
      <Link href={href} className={CLASSES}>
        {children}
      </Link>
    );
  }

  if (href.startsWith(MYTWIN.url)) {
    return (
      <a href={href} className={CLASSES}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener" className={CLASSES}>
      {children}
    </a>
  );
}
