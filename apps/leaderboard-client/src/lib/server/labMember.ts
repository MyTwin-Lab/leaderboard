import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config } from "../../../../../packages/config";

/**
 * Le membre du Lab, tel que ce navigateur s'en souvient.
 * ------------------------------------------------------
 * Posé par l'inscription de `/join`, lu par `/join/welcome` : il porte
 * l'e-mail, que la page d'accueil rappelle, sans que l'adresse passe jamais
 * dans une URL (historique, journaux, en-tête `Referer`).
 *
 * Un JWT HS256 signé avec le secret des sessions, comme `sb_anon`
 * (`anonVisitor.ts`) : pas de nouvelle variable d'environnement. L'audience
 * `lab-member` l'empêche de passer pour un autre jeton signé du même secret.
 * Signé, pour qu'une page d'accueil ne s'ouvre qu'au navigateur qui s'est
 * inscrit.
 */

export const LAB_MEMBER_COOKIE_NAME = "lab_member";

const AUDIENCE = "lab-member";
/** Un an : la page de bienvenue doit encore se souvenir après une newsletter lue des mois plus tard. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const SECRET = new TextEncoder().encode(config.auth.jwtSecret);

export interface LabMember {
  email: string;
}

/**
 * Le membre porté par la requête, ou `null` : pas de cookie, signature
 * invalide (secret tourné, cookie bricolé) ou jeton expiré — trois cas qui
 * reviennent au même, un visiteur à renvoyer vers `/join`.
 */
export async function readLabMember(): Promise<LabMember | null> {
  const token = (await cookies()).get(LAB_MEMBER_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET, { audience: AUDIENCE });
    if (typeof payload.email !== "string" || payload.email.length === 0) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

/**
 * (Re)pose le cookie. Server action seulement : un composant serveur ne peut
 * pas écrire de cookie. Mêmes options que `sb_anon` — `httpOnly`, le JS de la
 * page n'a rien à en lire.
 */
export async function writeLabMember(member: LabMember): Promise<void> {
  const token = await new SignJWT({ email: member.email })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(SECRET);

  (await cookies()).set(LAB_MEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}
