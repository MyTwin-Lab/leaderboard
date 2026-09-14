/**
 * Exceptions to the prefix gates in proxy.ts.
 *
 * proxy.ts matches with startsWith(), which cannot express "the challenge
 * detail page but not its /manage sub-page" — `/challenges/` covers both.
 * These patterns are anchored at both ends so a single extra path segment is
 * enough to fall back under the protected prefix.
 *
 * Edge-safe on purpose: proxy.ts runs in the Edge runtime, so this module
 * stays pure regex with no imports.
 */
const PUBLIC_PAGES = [/^\/challenges\/[^/]+\/?$/];

const PUBLIC_API_ROUTES = [
  /^\/api\/challenges\/[^/]+\/overview$/,
  /^\/api\/challenges\/[^/]+\/repo-activity$/,
  /^\/api\/challenges\/[^/]+\/ml-rewards$/,
  // Le brief seul, pas le tiroir Docs : `documents` sert tout ce qu'un admin a
  // déposé, `brief` ne sert que la page de garde — celle qu'on lit justement
  // avant d'avoir un compte.
  /^\/api\/challenges\/[^/]+\/brief$/,
  // Le détail d'une récompense, déplié depuis la fiche publique
  // `/contributors/[userId]`. Ouvert parce que la route ne renvoie plus `meta`
  // (extraits Slack, justifications IA) : libellés, points et noms seulement.
  /^\/api\/contributions\/[^/]+\/rewards$/,
];

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((pattern) => pattern.test(pathname));
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((pattern) => pattern.test(pathname));
}
