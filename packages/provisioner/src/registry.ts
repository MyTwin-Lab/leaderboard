// packages/provisioner/src/registry.ts

import type { WorkspaceProvider, WorkspaceType } from './types.js';
import { ProviderNotFoundError } from './errors.js';

/**
 * Registry pour les providers de workspace
 * Permet d'enregistrer et récupérer des providers par type
 */
export class ProvisionerRegistry {
  private static providers = new Map<WorkspaceType, WorkspaceProvider>();

  /**
   * Enregistre un provider pour un type de workspace
   */
  static register(provider: WorkspaceProvider): void {
    this.providers.set(provider.type, provider);
    console.log(`[ProvisionerRegistry] Registered provider: ${provider.name} for type: ${provider.type}`);
  }

  /**
   * Récupère un provider par type de workspace
   * @throws ProviderNotFoundError si aucun provider n'est enregistré pour ce type
   */
  static getProvider(type: WorkspaceType): WorkspaceProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new ProviderNotFoundError(type);
    }
    return provider;
  }

  /**
   * Vérifie si un provider existe pour un type donné
   */
  static hasProvider(type: WorkspaceType): boolean {
    return this.providers.has(type);
  }

  /**
   * Liste tous les types de workspace supportés
   */
  static getSupportedTypes(): WorkspaceType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Supprime un provider (utile pour les tests)
   */
  static unregister(type: WorkspaceType): void {
    this.providers.delete(type);
  }

  /**
   * Supprime tous les providers (utile pour les tests)
   */
  static clear(): void {
    this.providers.clear();
  }
}
