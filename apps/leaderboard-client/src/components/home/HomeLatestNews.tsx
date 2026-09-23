import { NewsCard } from "@/components/news/NewsCard";
import { getLatestNews } from "@/content/news";
import { NEWS_PATH } from "@/lib/paths";
import { HomeNewsCarousel } from "./HomeNewsCarousel";
import { HomeSectionHead } from "./HomeSection";

const LATEST_COUNT = 3;

/**
 * Un aperçu de MyTwin Lab News : les trois derniers événements du Lab.
 *
 * La carte est celle de `/news`, rhabillée en carte vitrine depuis
 * `home-vitrine.css` : elle garde son balisage, et `/news` son apparence.
 */
export function HomeLatestNews() {
  const latest = getLatestNews(LATEST_COUNT);
  if (latest.length === 0) return null;

  return (
    <section aria-labelledby="latest-news-title" className="v-home-section">
      <HomeSectionHead id="latest-news-title" title="News" href={NEWS_PATH} linkLabel="All news" />

      <HomeNewsCarousel>
        {latest.map((article) => (
          <NewsCard key={article.slug} article={article} compact className="v-home-news-card" />
        ))}
      </HomeNewsCarousel>
    </section>
  );
}
