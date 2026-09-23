import Link from "next/link";

import { NewsIllustrationFrame } from "@/components/news/NewsIllustrationFrame";
import { getLatestNews } from "@/content/news";
import { formatEventMonth } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS } from "@/content/news/types";
import { NEWS_PATH, newsPath } from "@/lib/paths";
import { HomeArrow, HomeMore, HomeSectionHead } from "./HomeSection";

/** La une, puis deux brèves : la maquette hiérarchise, elle n'aligne pas. */
const LATEST_COUNT = 3;

/**
 * Un aperçu de MyTwin Lab News.
 *
 * La carte de `/news` n'est pas réutilisée : la maquette donne à la première
 * news une forme qu'elle n'a nulle part ailleurs — photo et texte côte à côte,
 * extrait, appel à lire — et aux deux suivantes une vignette à gauche d'un
 * titre. Deux formes propres à cette page ; `/news` garde la sienne.
 *
 * Les trois vivent dans le même conteneur, et c'est ce qui permet à la version
 * téléphone d'exister sans dupliquer le balisage : la hiérarchie n'y tient pas
 * — une vedette pleine largeur puis deux brèves font trois écrans de
 * défilement — la maquette les remet donc à égalité dans un rail. Une grille
 * où la première occupe les deux colonnes devient ce rail par une seule
 * bascule de `display`.
 */
export function HomeLatestNews() {
  const [lead, ...rest] = getLatestNews(LATEST_COUNT);
  if (!lead) return null;

  return (
    <section aria-labelledby="news-title" className="v-home-section">
      <HomeSectionHead
        id="news-title"
        eyebrow="News"
        tagline="Explore the work behind the mission."
        href={NEWS_PATH}
        linkLabel="All news"
      />

      <div className="v-home-news-list">
        <Link href={newsPath(lead.slug)} className="v-home-feature">
          {lead.illustration && (
            <NewsIllustrationFrame
              illustration={lead.illustration}
              sizes="(min-width: 768px) 38rem, 82vw"
              className="v-home-shot"
            />
          )}
          <div className="v-home-feature-body">
            <span className="v-home-kicker">
              {NEWS_CATEGORY_LABELS[lead.category]} · {formatEventMonth(lead.eventMonth)}
            </span>
            <h3>{lead.overviewTitle}</h3>
            <p>{lead.excerpt}</p>
            <span className="v-home-read">
              Read article
              <HomeArrow />
            </span>
          </div>
        </Link>

        {rest.map((article) => (
          <Link key={article.slug} href={newsPath(article.slug)} className="v-home-brief">
            {article.illustration && (
              <NewsIllustrationFrame
                illustration={article.illustration}
                sizes="(min-width: 768px) 7.5rem, 82vw"
                className="v-home-brief-shot"
              />
            )}
            <div className="v-home-brief-body">
              <span className="v-home-kicker">
                {NEWS_CATEGORY_LABELS[article.category]} · {formatEventMonth(article.eventMonth)}
              </span>
              <h3>{article.overviewTitle}</h3>
            </div>
          </Link>
        ))}
      </div>

      {/* Sur téléphone la maquette redescend le lien sous le rail. */}
      <HomeMore href={NEWS_PATH} place="bottom">
        All news
      </HomeMore>
    </section>
  );
}
