import Link from "next/link";

import { ArrowIcon } from "@/components/home/ArrowIcon";
import type { NewsCta as NewsCtaData } from "@/content/news/types";

/**
 * Le bouton plein, aux couleurs `foreground` / `background` du thème — ces
 * deux tokens s'échangent avec le mode, là où un `bg-white` opaque resterait
 * blanc en mode clair. Les pages de mytwin.care passent par un `<a>` :
 * `next/link` ne sert que ce site.
 *
 * Il vivait dans les primitives de la page « About », supprimée depuis : le
 * seul appelant restant est cette bannière.
 */
function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    "inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-all duration-200 hover:-translate-y-0.5 hover:gap-2.5";

  const inner = (
    <>
      {children}
      <ArrowIcon />
    </>
  );

  return href.startsWith("http") ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

/**
 * Un seul appel à l'action, en fin d'article, et c'est l'action que la news
 * rend possible : rejoindre le challenge, soutenir le projet, découvrir MyTwin.
 * Au milieu du texte, il ferait d'une news une page de vente.
 */
export function NewsCta({ cta }: { cta: NewsCtaData }) {
  return (
    <aside className="relative mt-14 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-8 sm:mt-16 sm:px-10 sm:py-10">
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brandCP/15 blur-3xl" />
      <div className="relative flex flex-col items-start gap-6">
        <p className="max-w-xl text-balance text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
          {cta.text}
        </p>
        <PrimaryCta href={cta.href}>{cta.label}</PrimaryCta>
      </div>
    </aside>
  );
}
