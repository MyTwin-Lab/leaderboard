import Link from "next/link";
import { ArrowIcon } from "@/components/home/ArrowIcon";
import { formatEventMonth } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS, type NewsArticle } from "@/content/news/types";
import { newsPath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { NewsIllustrationFrame } from "./NewsIllustrationFrame";

/**
 * La carte d'une news : accueil, index `/news` et « Keep reading ».
 *
 * Elle affiche le mois de l'événement, pas la date de publication : plusieurs
 * news peuvent paraître le même jour sur des moments éloignés de l'histoire du
 * Lab, et c'est ce moment qui intéresse le lecteur. Le titre est celui des
 * aperçus (`overviewTitle`), l'illustration s'affiche en tête quand la news en a
 * une. En version `compact` (l'accueil), la carte perd son extrait et son appel
 * se réduit à « Read ».
 */
export function NewsCard({
  article,
  titleAs: Title = "h3",
  featured = false,
  compact = false,
  className,
}: {
  article: NewsArticle;
  titleAs?: "h2" | "h3";
  /** La une de `/news` : même carte, un cran de typographie au-dessus, l'illustration à côté du texte. */
  featured?: boolean;
  /** L'accueil : illustration, catégorie, date, titre et « Read », sans extrait. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={newsPath(article.slug)}
      className={cn(
        "animate-fade-up group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_14px_40px_-26px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brandCP/25 hover:bg-white/[0.06]",
        featured && article.illustration && "md:flex-row-reverse",
        className,
      )}
    >
      {article.illustration && (
        <NewsIllustrationFrame
          illustration={article.illustration}
          sizes={featured ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"}
          className={cn("aspect-[16/10] shrink-0", featured && "md:aspect-auto md:min-h-80 md:w-1/2")}
        />
      )}

      <div className={cn("flex flex-1 flex-col gap-3 p-5 sm:p-6", featured && "sm:p-8")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-brandCP/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brandCP">
            {NEWS_CATEGORY_LABELS[article.category]}
          </span>
          <span className="text-xs text-white/45">{formatEventMonth(article.eventMonth)}</span>
        </div>

        <Title
          className={cn(
            "text-balance font-semibold leading-snug tracking-tight text-white transition-colors duration-200 group-hover:text-brandCP",
            featured ? "text-2xl sm:text-3xl" : "text-lg",
          )}
        >
          {article.overviewTitle}
        </Title>

        {/* Pas de `flex-1` ici : étiré au-delà de ses lignes, un paragraphe tronqué
            (`line-clamp`) laisse voir la moitié de la ligne suivante. C'est le lien
            qui prend l'espace restant. */}
        {!compact && (
          <p
            className={cn(
              "text-pretty leading-relaxed text-white/60",
              featured ? "line-clamp-4 text-base sm:text-lg" : "line-clamp-3 text-sm",
            )}
          >
            {article.excerpt}
          </p>
        )}

        {compact ? (
          <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13px] font-medium text-brandCP transition-all duration-200 group-hover:gap-2">
            Read
            <ArrowIcon className="h-3 w-3" />
          </span>
        ) : (
          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-brandCP transition-all duration-200 group-hover:gap-2">
            Read the news
            <ArrowIcon />
          </span>
        )}
      </div>
    </Link>
  );
}
