import type { Metadata, MetadataRoute } from "next";

/**
 * Ce que les moteurs de recherche et les aperçus de lien lisent : nom du site,
 * URL publique, descriptions, et forme des métadonnées d'une page.
 *
 * Pur (ni base, ni `server-only`) : `robots.ts`, `opengraph-image.tsx` et les
 * layouts l'importent, et les tests l'appellent sans rien mocker.
 */
export const SITE_NAME = "MyTwin Leaderboard";

export const DEFAULT_DESCRIPTION =
  "Students, engineers, clinicians and researchers building the most advanced digital twin of the human body. Every contribution is tracked, evaluated and rewarded in CP.";

const LOCAL_URL = "http://localhost:3000";

/**
 * L'URL publique canonique, sans slash final.
 *
 * Lue dans `NEXT_PUBLIC_APP_URL` et non dans la requête (comme `getBaseUrl`) :
 * une URL canonique ne doit pas changer selon l'hôte par lequel on est arrivé.
 * Une valeur absente ou invalide retombe sur localhost plutôt que de faire
 * planter `metadataBase`, qui exige une URL valide.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Valeur mal formée : on garde le repli local.
    }
  }
  return LOCAL_URL;
}

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
 * Sans `title`, la page garde le titre par défaut du site (l'accueil).
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title?: string;
  description?: string;
  path: string;
}): Metadata {
  const fullTitle = title ? `${title} - ${SITE_NAME}` : SITE_NAME;
  const withDescription = description ? { description } : {};

  return {
    ...(title ? { title } : {}),
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
  challenges: { uuid: string; created_at: Date; closed_at?: Date | null }[];
  /** Déjà filtrés sur ce qu'un visiteur anonyme peut ouvrir. */
  sandboxes: { uuid: string; updated_at: Date }[];
  contributorIds: string[];
};

export function buildSitemap({
  baseUrl,
  challenges,
  sandboxes,
  contributorIds,
}: SitemapInput): MetadataRoute.Sitemap {
  const url = (path: string) => `${baseUrl}${path}`;

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/leaderboard"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/challenges"), changeFrequency: "daily", priority: 0.9 },
    { url: url("/sandbox"), changeFrequency: "daily", priority: 0.8 },
    { url: url("/about"), changeFrequency: "monthly", priority: 0.5 },
    ...challenges.map((challenge) => ({
      url: url(`/challenges/${challenge.uuid}`),
      lastModified: challenge.closed_at ?? challenge.created_at,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...sandboxes.map((sandbox) => ({
      url: url(`/sandbox/${sandbox.uuid}`),
      lastModified: sandbox.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...contributorIds.map((id) => ({
      url: url(`/contributors/${id}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
