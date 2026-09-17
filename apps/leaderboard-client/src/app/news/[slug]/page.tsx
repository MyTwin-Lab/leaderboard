import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsArticleBody } from "@/components/news/NewsArticleBody";
import { NewsArticleHeader } from "@/components/news/NewsArticleHeader";
import { NewsCard } from "@/components/news/NewsCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { NEWS_ARTICLES, getNewsBySlug, getRelatedNews } from "@/content/news";
import { NEWS_CATEGORY_LABELS } from "@/content/news/types";
import { NEWS_PATH, newsPath } from "@/lib/paths";
import {
  SITE_URL,
  articleMetadata,
  breadcrumbJsonLd,
  jsonLdGraph,
  newsArticleJsonLd,
  unindexedMetadata,
} from "@/lib/seo";

type NewsPageProps = { params: Promise<{ slug: string }> };

// Le contenu est dans le code : une news inconnue est un 404, pas une page à
// résoudre au runtime.
export const dynamicParams = false;

export function generateStaticParams() {
  return NEWS_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: NewsPageProps) {
  const article = getNewsBySlug((await params).slug);
  if (!article) return unindexedMetadata("News");

  return articleMetadata({
    title: article.seoTitle,
    description: article.description,
    path: newsPath(article.slug),
    publishedTime: article.publishedAt,
    modifiedTime: article.updatedAt ?? article.publishedAt,
    tags: article.keywords,
  });
}

export default async function NewsArticlePage({ params }: NewsPageProps) {
  const article = getNewsBySlug((await params).slug);
  if (!article) notFound();

  const path = newsPath(article.slug);
  const related = getRelatedNews(article);

  const jsonLd = jsonLdGraph(
    newsArticleJsonLd({
      path,
      headline: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      // L'image générée par `opengraph-image.tsx` : `image` conditionne
      // l'éligibilité aux résultats enrichis Article.
      image: `${SITE_URL}${path}/opengraph-image`,
      keywords: article.keywords,
      section: NEWS_CATEGORY_LABELS[article.category],
      sources: article.sources,
      mentions: article.mentions,
    }),
    breadcrumbJsonLd([
      { name: "MyTwin Lab", path: "/" },
      { name: "News", path: NEWS_PATH },
      { name: article.title, path },
    ]),
  );

  return (
    <div className="flex flex-col gap-16 pt-4 sm:gap-20 sm:pt-8">
      <JsonLd data={jsonLd} />

      <div>
        <NewsArticleBody
          article={article}
          backLink={
            <Link
              href={NEWS_PATH}
              className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-brandCP"
            >
              <span aria-hidden>←</span> All news
            </Link>
          }
          header={<NewsArticleHeader article={article} />}
        />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="flex flex-col gap-5 border-t border-white/10 pt-10">
          <h2 id="related-title" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Keep reading
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {related.map((other) => (
              <NewsCard key={other.slug} article={other} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
