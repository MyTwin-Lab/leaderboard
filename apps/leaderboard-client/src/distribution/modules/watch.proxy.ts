import type { ModuleProxyRoutes } from '@/lib/moduleProxy';

/**
 * Distribution MyTwin — le module watch dans le proxy. Fichier pur, lu dans
 * le runtime Edge : n'importe rien d'autre que des types.
 *
 * La page et la route sont réservées aux comptes connectés, tous rôles : le
 * proxy rafraîchit un jeton expiré et renvoie l'anonyme vers `/signin`. Le
 * module désactivé, la page et la route répondent elles-mêmes 404.
 */
export const watchProxyRoutes: ModuleProxyRoutes = {
  protectedApiRoutes: ['/api/watch'],
  protectedPages: ['/watch'],
  // Lecture seule en V1 : aucune écriture, donc rien à ouvrir aux non-admins.
  nonAdminWrites: [],
};
