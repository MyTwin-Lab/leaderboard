import type { NewsArticle } from "@/content/news/types";
import { cn } from "@/lib/utils";
import { NewsCta } from "./NewsCta";
import { NewsFaq } from "./NewsFaq";
import { NewsKeyFacts } from "./NewsKeyFacts";
import { NewsProse } from "./NewsProse";
import { NewsSources } from "./NewsSources";
import { NewsToc, type TocItem } from "./NewsToc";

// Ancres fixes : les seules sections que le gabarit ajoute, les autres viennent
// du contenu.
const FAQ_ID = "faq";
const SOURCES_ID = "sources";

// En dessous, une news se lit d'une traite : un sommaire ne ferait qu'ajouter
// un détour.
const MIN_SECTIONS_FOR_TOC = 3;

/**
 * Le corps d'une news : en-tête, « At a glance », chapeau, sections, FAQ
 * éventuelle, appel à l'action, sources.
 *
 * Le bloc titre vit dans la colonne du texte et non au-dessus : c'est ce qui
 * fait démarrer le sommaire collant en haut de l'en-tête. Sans sommaire, la
 * colonne se centre.
 */
export function NewsArticleBody({
  article,
  backLink,
  header,
}: {
  article: NewsArticle;
  /** Au-dessus des deux colonnes, aligné sur le texte de l'article. */
  backLink: React.ReactNode;
  header: React.ReactNode;
}) {
  const hasToc = article.sections.length >= MIN_SECTIONS_FOR_TOC;
  const hasFaq = Boolean(article.faq?.length);

  const tocItems: TocItem[] = [
    ...article.sections.map(({ id, title }) => ({ id, title })),
    ...(hasFaq ? [{ id: FAQ_ID, title: "FAQ" }] : []),
    ...(article.sources.length ? [{ id: SOURCES_ID, title: "Sources" }] : []),
  ];

  return (
    <>
      {/* `lg:ml-68` = la colonne du sommaire (`w-56`) + la gouttière (`gap-12`). */}
      <div className={cn("mb-8", hasToc ? "lg:ml-68" : "mx-auto max-w-3xl")}>{backLink}</div>

      <div className={cn("flex gap-12", !hasToc && "justify-center")}>
        {hasToc && (
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-28">
              <NewsToc items={tocItems} />
            </div>
          </aside>
        )}

        <article className="min-w-0 max-w-3xl flex-1">
          {header}

          <NewsKeyFacts facts={article.facts} />

          {hasToc && (
            // Sous `lg`, pas de colonne pour un sommaire collant : il se replie
            // en tête d'article, sans JS.
            <details className="group mt-8 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                Contents
                <span aria-hidden className="text-brandCP transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-white/60">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="transition-colors hover:text-brandCP">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <NewsProse className="mt-10">{article.intro}</NewsProse>

          {article.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="mt-12 sm:mt-14">
              <h2
                id={section.id}
                className="scroll-mt-24 text-balance text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]"
              >
                {section.title}
              </h2>
              <NewsProse className="mt-5">{section.content}</NewsProse>
            </section>
          ))}

          {hasFaq && <NewsFaq id={FAQ_ID} items={article.faq!} />}

          <NewsCta cta={article.cta} />

          {article.sources.length > 0 && <NewsSources id={SOURCES_ID} sources={article.sources} />}
        </article>
      </div>
    </>
  );
}
