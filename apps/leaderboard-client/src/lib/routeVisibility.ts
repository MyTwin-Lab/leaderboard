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
];

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((pattern) => pattern.test(pathname));
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((pattern) => pattern.test(pathname));
}
