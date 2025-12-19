import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { RefreshTokenRepository } from '../../../../packages/database-service/repositories';
import { UserRepository } from '../../../../packages/database-service/repositories';
import type { User } from '../../../../packages/database-service/domain/entities';
import * as bcrypt from 'bcryptjs';
import { config } from '../../../../packages/config';
import type { SessionUser } from '@/lib/types';

const refreshTokenRepo = new RefreshTokenRepository();
const userRepo = new UserRepository();

const JWT_SECRET = new TextEncoder().encode(config.auth.jwtSecret);
const ACCESS_TOKEN_EXPIRY = config.auth.accessExpiry; // "15m"
const REFRESH_TOKEN_EXPIRY = config.auth.refreshExpiry; // "7d"

export interface JWTPayload {
  userId: string;
  github_username: string;
  role: string;
  [key: string]: unknown;
}

/**
 * Hash un mot de passe avec bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Vérifie un mot de passe contre son hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Génère un access token JWT
 */
export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Génère un refresh token JWT
 */
export async function generateRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Vérifie et décode un token JWT
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Stocke un refresh token en base de données (hashé)
 */
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = await hashPassword(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

  await refreshTokenRepo.create({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
}

/**
 * Invalide un refresh token en base
 */
export async function invalidateRefreshToken(tokenHash: string): Promise<void> {
  await refreshTokenRepo.deleteByHash(tokenHash);
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
    githubUsername: user.github_username,
    role: user.role,
  } satisfies SessionUser;
}

/**
 * Vérifie que l'utilisateur est admin
 */
export async function verifyAdmin(request: NextRequest): Promise<JWTPayload | null> {
  const payload = await verifyRequestToken(request);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

/**
 * Vérifie que l'utilisateur a un des rôles autorisés
 */
export async function checkRole(request: NextRequest, allowedRoles: string[]): Promise<boolean> {
  const payload = await verifyRequestToken(request);
  if (!payload) return false;
  return allowedRoles.includes(payload.role);
}

/**
 * Récupère un utilisateur par son github_username
 */
export async function getUserByGithubUsername(github_username: string): Promise<User | null> {
  return userRepo.findByGithub(github_username);
}
