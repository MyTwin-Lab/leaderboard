import "server-only";

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/seo";

/**
 * Le rendu serveur des pages publiques dont le contenu vit côté client
 * (`/challenges/<slug>`, `/sandbox`, `/sandbox/<slug>`).
 *
 * Ces pages sont des composants client qui lisent leurs données dans l'API
 * après une première requête `/api/contributors/me`. Rendues telles quelles,
 * elles n'envoient qu'un squelette : Google doit exécuter le JavaScript pour
 * voir le contenu, et les crawlers qui ne l'exécutent pas (Bing en partie, les
 * IA, les aperçus de lien) ne voient rien.
 *
 * Pour un visiteur **sans aucun cookie** — ce qu'est toujours un crawler — la
 * page serveur pré-remplit le cache React Query avec exactement ce que le
 * navigateur aurait reçu, et le composant client se rend complet dès le HTML.
 * Pour tout visiteur qui porte un cookie, rien ne change : sa vue dépend de sa
 * session, que seul le client sait rafraîchir.
 */

// La session (et son refresh) ou l'identité anonyme des étoiles Sandbox : l'un
// d'eux présent, la réponse de l'API dépend du visiteur.
const IDENTITY_COOKIES = ["access_token", "refresh_token", "sb_anon"];

export async function isCookielessVisitor(): Promise<boolean> {
  const store = await cookies();
  return !IDENTITY_COOKIES.some((name) => store.has(name));
}

type RouteHandler<P> = (request: NextRequest, context: { params: Promise<P> }) => Promise<Response>;

/**
 * Appelle une route GET de l'API en processus, comme le ferait un navigateur
 * sans cookie, et renvoie son JSON — `null` si elle refuse ou échoue, et la
 * page retombe alors sur le chargement côté client.
 *
 * La route elle-même plutôt qu'une copie de sa logique : les listes blanches
 * de champs publics (`lib/public/*`) restent le seul endroit qui décide de ce
 * qu'un anonyme voit, et le HTML ne peut rien publier que l'API ne publie pas.
 * Le passage par JSON donne aussi la forme exacte que le client attend (dates
 * en chaînes, pas en `Date`).
 */
export async function readPublicRoute<T, P = Record<string, never>>(
  handler: RouteHandler<P>,
  path: string,
  params: P = {} as P,
): Promise<T | null> {
  try {
    const response = await handler(new NextRequest(`${SITE_URL}${path}`), { params: Promise.resolve(params) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch (error) {
    console.error(`[ssr] ${path} prefetch failed`, error);
    return null;
  }
}
