import type { ModuleSlots } from '@/lib/moduleSlots';

/**
 * Distribution MyTwin — slots du module sandbox
 * ---------------------------------------------
 * L'entrée « Sandbox » de la navigation publique. Ses pages et ses routes
 * répondent 404 quand le module est désactivé ; le lien disparaît avec elles.
 */
export const sandboxSlots: ModuleSlots = {
  key: 'sandbox',
  publicNav: [{ href: '/sandbox', label: 'Sandbox' }],
};
