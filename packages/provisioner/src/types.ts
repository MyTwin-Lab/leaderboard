// packages/provisioner/src/types.ts

/**
 * Types de workspace supportés (extensible)
 */
export type WorkspaceType = 
  | 'git_branch' 
  | 'git_repo' 
  | 'figma_project' 
  | 'hf_space' 
  | 'notion_page' 
  | string;

/**
 * Statut d'un workspace provisionné
 */
export type WorkspaceStatus = 'pending' | 'ready' | 'failed';

/**
 * Requête de provisioning générique
 */
export interface ProvisionRequest {
  /** Type de workspace à créer */
  workspaceType: WorkspaceType;
  
  /** Identifiant de la ressource parente (ex: "owner/repo" pour GitHub) */
  parentRef: string;
  
  /** Nom du workspace à créer (ex: "challenge/007-admin-experience") */
  name: string;
  
  /** Référence de base (ex: branche source "main") */
  baseRef?: string;
  
  /** Métadonnées spécifiques au provider */
  options?: Record<string, unknown>;
}

/**
 * Résultat d'un provisioning
 */
export interface ProvisionResult {
  /** Nom du provider utilisé */
  provider: string;
  
  /** Type de workspace créé */
  workspaceType: WorkspaceType;
  
  /** Référence unique du workspace (ex: "refs/heads/challenge/007-admin") */
  ref: string;
  
  /** URL d'accès au workspace */
  url: string;
  
  /** Statut du provisioning */
  status: WorkspaceStatus;
  
  /** Métadonnées additionnelles */
  meta?: Record<string, unknown>;
  
  /** Message d'erreur si status = 'failed' */
  error?: string;
}

/**
 * Interface générique pour tout provider de workspace
 */
export interface WorkspaceProvider {
  /** Type de workspace géré par ce provider */
  readonly type: WorkspaceType;
  
  /** Nom lisible du provider */
  readonly name: string;

  /**
   * Provisionne un nouveau workspace
   */
  provision(request: ProvisionRequest): Promise<ProvisionResult>;
  
  /**
   * Vérifie le statut d'un workspace existant
   */
  getStatus(parentRef: string, ref: string): Promise<WorkspaceStatus>;
  
  /**
   * Supprime un workspace (optionnel)
   */
  deprovision?(parentRef: string, ref: string): Promise<void>;
}

/**
 * Configuration pour le provisioning d'un challenge
 */
export interface ChallengeProvisionContext {
  challengeIndex: number;
  challengeTitle: string;
  repoExternalId: string;
  repoType: string;
}

/**
 * Configuration pour le provisioning d'une task
 */
export interface TaskProvisionContext {
  challengeIndex: number;
  taskTitle: string;
  repoExternalId: string;
  repoType: string;
  /** Branche du challenge parent (base pour la branche task) */
  challengeBranchRef?: string;
}
