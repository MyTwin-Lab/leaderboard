import type { Repo } from "../database-service/domain/entities.js";
import type { ExternalConnector } from "./interfaces.js";
import { GitHubExternalConnector } from "./implementation/Github.connector.js";
// Future: import { HuggingFaceConnector } from "./implementation/HuggingFace.connector.js";

export interface ConnectorInitContext {
  repo: Repo;
  env: NodeJS.ProcessEnv;
}

/**
 * ConnectorRegistry
 * -----------------
 * Factory pour créer des connecteurs basés sur le type de repo.
 * Utilise les variables d'environnement pour la configuration.
 */
export class ConnectorRegistry {
  /**
   * Crée un connecteur basé sur le type du repo
   * @param ctx - Contexte contenant le repo et l'environnement
   * @returns ExternalConnector ou null si le type n'est pas supporté
   */
  static createConnector(ctx: ConnectorInitContext): ExternalConnector | null {
    const { repo, env } = ctx;

    switch (repo.type) {
      case 'github':
        return new GitHubExternalConnector({
          token: env.GITHUB_TOKEN || "",
          owner: env.GITHUB_OWNER || "",
          repo: repo.title,
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
