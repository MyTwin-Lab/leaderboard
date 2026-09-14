/**
 * Options des cookies d'authentification, en un seul endroit.
 * -----------------------------------------------------------
 * La connexion posait ses cookies en `lax` et le refresh en `strict` : la
 * session survivait au login puis se perdait au premier refresh sur un lien
 * venu de Slack ou d'un email (docs/temp.md, L2). Sans import : utilisable
 * depuis n'importe quel runtime.
 */

export const ACCESS_TOKEN_MAX_AGE = 60 * 15; // 15 minutes
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 jours
export const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

/**
 * Cookie de nonce d'un aller-retour OAuth (`g_oauth_state`, `gh_oauth_state`).
 * `lax` et non `strict` : le retour du fournisseur est une navigation
 * cross-site, qui doit porter le cookie.
 */
export function oauthStateCookieOptions() {
  return sessionCookieOptions(OAUTH_STATE_MAX_AGE);
}
