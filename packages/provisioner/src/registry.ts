// packages/provisioner/src/registry.ts

import type { WorkspaceProvider, WorkspaceType } from './types.js';
import { ProviderNotFoundError } from './errors.js';

/*
 * L'état vit sur `globalThis` : les providers sont enregistrés par la
 * distribution au démarrage du serveur, et Next peut charger ce module
 * plusieurs fois.
 */
const STATE_KEY = '__leaderboardProvisionerRegistry';

function providers(): Map<WorkspaceType, WorkspaceProvider> {
  const holder = globalThis as unknown as Record<string, Map<WorkspaceType, WorkspaceProvider> | undefined>;
  holder[STATE_KEY] ??= new Map();
  return holder[STATE_KEY]!;
}

/**
 * Registry pour les providers de workspace
 * Permet d'enregistrer et récupérer des providers par type
 */
export class ProvisionerRegistry {
  /**
   * Enregistre un provider pour un type de workspace
   */
  static register(provider: WorkspaceProvider): void {
    providers().set(provider.type, provider);
    console.log(`[ProvisionerRegistry] Registered provider: ${provider.name} for type: ${provider.type}`);
  }

  /**
   * Récupère un provider par type de workspace
   * @throws ProviderNotFoundError si aucun provider n'est enregistré pour ce type
   */
  static getProvider(type: WorkspaceType): WorkspaceProvider {
    const provider = providers().get(type);
    if (!provider) {
      throw new ProviderNotFoundError(type);
    }
    return provider;
  }

  /**
   * Vérifie si un provider existe pour un type donné
   */
  static hasProvider(type: WorkspaceType): boolean {
    return providers().has(type);
  }

  /**
   * Liste tous les types de workspace supportés
   */
  static getSupportedTypes(): WorkspaceType[] {
    return Array.from(providers().keys());
  }

  /**
   * Supprime un provider (utile pour les tests)
   */
  static unregister(type: WorkspaceType): void {
    providers().delete(type);
  }

  /**
   * Supprime tous les providers (utile pour les tests)
   */
  static clear(): void {
    providers().clear();
  }
}
