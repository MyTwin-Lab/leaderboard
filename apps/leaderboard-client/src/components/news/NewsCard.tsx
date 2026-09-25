import Link from "next/link";
import { formatEventMonth } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS, type NewsArticle } from "@/content/news/types";
import { newsPath } from "@/lib/paths";
import { NewsArrowRightIcon } from "./NewsIcons";
import { NewsIllustrationFrame } from "./NewsIllustrationFrame";

/**
 * La carte d'une news sur l'index `/news`, au style vitrine.
 *
 * Elle affiche le mois de l'événement, pas la date de publication : plusieurs
 * news peuvent paraître le même jour sur des moments éloignés de l'histoire du
 * Lab, et c'est ce moment qui intéresse le lecteur. Le titre est celui des
 * aperçus (`overviewTitle`), l'illustration s'affiche en tête quand la news en
 * a une.
 *
 * Elle ne sert que cet index : l'accueil a ses deux formes propres
 * (`HomeLatestNews`), et « Keep reading », sous un article, la sienne
 * (`NewsRelated`).
 */
export function NewsCard({
  article,
  titleAs: Title = "h3",
  featured = false,
}: {
  article: NewsArticle;
  titleAs?: "h2" | "h3";
  /** La une de l'index : même carte, un cran de typographie au-dessus, l'illustration à côté du texte. */
  featured?: boolean;
}) {
  return (
    <Link
      href={newsPath(article.slug)}
      data-featured={featured ? "true" : "false"}
      className="group v-news-card"
    >
      {article.illustration && (
        <NewsIllustrationFrame
          illustration={article.illustration}
          sizes={featured ? "(min-width: 768px) 34rem, 100vw" : "(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"}
          className="v-news-shot"
        />
      )}

      <div className="v-news-body">
        <span className="v-news-kicker">
          {NEWS_CATEGORY_LABELS[article.category]} · {formatEventMonth(article.eventMonth)}
        </span>

        <Title className="v-news-title">{article.overviewTitle}</Title>

        <p className="v-news-excerpt">{article.excerpt}</p>

        <span className="v-news-read">
          Read the news
          <NewsArrowRightIcon />
        </span>
      </div>
    </Link>
  );
}
