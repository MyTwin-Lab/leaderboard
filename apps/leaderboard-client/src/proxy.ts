import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getBaseUrl } from '@/lib/url';

type UserRole = 'admin' | 'contributor';
type ProtectedPage = { prefix: string; roles: readonly UserRole[] };

const protectedPages: ProtectedPage[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/contributors/me', roles: ['admin', 'contributor'] },
  { prefix: '/challenges/', roles: ['admin', 'contributor'] },
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
];

// Routes publiques d'authentification
const authRoutes = ['/api/auth/refresh', '/api/auth/logout', '/api/google-auth/authorize', '/api/google-auth/callback'];

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const matchedProtectedPage = protectedPages.find((route) => pathname.startsWith(route.prefix));
  const isProtectedApiRoute = protectedApiRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
  
  // Les routes d'auth sont toujours accessibles
  if (isAuthRoute) {
    return NextResponse.next();
  }
  
  // Si c'est une route protégée, vérifier le token
  if (matchedProtectedPage || isProtectedApiRoute) {
    const token = request.cookies.get('access_token')?.value;
    
    if (!token) {
      // Rediriger vers Google OAuth pour les pages, 401 pour les API
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

    // Vérifier la validité du token
    const payload = await verifyTokenEdge(token);

    if (!payload) {
      // Token invalide ou expiré
      if (isProtectedApiRoute) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      const baseUrl = getBaseUrl(request);
      const oauthUrl = new URL('/api/google-auth/authorize', baseUrl);
      oauthUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(oauthUrl);
    }
    
    if (matchedProtectedPage) {
      const allowedRoles = matchedProtectedPage.roles;
      if (!allowedRoles.includes(payload.role as typeof allowedRoles[number])) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }
    
    // Pour les routes API protégées, vérifier les permissions selon la méthode
    if (isProtectedApiRoute) {
      const method = request.method;
      
      // Routes accessibles aux contributeurs (self-assign/unassign/complete)
      const isTaskSelfServiceRoute =
        pathname.startsWith('/api/tasks/') &&
        (pathname.endsWith('/assign') || pathname.endsWith('/complete'));

      // Routes ML accessibles aux contributeurs pour soumettre leur travail
      const isMLContributorRoute = pathname.includes('/ml-workspace');

      // Rejoindre un challenge
      const isChallengeJoinRoute = pathname.endsWith('/join');

      // Mise à jour du profil par le contributeur lui-même
      const isContributorSelfRoute = pathname === '/api/contributors/me' && method === 'PATCH';

      // Routes accessibles aux managers de projet (auth vérifiée dans le handler)
      const isManagerAccessibleRoute =
        (pathname.match(/^\/api\/challenges\/[^/]+$/) && ['PUT', 'PATCH'].includes(method)) ||
        (pathname === '/api/challenges' && method === 'POST') ||
        (pathname.startsWith('/api/repos') && ['POST', 'PUT'].includes(method)) ||
        pathname.includes('/documents');

      // Les méthodes de modification nécessitent le rôle admin, sauf pour certaines routes
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && payload.role !== 'admin') {
        if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isManagerAccessibleRoute && !isContributorSelfRoute) {
          return NextResponse.json(
            { error: 'Admin role required for this action' },
            { status: 403 }
          );
        }
      }
    }
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
  ],
};
