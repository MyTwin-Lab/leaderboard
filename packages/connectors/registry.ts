import type { Repo } from "../database-service/domain/entities.js";
import type { ExternalConnector } from "./interfaces.js";
import { GitHubExternalConnector } from "./implementation/Github.connector.js";
import { KaggleConnector } from "./implementation/Kaggle.connector.js";
import { SlackConnector } from "./implementation/Slack.connector.js";
import { getGithubToken } from "../config/githubToken.js";
import { getKaggleCredentials } from "../config/kaggleCredentials.js";
import { getSlackToken } from "../config/slackCredentials.js";
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
  static KaggleConnectorClass = KaggleConnector;
  static SlackConnectorClass = SlackConnector;

  /**
   * Crée un connecteur basé sur le type du repo
   * @param repo - Repo contenant le type et l'external_repo_id
   * @param options - Options supplémentaires (ex: branch pour GitHub)
   * @returns ExternalConnector ou null si le type n'est pas supporté
   */
  static async createConnector(repo: Repo, options?: { branch?: string }): Promise<ExternalConnector | null> {
    switch (repo.type) {
      case 'github': {
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

        const token = await getGithubToken();
        if (!token) {
          console.error('[ConnectorRegistry] No GitHub token available (DB or .env)');
          return null;
        }

        return new this.GitHubConnectorClass({
          token,
          owner,
          repo: repoName,
          branch: options?.branch,
        });
      }

      case 'kaggle_dataset':
      case 'kaggle_model': {
        if (!repo.external_repo_id) {
          console.error(`[ConnectorRegistry] Missing external_repo_id for Kaggle repo: ${repo.title}`);
          return null;
        }

        const kaggleCreds = await getKaggleCredentials();
        if (!kaggleCreds) {
          console.error('[ConnectorRegistry] No Kaggle credentials available (DB or .env)');
          return null;
        }

        return new this.KaggleConnectorClass({
          username: kaggleCreds.username,
          apiKey: kaggleCreds.apiKey,
          ref: repo.external_repo_id,
          subtype: repo.type as 'kaggle_dataset' | 'kaggle_model',
        });
      }

      case 'slack': {
        const slackToken = await getSlackToken();
        if (!slackToken) {
          console.error('[ConnectorRegistry] No Slack token available (DB or .env)');
          return null;
        }

        return new this.SlackConnectorClass({
          token: slackToken,
          channelId: repo.external_repo_id,
        });
      }

      case 'google_drive':
        // Google Drive n'est pas utilisé dans l'orchestrateur (seulement pour sync)
        return null;

      default:
        console.warn(`[ConnectorRegistry] Unknown repo type '${repo.type}' for repo: ${repo.title}`);
        return null;
    }
  }
}
