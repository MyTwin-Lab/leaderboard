import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { config } from "../../../../../packages/config";

/**
 * Identité anonyme d'un visiteur qui star sans compte.
 * -----------------------------------------------------
 * Un JWT HS256 signé avec le secret des sessions — exactement le mécanisme de
 * `lib/auth.ts`, donc pas de nouvelle variable d'environnement. Le cookie ne
 * porte qu'un aléa (`aid`) sans lien avec la personne : il sert l'unicité de la
 * star, jamais l'identification.
 *
 * Signé et non un simple UUID en clair, pour qu'on ne puisse pas se fabriquer
 * une identité par requête et starer autant de fois qu'on veut sans jamais
 * repasser par le débit — le plafond horaire se compte par IP hachée, mais une
 * identité stable est ce qui rend l'unicité par sandbox tenable.
 *
 * Émis **uniquement** par `PUT /star` quand la requête n'en porte pas — jamais
 * sur un GET : un simple lecteur ne repart pas avec un cookie.
 */

export const ANON_COOKIE_NAME = "sb_anon";

/** Un an : la star anonyme doit survivre à une newsletter lue des mois plus tard. */
const ANON_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const ANON_TOKEN_EXPIRY = "365d";

const SECRET = new TextEncoder().encode(config.auth.jwtSecret);

/** Nouvel identifiant anonyme. UUID : aléatoire, et 36 caractères sur les 64 de la colonne. */
export function newAnonId(): string {
  return randomUUID();
}

/**
 * L'identifiant anonyme porté par la requête, ou `null`.
 *
 * `null` couvre les trois cas indistinguables et traités pareil : pas de
 * cookie, signature invalide (secret tourné, cookie bricolé) et jeton expiré.
 * Aucun n'est une erreur — c'est un visiteur sans identité anonyme, à qui
 * `PUT /star` en donnera une.
 */
export async function readAnonId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(ANON_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const aid = payload.aid;
    return typeof aid === "string" && aid.length > 0 ? aid : null;
  } catch {
    return null;
  }
}

/**
 * Pose le cookie anonyme sur une réponse. Mêmes options que les cookies de
 * session de `google-auth/callback` : `httpOnly` (le JS de la page n'a rien à
 * en faire), `sameSite: 'lax'`, `secure` en production, `path: '/'`.
 *
 * Le cookie est **conservé** après un rattachement à un compte : l'invalider
 * produirait une nouvelle identité à la prochaine star anonyme, donc plus de
 * doublons, pas moins.
 */
export async function issueAnonCookie(response: NextResponse, anonId: string): Promise<void> {
  const token = await new SignJWT({ aid: anonId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ANON_TOKEN_EXPIRY)
    .sign(SECRET);

  response.cookies.set(ANON_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ANON_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}
