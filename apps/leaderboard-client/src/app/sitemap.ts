import type { MetadataRoute } from "next";
import { fetchSitemap } from "@/lib/server/seo";

/**
 * /sitemap.xml
 *
 * Dynamique, comme le reste de l'app : généré au build, il lirait la base
 * pendant `next build` et figerait la liste des challenges jusqu'au déploiement
 * suivant.
 */
export const dynamic = "force-dynamic";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return fetchSitemap();
}
