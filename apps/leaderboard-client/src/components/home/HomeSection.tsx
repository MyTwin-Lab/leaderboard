import Link from "next/link";
import { ArrowIcon } from "./ArrowIcon";

/** Le titre des sections de l'accueil. */
export function HomeSectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
      {children}
    </h2>
  );
}

/** Le lien « voir tout » d'une section de l'accueil, en bas à droite, sous son contenu. */
export function HomeSectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 self-end text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2"
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}
