/** Un type de repo, validé par le registre des connecteurs installés (`ConnectorRegistry.isKnownRepoType`). */
export type ConnectorType = string;

export interface ConnectorAuthConfig {
  apiKey?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  [key: string]: any;
}

export interface ExternalItem {
  id: string;
  name: string;
  type: string; // 'file', 'commit', 'message', ...
  url?: string;
  metadata?: Record<string, any>;
}

// ─── Activité ─────────────────────────────────────────────────────────────────

/**
 * L'activité d'un dépôt, opaque pour le core : seul le connecteur `connectorKey`
 * connaît la forme de `payload`, et déclare de quoi la lire (fusion, filtrage
 * public côté serveur ; rendus et extracteurs typés dans la distribution).
 */
export interface ConnectorActivity {
  connectorKey: string;
  payload: unknown;
}

// ─── Connector interface ──────────────────────────────────────────────────────

export interface ExternalConnector {
  /** Nom humain lisible */
  name: string;

  /** Type de connecteur */
  type: ConnectorType;

  /** Configuration d'authentification */
  authConfig: ConnectorAuthConfig;

  /** Initialise la connexion (OAuth ou clé API) */
  connect(): Promise<void>;

  /** Vérifie la validité et disponibilité du connecteur */
  testConnection(): Promise<boolean>;

  /** Récupère une liste d'éléments (fichiers, commits, messages, modèles, etc.) */
  fetchItems(options?: Record<string, any>): Promise<ExternalItem[]>;

  /** Récupère le contenu détaillé d'un élément */
  fetchItemContent(itemId: string): Promise<any>;

  /** Récupère l'activité du repo, dans l'enveloppe du connecteur */
  fetchRepoActivity?(): Promise<ConnectorActivity>;

  /** Nettoyage éventuel */
  disconnect?(): Promise<void>;
}
