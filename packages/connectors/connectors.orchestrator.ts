import type { ExternalConnector, ExternalItem, ConnectorType } from "./interfaces.js";
import type { Repo } from "../database-service/domain/entities.js";

/**
 * Item enrichi avec sa source (type de connecteur, repo ID, nom du repo)
 */
export type AggregatedItem = ExternalItem & {
  source: {
    type: ConnectorType;
    repoId: string;
    repoTitle: string;
  };
};

/**
 * ConnectorsOrchestrator
 * ----------------------
 * Orchestre le cycle de vie de plusieurs connecteurs :
 * - Connexion parallèle avec gestion d'erreurs
 * - Agrégation des items de tous les connecteurs
 * - Indexation pour router les fetchItemContent vers le bon connecteur
 * - Déconnexion propre
 */
export class ConnectorsOrchestrator {
  private connectors: Map<string, ExternalConnector> = new Map();
  private itemToConnector: Map<string, ExternalConnector> = new Map();
  private repos: Repo[];

  constructor(connectors: ExternalConnector[], repos: Repo[]) {
    this.repos = repos;
    
    // Indexer les connecteurs par repo UUID
    repos.forEach((repo, idx) => {
      if (connectors[idx]) {
        this.connectors.set(repo.uuid, connectors[idx]);
      }
    });
  }

  /**
   * Connecte tous les connecteurs en parallèle
   * Continue même si certains échouent (log les erreurs)
   */
  async connectAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.connectors.entries()).map(async ([repoId, connector]) => {
        try {
          await connector.connect();
          console.log(`[Orchestrator] Connected: ${connector.name} (${connector.type})`);
        } catch (error: any) {
          console.error(`[Orchestrator] Failed to connect ${connector.name}:`, error.message);
          throw error;
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[Orchestrator] ${failures.length}/${this.connectors.size} connectors failed to connect`);
    }
  }

  /**
   * Récupère les items de tous les connecteurs et les agrège
   * Construit l'index itemId -> connector pour le routing ultérieur
   * @param options - Options passées à fetchItems de chaque connecteur
   * @returns Liste agrégée des items avec leur source
   */
  async fetchAllItems(options?: Record<string, any>): Promise<AggregatedItem[]> {
    const allItems: AggregatedItem[] = [];

    const results = await Promise.allSettled(
      Array.from(this.connectors.entries()).map(async ([repoId, connector]) => {
        try {
          const items = await connector.fetchItems(options);
          console.log(`[Orchestrator] Fetched ${items.length} items from ${connector.name}`);

          // Indexer chaque item vers son connecteur pour le routing
          items.forEach(item => {
            this.itemToConnector.set(item.id, connector);
          });

          // Enrichir avec la source
          const repo = this.repos.find(r => r.uuid === repoId);
          return items.map(item => ({
            ...item,
            source: {
              type: connector.type,
              repoId,
              repoTitle: repo?.title || connector.name,
            },
          }));
        } catch (error: any) {
          console.error(`[Orchestrator] Failed to fetch from ${connector.name}:`, error.message);
          return [];
        }
      })
    );

    // Agréger tous les résultats (succès et échecs)
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    });

    console.log(`[Orchestrator] Total items aggregated: ${allItems.length}`);
    return allItems;
  }

  /**
   * Résout le connecteur responsable d'un item donné
   * Utilisé pour router les appels fetchItemContent vers le bon connecteur
   * @param itemId - ID de l'item (ex: commit SHA)
   * @returns Le connecteur ou undefined si non trouvé
   */
  getConnectorForItem(itemId: string): ExternalConnector | undefined {
    return this.itemToConnector.get(itemId);
  }

  /**
   * Déconnecte tous les connecteurs proprement
   */
  async disconnectAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.connectors.values()).map(async (connector) => {
        try {
          await connector.disconnect?.() || Promise.resolve();
          console.log(`[Orchestrator] Disconnected: ${connector.name}`);
        } catch (error: any) {
          console.error(`[Orchestrator] Failed to disconnect ${connector.name}:`, error.message);
          // Ne pas throw pour continuer avec les autres
        }
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`[Orchestrator] ${failures.length}/${this.connectors.size} connectors failed to disconnect`);
    } else {
      console.log(`[Orchestrator] All connectors disconnected successfully`);
    }
  }
}
