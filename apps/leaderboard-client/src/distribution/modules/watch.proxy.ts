import type { ModuleProxyRoutes } from '@/lib/moduleProxy';

/**
 * Distribution MyTwin — le module watch dans le proxy. Fichier pur, lu dans
 * le runtime Edge : n'importe rien d'autre que des types.
 *
 * La recherche (`/api/watch`) est réservée aux comptes connectés, tous
 * rôles : le proxy rafraîchit un jeton expiré et refuse l'anonyme. La page
 * `/watch`, elle, est publique : sa sélection se lit sans compte, et c'est la
 * page qui décide de ce qu'un anonyme peut faire. Le module désactivé, la
 * page et la route répondent elles-mêmes 404.
 */
export const watchProxyRoutes: ModuleProxyRoutes = {
  protectedApiRoutes: ['/api/watch'],
  // Lecture seule en V1 : aucune écriture, donc rien à ouvrir aux non-admins.
  nonAdminWrites: [],
};
