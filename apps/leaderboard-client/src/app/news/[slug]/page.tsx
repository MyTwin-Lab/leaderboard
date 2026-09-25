import { notFound } from "next/navigation";
import { NewsArticleBody } from "@/components/news/NewsArticleBody";
import { NewsRelated } from "@/components/news/NewsRelated";
import { JsonLd } from "@/components/seo/JsonLd";
import { vitrineFontVars } from "@/components/vitrine/fonts";
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
      video: article.video,
    }),
    breadcrumbJsonLd([
      { name: "MyTwin Lab", path: "/" },
      { name: "News", path: NEWS_PATH },
      { name: article.title, path },
    ]),
  );

  return (
    <div className={`vitrine v-nd ${vitrineFontVars}`}>
      <JsonLd data={jsonLd} />

      <NewsArticleBody article={article} />

      <NewsRelated articles={related} />
    </div>
  );
}
