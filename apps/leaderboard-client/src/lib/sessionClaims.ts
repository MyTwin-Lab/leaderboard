/**
 * Claims d'un JWT de session, validés.
 * ------------------------------------
 * Une signature valide ne fait pas une session. Le cookie anonyme `sb_anon`
 * (lib/server/anonVisitor.ts) est signé avec le même secret et ne porte qu'un
 * `aid` ; un refresh token porte le même payload qu'un access token. Sans
 * contrôle de forme, `userId` vaut `undefined` et chaque garde en aval prend
 * ce jeton pour une session.
 *
 * Sans import : proxy.ts l'utilise aussi (même contrainte que routeVisibility.ts).
 */

export type TokenType = 'access' | 'refresh';

export interface SessionClaims {
  userId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Les claims d'une session du type attendu, ou `null`.
 *
 * Le rôle n'est pas comparé à une liste : la colonne est une chaîne libre, et
 * un rôle inattendu doit être refusé par les gardes de rôle, pas déconnecter
 * le compte.
 */
export function parseSessionClaims(
  payload: Record<string, unknown>,
  expected: TokenType,
): SessionClaims | null {
  if (!isUuid(payload.userId)) return null;
  if (typeof payload.role !== 'string' || payload.role.length === 0) return null;
  // Jetons émis avant l'ajout de `typ` : tolérés jusqu'à l'expiration du
  // dernier refresh token de l'ancien format, 7 jours après le déploiement.
  // Le contrôle de `userId` suffit déjà à écarter `sb_anon`.
  if (payload.typ !== undefined && payload.typ !== expected) return null;
  return { userId: payload.userId, role: payload.role };
}
