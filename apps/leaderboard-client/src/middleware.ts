import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

type UserRole = 'admin' | 'contributor';
type ProtectedPage = { prefix: string; roles: readonly UserRole[] };

const protectedPages: ProtectedPage[] = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/contributors/me', roles: ['admin', 'contributor'] },
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
const authRoutes = ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout'];

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

export async function middleware(request: NextRequest) {
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
      // Rediriger vers /login pour les pages, 401 pour les API
      if (isProtectedApiRoute) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
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
      
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
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
      
      // Les méthodes de modification nécessitent le rôle admin, sauf pour certaines routes
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && payload.role !== 'admin') {
        // Permettre aux contributeurs de s'assigner/désassigner des tâches
        if (!isTaskSelfServiceRoute) {
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
    '/api/challenges/:path*',
    '/api/projects/:path*',
    '/api/users/:path*',
    '/api/repos/:path*',
    '/api/contributions/:path*',
    '/api/contributors/:path*',
    '/api/tasks/:path*',
    '/api/auth/:path*',
  ],
};
