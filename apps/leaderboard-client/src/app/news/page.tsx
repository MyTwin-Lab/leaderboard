import { NewsCard } from "@/components/news/NewsCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { NEWS_ARTICLES } from "@/content/news";
import { NEWS_PATH, newsPath } from "@/lib/paths";
import { breadcrumbJsonLd, collectionPageJsonLd, jsonLdGraph, pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/news/news-index-vitrine.css";

const TITLE = "MyTwin Lab News | Partnerships, Challenges and Projects";
const DESCRIPTION =
  "News from MyTwin Lab: partner technologies joining MyTwin, open health AI challenges, Sandbox projects and research milestones, told as they happen.";

// La marque d'abord, comme l'accueil : c'est la page qui doit sortir sur
// « MyTwin Lab news ».
export const metadata = pageMetadata({ absoluteTitle: TITLE, description: DESCRIPTION, path: NEWS_PATH });

/**
 * L'index des news, au style vitrine — même fond, mêmes polices et même
 * grammaire d'en-tête que les trois listings et que la page d'un article.
 *
 * La maquette Claude Design ne couvre que l'article ; la page reprend donc
 * `.v-main` et `.v-head` des listings, et la matière des cartes de l'article
 * (`news-index-vitrine.css`). Le wording, lui, ne bouge pas.
 */
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
    <div className={`vitrine v-news ${vitrineFontVars}`}>
      <div className="v-main">
        <JsonLd data={jsonLd} />

        <header className="v-head">
          <div className="v-head-text">
            <BackToLab />
            <h1 className="v-title">
              What’s happening in the <span className="v-news-accent">Lab</span>
            </h1>
            <p className="v-lede">
              Partner technologies joining MyTwin, challenges opening, Sandbox projects taking shape and research
              milestones, step by step, as they happen.
            </p>
          </div>
        </header>

        {latest ? (
          <div className="v-news-grid">
            <NewsCard article={latest} titleAs="h2" featured />
            {rest.map((article) => (
              <NewsCard key={article.slug} article={article} titleAs="h2" />
            ))}
          </div>
        ) : (
          <p className="v-news-empty">The first news is on its way.</p>
        )}
      </div>
    </div>
  );
}
