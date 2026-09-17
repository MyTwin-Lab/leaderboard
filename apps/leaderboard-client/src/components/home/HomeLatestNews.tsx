import { NewsCard } from "@/components/news/NewsCard";
import { getLatestNews } from "@/content/news";
import { NEWS_PATH } from "@/lib/paths";
import { HomeSectionHeader } from "./HomeSectionHeader";

const LATEST_COUNT = 3;

/** Un aperçu de MyTwin Lab News : les trois derniers événements du Lab. */
export function HomeLatestNews() {
  const latest = getLatestNews(LATEST_COUNT);
  if (latest.length === 0) return null;

  return (
    <section aria-labelledby="latest-news-title" className="flex flex-col gap-4">
      <HomeSectionHeader
        id="latest-news-title"
        label="MyTwin Lab News"
        title="Latest from the Lab"
        link={{ href: NEWS_PATH, label: "All news" }}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {latest.map((article) => (
          <NewsCard key={article.slug} article={article} />
        ))}
      </div>
    </section>
  );
}
