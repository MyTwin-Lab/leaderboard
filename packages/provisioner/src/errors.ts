// packages/provisioner/src/errors.ts

/**
 * Erreur de base pour le provisioner
 */
export class ProvisionerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvisionerError';
  }
}

/**
 * Type de workspace non supporté
 */
export class UnsupportedWorkspaceTypeError extends ProvisionerError {
  constructor(public readonly workspaceType: string) {
    super(`Unsupported workspace type: ${workspaceType}`);
    this.name = 'UnsupportedWorkspaceTypeError';
  }
}

/**
 * Provider non trouvé dans le registry
 */
export class ProviderNotFoundError extends ProvisionerError {
  constructor(public readonly workspaceType: string) {
    super(`No provider registered for workspace type: ${workspaceType}`);
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * Erreur d'authentification avec le provider externe
 */
export class ProviderAuthenticationError extends ProvisionerError {
  constructor(public readonly provider: string, message?: string) {
    super(`Authentication failed for provider ${provider}${message ? `: ${message}` : ''}`);
    this.name = 'ProviderAuthenticationError';
  }
}

/**
 * Le workspace existe déjà (non bloquant)
 */
export class WorkspaceAlreadyExistsError extends ProvisionerError {
  constructor(
    public readonly provider: string,
    public readonly ref: string,
    public readonly url: string
  ) {
    super(`Workspace already exists: ${ref}`);
    this.name = 'WorkspaceAlreadyExistsError';
  }
}

/**
 * Ressource parente non trouvée (ex: repo GitHub inexistant)
 */
export class ParentResourceNotFoundError extends ProvisionerError {
  constructor(public readonly parentRef: string) {
    super(`Parent resource not found: ${parentRef}`);
    this.name = 'ParentResourceNotFoundError';
  }
}

/**
 * Erreur de configuration manquante
 */
export class MissingConfigurationError extends ProvisionerError {
  constructor(public readonly configKey: string) {
    super(`Missing configuration: ${configKey}`);
    this.name = 'MissingConfigurationError';
  }
}
