import type { FlowDescriptor } from "./flows.js";

/**
 * Registre de la plateforme
 * -------------------------
 * Ce que la distribution installée apporte côté serveur : les flows (un par
 * challenge), les extensions (attachables aux flows qu'elles déclarent), les
 * kits (code partagé entre flows) et les modules produit.
 *
 * Chacun déclare les clés du ledger et les types de contribution qu'il écrit.
 * Le registre refuse, dès l'installation, une clé revendiquée par deux
 * propriétaires : deux sens pour la même ligne de ledger rendraient faux tous
 * les calculs qui la lisent.
 *
 * L'état vit sur `globalThis`, pour la même raison que le registre des
 * connecteurs : Next peut charger ce module plusieurs fois.
 */

/** Une clé du ledger (`reward_entries.rule_key`) et son rapport au pool du challenge. */
export interface RuleKeyDeclaration {
  key: string;
  /** Les points de cette clé consomment le pool du challenge. Faux pour une récompense fixe hors pool. */
  consumesPool: boolean;
}

/** Un type de contribution (`contributions.type`). */
export interface ContributionTypeDeclaration {
  key: string;
  /**
   * Compte comme une contribution dans le classement et les profils. Faux pour
   * une ligne d'agrégat, comme les signaux de discussion.
   */
  countsAsContribution: boolean;
}

interface Declarations {
  ruleKeys?: readonly RuleKeyDeclaration[];
  contributionTypes?: readonly ContributionTypeDeclaration[];
}

export interface FlowDefinition extends Declarations {
  descriptor: FlowDescriptor;
}

export interface ExtensionDefinition extends Declarations {
  key: string;
  /** Les flows auxquels l'extension s'attache, ou `"*"` pour tous. */
  appliesTo: readonly string[] | "*";
}

export interface KitDefinition extends Declarations {
  key: string;
}

export interface ModuleDefinition extends Declarations {
  key: string;
}

export interface PlatformDefinitions {
  flows: readonly FlowDefinition[];
  extensions?: readonly ExtensionDefinition[];
  kits?: readonly KitDefinition[];
  modules?: readonly ModuleDefinition[];
}

/** Une déclaration, avec qui l'a faite (`flow:ml`, `extension:slack-signals`…). */
export type Owned<T> = T & { owner: string };

interface PlatformState {
  flows: Map<string, FlowDefinition>;
  extensions: Map<string, ExtensionDefinition>;
  kits: Map<string, KitDefinition>;
  modules: Map<string, ModuleDefinition>;
  ruleKeys: Map<string, Owned<RuleKeyDeclaration>>;
  contributionTypes: Map<string, Owned<ContributionTypeDeclaration>>;
}

const STATE_KEY = "__leaderboardPlatformRegistry";

function holder(): Record<string, PlatformState | undefined> {
  return globalThis as unknown as Record<string, PlatformState | undefined>;
}

function current(): PlatformState {
  const state = holder()[STATE_KEY];
  if (!state) {
    throw new Error("[PlatformRegistry] No distribution installed");
  }
  return state;
}

function claim<T extends { key: string }>(
  target: Map<string, Owned<T>>,
  kind: string,
  owner: string,
  declarations: readonly T[] | undefined
): void {
  for (const declaration of declarations ?? []) {
    const existing = target.get(declaration.key);
    if (existing) {
      throw new Error(
        `[PlatformRegistry] ${kind} "${declaration.key}" is declared by both ${existing.owner} and ${owner}`
      );
    }
    target.set(declaration.key, { ...declaration, owner });
  }
}

function addUnique<T>(target: Map<string, T>, kind: string, key: string, value: T): void {
  if (target.has(key)) {
    throw new Error(`[PlatformRegistry] ${kind} "${key}" is installed twice`);
  }
  target.set(key, value);
}

export class PlatformRegistry {
  /**
   * Installe une distribution. Tout est vérifié avant que rien ne soit visible :
   * une installation qui échoue laisse le registre vide.
   */
  static install(definitions: PlatformDefinitions): void {
    if (holder()[STATE_KEY]) {
      throw new Error("[PlatformRegistry] A distribution is already installed");
    }

    const state: PlatformState = {
      flows: new Map(),
      extensions: new Map(),
      kits: new Map(),
      modules: new Map(),
      ruleKeys: new Map(),
      contributionTypes: new Map(),
    };

    const owners: Array<{ owner: string; declarations: Declarations }> = [];

    for (const flow of definitions.flows) {
      addUnique(state.flows, "Flow", flow.descriptor.key, flow);
      owners.push({ owner: `flow:${flow.descriptor.key}`, declarations: flow });
    }
    for (const kit of definitions.kits ?? []) {
      addUnique(state.kits, "Kit", kit.key, kit);
      owners.push({ owner: `kit:${kit.key}`, declarations: kit });
    }
    for (const extension of definitions.extensions ?? []) {
      addUnique(state.extensions, "Extension", extension.key, extension);
      if (extension.appliesTo !== "*") {
        for (const flowKey of extension.appliesTo) {
          if (!state.flows.has(flowKey)) {
            throw new Error(
              `[PlatformRegistry] Extension "${extension.key}" applies to flow "${flowKey}", which is not installed`
            );
          }
        }
      }
      owners.push({ owner: `extension:${extension.key}`, declarations: extension });
    }
    for (const module of definitions.modules ?? []) {
      addUnique(state.modules, "Module", module.key, module);
      owners.push({ owner: `module:${module.key}`, declarations: module });
    }

    for (const { owner, declarations } of owners) {
      claim(state.ruleKeys, "Rule key", owner, declarations.ruleKeys);
      claim(state.contributionTypes, "Contribution type", owner, declarations.contributionTypes);
    }

    holder()[STATE_KEY] = state;
  }

  static isInstalled(): boolean {
    return !!holder()[STATE_KEY];
  }

  /** Désinstalle la distribution — réservé aux tests. */
  static reset(): void {
    delete holder()[STATE_KEY];
  }

  static flow(key: string | null | undefined): FlowDefinition | undefined {
    return key ? current().flows.get(key) : undefined;
  }

  static flows(): FlowDefinition[] {
    return [...current().flows.values()];
  }

  static extension(key: string): ExtensionDefinition | undefined {
    return current().extensions.get(key);
  }

  /** Les extensions qui s'attachent à ce flow. */
  static extensionsFor(flowKey: string): ExtensionDefinition[] {
    return [...current().extensions.values()].filter(
      (extension) => extension.appliesTo === "*" || extension.appliesTo.includes(flowKey)
    );
  }

  static kit(key: string): KitDefinition | undefined {
    return current().kits.get(key);
  }

  static module(key: string): ModuleDefinition | undefined {
    return current().modules.get(key);
  }

  static ruleKey(key: string): Owned<RuleKeyDeclaration> | undefined {
    return current().ruleKeys.get(key);
  }

  static ruleKeys(): Owned<RuleKeyDeclaration>[] {
    return [...current().ruleKeys.values()];
  }

  static contributionType(key: string): Owned<ContributionTypeDeclaration> | undefined {
    return current().contributionTypes.get(key);
  }

  static contributionTypes(): Owned<ContributionTypeDeclaration>[] {
    return [...current().contributionTypes.values()];
  }
}
