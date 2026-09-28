/**
 * Ce qu'un module ajoute au proxy (challenge 020, L6)
 * ---------------------------------------------------
 * `proxy.ts` tourne dans le runtime Edge : ces déclarations restent de simples
 * données et fonctions pures, sans import — ni base, ni composant.
 *
 * L'état actif du module n'y figure pas : le proxy ne lit pas la base. Une
 * route de module désactivé répond elle-même 404 (`moduleNotFoundResponse`).
 */
export interface ModuleProxyRoutes {
  /** Préfixes d'API qui exigent une session. `config.matcher` doit aussi les couvrir. */
  protectedApiRoutes: readonly string[];
  /**
   * Préfixes de pages qui exigent une session, quel que soit le rôle. Le proxy
   * y rafraîchit un jeton expiré et renvoie l'anonyme vers `/signin` ; la page
   * décide ensuite du reste (module désactivé → 404). `config.matcher` doit
   * aussi les couvrir.
   */
  protectedPages?: readonly string[];
  /** Écritures qu'un non-admin peut tenter : le handler vérifie lui-même le droit. */
  nonAdminWrites: ReadonlyArray<(pathname: string, method: string) => boolean>;
}
