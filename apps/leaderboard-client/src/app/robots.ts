import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * /robots.txt
 *
 * `/api` n'est volontairement pas interdit : les pages de détail (challenge,
 * sandbox) sont des composants client qui lisent leur contenu dans
 * `/api/challenges/<id>/overview` ou `/api/sandboxes/<id>`, et Googlebot
 * respecte robots.txt jusque dans les requêtes qu'il exécute au rendu —
 * interdire `/api` lui rendrait ces pages vides. Les réponses de l'API sont
 * écartées de l'index par l'en-tête `X-Robots-Tag` posé dans next.config.ts.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/signin",
        "/contributors/me",
        "/challenges/*/manage",
        "/tasks/",
        "/sync-meetings/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
