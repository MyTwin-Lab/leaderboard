import type { Repo } from "../database-service/domain/entities.js";
import type { ExternalConnector } from "./interfaces.js";
import { GitHubExternalConnector } from "./implementation/Github.connector.js";
import { KaggleConnector } from "./implementation/Kaggle.connector.js";
import { config } from "../config/index.js";

type ConnectorFactory = (repo: Repo, options?: { branch?: string }) => ExternalConnector | null;

const factories = new Map<string, ConnectorFactory>();

/**
 * ConnectorRegistry
 * -----------------
 * Factory fermée à la modification (OCP) : enregistrer un nouveau connecteur
 * = appeler ConnectorRegistry.register() sans toucher à ce fichier.
 *
 * Ajout d'un nouveau connecteur :
 *   ConnectorRegistry.register('huggingface', (repo, opts) => new HuggingFaceConnector(...));
 */
export class ConnectorRegistry {
  // Exposed for tests to swap implementation
  static GitHubConnectorClass = GitHubExternalConnector;
  static KaggleConnectorClass = KaggleConnector;

  /** Mapping repoType → gridSlug — centralisé ici pour éviter le couplage dans les services */
  static readonly REPO_TYPE_TO_GRID: Record<string, string> = {
    github: 'code',
    kaggle_dataset: 'dataset',
    kaggle_model: 'model',
  };

  static register(type: string, factory: ConnectorFactory): void {
    factories.set(type, factory);
  }

  static createConnector(repo: Repo, options?: { branch?: string }): ExternalConnector | null {
    const factory = factories.get(repo.type);
    if (!factory) {
      console.warn(`[ConnectorRegistry] Unknown or unimplemented repo type '${repo.type}' for repo: ${repo.title}`);
      return null;
    }
    return factory(repo, options);
  }
}

// ─── Auto-registration ────────────────────────────────────────────────────────

ConnectorRegistry.register('github', (repo, options) => {
  if (!repo.external_repo_id) {
    console.error(`[ConnectorRegistry] Missing external_repo_id for GitHub repo: ${repo.title}`);
    return null;
  }
  const [owner, repoName] = repo.external_repo_id.split('/');
  if (!owner || !repoName) {
    console.error(`[ConnectorRegistry] Invalid external_repo_id format for repo: ${repo.title}. Expected "owner/repo", got "${repo.external_repo_id}"`);
    return null;
  }
  return new ConnectorRegistry.GitHubConnectorClass({
    token: config.github.token || "",
    owner,
    repo: repoName,
    branch: options?.branch,
  });
});

ConnectorRegistry.register('kaggle_dataset', (repo, _options) => {
  if (!repo.external_repo_id) {
    console.error(`[ConnectorRegistry] Missing external_repo_id for Kaggle repo: ${repo.title}`);
    return null;
  }
  return new ConnectorRegistry.KaggleConnectorClass({
    username: config.kaggle.username || "",
    apiKey: config.kaggle.apiKey || "",
    ref: repo.external_repo_id,
    subtype: 'kaggle_dataset',
  });
});

ConnectorRegistry.register('kaggle_model', (repo, _options) => {
  if (!repo.external_repo_id) {
    console.error(`[ConnectorRegistry] Missing external_repo_id for Kaggle repo: ${repo.title}`);
    return null;
  }
  return new ConnectorRegistry.KaggleConnectorClass({
    username: config.kaggle.username || "",
    apiKey: config.kaggle.apiKey || "",
    ref: repo.external_repo_id,
    subtype: 'kaggle_model',
  });
});
