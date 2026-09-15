// packages/provisioner/src/index.ts

import type {
  ProvisionResult,
  ChallengeProvisionContext,
} from './types.js';
import { ProvisionerRegistry } from './registry.js';
import {
  generateChallengeBranchName,
  generateContributorBranchName,
  mapRepoTypeToWorkspaceType
} from './utils.js';

/*
 * Les providers ne sont pas enregistrés ici : c'est la distribution installée
 * qui les apporte (`apps/leaderboard-client/src/distribution/mytwin.server.ts`).
 * Sans provider pour un type de workspace, le provisioning répond `failed`.
 */

/**
 * Provisionne un workspace pour un challenge
 * Crée une branche dédiée au challenge sur chaque repo associé
 */
export async function provisionChallengeWorkspace(
  context: ChallengeProvisionContext
): Promise<ProvisionResult> {
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
 * Provisionne le workspace personnel d'un contributeur sur un challenge code :
 * une branche `contrib/<index>-<username>` basée sur la branche du challenge
 * (ou main), protégée ensuite pour ce seul contributeur par l'appelant.
 */
export async function provisionContributorWorkspace(context: {
  challengeIndex: number;
  username: string;
  repoExternalId: string;
  repoType: string;
  challengeBranchRef?: string;
}): Promise<ProvisionResult> {
  const workspaceType = mapRepoTypeToWorkspaceType(context.repoType);
  if (!ProvisionerRegistry.hasProvider(workspaceType)) {
    return {
      provider: 'none', workspaceType, ref: '', url: '',
      status: 'failed',
      error: `No provider available for workspace type: ${workspaceType}`,
    };
  }

  const provider = ProvisionerRegistry.getProvider(workspaceType);
  const baseRef = context.challengeBranchRef
    ? context.challengeBranchRef.replace('refs/heads/', '')
    : 'main';

  return provider.provision({
    workspaceType,
    parentRef: context.repoExternalId,
    name: generateContributorBranchName(context.challengeIndex, context.username),
    baseRef,
  });
}

// Exports
export { ProvisionerRegistry } from './registry.js';
export * from './types.js';
export * from './errors.js';
export * from './utils.js';
