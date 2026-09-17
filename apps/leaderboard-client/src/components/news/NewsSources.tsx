import type { NewsSource } from "@/content/news/types";

export const NEWS_DISCLAIMER =
  "This news is provided for information only. The technologies it describes are at research or pilot stage, and none of them replaces advice, diagnosis or treatment from a healthcare professional.";

/**
 * Les sources sont affichées en entier, pas repliées : sur un sujet de santé,
 * pouvoir vérifier d'où vient une affirmation fait partie du contenu lui-même.
 */
export function NewsSources({ id, sources }: { id: string; sources: NewsSource[] }) {
  return (
    <section aria-labelledby={id} className="mt-14 border-t border-white/10 pt-8 sm:mt-16">
      <h2 id={id} className="scroll-mt-24 text-lg font-semibold tracking-tight text-white">
        Sources
      </h2>

      <ol className="mt-5 flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-white/60 marker:text-white/35">
        {sources.map((source) => (
          <li key={source.url} className="pl-1">
            <a
              href={source.url}
              target="_blank"
              rel="noopener"
              className="underline-offset-4 transition-colors hover:text-brandCP hover:underline"
            >
              {source.label}
            </a>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-pretty text-xs leading-relaxed text-white/40">{NEWS_DISCLAIMER}</p>
    </section>
  );
}
