import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * /robots.txt
 *
 * Un seul `Disallow`, `/admin`, qui est derrière une authentification.
 *
 * ⚠️ Un `Disallow` bloque le *crawl* : le moteur ne lit alors jamais le
 * `noindex` de la page, et une URL bloquée qui circule ailleurs — le lien
 * « Sign in » de la navbar est sur toutes les pages — peut rester indexée
 * « sans description ». Les autres pages privées (`/signin`,
 * `/contributors/me`, `/challenges/<id>/manage`, `/tasks`, `/sync-meetings`)
 * restent donc crawlables et portent un `X-Robots-Tag: noindex` posé dans
 * next.config.ts. Les lister ici les rendrait *moins* sûres.
 *
 * `/api` n'est pas interdit non plus : les pages de détail (challenge,
 * sandbox) sont des composants client qui lisent leur contenu dans
 * `/api/challenges/<id>/overview` ou `/api/sandboxes/<id>`, et Googlebot
 * respecte robots.txt jusque dans les requêtes qu'il exécute au rendu —
 * interdire `/api` lui rendrait ces pages vides.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
