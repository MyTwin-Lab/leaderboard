/**
 * Les URLs des pages publiques d'un challenge, d'un sandbox et d'une news.
 *
 * Toujours bâties sur le **slug**, jamais sur l'UUID : une page servie à son
 * UUID redirige (308), et un lien qui y mène coûte un aller-retour — et, pour
 * un moteur, un signal de canonique moins net. Les routes d'API, elles,
 * restent sur l'UUID ; les URLs admin (`/admin/challenges/<uuid>`) aussi.
 *
 * Pur : utilisable côté client comme côté serveur.
 */
import { looksLikeUuid } from "../../../../packages/database-service/domain/slug";

export function challengePath(slug: string): string {
  return `/challenges/${slug}`;
}

export function challengeManagePath(slug: string): string {
  return `/challenges/${slug}/manage`;
}

/** Le lien d'invitation d'un groupe : c'est lui, l'invitation (docs/challenge-groups.md). */
export function challengeInvitePath(slug: string, groupToken: string): string {
  return `${challengePath(slug)}?group=${encodeURIComponent(groupToken)}`;
}

/**
 * La connexion depuis la page d'un challenge, avec retour sur cette page — et
 * sur l'invitation, si le visiteur en ouvrait une. Un jeton qui n'a pas la
 * forme d'un UUID n'est pas transmis : `safeInternalPath` refuserait tout le
 * chemin, et le visiteur reviendrait sur l'accueil.
 */
export function challengeSignInPath(slug: string, groupToken?: string | null): string {
  const from = groupToken && looksLikeUuid(groupToken) ? challengeInvitePath(slug, groupToken) : challengePath(slug);
  return `/signin?from=${encodeURIComponent(from)}`;
}

export function sandboxPath(slug: string): string {
  return `/sandbox/${slug}`;
}

export const NEWS_PATH = "/news";

export function newsPath(slug: string): string {
  return `${NEWS_PATH}/${slug}`;
}

/**
 * `path` suivi de la query d'origine, telle que Next la passe à une page
 * (`searchParams`). Sert aux redirections vers l'URL canonique, qui doivent
 * garder `?group=` : un lien d'invitation partagé avant les slugs porte le
 * jeton dans sa query.
 */
export function withSearchParams(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}
