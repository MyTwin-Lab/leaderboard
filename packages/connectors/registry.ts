import type { Repo } from "../database-service/domain/entities.js";
import type { ExternalConnector } from "./interfaces.js";

/**
 * ConnectorRegistry
 * -----------------
 * Associe un type de repo (`github`, `kaggle_model`…) au connecteur qui sait
 * le lire. Le core ne connaît aucune implémentation : chaque connecteur est
 * une définition enregistrée par la distribution installée
 * (`apps/leaderboard-client/src/distribution/mytwin.server.ts`), exactement
 * comme le serait le connecteur d'un client.
 *
 * L'état vit sur `globalThis` : Next peut charger ce module plusieurs fois
 * (instrumentation, bundles de routes), et une distribution installée au
 * démarrage doit être vue par toutes ces copies.
 */

/**
 * Ce qu'un connecteur a besoin de savoir du repo à lire : son type, et le plus
 * souvent `external_repo_id`. Les autres champs d'un `Repo` sont acceptés, pour
 * que les appelants puissent passer une ligne entière.
 */
export type ConnectorRepoRef = Pick<Repo, "type"> & Partial<Omit<Repo, "type">>;

export interface ConnectorCreateOptions {
  /** Branche à lire, pour les connecteurs de code. */
  branch?: string;
  /**
   * Construit le connecteur sans credentials quand le service l'accepte (dépôt
   * GitHub public, fortement limité en débit). Par défaut, un connecteur sans
   * credentials n'est pas construit.
   */
  allowAnonymous?: boolean;
}

/** Ce que le core fait de l'activité d'un connecteur, sans jamais lire son payload. */
export interface ConnectorActivityDeclaration {
  /** Les types de repo dont l'activité se lit. Défaut : tous ceux du connecteur. */
  repoTypes?: readonly string[];
  /** Fusionne les activités de plusieurs artefacts d'un même repo (un par contributeur). */
  merge?(payloads: unknown[]): unknown;
  /** Ce qu'un visiteur anonyme peut voir. Défaut : l'activité telle quelle. */
  toPublic?(payload: unknown): unknown;
}

export interface ConnectorDefinition {
  /** Identifiant unique du connecteur. */
  key: string;
  /** Types de repo que ce connecteur sait lire. Un type n'appartient qu'à un seul connecteur. */
  repoTypes: readonly string[];
  /** `null` quand le connecteur ne peut pas être construit (credentials absents, référence invalide). */
  create(repo: ConnectorRepoRef, options?: ConnectorCreateOptions): Promise<ExternalConnector | null>;
  activity?: ConnectorActivityDeclaration;
}

interface RegistryState {
  byKey: Map<string, ConnectorDefinition>;
  byRepoType: Map<string, ConnectorDefinition>;
}

const STATE_KEY = "__leaderboardConnectorRegistry";

function state(): RegistryState {
  const holder = globalThis as unknown as Record<string, RegistryState | undefined>;
  holder[STATE_KEY] ??= { byKey: new Map(), byRepoType: new Map() };
  return holder[STATE_KEY]!;
}

export class ConnectorRegistry {
  /**
   * Enregistre un connecteur. Une clé ou un type de repo déjà pris lève : deux
   * connecteurs qui prétendraient lire le même type rendraient le choix
   * arbitraire, et l'erreur doit apparaître au démarrage, pas à la lecture.
   */
  static register(definition: ConnectorDefinition): void {
    const { byKey, byRepoType } = state();
    if (byKey.has(definition.key)) {
      throw new Error(`[ConnectorRegistry] Connector "${definition.key}" is already registered`);
    }
    for (const type of definition.repoTypes) {
      const owner = byRepoType.get(type);
      if (owner) {
        throw new Error(`[ConnectorRegistry] Repo type "${type}" is already handled by connector "${owner.key}"`);
      }
    }
    byKey.set(definition.key, definition);
    for (const type of definition.repoTypes) byRepoType.set(type, definition);
  }

  static has(key: string): boolean {
    return state().byKey.has(key);
  }

  static keys(): string[] {
    return [...state().byKey.keys()];
  }

  static get(key: string): ConnectorDefinition | undefined {
    return state().byKey.get(key);
  }

  /** Le connecteur qui lit ce type de repo. */
  static definitionFor(repoType: string): ConnectorDefinition | undefined {
    return state().byRepoType.get(repoType);
  }

  /** Un type de repo n'est valide que si un connecteur installé le lit. */
  static isKnownRepoType(repoType: string): boolean {
    return state().byRepoType.has(repoType);
  }

  /** Vide le registre — réservé aux tests. */
  static clear(): void {
    const { byKey, byRepoType } = state();
    byKey.clear();
    byRepoType.clear();
  }

  /**
   * Crée le connecteur du repo, ou `null` si aucun connecteur installé ne lit
   * ce type ou si le connecteur ne peut pas être construit.
   */
  static async createConnector(
    repo: ConnectorRepoRef,
    options?: ConnectorCreateOptions
  ): Promise<ExternalConnector | null> {
    const { byKey, byRepoType } = state();
    const definition = byRepoType.get(repo.type);
    if (!definition) {
      if (byKey.size === 0) {
        console.error(
          `[ConnectorRegistry] No connector installed: the server distribution was not installed before '${repo.type}' was requested`
        );
      } else {
        console.warn(`[ConnectorRegistry] Unknown repo type '${repo.type}'${repo.title ? ` for repo: ${repo.title}` : ""}`);
      }
      return null;
    }
    return definition.create(repo, options);
  }
}
