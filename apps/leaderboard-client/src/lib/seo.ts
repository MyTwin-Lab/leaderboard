import type { Metadata, MetadataRoute } from "next";
import { challengePath, sandboxPath } from "@/lib/paths";

/**
 * Ce que les moteurs de recherche et les aperçus de lien lisent : nom du site,
 * URL publique, descriptions, forme des métadonnées d'une page et données
 * structurées (JSON-LD).
 *
 * Pur (ni base, ni `server-only`) : `robots.ts`, `opengraph-image.tsx` et les
 * layouts l'importent, et les tests l'appellent sans rien mocker.
 */
export const SITE_NAME = "MyTwin Lab";

/**
 * L'URL publique canonique, sans slash final.
 *
 * Une constante, et non plus `NEXT_PUBLIC_APP_URL` : la variable valait l'URL
 * Scalingo en production, si bien que canonical, sitemap et robots.txt
 * désignaient tous un domaine qui redirige vers celui-ci — le signal que Google
 * sait le moins consolider. Le domaine fait partie de l'entité (il est dans
 * l'`@id` du JSON-LD), il n'a pas à varier d'un environnement à l'autre.
 */
export const SITE_URL = "https://mytwinlab.care";

export const DEFAULT_DESCRIPTION =
  "MyTwin Lab is the open innovation lab of MyTwin: clinicians, researchers, engineers and students take on real health challenges, together and in the open.";

/**
 * L'entité mère, déclarée par mytwin.care (`src/lib/seo.ts` du repo
 * mytwin-health-landing). Nom, URL et `@id` doivent y être identiques au
 * caractère près : c'est l'`@id` qui relie les deux graphes en une seule
 * famille d'entités, et deux orthographes la couperaient en deux.
 */
export const MYTWIN = {
  name: "MyTwin",
  url: "https://mytwin.care",
  id: "https://mytwin.care/#organization",
  /** L'accueil réel : `/` redirige vers la locale par défaut. */
  home: "https://mytwin.care/en",
  clinicians: "https://mytwin.care/en/clinicians",
  contact: "https://mytwin.care/en/contact-us",
} as const;

/**
 * Pages externes qui représentent le Lab lui-même. On ne déclare que ce qui
 * existe et se vérifie : un `sameAs` vers un profil mort dessert l'entité.
 */
const LAB_SAME_AS = ["https://github.com/MyTwin-Lab"] as const;

/**
 * Réduit un texte saisi (souvent du markdown) à une meta description : texte
 * brut, une seule ligne, coupé sur un mot à `max` caractères au plus.
 * Renvoie `undefined` quand il ne reste rien, pour que la page hérite de la
 * description par défaut au lieu d'en publier une vide.
 */
export function toMetaDescription(text: string | null | undefined, max = 160): string | undefined {
  if (!text) return undefined;

  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    // Bornée par des non-mots, pour que le `_` de `snake_case` ne passe pas pour de l'emphase.
    .replace(/(?<!\w)(\*\*|__|~~|\*|_|`)(\S(?:.*?\S)?)\1(?!\w)/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return undefined;
  if (plain.length <= max) return plain;

  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Un seul mot très long : couper au milieu vaut mieux que ne rien garder.
  const kept = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}

/**
 * Les métadonnées d'une page publique : titre, description, URL canonique et
 * aperçus Open Graph / Twitter.
 *
 * Chaque page déclare son propre `canonical` : posé dans le layout racine, il
 * serait hérité par toutes les pages et les désignerait toutes comme doublons
 * de l'accueil. `openGraph` est de même reconstruit en entier, parce que Next
 * remplace cet objet d'un niveau à l'autre au lieu de le fusionner. L'image,
 * elle, vient de `app/opengraph-image.tsx` et s'applique partout.
 *
 * `title` passe par le gabarit du layout (« Titre | MyTwin Lab ») ;
 * `absoluteTitle` l'écrit en entier, pour les pages dont le titre commence par
 * la marque. Sans l'un ni l'autre, la page garde le titre par défaut du site.
 */
export function pageMetadata({
  title,
  absoluteTitle,
  description,
  path,
}: {
  title?: string;
  absoluteTitle?: string;
  description?: string;
  path: string;
}): Metadata {
  const fullTitle = absoluteTitle ?? (title ? `${title} | ${SITE_NAME}` : SITE_NAME);
  const withTitle = absoluteTitle ? { title: { absolute: absoluteTitle } } : title ? { title } : {};
  const withDescription = description ? { description } : {};

  return {
    ...withTitle,
    ...withDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title: fullTitle,
      ...withDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      ...withDescription,
    },
  };
}

/** Métadonnées d'une page qui ne doit pas être indexée (inconnue, privée, retirée). */
export function unindexedMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

export type SitemapInput = {
  baseUrl: string;
  /** Déjà filtrés sur ce qu'un visiteur anonyme peut ouvrir. */
  challenges: { slug: string; created_at: Date; closed_at?: Date | null }[];
  /** Déjà filtrés sur ce qu'un visiteur anonyme peut ouvrir. */
  sandboxes: { slug: string; updated_at: Date }[];
  /** Faux quand le module sandbox est désactivé : `/sandbox` répond alors 404. Vrai par défaut. */
  sandboxEnabled?: boolean;
};

/**
 * Ne liste que les pages qui doivent être indexées. Les profils contributeurs
 * n'y figurent plus : ils sont en `noindex` (des noms de personnes n'ont rien
 * à faire dans Google), et une URL en `noindex` dans un sitemap dégrade la
 * confiance que Google accorde au fichier entier.
 */
export function buildSitemap({ baseUrl, challenges, sandboxes, sandboxEnabled = true }: SitemapInput): MetadataRoute.Sitemap {
  const url = (path: string) => `${baseUrl}${path}`;

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.9 },
    { url: url("/challenges"), changeFrequency: "daily", priority: 0.9 },
    ...(sandboxEnabled ? [{ url: url("/sandbox"), changeFrequency: "daily" as const, priority: 0.8 }] : []),
    { url: url("/leaderboard"), changeFrequency: "daily", priority: 0.6 },
    { url: url("/terms-of-use"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/privacy-policy"), changeFrequency: "yearly", priority: 0.2 },
    ...challenges.map((challenge) => ({
      url: url(challengePath(challenge.slug)),
      lastModified: challenge.closed_at ?? challenge.created_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...sandboxes.map((sandbox) => ({
      url: url(sandboxPath(sandbox.slug)),
      lastModified: sandbox.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Données structurées
// ---------------------------------------------------------------------------
// L'entité MyTwin Lab est déclarée ici une seule fois et émise à l'identique
// partout où elle apparaît : une entité qui se décrit différemment selon la
// page est une entité floue.

type JsonLdNode = Record<string, unknown>;

export const LAB_ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Le Lab est une organisation fille de MyTwin, pas la même entité : d'où
 * `parentOrganization` plutôt qu'un `sameAs` vers mytwin.care, qui dirait à
 * Google que les deux sites parlent d'une seule et même chose.
 */
export function labOrganizationJsonLd(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": LAB_ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logos/mytwinlab-logo.png`,
      width: 924,
      height: 372,
    },
    description: DEFAULT_DESCRIPTION,
    parentOrganization: {
      "@type": "Organization",
      "@id": MYTWIN.id,
      name: MYTWIN.name,
      url: MYTWIN.url,
    },
    sameAs: [...LAB_SAME_AS],
  };
}

/** `alternateName` : le nom sous lequel le site a d'abord circulé. */
export function websiteJsonLd(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    alternateName: ["MyTwin Lab Leaderboard"],
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": LAB_ORGANIZATION_ID },
  };
}

export function jsonLdGraph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * Le fil d'Ariane d'une page de détail : Google affiche le nom de la section et
 * le titre sous le résultat (« MyTwin Lab › Challenges › Mammography… »), plus
 * lisible que le chemin, même à slug.
 */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
