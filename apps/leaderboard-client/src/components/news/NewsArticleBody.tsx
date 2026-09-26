import type { NewsArticle } from "@/content/news/types";

import "@/components/vitrine/vitrine.css";
import "./news-detail-vitrine.css";

import { NewsArticleHeader } from "./NewsArticleHeader";
import { NewsCta } from "./NewsCta";
import { NewsFaq } from "./NewsFaq";
import { NewsHero } from "./NewsHero";
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
 * Le corps d'une news, d'après `News Detail Redesign Vitrine.dc.html` :
 * en-tête, image de tête, puis les deux colonnes — sommaire collant à gauche,
 * article à droite — et enfin le chapeau, les sections, la FAQ,
 * l'appel à l'action et les sources.
 *
 * L'encart « At a glance » de la maquette n'est plus posé : l'article démarre
 * sur son chapeau. Le champ `facts` reste dans le contenu, sans affichage.
 *
 * L'en-tête et l'image tiennent toute la largeur, au-dessus des colonnes :
 * c'est la maquette, et c'est ce qui laisse le titre respirer avant que le
 * texte ne se resserre sur sa mesure de lecture. Sans sommaire, la colonne
 * de lecture se centre.
 *
 * La maquette porte aussi sa navbar et son pied de page : `LabShell` les pose
 * déjà pour toute l'app, ils ne sont pas repris ici.
 */
export function NewsArticleBody({ article }: { article: NewsArticle }) {
  const hasToc = article.sections.length >= MIN_SECTIONS_FOR_TOC;
  const hasFaq = Boolean(article.faq?.length);

  const tocItems: TocItem[] = [
    ...article.sections.map(({ id, title }) => ({ id, title })),
    ...(hasFaq ? [{ id: FAQ_ID, title: "FAQ" }] : []),
    ...(article.sources.length ? [{ id: SOURCES_ID, title: "Sources" }] : []),
  ];

  return (
    <>
      <NewsArticleHeader article={article} />

      {article.illustration && <NewsHero illustration={article.illustration} />}

      <div className="v-nd-body" data-toc={hasToc ? "1" : "0"}>
        {hasToc && (
          <aside className="v-nd-aside">
            <NewsToc items={tocItems} />
          </aside>
        )}

        <article className="v-nd-article">
          {hasToc && (
            // Sous 900px, pas de marge où coller un sommaire : il se replie en
            // tête d'article, en `<details>` natif et sans JS. Sous 768px la
            // feuille le sort tout à fait.
            <details className="v-nd-contents">
              <summary className="v-nd-contents-summary">
                Contents
                <span aria-hidden className="v-nd-plus">
                  +
                </span>
              </summary>
              <ol className="v-nd-contents-list">
                {tocItems.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.title}</a>
                  </li>
                ))}
              </ol>
            </details>
          )}

          <NewsProse className="v-nd-intro">{article.intro}</NewsProse>

          {article.sections.map((section) => (
            <section key={section.id} aria-labelledby={section.id} className="v-nd-section">
              <h2 id={section.id} className="v-nd-section-title">
                {section.title}
              </h2>
              <NewsProse>{section.content}</NewsProse>
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
