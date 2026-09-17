import { NewsCard } from "@/components/news/NewsCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { NEWS_ARTICLES } from "@/content/news";
import { NEWS_PATH, newsPath } from "@/lib/paths";
import { breadcrumbJsonLd, collectionPageJsonLd, jsonLdGraph, pageMetadata } from "@/lib/seo";

const TITLE = "MyTwin Lab News | Partnerships, Challenges and Projects";
const DESCRIPTION =
  "News from MyTwin Lab: partner technologies joining MyTwin, open health AI challenges, Sandbox projects and research milestones, told as they happen.";

// La marque d'abord, comme l'accueil : c'est la page qui doit sortir sur
// « MyTwin Lab news ».
export const metadata = pageMetadata({ absoluteTitle: TITLE, description: DESCRIPTION, path: NEWS_PATH });

export default function NewsIndexPage() {
  const [latest, ...rest] = NEWS_ARTICLES;

  const jsonLd = jsonLdGraph(
    collectionPageJsonLd({
      path: NEWS_PATH,
      name: "MyTwin Lab News",
      description: DESCRIPTION,
      items: NEWS_ARTICLES.map((article) => ({ name: article.title, path: newsPath(article.slug) })),
    }),
    breadcrumbJsonLd([
      { name: "MyTwin Lab", path: "/" },
      { name: "News", path: NEWS_PATH },
    ]),
  );

  return (
    <div className="flex flex-col gap-10 sm:gap-14">
      <JsonLd data={jsonLd} />

      <header className="animate-fade-up flex max-w-3xl flex-col gap-5 pt-4 sm:pt-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">MyTwin Lab News</span>
        <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl">
          What’s happening in the <span className="text-brandCP">Lab</span>
        </h1>
        <p className="text-base leading-relaxed text-white/60 sm:text-lg">
          Partner technologies joining MyTwin, challenges opening, Sandbox projects taking shape and research
          milestones, step by step, as they happen.
        </p>
      </header>

      {latest ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <NewsCard article={latest} titleAs="h2" featured className="md:col-span-2 lg:col-span-3" />
          {rest.map((article) => (
            <NewsCard key={article.slug} article={article} titleAs="h2" />
          ))}
        </div>
      ) : (
        <p className="text-white/60">The first news is on its way.</p>
      )}
    </div>
  );
}
