import type { ModuleSetting } from "../database-service/repositories/moduleSetting.repo.js";
import { PlatformRegistry, type ModuleDefinition } from "../registry/platform.js";

/**
 * Capacité `modules`
 * ------------------
 * Un module produit s'active et se règle depuis l'écran des modules. Désactivé,
 * ses routes répondent 404, ses jobs sont sautés, ses abonnements ne
 * consomment pas d'événements et ses slots sont masqués.
 *
 * L'état vit dans `module_settings` ; un module sans ligne prend l'état par
 * défaut qu'il déclare. Ses réglages sont validés et complétés par son schéma.
 */

export interface ModuleSettingStore {
  find(key: string): Promise<ModuleSetting | null>;
  findAll(): Promise<ModuleSetting[]>;
  save(key: string, state: { enabled: boolean; settings: Record<string, unknown> }, updatedBy: string | null): Promise<ModuleSetting>;
}

export interface ModuleState {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  settings: Record<string, unknown>;
  updatedAt: Date | null;
}

export class ModuleNotFoundError extends Error {}
export class ModuleSettingsError extends Error {}

function parseSettings(module: ModuleDefinition, raw: unknown, strict: boolean): Record<string, unknown> {
  if (!module.settings) return {};
  try {
    return module.settings.schema.parse(raw ?? {});
  } catch (error) {
    if (strict) {
      throw new ModuleSettingsError(error instanceof Error ? error.message : `Invalid settings for module "${module.key}"`);
    }
    // Des réglages stockés devenus illisibles (le schéma a changé) : le module tourne sur ses défauts.
    console.warn(`[modules] Stored settings of module "${module.key}" are invalid, using defaults:`, error);
    return module.settings.schema.parse({});
  }
}

function stateOf(module: ModuleDefinition, row: ModuleSetting | null): ModuleState {
  return {
    key: module.key,
    label: module.label ?? module.key,
    description: module.description ?? null,
    enabled: row?.enabled ?? module.defaultEnabled ?? false,
    settings: parseSettings(module, row?.settings, false),
    updatedAt: row?.updated_at ?? null,
  };
}

export interface Modules {
  /** L'état d'un module installé, `null` sinon. */
  state(key: string): Promise<ModuleState | null>;
  /** Tous les modules installés, dans l'ordre de la distribution. */
  all(): Promise<ModuleState[]>;
  /** Faux pour un module désactivé comme pour un module qui n'est pas installé. */
  enabled(key: string): Promise<boolean>;
  /** Les réglages validés d'un module installé ; `{}` sinon. */
  settings(key: string): Promise<Record<string, unknown>>;
  /** Change l'état et fusionne les réglages, validés par le schéma du module. */
  update(
    key: string,
    patch: { enabled?: boolean; settings?: Record<string, unknown> },
    updatedBy: string | null,
  ): Promise<ModuleState>;
}

export function createModules(store?: ModuleSettingStore): Modules {
  let resolved = store;
  const repo = async (): Promise<ModuleSettingStore> => {
    if (!resolved) {
      // Import à la demande : lire la capacité ne charge pas la base.
      const { ModuleSettingRepository } = await import("../database-service/repositories/moduleSetting.repo.js");
      resolved = new ModuleSettingRepository();
    }
    return resolved;
  };

  const installed = (key: string) => (PlatformRegistry.isInstalled() ? PlatformRegistry.module(key) : undefined);

  const api: Modules = {
    async state(key) {
      const module = installed(key);
      if (!module) return null;
      return stateOf(module, await (await repo()).find(key));
    },

    async all() {
      if (!PlatformRegistry.isInstalled()) return [];
      const rows = new Map((await (await repo()).findAll()).map((row) => [row.key, row]));
      return PlatformRegistry.modules().map((module) => stateOf(module, rows.get(module.key) ?? null));
    },

    async enabled(key) {
      return (await api.state(key))?.enabled ?? false;
    },

    async settings(key) {
      return (await api.state(key))?.settings ?? {};
    },

    async update(key, patch, updatedBy) {
      const module = installed(key);
      if (!module) throw new ModuleNotFoundError(`Module "${key}" is not installed`);
      const current = stateOf(module, await (await repo()).find(key));
      const settings = patch.settings === undefined
        ? current.settings
        : parseSettings(module, { ...current.settings, ...patch.settings }, true);
      const row = await (await repo()).save(key, { enabled: patch.enabled ?? current.enabled, settings }, updatedBy);
      return stateOf(module, row);
    },
  };
  return api;
}

export const modules: Modules = createModules();

/**
 * Le propriétaire d'une déclaration (`module:digest`, `flow:code`…) est-il
 * actif ? Seul un module installé peut être désactivé : tout le reste l'est.
 */
export async function ownerEnabled(owner: string, registry: Modules = modules): Promise<boolean> {
  if (!owner.startsWith("module:")) return true;
  const key = owner.slice("module:".length);
  if (!PlatformRegistry.isInstalled() || !PlatformRegistry.module(key)) return true;
  return registry.enabled(key);
}
