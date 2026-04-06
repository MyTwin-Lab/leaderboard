export type ConnectorType = 'github' | 'google_drive' | 'kaggle_dataset' | 'kaggle_model' | 'slack' | string;

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

export interface ModifiedFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  sha: string;
  content?: string;
  patch?: string;
  isBinary?: boolean;
  contentEncoding?: string;
}

export interface ExternalItemContent {
  commitSha: string;
  modifiedFiles: ModifiedFile[];
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
  fetchItemContent(itemId: string): Promise<ExternalItemContent>;

  /** Nettoyage éventuel */
  disconnect?(): Promise<void>;
}
