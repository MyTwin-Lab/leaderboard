// packages/provisioner/src/index.ts

import type { 
  ProvisionResult, 
  ChallengeProvisionContext, 
  TaskProvisionContext,
  WorkspaceType 
} from './types.js';
import { ProvisionerRegistry } from './registry.js';
import { GitHubBranchProvider } from './providers/github-branch.provider.js';
import { 
  generateChallengeBranchName, 
  generateTaskBranchName, 
  mapRepoTypeToWorkspaceType 
} from './utils.js';
import { ProviderNotFoundError } from './errors.js';

// Enregistrer les providers par défaut
let initialized = false;

function initializeProviders(): void {
  if (initialized) return;
  
  try {
    // Enregistrer le provider GitHub si le token est disponible
    if (process.env.GITHUB_TOKEN) {
      ProvisionerRegistry.register(new GitHubBranchProvider());
    } else {
      console.warn('[Provisioner] GITHUB_TOKEN not set, GitHub provider not available');
    }
    
    initialized = true;
  } catch (error) {
    console.error('[Provisioner] Error initializing providers:', error);
  }
}

/**
 * Provisionne un workspace pour un challenge
 * Crée une branche dédiée au challenge sur chaque repo associé
 */
export async function provisionChallengeWorkspace(
  context: ChallengeProvisionContext
): Promise<ProvisionResult> {
  initializeProviders();
  
  const { challengeIndex, challengeTitle, repoExternalId, repoType } = context;
  
  // Déterminer le type de workspace
  const workspaceType = mapRepoTypeToWorkspaceType(repoType);
  
  // Vérifier si un provider existe
  if (!ProvisionerRegistry.hasProvider(workspaceType)) {
    console.warn(`[Provisioner] No provider for workspace type: ${workspaceType}`);
    return {
      provider: 'none',
      workspaceType,
      ref: '',
      url: '',
      status: 'failed',
      error: `No provider available for workspace type: ${workspaceType}`,
    };
  }
  
  // Récupérer le provider
  const provider = ProvisionerRegistry.getProvider(workspaceType);
  
  // Générer le nom de branche
  const branchName = generateChallengeBranchName(challengeIndex, challengeTitle);
  
  // Provisionner
  return provider.provision({
    workspaceType,
    parentRef: repoExternalId,
    name: branchName,
    baseRef: 'main', // TODO: rendre configurable
  });
}

/**
 * Provisionne un workspace pour une task
 * Crée une branche dédiée à la task, basée sur la branche du challenge parent
 */
export async function provisionTaskWorkspace(
  context: TaskProvisionContext
): Promise<ProvisionResult> {
  initializeProviders();
  
  const { challengeIndex, taskTitle, repoExternalId, repoType, challengeBranchRef } = context;
  
  // Déterminer le type de workspace
  const workspaceType = mapRepoTypeToWorkspaceType(repoType);
  
  // Vérifier si un provider existe
  if (!ProvisionerRegistry.hasProvider(workspaceType)) {
    console.warn(`[Provisioner] No provider for workspace type: ${workspaceType}`);
    return {
      provider: 'none',
      workspaceType,
      ref: '',
      url: '',
      status: 'failed',
      error: `No provider available for workspace type: ${workspaceType}`,
    };
  }
  
  // Récupérer le provider
  const provider = ProvisionerRegistry.getProvider(workspaceType);
  
  // Générer le nom de branche
  const branchName = generateTaskBranchName(challengeIndex, taskTitle);
  
  // Déterminer la branche de base (branche du challenge ou main)
  let baseRef = 'main';
  if (challengeBranchRef) {
    // Extraire le nom de branche du ref complet
    baseRef = challengeBranchRef.replace('refs/heads/', '');
  }
  
  // Provisionner
  return provider.provision({
    workspaceType,
    parentRef: repoExternalId,
    name: branchName,
    baseRef,
  });
}

// Exports
export { ProvisionerRegistry } from './registry.js';
export { GitHubBranchProvider } from './providers/github-branch.provider.js';
export * from './types.js';
export * from './errors.js';
export * from './utils.js';
