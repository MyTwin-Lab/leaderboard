import type { NewsArticle } from "./types";

/**
 * Le registre des news. Ajouter une news = un dossier `<slug>/` + une ligne ici.
 *
 * L'ordre affiché suit `eventMonth`, du plus récent au plus ancien : une news
 * raconte un moment de l'histoire du Lab, et plusieurs peuvent paraître le même
 * jour sur des événements éloignés. À mois égal, l'ordre de ce tableau fait foi.
 */
const ARTICLES: readonly NewsArticle[] = [];

export const NEWS_ARTICLES: readonly NewsArticle[] = [...ARTICLES].sort((a, b) =>
  b.eventMonth.localeCompare(a.eventMonth),
);

export function getNewsBySlug(slug: string): NewsArticle | undefined {
  return NEWS_ARTICLES.find((article) => article.slug === slug);
}

export function getLatestNews(count: number): NewsArticle[] {
  return NEWS_ARTICLES.slice(0, count);
}

/**
 * Même catégorie d'abord : un lecteur venu pour un partenaire a plus de chances
 * de poursuivre sur les autres partenaires que sur un challenge.
 */
export function getRelatedNews(article: NewsArticle, count = 2): NewsArticle[] {
  const others = NEWS_ARTICLES.filter((other) => other.slug !== article.slug);
  return [
    ...others.filter((other) => other.category === article.category),
    ...others.filter((other) => other.category !== article.category),
  ].slice(0, count);
}
