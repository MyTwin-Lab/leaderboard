import Link from "next/link";

import { formatEventMonth } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS, type NewsArticle } from "@/content/news/types";
import { NEWS_PATH, newsPath } from "@/lib/paths";
import { NewsArrowRightIcon } from "./NewsIcons";
import { NewsIllustrationFrame } from "./NewsIllustrationFrame";

/**
 * « Keep reading » : les deux news à lire ensuite, dans la carte de la
 * maquette — vignette à gauche, catégorie et mois, titre d'aperçu.
 *
 * `NewsCard` n'est pas réutilisée : c'est la carte de `/news` et de l'accueil,
 * sur une autre forme et un autre fond. Sous 768px, les deux cartes passent en
 * rail, comme la maquette téléphone : empilées, elles feraient deux écrans de
 * défilement pour deux liens.
 */
export function NewsRelated({ articles }: { articles: NewsArticle[] }) {
  if (!articles.length) return null;

  return (
    <section aria-labelledby="related-title" className="v-nd-related">
      <div className="v-nd-related-head">
        <div className="v-nd-related-titles">
          <span className="v-nd-related-eyebrow">Keep reading</span>
          <h2 id="related-title" className="v-nd-related-title">
            More from the Lab.
          </h2>
        </div>
        <Link href={NEWS_PATH} className="v-nd-related-all">
          All news
          <NewsArrowRightIcon />
        </Link>
      </div>

      <div className="v-nd-related-grid">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={newsPath(article.slug)}
            data-shot={article.illustration ? "1" : "0"}
            className="v-nd-card"
          >
            {article.illustration && (
              <NewsIllustrationFrame
                illustration={article.illustration}
                sizes="(min-width: 768px) 7.5rem, 82vw"
                className="v-nd-card-shot bg-[#11161a]"
              />
            )}
            <div className="v-nd-card-body">
              <span className="v-nd-card-kicker">
                {NEWS_CATEGORY_LABELS[article.category]} · {formatEventMonth(article.eventMonth)}
              </span>
              <h3 className="v-nd-card-title">{article.overviewTitle}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
