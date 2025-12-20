// packages/provisioner/src/providers/github-branch.provider.ts

import { Octokit } from 'octokit';
import type { WorkspaceProvider, ProvisionRequest, ProvisionResult, WorkspaceStatus } from '../types.js';
import { 
  WorkspaceAlreadyExistsError, 
  ProviderAuthenticationError, 
  ParentResourceNotFoundError,
  MissingConfigurationError 
} from '../errors.js';

/**
 * Provider pour créer des branches GitHub
 */
export class GitHubBranchProvider implements WorkspaceProvider {
  readonly type = 'git_branch' as const;
  readonly name = 'GitHub Branch';
  
  private octokit: Octokit;

  constructor(token?: string) {
    const githubToken = token || process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      throw new MissingConfigurationError('GITHUB_TOKEN');
    }
    
    this.octokit = new Octokit({ auth: githubToken });
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

    const branchName = name;
    const fullRef = `refs/heads/${branchName}`;

    try {
      // 1. Vérifier si la branche existe déjà
      try {
        const existingBranch = await this.octokit.rest.git.getRef({
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
      const baseBranchRef = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseRef}`,
      });
      const baseSha = baseBranchRef.data.object.sha;

      // 3. Créer la nouvelle branche
      const newBranch = await this.octokit.rest.git.createRef({
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
      await this.octokit.rest.git.getRef({
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
   * Supprime une branche
   */
  async deprovision(parentRef: string, ref: string): Promise<void> {
    const [owner, repo] = parentRef.split('/');
    if (!owner || !repo) {
      throw new ParentResourceNotFoundError(parentRef);
    }

    const branchName = ref.replace('refs/heads/', '');

    await this.octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branchName}`,
    });

    console.log(`[GitHubBranchProvider] Deleted branch: ${branchName}`);
  }
}
