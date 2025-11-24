import type { Repo } from "../database-service/domain/entities.js";
import type { ExternalConnector } from "./interfaces.js";
import { GitHubExternalConnector } from "./implementation/Github.connector.js";
import { config } from "../config/index.js";
// Future: import { HuggingFaceConnector } from "./implementation/HuggingFace.connector.js";

/**
 * ConnectorRegistry
 * -----------------
 * Factory pour créer des connecteurs basés sur le type de repo.
 * Utilise les variables d'environnement pour la configuration.
 */
export class ConnectorRegistry {
  // Exposed for tests to swap implementation
  static GitHubConnectorClass = GitHubExternalConnector;

  /**
   * Crée un connecteur basé sur le type du repo
   * @param repo - Repo contenant le type et l'external_repo_id
   * @returns ExternalConnector ou null si le type n'est pas supporté
   */
  static createConnector(repo: Repo): ExternalConnector | null {
    switch (repo.type) {
      case 'github':
        // Utiliser external_repo_id qui contient "owner/repo"
        if (!repo.external_repo_id) {
          console.error(`[ConnectorRegistry] Missing external_repo_id for GitHub repo: ${repo.title}`);
          return null;
        }
        
        const [owner, repoName] = repo.external_repo_id.split('/');
        if (!owner || !repoName) {
          console.error(`[ConnectorRegistry] Invalid external_repo_id format for repo: ${repo.title}. Expected "owner/repo", got "${repo.external_repo_id}"`);
          return null;
        }
        
        return new this.GitHubConnectorClass({
          token: config.github.token || "",
          owner,
          repo: repoName,
        });

      case 'huggingface':
        // Future: return new HuggingFaceConnector({ ... });
        console.warn(`[ConnectorRegistry] Type '${repo.type}' not yet implemented for repo: ${repo.title}`);
        return null;

      case 'google_drive':
        // Google Drive n'est pas utilisé dans l'orchestrateur (seulement pour sync)
        return null;

      default:
        console.warn(`[ConnectorRegistry] Unknown repo type '${repo.type}' for repo: ${repo.title}`);
        return null;
    }
  }
}
