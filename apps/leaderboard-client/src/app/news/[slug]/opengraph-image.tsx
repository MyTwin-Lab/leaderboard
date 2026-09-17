import { ImageResponse } from "next/og";
import { NEWS_ARTICLES, getNewsBySlug } from "@/content/news";
import { formatEventMonth } from "@/content/news/format";
import { NEWS_CATEGORY_LABELS } from "@/content/news/types";

/**
 * L'aperçu partagé d'une news (LinkedIn, Slack, X) et l'`image` de son
 * `NewsArticle` : son titre sur le fond de l'image du site
 * (`app/opengraph-image.tsx`), pour que chaque news se reconnaisse dans un fil
 * sans produire d'illustration. Générée au build, comme celle du site.
 */
export const alt = "MyTwin Lab News";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#0af7c1";

export function generateStaticParams() {
  return NEWS_ARTICLES.map((article) => ({ slug: article.slug }));
}

export default async function NewsOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getNewsBySlug((await params).slug);
  const title = article?.title ?? "MyTwin Lab News";
  // Plus le titre est long, plus la police descend : au-delà de trois lignes, il
  // écraserait le pied de l'image.
  const fontSize = title.length > 90 ? 50 : title.length > 70 ? 56 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #05070d 0%, #0b1a24 60%, #06302a 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 4, borderRadius: 2, background: BRAND }} />
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: BRAND }}>
            {article ? NEWS_CATEGORY_LABELS[article.category].toUpperCase() : "NEWS"}
          </div>
          {article && (
            <div style={{ fontSize: 26, color: "rgba(255,255,255,0.55)" }}>{formatEventMonth(article.eventMonth)}</div>
          )}
        </div>

        <div style={{ display: "flex", fontSize, fontWeight: 700, lineHeight: 1.12 }}>{title}</div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "rgba(255,255,255,0.6)" }}>
          <span>MyTwin Lab News</span>
          <span>mytwinlab.care</span>
        </div>
      </div>
    ),
    size,
  );
}
