export type ConnectorType = 'github' | 'google_drive' | 'huggingface' | 'slack' | string;

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

export interface ExternalConnector {
  /** Nom humain lisible */
  name: string;

  /** Type de connecteur */
  type: ConnectorType;

  /** Configuration d’authentification */
  authConfig: ConnectorAuthConfig;

  /** Initialise la connexion (OAuth ou clé API) */
  connect(): Promise<void>;

  /** Vérifie la validité et disponibilité du connecteur */
  testConnection(): Promise<boolean>;

  /** Récupère une liste d’éléments (fichiers, commits, messages, modèles, etc.) */
  fetchItems(options?: Record<string, any>): Promise<ExternalItem[]>;

  /** Récupère le contenu détaillé d’un élément */
  fetchItemContent(itemId: string): Promise<any>;

  /** Nettoyage éventuel */
  disconnect?(): Promise<void>;
}
