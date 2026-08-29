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

// ─── Repo Activity types ──────────────────────────────────────────────────────

export type GitHubEventType = 'commit' | 'pull_request' | 'pr_review' | 'branch_created';

export interface GitHubEvent {
  type: GitHubEventType;
  id: string;
  title: string;
  author: string;       // GitHub login
  date: string;         // ISO 8601
  url: string;
  metadata: {
    sha?: string;
    additions?: number;
    deletions?: number;
    prNumber?: number;
    state?: 'open' | 'closed' | 'merged';
    reviewState?: 'approved' | 'changes_requested' | 'commented';
    branchName?: string;
  };
}

export interface GitHubRepoActivity {
  type: 'github';
  events: GitHubEvent[]; // sorted newest to oldest
}

export interface KaggleModelMetrics {
  auc?: number;
  f1?: number;
  accuracy?: number;
  [key: string]: number | undefined;
}

export interface KaggleModelVersion {
  versionNumber: number;
  createdAt: string; // ISO 8601
  metrics: KaggleModelMetrics;
}

export interface KaggleRepoActivity {
  type: 'kaggle_dataset' | 'kaggle_model';
  datasetMeta?: {
    title: string;
    description?: string;
    tags?: string[];
    url: string;
    lastUpdated?: string;
  };
  modelVersions?: Array<{
    ref: string; // "owner/slug"
    versions: KaggleModelVersion[];
  }>;
}

export type RepoActivity = GitHubRepoActivity | KaggleRepoActivity;

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

  /** Récupère l'activité du repo (commits, PRs, reviews, branches / métriques Kaggle) */
  fetchRepoActivity?(): Promise<RepoActivity>;

  /** Nettoyage éventuel */
  disconnect?(): Promise<void>;
}
