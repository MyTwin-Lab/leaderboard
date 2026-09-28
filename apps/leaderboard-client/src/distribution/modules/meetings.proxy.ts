import type { ModuleProxyRoutes } from '@/lib/moduleProxy';

/**
 * Distribution MyTwin — le module meetings dans le proxy. Fichier pur, lu dans
 * le runtime Edge : n'importe rien d'autre que des types.
 */
export const meetingsProxyRoutes: ModuleProxyRoutes = {
  protectedApiRoutes: ['/api/sync-meetings'],
  nonAdminWrites: [
    // Planifier un meeting : admin ou manager du challenge, vérifié dans le
    // handler (isManagerOfChallenge).
    (pathname, method) => pathname === '/api/sync-meetings' && method === 'POST',
  ],
};
