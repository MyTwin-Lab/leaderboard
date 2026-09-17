import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatEventMonth, formatNewsDate } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS, type NewsArticle } from "@/content/news/types";
import { EDITORIAL_AUTHOR } from "@/lib/seo";

export function NewsArticleHeader({ article }: { article: NewsArticle }) {
  return (
    <header className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brandCP">
          {NEWS_CATEGORY_LABELS[article.category]}
        </span>
        <span className="text-xs text-white/45">{formatEventMonth(article.eventMonth)}</span>
        <span aria-hidden className="text-xs text-white/25">·</span>
        <span className="text-xs text-white/45">{article.readingMinutes} min read</span>
      </div>
      <h1 className="text-balance text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
        {article.title}
      </h1>

      <p className="mt-5 text-pretty text-lg leading-relaxed text-white/65 sm:text-xl">{article.excerpt}</p>

      <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <InitialsAvatar name={EDITORIAL_AUTHOR.name} size={40} className="rounded-2xl" />
          <div>
            <p className="text-sm font-semibold text-white">By {EDITORIAL_AUTHOR.name}</p>
            <p className="text-xs text-white/45">{EDITORIAL_AUTHOR.role}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1 text-xs text-white/45 sm:text-right">
          <p>
            Published on <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
          </p>
          {article.updatedAt && (
            <p>
              Updated on <time dateTime={article.updatedAt}>{formatNewsDate(article.updatedAt)}</time>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
