// content/workspace-providers/github-branch/provider.ts

import { Octokit } from 'octokit';
import type { WorkspaceProvider, ProvisionRequest, ProvisionResult, WorkspaceStatus } from '../../../packages/provisioner/src/types.js';
import {
  WorkspaceAlreadyExistsError,
  ProviderAuthenticationError,
  ParentResourceNotFoundError,
  MissingConfigurationError
} from '../../../packages/provisioner/src/errors.js';
import { getGithubToken } from '../../../packages/config/githubToken.js';

/**
 * Provider pour créer des branches GitHub.
 *
 * Le token est lu **à chaque appel**, jamais au démarrage : un admin peut
 * reconnecter GitHub à tout moment. Par défaut, c'est celui de la connexion
 * GitHub (store des credentials), avec `GITHUB_TOKEN` en repli jusqu'au lot
 * L7 du challenge 020. Branches et protections sont donc faites au nom de
 * l'admin qui a connecté GitHub.
 */
export class GitHubBranchProvider implements WorkspaceProvider {
  readonly type = 'git_branch' as const;
  readonly name = 'GitHub Branch';

  constructor(private readonly resolveToken: () => Promise<string | null> = getGithubToken) {}

  /** Un token est disponible : sans connexion GitHub, le provisioning répond `failed`. */
  async isAvailable(): Promise<boolean> {
    return !!(await this.resolveToken());
  }

  private async client(): Promise<Octokit> {
    const token = await this.resolveToken();
    if (!token) {
      throw new MissingConfigurationError('GitHub connection');
    }
    return new Octokit({ auth: token });
  }

  /**
   * Crée une nouvelle branche sur GitHub
   */
  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    const { parentRef, name, baseRef = 'main' } = request;

    // Extraire owner et repo de parentRef (format: "owner/repo")
    const [owner, repo] = parentRef.split('/');
    if (!owner || !repo) {
      throw new ParentResourceNotFoundError(parentRef);
    }

    const octokit = await this.client();
    const branchName = name;
    const fullRef = `refs/heads/${branchName}`;

    try {
      // 1. Vérifier si la branche existe déjà
      try {
        const existingBranch = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
        });

        // La branche existe déjà - on log l'erreur mais on retourne ready
        const url = `https://github.com/${owner}/${repo}/tree/${branchName}`;
        console.warn(`[GitHubBranchProvider] Branch already exists: ${branchName}`);

        return {
          provider: this.name,
          workspaceType: this.type,
          ref: fullRef,
          url,
          status: 'ready',
          meta: {
            alreadyExisted: true,
            sha: existingBranch.data.object.sha,
          },
          error: `Branch '${branchName}' already exists`,
        };
      } catch (error: any) {
        // 404 = la branche n'existe pas, on peut continuer
        if (error.status !== 404) {
          throw error;
        }
      }

      // 2. Récupérer le SHA de la branche de base
      const baseBranchRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseRef}`,
      });
      const baseSha = baseBranchRef.data.object.sha;

      // 3. Créer la nouvelle branche
      const newBranch = await octokit.rest.git.createRef({
        owner,
        repo,
        ref: fullRef,
        sha: baseSha,
      });

      const url = `https://github.com/${owner}/${repo}/tree/${branchName}`;

      console.log(`[GitHubBranchProvider] Created branch: ${branchName} from ${baseRef}`);

      return {
        provider: this.name,
        workspaceType: this.type,
        ref: fullRef,
        url,
        status: 'ready',
        meta: {
          baseBranch: baseRef,
          baseSha,
          sha: newBranch.data.object.sha,
          createdAt: new Date().toISOString(),
        },
      };

    } catch (error: any) {
      // Gérer les erreurs spécifiques
      if (error.status === 401 || error.status === 403) {
        throw new ProviderAuthenticationError(this.name, error.message);
      }

      if (error.status === 404) {
        throw new ParentResourceNotFoundError(`${owner}/${repo} or branch ${baseRef}`);
      }

      // Erreur générique
      console.error(`[GitHubBranchProvider] Error creating branch:`, error);

      return {
        provider: this.name,
        workspaceType: this.type,
        ref: fullRef,
        url: `https://github.com/${owner}/${repo}`,
        status: 'failed',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Vérifie le statut d'une branche
   */
  async getStatus(parentRef: string, ref: string): Promise<WorkspaceStatus> {
    const [owner, repo] = parentRef.split('/');
    if (!owner || !repo) {
      return 'failed';
    }

    // Extraire le nom de branche du ref complet
    const branchName = ref.replace('refs/heads/', '');

    try {
      const octokit = await this.client();
      await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      return 'ready';
    } catch (error: any) {
      if (error.status === 404) {
        return 'pending';
      }
      return 'failed';
    }
  }

  /**
   * Restreint les push sur une branche aux utilisateurs spécifiés.
   * Les admins du repo conservent toujours l'accès (enforce_admins: false).
   */
  async protect(parentRef: string, ref: string, allowedUsers: string[]): Promise<void> {
    const [owner, repo] = parentRef.split('/');
    if (!owner || !repo) {
      throw new ParentResourceNotFoundError(parentRef);
    }

    const octokit = await this.client();
    const branchName = ref.replace('refs/heads/', '');

    try {
      await octokit.rest.repos.updateBranchProtection({
        owner,
        repo,
        branch: branchName,
        required_status_checks: null,
        enforce_admins: false,
        required_pull_request_reviews: null,
        restrictions: {
          users: allowedUsers,
          teams: [],
        },
      });

      console.log(`[GitHubBranchProvider] Branch protected: ${branchName} (allowed: ${allowedUsers.join(', ')})`);
    } catch (error: any) {
      if (error.status === 404) {
        console.warn(`[GitHubBranchProvider] Branch ${branchName} not found for protection, skipping`);
        return;
      }
      console.error(`[GitHubBranchProvider] Error protecting branch ${branchName}:`, error.message);
      throw error;
    }
  }

  /**
   * Supprime une branche
   */
  async deprovision(parentRef: string, ref: string): Promise<void> {
    const [owner, repo] = parentRef.split('/');
    if (!owner || !repo) {
      throw new ParentResourceNotFoundError(parentRef);
    }

    const octokit = await this.client();
    const branchName = ref.replace('refs/heads/', '');

    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });

    console.log(`[GitHubBranchProvider] Deleted branch: ${branchName}`);
  }
}

// Réexporté pour les appelants qui distinguent une branche déjà créée.
export { WorkspaceAlreadyExistsError };
