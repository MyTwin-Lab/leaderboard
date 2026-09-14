import { SignJWT, decodeJwt, jwtVerify } from 'jose';
import { createHash, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { RefreshTokenRepository } from '../../../../packages/database-service/repositories';
import { UserRepository } from '../../../../packages/database-service/repositories';
import { config } from '../../../../packages/config';
import type { SessionUser } from '@/lib/types';
import { parseSessionClaims, type TokenType } from '@/lib/sessionClaims';

const refreshTokenRepo = new RefreshTokenRepository();
const userRepo = new UserRepository();

const JWT_SECRET = new TextEncoder().encode(config.auth.jwtSecret);
const ACCESS_TOKEN_EXPIRY = config.auth.accessExpiry; // "15m"
const REFRESH_TOKEN_EXPIRY = config.auth.refreshExpiry; // "7d"

// Pas d'email : jamais lu côté serveur, et un JWT se décode sans le secret
// (docs/temp.md, L3).
export interface JWTPayload {
  userId: string;
  role: string;
  /** Identifiant unique d'un refresh token, seul lien avec sa ligne en base. */
  jti?: string;
  [key: string]: unknown;
}

/**
 * Délai pendant lequel un refresh token déjà tourné reste accepté. Le proxy
 * rafraîchit la session à chaque requête qui arrive sans access_token valide :
 * plusieurs requêtes parallèles (refetch au retour sur l'onglet) présentent le
 * même refresh token. Un usage unique strict prendrait la seconde pour un vol
 * et déconnecterait l'utilisateur.
 */
const REFRESH_REUSE_GRACE_MS = 30_000;

/**
 * Génère un access token JWT
 */
export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  // Claims explicites plutôt qu'un spread : un payload relu d'un autre jeton
  // (jti, email d'un ancien format) ne doit pas fuiter dans le nouveau.
  return new SignJWT({ userId: payload.userId, role: payload.role, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Génère un refresh token JWT
 */
export async function generateRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role, typ: 'refresh', jti: randomUUID() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

async function verifyTypedToken(token: string, expected: TokenType): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // La signature seule accepterait `sb_anon` et les refresh tokens : voir
    // lib/sessionClaims.ts.
    const claims = parseSessionClaims(payload, expected);
    return claims ? ({ ...payload, ...claims } as JWTPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Vérifie et décode un access token
 */
export function verifyToken(token: string): Promise<JWTPayload | null> {
  return verifyTypedToken(token, 'access');
}

/**
 * Vérifie et décode un refresh token.
 *
 * Exige un `jti` : les refresh tokens émis avant son ajout n'ont aucune ligne
 * en base (hash bcrypt salé, jamais retrouvable) et sont refusés — leurs
 * porteurs se reconnectent une fois.
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyTypedToken(token, 'refresh');
  return payload && typeof payload.jti === 'string' && payload.jti.length > 0 ? payload : null;
}

/**
 * Hash stocké dans `refresh_tokens.token_hash`. Un sha256 non salé suffit : le
 * `jti` est un UUID aléatoire, et le hash doit être retrouvable par égalité
 * (bcrypt ne l'était pas).
 */
export function refreshTokenHash(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

/**
 * Stocke un refresh token en base de données (hash de son `jti`)
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const { jti, exp } = decodeJwt(token);
  if (typeof jti !== 'string' || typeof exp !== 'number') {
    throw new Error('Refresh token without jti/exp');
  }

  await refreshTokenRepo.create({
    user_id: userId,
    token_hash: refreshTokenHash(jti),
    expires_at: new Date(exp * 1000),
  });
}

/**
 * Consomme un refresh token vérifié (rotation).
 *
 * Absent, expiré ou déjà tourné depuis plus de REFRESH_REUSE_GRACE_MS : le
 * jeton a fuité ou été rejoué, toutes les sessions du compte sont révoquées et
 * l'appelant doit répondre 401.
 */
export async function consumeRefreshToken(payload: JWTPayload): Promise<boolean> {
  if (typeof payload.jti !== 'string') return false;
  const tokenHash = refreshTokenHash(payload.jti);
  const row = await refreshTokenRepo.findByHash(tokenHash);
  const now = Date.now();

  if (!row || row.user_id !== payload.userId || row.expires_at.getTime() <= now) {
    await refreshTokenRepo.deleteAllByUserId(payload.userId);
    return false;
  }

  await refreshTokenRepo.shortenExpiry(tokenHash, new Date(now + REFRESH_REUSE_GRACE_MS));
  return true;
}

/**
 * Invalide un refresh token en base, par son `jti`
 */
export async function invalidateRefreshToken(jti: string): Promise<void> {
  await refreshTokenRepo.deleteByHash(refreshTokenHash(jti));
}

/**
 * Invalide tous les refresh tokens d'un utilisateur
 */
export async function invalidateAllUserTokens(userId: string): Promise<void> {
  await refreshTokenRepo.deleteAllByUserId(userId);
}

/**
 * Récupère le token depuis les cookies de la requête
 */
export function getTokenFromRequest(request: NextRequest, tokenName: string = 'access_token'): string | null {
  return request.cookies.get(tokenName)?.value || null;
}

/**
 * Récupère le token depuis les cookies serveur
 */
export async function getTokenFromCookies(tokenName: string = 'access_token'): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(tokenName)?.value || null;
}

/**
 * Vérifie le token depuis la requête et retourne le payload
 */
export async function verifyRequestToken(request: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getTokenFromCookies();
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const user = await userRepo.findById(payload.userId);
  if (!user) return null;
  return {
    id: user.uuid,
    fullName: user.full_name,
    githubUsername: user.github_username ?? '',
    email: user.email ?? '',
    role: user.role,
    avatarUrl: user.avatar_url ?? undefined,
  } satisfies SessionUser;
}

/**
 * Vérifie que l'utilisateur est admin.
 *
 * Le rôle est relu en base : celui du JWT date de l'émission, et un admin
 * rétrogradé le garderait jusqu'à 15 minutes.
 */
export async function verifyAdmin(request: NextRequest): Promise<JWTPayload | null> {
  const payload = await verifyRequestToken(request);
  if (!payload) return null;
  const user = await userRepo.findById(payload.userId);
  if (!user || user.role !== 'admin') return null;
  return { ...payload, role: user.role };
}

/**
 * Vérifie que l'utilisateur a un des rôles autorisés
 */
export async function checkRole(request: NextRequest, allowedRoles: string[]): Promise<boolean> {
  const payload = await verifyRequestToken(request);
  if (!payload) return false;
  return allowedRoles.includes(payload.role);
}

