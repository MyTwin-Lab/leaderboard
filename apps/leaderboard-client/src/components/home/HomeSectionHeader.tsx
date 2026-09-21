import Link from "next/link";
import { ArrowIcon } from "./ArrowIcon";

/**
 * L'en-tête des sections de l'accueil : libellé, titre, lien « voir tout » à
 * droite.
 *
 * Un lien externe (YouTube, mytwin.care) passe par un <a> : next/link ne sert
 * que ce site.
 */
export function HomeSectionHeader({
  id,
  label,
  title,
  link,
}: {
  id: string;
  label: string;
  title: string;
  link: { href: string; label: string };
}) {
  const linkClass =
    "inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2";

  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">{label}</span>
        <h2 id={id} className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
      </div>
      {link.href.startsWith("/") ? (
        <Link href={link.href} className={linkClass}>
          {link.label}
          <ArrowIcon />
        </Link>
      ) : (
        <a href={link.href} className={linkClass}>
          {link.label}
          <ArrowIcon />
        </a>
      )}
    </div>
  );
}
