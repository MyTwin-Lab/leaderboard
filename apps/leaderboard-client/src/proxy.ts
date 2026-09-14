import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getBaseUrl, getInternalBaseUrl } from '@/lib/url';
import { isPublicPage, isPublicApiRoute } from '@/lib/routeVisibility';
import { parseSessionClaims } from '@/lib/sessionClaims';

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
    // Une signature valide ne fait pas une session : voir lib/sessionClaims.ts.
    return parseSessionClaims(payload, 'access');
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

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Défense CSRF en profondeur, en plus de SameSite (docs/temp.md, L6) : une
 * écriture sur l'API émise par un autre site est refusée.
 *
 * Une requête sans `Origin` ni `Sec-Fetch-Site` passe : ce n'est pas un
 * navigateur (crons, curl, fetch interne du proxy vers /api/auth/refresh).
 * `X-Forwarded-Host` compte parmi les hôtes admis : derrière le reverse proxy
 * c'est l'hôte public, et un site tiers ne peut pas le poser sans préflight CORS.
 */
function isCrossSiteWrite(request: NextRequest): boolean {
  if (!WRITE_METHODS.includes(request.method)) return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;

  const origin = request.headers.get('origin');
  if (origin === null) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true; // `Origin: null` (iframe sandboxée, redirection…) ou illisible
  }
  const allowedHosts = [
    request.headers.get('x-forwarded-host'),
    request.headers.get('host'),
    request.nextUrl.host,
  ];
  return !allowedHosts.includes(originHost);
}

/**
 * Tente un refresh silencieux via /api/auth/refresh (Node runtime — c'est là
 * que vit la rotation en base, impossible à faire tourner ici pour la même
 * raison que verifyTokenEdge existe au lieu d'importer lib/auth.ts).
 * Appel HTTP interne, même déploiement.
 */
async function tryRefreshSession(request: NextRequest): Promise<{
  payload: { userId: string; role: string };
  setCookieHeaders: string[];
} | null> {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) return null;

  try {
    // Origine fixe, jamais X-Forwarded-Host : le refresh token part avec cet
    // appel (docs/temp.md, L5).
    const res = await fetch(new URL('/api/auth/refresh', getInternalBaseUrl()), {
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
async function checkSessionStillValid(userId: string): Promise<boolean> {
  try {
    const url = new URL('/api/auth/check-session', getInternalBaseUrl());
    url.searchParams.set('userId', userId);
    const res = await fetch(url);
    // Seule une panne du check (5xx) laisse passer, pour ne pas bloquer tout le
    // trafic. Un 4xx est une réponse : la session est refusée.
    if (res.status >= 500) return true;
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid !== false;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Les allowlists priment sur les gardes par préfixe : /challenges/<id> et ses
  // trois routes de lecture sont publiques, tandis que /challenges/<id>/manage
  // et tous les autres /api/challenges/* restent derrière les préfixes.
  const matchedProtectedPage = isPublicPage(pathname)
    ? undefined
    : protectedPages.find((route) => pathname.startsWith(route.prefix));
  const isProtectedApiRoute = !isPublicApiRoute(pathname)
    && protectedApiRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Avant tout le reste, routes d'auth comprises (logout, refresh). Les
  // callbacks OAuth sont des GET : non concernés.
  if (pathname.startsWith('/api/') && isCrossSiteWrite(request)) {
    return NextResponse.json(
      { error: 'Cross-site request refused' },
      { status: 403 }
    );
  }

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

      // Vers /signin plutôt que directement Google : l'utilisateur arrive ici
      // sans avoir rien demandé (deep link vers une page protégée), donc on lui
      // explique pourquoi on demande un compte Google avant de l'y envoyer.
      const baseUrl = getBaseUrl(request);
      const signInUrl = new URL('/signin', baseUrl);
      signInUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Le JWT est valide par signature mais ne prouve pas que le compte existe
    // encore : un admin a pu le fusionner (Onboarding > Lier) ou le supprimer
    // entre deux requêtes. Un seul lookup indexé côté Node runtime détecte ça
    // immédiatement au lieu d'attendre l'expiration de l'access_token (15 min).
    if (!(await checkSessionStillValid(payload.userId))) {
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

      // Même page, mais avec le message de reconnexion : la personne s'est
      // déjà connectée une fois, lui re-servir l'explication initiale serait du
      // bruit. Le compte a été fusionné ou supprimé — check-session ne sait pas
      // dire lequel, d'où une formulation vraie dans les deux cas.
      const baseUrl = getBaseUrl(request);
      const signInUrl = new URL('/signin', baseUrl);
      signInUrl.searchParams.set('from', pathname);
      signInUrl.searchParams.set('reason', 'account-updated');
      return respond(NextResponse.redirect(signInUrl));
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

      // Inviter un contributeur dans son groupe. L'appartenance au groupe est
      // vérifiée dans le handler — sans cette exception, le garde-fou
      // « admin only » plus bas bloquerait la fonctionnalité pour tout
      // contributeur, qui en est pourtant le seul utilisateur.
      const isGroupInviteRoute = pathname.endsWith('/group/invite');

      // Lancer l'évaluation de son board personnel (code) / déclarer son repo
      // perso en mode own_repo — ownership vérifiée dans les handlers.
      const isChallengeSelfServiceRoute =
        pathname.endsWith('/project-evaluation') || pathname.endsWith('/workspace');

      // Mise à jour du profil par le contributeur lui-même
      const isContributorSelfRoute = pathname === '/api/contributors/me' && method === 'PATCH';

      // Ses propres notifications : marquer lu (PATCH), ou retirer une ligne
      // (DELETE, c'est-à-dire refuser une invitation). La propriété est
      // vérifiée dans le repository, où le userId est dans le WHERE — une garde
      // écrite là ne peut pas être oubliée.
      const isNotificationSelfRoute =
        pathname.startsWith('/api/notifications') && ['PATCH', 'DELETE'].includes(method);

      // Routes accessibles aux managers de projet (auth vérifiée dans le handler)
      const isManagerAccessibleRoute =
        (pathname.match(/^\/api\/challenges\/[^/]+$/) && ['PUT', 'PATCH'].includes(method)) ||
        (pathname === '/api/challenges' && method === 'POST') ||
        (pathname.startsWith('/api/repos') && ['POST', 'PUT'].includes(method)) ||
        pathname.includes('/documents') ||
        // Écriture du scénario d'un challenge de validation en mode scénario :
        // admin OU manager de ce challenge, vérifié dans le handler via
        // isManagerOfChallenge, plus le gel côté service dès la première
        // walkthrough. Sans cette exception un manager non-admin ne pourrait
        // pas écrire le scénario qu'il est censé écrire.
        pathname.includes('/validation-scenario-steps');

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

      // Parcours de scénario (challenge-018) : ouvrir ou reprendre une
      // walkthrough, enregistrer le retour d'une étape, et la clore. Ouvert à
      // tout principal connecté à ce niveau, sans condition de rôle ici —
      // contrairement au flux cas de référence, il n'y a pas de vérité
      // terrain à être qualifié pour juger, seulement un scénario à
      // parcourir. C'est le geste central de la fonctionnalité, pas une
      // action d'administration.
      //
      // Les vraies gardes vivent dans ScenarioWalkthroughService, où elles sont
      // testées : rôle éligible (contributor/medical_pro/admin — pas viewer,
      // lecture seule partout ailleurs), pas ma propre application (porteur ET
      // membres du groupe), la walkthrough m'appartient et est encore
      // brouillon, l'avis médical réservé aux medical_pro. Sans cette
      // exception, le garde-fou « admin only » ci-dessous interdirait à tout
      // le monde sauf un admin de démarrer une walkthrough — et donc d'être payé.
      const isScenarioWalkthroughRoute = pathname.includes('/validation-scenario-runs');

      // Puissance de calcul GPU (challenges ML) : un contributeur demande une
      // instance et lit son propre token Jupyter — les handlers relisent la
      // session en base et ne touchent qu'à la demande de l'appelant ; un
      // manager ou un admin tranche une demande — rôle et isManagerOfChallenge
      // vérifiés dans le handler de decision.
      const isComputeRequestRoute =
        method === 'POST' &&
        (/^\/api\/challenges\/[^/]+\/compute-request(\/reveal-token)?$/.test(pathname) ||
          /^\/api\/challenges\/[^/]+\/compute-requests\/[^/]+\/decision$/.test(pathname));

      // Planifier un meeting : admin ou manager du challenge, vérifié dans le
      // handler (isManagerOfChallenge).
      const isSyncMeetingCreateRoute = pathname === '/api/sync-meetings' && method === 'POST';

      // Les méthodes de modification nécessitent le rôle admin, sauf pour certaines routes
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && payload.role !== 'admin') {
        if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isChallengeSelfServiceRoute && !isManagerAccessibleRoute && !isContributorSelfRoute && !isMedicalProValidationRoute && !isScenarioWalkthroughRoute && !isNotificationSelfRoute && !isGroupInviteRoute && !isComputeRequestRoute && !isSyncMeetingCreateRoute) {
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
    // Dans le matcher, et non authentifiées à la main comme /api/sandboxes/** :
    // ces routes sont toujours authentifiées, et rester dans le matcher leur
    // vaut le rafraîchissement silencieux du token — un panneau de
    // notifications lu sur un profil ouvert depuis longtemps est exactement là
    // où une session qui expire se voit.
    '/api/notifications/:path*',
    '/api/tasks/:path*',
    '/api/auth/:path*',
    '/api/google-auth/:path*',
    '/api/evaluation-grids/:path*',
    '/api/evaluation-runs/:path*',
    '/api/github-oauth/:path*',
    '/api/sync-meetings/:path*',
  ],
};
