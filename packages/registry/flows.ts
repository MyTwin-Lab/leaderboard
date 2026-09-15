/**
 * Descripteurs de flows
 * ---------------------
 * Ce qu'un type de challenge dit de lui-même à l'interface et aux pages
 * publiques : son nom, son icône, et deux règles d'accès. Données pures, sans
 * React ni base : le même catalogue sert aux composants client et au serveur.
 *
 * Le core ne connaît aucun flow. La distribution installée construit le
 * catalogue (`apps/leaderboard-client/src/distribution/mytwin.flows.ts`).
 */

export interface FlowDescriptor {
  /** Valeur de `challenges.type`. */
  key: string;
  /** Nom court : badges, cartes, listes. */
  label: string;
  /** Nom dans une phrase : métadonnées, landing. */
  longLabel: string;
  /** Clé d'icône du design system (`components/ui/FlowIcon.tsx` dans l'app). */
  icon: string;
  /**
   * L'accès d'un non-membre passe par le brief et par le `Join` de l'en-tête.
   * Faux pour un flow dont les routes ne demandent aucune adhésion préalable.
   */
  briefRequired: boolean;
  /** Un visiteur anonyme peut ouvrir un challenge de ce flow, s'il a un statut public. */
  publiclyVisible: boolean;
  /** Ce que rejoindre implique, affiché sous le brief. */
  joinCaption?: string;
}

export interface FlowCatalog {
  /** Le flow d'un challenge dont le type est absent. */
  readonly defaultKey: string;
  /** Le descripteur du type, ou `undefined` s'il n'est pas installé. */
  get(key: string | null | undefined): FlowDescriptor | undefined;
  /** Le descripteur du type, ou celui du flow par défaut quand le type est absent ou inconnu. */
  resolve(key: string | null | undefined): FlowDescriptor;
  list(): FlowDescriptor[];
}

export function createFlowCatalog(
  descriptors: readonly FlowDescriptor[],
  options: { defaultKey: string }
): FlowCatalog {
  const byKey = new Map<string, FlowDescriptor>();
  for (const descriptor of descriptors) {
    if (byKey.has(descriptor.key)) {
      throw new Error(`[FlowCatalog] Flow "${descriptor.key}" is declared twice`);
    }
    byKey.set(descriptor.key, descriptor);
  }

  const fallback = byKey.get(options.defaultKey);
  if (!fallback) {
    throw new Error(`[FlowCatalog] Default flow "${options.defaultKey}" is not in the catalog`);
  }

  const get = (key: string | null | undefined) => (key ? byKey.get(key) : undefined);

  return {
    defaultKey: options.defaultKey,
    get,
    resolve: (key) => get(key) ?? fallback,
    list: () => [...byKey.values()],
  };
}
