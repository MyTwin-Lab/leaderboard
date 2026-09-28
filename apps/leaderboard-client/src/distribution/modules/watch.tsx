import type { ModuleSlots } from '@/lib/moduleSlots';

/**
 * Distribution MyTwin — slots du module watch
 * -------------------------------------------
 * Le lien « Open resources » de l'accueil, vers l'explorateur de
 * publications `/watch`. La page et sa route répondent 404 quand le module
 * est désactivé ; le lien disparaît avec elles.
 */
export const watchSlots: ModuleSlots = {
  key: 'watch',
  homeLinks: [{ href: '/watch', label: 'Open resources' }],
};
