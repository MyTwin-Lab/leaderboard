import Link from "next/link";

import { formatEventMonth, formatNewsDate } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS, type NewsArticle } from "@/content/news/types";
import { NEWS_PATH } from "@/lib/paths";
import { EDITORIAL_AUTHOR } from "@/lib/seo";
import { NewsArrowLeftIcon, NewsClockIcon } from "./NewsIcons";

/** « Rubens Valcy » → « RV ». La pastille de la maquette porte les initiales. */
const INITIALS = EDITORIAL_AUTHOR.name
  .split(" ")
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join("");

/**
 * L'en-tête d'une news, d'après la maquette : retour, surtitre, titre,
 * chapeau, puis la signature et les dates de part et d'autre d'un filet.
 *
 * Il tient toute la largeur de la page et non la colonne de lecture : c'est ce
 * qui laisse le titre respirer sur 52rem avant que l'article ne se resserre
 * sur 44rem, sous le sommaire collant.
 *
 * Le surtitre dit la catégorie et le **mois de l'événement**, pas la date de
 * parution : une news raconte un moment de l'histoire du Lab, et la parution
 * se lit à droite du filet.
 */
export function NewsArticleHeader({ article }: { article: NewsArticle }) {
  return (
    <header className="v-nd-head">
      <Link href={NEWS_PATH} className="v-nd-back">
        <NewsArrowLeftIcon />
        All news
      </Link>

      <span className="v-nd-kicker">
        {NEWS_CATEGORY_LABELS[article.category]} · {formatEventMonth(article.eventMonth)}
      </span>

      <h1 className="v-nd-title">{article.title}</h1>

      <p className="v-nd-lede">{article.excerpt}</p>

      <div className="v-nd-byline">
        <div className="v-nd-author">
          <span className="v-nd-avatar" aria-hidden>
            {INITIALS}
          </span>
          <div className="v-nd-author-text">
            <span className="v-nd-author-name">{EDITORIAL_AUTHOR.name}</span>
            <span className="v-nd-author-role">{EDITORIAL_AUTHOR.role}</span>
          </div>
        </div>

        <div className="v-nd-dates">
          <span>
            Published <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
          </span>
          {article.updatedAt && (
            <span>
              Updated <time dateTime={article.updatedAt}>{formatNewsDate(article.updatedAt)}</time>
            </span>
          )}
          <span className="v-nd-read">
            <NewsClockIcon />
            {article.readingMinutes} min read
          </span>
        </div>
      </div>
    </header>
  );
}
