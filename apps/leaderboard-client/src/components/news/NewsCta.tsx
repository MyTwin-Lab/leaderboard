import { PrimaryCta } from "@/components/about/primitives";
import type { NewsCta as NewsCtaData } from "@/content/news/types";

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
