import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getBaseUrl } from '@/lib/url';

type UserRole = 'admin' | 'contributor' | 'viewer' | 'medical_pro';
type ProtectedPage = { prefix: string; roles: readonly UserRole[] };

// Every authenticated role can view their own profile and the challenges
// list/detail pages — role-specific gating (e.g. medical_pro-only voting on a
// validation challenge) happens inside those pages/routes, not here. Only
// /admin is restricted at this layer. Missing 'medical_pro' (added by
// challenge-014) here was the bug: it 403'd a medical_pro on pages every
// other authenticated role could already reach.
const protectedPages: ProtectedPage[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/contributors/me', roles: ['admin', 'contributor', 'viewer', 'medical_pro'] },
  { prefix: '/challenges/', roles: ['admin', 'contributor', 'viewer', 'medical_pro'] },
];

// Routes API qui nécessitent une authentification (sauf auth)
const protectedApiRoutes = [
  '/api/challenges',
  '/api/projects',
  '/api/users',
  '/api/repos',
  '/api/contributions',
  '/api/contributors/me',
  '/api/tasks',
  '/api/evaluation-grids',
  '/api/evaluation-runs',
  '/api/github-oauth',
  '/api/sync-meetings',
];

// Routes publiques d'authentification
const authRoutes = ['/api/auth/refresh', '/api/auth/logout', '/api/auth/check-session', '/api/google-auth/authorize', '/api/google-auth/callback'];

// Fonction de vérification JWT simplifiée pour Edge Runtime
async function verifyTokenEdge(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

/** Extrait la valeur d'un cookie donné depuis une liste d'en-têtes Set-Cookie bruts. */
function extractCookieValue(setCookieHeaders: string[], name: string): string | null {
  for (const header of setCookieHeaders) {
    const [pair] = header.split(';');
    const [key, value] = pair.split('=');
    if (key?.trim() === name) return value ?? null;
  }
  return null;
}

/** Remplace (ou ajoute) la valeur d'un cookie dans l'en-tête `Cookie` brut d'une requête. */
function withUpdatedCookie(cookieHeader: string | null, name: string, value: string): string {
  const pairs = (cookieHeader ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith(`${name}=`));
  pairs.push(`${name}=${value}`);
  return pairs.join('; ');
}

/**
 * Tente un refresh silencieux via /api/auth/refresh (Node runtime — c'est là
 * que vivent la rotation en base et bcrypt, impossibles à faire tourner ici
 * même raison que verifyTokenEdge existe au lieu d'importer lib/auth.ts).
 * Appel HTTP interne, même déploiement.
 */
async function tryRefreshSession(request: NextRequest): Promise<{
  payload: { userId: string; role: string };
  setCookieHeaders: string[];
} | null> {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) return null;

  try {
    const baseUrl = getBaseUrl(request);
    const res = await fetch(new URL('/api/auth/refresh', baseUrl), {
      method: 'POST',
      headers: { cookie: `refresh_token=${refreshToken}` },
    });
    if (!res.ok) return null;

    const setCookieHeaders = res.headers.getSetCookie();
    const newAccessToken = extractCookieValue(setCookieHeaders, 'access_token');
    if (!newAccessToken) return null;

    const payload = await verifyTokenEdge(newAccessToken);
    if (!payload) return null;

    return { payload, setCookieHeaders };
  } catch {
    return null;
  }
}

/**
 * Vérifie que le userId d'un JWT valide correspond toujours à un compte
 * existant (Node runtime — même contrainte que tryRefreshSession : l'Edge
 * runtime ne peut pas interroger `pg` directement).
 */
async function checkSessionStillValid(request: NextRequest, userId: string): Promise<boolean> {
  try {
    const baseUrl = getBaseUrl(request);
    const url = new URL('/api/auth/check-session', baseUrl);
    url.searchParams.set('userId', userId);
    const res = await fetch(url);
    if (!res.ok) return true; // panne du check : ne pas bloquer tout le trafic
    const data = await res.json();
    return data.valid !== false;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const matchedProtectedPage = protectedPages.find((route) => pathname.startsWith(route.prefix));
  const isProtectedApiRoute = protectedApiRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Les routes d'auth sont toujours accessibles
  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (matchedProtectedPage || isProtectedApiRoute) {
    const token = request.cookies.get('access_token')?.value;
    let payload = token ? await verifyTokenEdge(token) : null;

    // access_token absent ou expiré : tenter un refresh silencieux avant
    // d'abandonner (au lieu de déconnecter après 15 minutes d'inactivité).
    let refreshedCookies: string[] | null = null;
    let requestHeaders = request.headers;

    if (!payload) {
      const refreshed = await tryRefreshSession(request);
      if (refreshed) {
        payload = refreshed.payload;
        refreshedCookies = refreshed.setCookieHeaders;

        // Les pages/route handlers en aval relisent les cookies eux-mêmes
        // (lib/auth.ts) — ils doivent voir le nouveau access_token, pas
        // seulement ce middleware.
        const newAccessToken = extractCookieValue(refreshedCookies, 'access_token');
        const newRefreshToken = extractCookieValue(refreshedCookies, 'refresh_token');
        let cookieHeader = request.headers.get('cookie') ?? '';
        if (newAccessToken) cookieHeader = withUpdatedCookie(cookieHeader, 'access_token', newAccessToken);
        if (newRefreshToken) cookieHeader = withUpdatedCookie(cookieHeader, 'refresh_token', newRefreshToken);
        requestHeaders = new Headers(request.headers);
        requestHeaders.set('cookie', cookieHeader);
      }
    }

    // Propage les nouveaux cookies vers le navigateur sur toute réponse
    // renvoyée après un refresh réussi — y compris un 403 "rôle insuffisant" :
    // l'action précise peut être refusée, la session reste rafraîchie.
    const respond = (response: NextResponse) => {
      if (refreshedCookies) {
        for (const cookie of refreshedCookies) response.headers.append('set-cookie', cookie);
      }
      return response;
    };

    if (!payload) {
      // Ni access_token valide, ni refresh_token exploitable.
      if (isProtectedApiRoute) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const baseUrl = getBaseUrl(request);
      const oauthUrl = new URL('/api/google-auth/authorize', baseUrl);
      oauthUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(oauthUrl);
    }

    // Le JWT est valide par signature mais ne prouve pas que le compte existe
    // encore : un admin a pu le fusionner (Onboarding > Lier) ou le supprimer
    // entre deux requêtes. Un seul lookup indexé côté Node runtime détecte ça
    // immédiatement au lieu d'attendre l'expiration de l'access_token (15 min).
    if (!(await checkSessionStillValid(request, payload.userId))) {
      if (isProtectedApiRoute) {
        return respond(NextResponse.json(
          { error: 'SESSION_INVALID' },
          { status: 401 }
        ));
      }

      // Navigation client Next.js (next/link) : le fetch RSC peut recevoir ce
      // 401 et le front affiche une modale de reconnexion (SessionGuard). Un
      // chargement direct (hard refresh) n'a pas ce header — on ne peut pas y
      // poser de modale, donc on redirige tout de suite vers Google.
      if (request.headers.get('rsc') === '1') {
        return respond(NextResponse.json(
          { error: 'SESSION_INVALID' },
          { status: 401 }
        ));
      }

      const baseUrl = getBaseUrl(request);
      const oauthUrl = new URL('/api/google-auth/authorize', baseUrl);
      oauthUrl.searchParams.set('from', pathname);
      return respond(NextResponse.redirect(oauthUrl));
    }

    if (matchedProtectedPage) {
      const allowedRoles = matchedProtectedPage.roles;
      if (!allowedRoles.includes(payload.role as typeof allowedRoles[number])) {
        return respond(NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        ));
      }
    }

    // Pour les routes API protégées, vérifier les permissions selon la méthode
    if (isProtectedApiRoute) {
      const method = request.method;

      // Boards personnels (challenge-015) : un contributeur authentifié peut
      // créer ses propres tâches et modifier/supprimer celles qu'il possède
      // (l'ownership réelle — tâche perso vs template — est vérifiée dans les
      // handlers). Les anciennes routes /assign et /complete ont été
      // supprimées avec task_assignees/task_workspaces.
      const isTaskSelfServiceRoute =
        (pathname === '/api/tasks' && method === 'POST') ||
        (/^\/api\/tasks\/[^/]+$/.test(pathname) && ['PATCH', 'DELETE'].includes(method));

      // Routes ML accessibles aux contributeurs pour soumettre leur travail
      const isMLContributorRoute = pathname.includes('/ml-workspace');

      // Rejoindre un challenge
      const isChallengeJoinRoute = pathname.endsWith('/join');

      // Lancer l'évaluation de son board personnel (code) / déclarer son repo
      // perso en mode own_repo — ownership vérifiée dans les handlers.
      const isChallengeSelfServiceRoute =
        pathname.endsWith('/project-evaluation') || pathname.endsWith('/workspace');

      // Mise à jour du profil par le contributeur lui-même
      const isContributorSelfRoute = pathname === '/api/contributors/me' && method === 'PATCH';

      // Routes accessibles aux managers de projet (auth vérifiée dans le handler)
      const isManagerAccessibleRoute =
        (pathname.match(/^\/api\/challenges\/[^/]+$/) && ['PUT', 'PATCH'].includes(method)) ||
        (pathname === '/api/challenges' && method === 'POST') ||
        (pathname.startsWith('/api/repos') && ['POST', 'PUT'].includes(method)) ||
        pathname.includes('/documents');

      // Cycle de vote de la validation qualifiée (challenge-014) : claim/observation/
      // reveal/verdict/authoring d'un cas de référence — réservé aux medical_pro,
      // enforced dans chaque handler (InsufficientRoleError). Sans cette exception,
      // le garde-fou "admin only" ci-dessous bloquerait toute la fonctionnalité pour
      // un vrai medical_pro non-admin.
      const isMedicalProValidationRoute =
        payload.role === 'medical_pro' &&
        (pathname.includes('/validation-verdicts') ||
          pathname.includes('/validation-targets') ||
          pathname.includes('/validation-case-claims') ||
          pathname.includes('/validation-reference-cases'));

      // Les méthodes de modification nécessitent le rôle admin, sauf pour certaines routes
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && payload.role !== 'admin') {
        if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isChallengeSelfServiceRoute && !isManagerAccessibleRoute && !isContributorSelfRoute && !isMedicalProValidationRoute) {
          return respond(NextResponse.json(
            { error: 'Admin role required for this action' },
            { status: 403 }
          ));
        }
      }
    }

    return respond(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/contributors/me',
    '/challenges/:path*',
    '/api/challenges/:path*',
    '/api/projects/:path*',
    '/api/users/:path*',
    '/api/repos/:path*',
    '/api/contributions/:path*',
    '/api/contributors/:path*',
    '/api/tasks/:path*',
    '/api/auth/:path*',
    '/api/google-auth/:path*',
    '/api/evaluation-grids/:path*',
    '/api/evaluation-runs/:path*',
    '/api/github-oauth/:path*',
    '/api/sync-meetings/:path*',
  ],
};
