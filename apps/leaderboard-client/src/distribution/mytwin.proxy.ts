import type { ModuleProxyRoutes } from '@/lib/moduleProxy';
import { meetingsProxyRoutes } from './modules/meetings.proxy';

/**
 * Distribution MyTwin — les routes des modules dans le proxy
 * ----------------------------------------------------------
 * Lu par `proxy.ts`, dans le runtime Edge : n'agrège que des fichiers purs
 * (`modules/*.proxy.ts`), jamais les slots d'interface.
 *
 * Le `config.matcher` de `proxy.ts` reste un littéral : Next le lit à la
 * compilation et refuse une valeur calculée. Chaque préfixe déclaré ici y a
 * donc aussi son entrée, ce que vérifie `mytwin.proxy.test.ts`.
 */
const ROUTES: readonly ModuleProxyRoutes[] = [meetingsProxyRoutes];

export const moduleProtectedApiRoutes: readonly string[] = ROUTES.flatMap(routes => routes.protectedApiRoutes);

export function isModuleNonAdminWrite(pathname: string, method: string): boolean {
  return ROUTES.some(routes => routes.nonAdminWrites.some(allows => allows(pathname, method)));
}
