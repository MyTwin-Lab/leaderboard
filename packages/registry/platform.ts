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
  /** Libellé lisible d'une ligne de cette clé. Sans libellé, la clé brute s'affiche. */
  label?: string;
  /**
   * Libellé propre à une ligne, tiré de son `meta` (le nom d'un signal choisi
   * par le manager, par exemple). `undefined` retombe sur `label`.
   */
  describe?(meta: Record<string, unknown> | undefined): string | undefined;
}

/** Une chip du profil d'un contributeur, pour un type de contribution agrégat. */
export interface ProfileAggregateChip {
  id: string;
  label: string;
  /** Clé d'icône du design system, ou `null`. */
  icon: string | null;
  count: number;
  totalCp: number;
}

/** Comment le profil résume une contribution agrégat, en chips plutôt qu'en ligne de liste. */
export interface ProfileAggregate {
  /** Titre de la section (« Discussion »…). */
  title: string;
  summarize(input: { challengeId: string; contributionId: string }): Promise<ProfileAggregateChip[]>;
}

/** Un type de contribution (`contributions.type`). */
export interface ContributionTypeDeclaration {
  key: string;
  /**
   * Compte comme une contribution dans le classement et les profils. Faux pour
   * une ligne d'agrégat, comme les signaux de discussion.
   */
  countsAsContribution: boolean;
  /** Pour un type agrégat : son résumé dans le profil. */
  profileAggregate?: ProfileAggregate;
}

/** Une ligne de CP gagnée hors challenge, sans projet. */
export interface CpSourceEntry {
  user_id: string;
  points: number;
  created_at: Date;
}

/** Des CP extérieurs au ledger des challenges, que le classement additionne. */
export interface CpSourceDefinition {
  key: string;
  listAll(): Promise<CpSourceEntry[]>;
}

/** Ce que rend le rejeu d'une évaluation : relancée, ou refusée avec une raison affichable. */
export type EvaluationRetryOutcome = { ok: true } | { ok: false; reason: string };

/**
 * Un point d'entrée d'évaluation, que la capacité `evaluate` inscrit dans ses
 * runs et que le rejeu d'un run échoué rappelle avec le même `payload`.
 */
export interface EvaluationHandlerDeclaration {
  key: string;
  retry(payload: Record<string, unknown>): Promise<EvaluationRetryOutcome>;
}

/**
 * Un schéma de configuration : tout ce qui a un `parse` qui lève sur une
 * valeur invalide et rend la valeur normalisée (défauts posés). Un schéma zod
 * convient tel quel ; le registre ne dépend pas de zod pour autant.
 */
export interface ConfigSchema<T = Record<string, unknown>> {
  parse(value: unknown): T;
}

/**
 * La configuration d'un flow (`challenges.flow_config`), fixée à la création.
 *
 * Versionnée : `version` est la version courante, `upgrades[n]` monte une
 * configuration écrite en version `n` vers `n + 1`. Une montée manquante fait
 * échouer l'installation.
 */
export interface FlowConfigDeclaration {
  version: number;
  schema: ConfigSchema;
  upgrades?: Readonly<Record<number, (config: Record<string, unknown>) => Record<string, unknown>>>;
}

/**
 * La configuration qu'une extension range dans `flow_config.extensions[key]`.
 * Seules les clés de `editableKeys` changent après la création.
 */
export interface ExtensionConfigDeclaration {
  schema: ConfigSchema;
  editableKeys?: readonly string[];
}

/** Les règles de récompense d'un flow (`challenges.reward_rules`), éditables. `null` : illisibles. */
export interface FlowRulesDeclaration {
  parse(raw: unknown): unknown | null;
}

interface Declarations {
  ruleKeys?: readonly RuleKeyDeclaration[];
  contributionTypes?: readonly ContributionTypeDeclaration[];
  evaluationHandlers?: readonly EvaluationHandlerDeclaration[];
}

export interface FlowDefinition extends Declarations {
  descriptor: FlowDescriptor;
  config?: FlowConfigDeclaration;
  rules?: FlowRulesDeclaration;
}

export interface ExtensionDefinition extends Declarations {
  key: string;
  /** Les flows auxquels l'extension s'attache, ou `"*"` pour tous. */
  appliesTo: readonly string[] | "*";
  config?: ExtensionConfigDeclaration;
}

export interface KitDefinition extends Declarations {
  key: string;
}

export interface ModuleDefinition extends Declarations {
  key: string;
  /** CP que le module verse hors du ledger des challenges. */
  cpSource?: CpSourceDefinition;
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
  /** Par clé de propriétaire (`code`, `sandbox`…), telle qu'inscrite dans `evaluation_runs.trigger_type`. */
  evaluationHandlers: Map<string, { owner: string; handlers: Map<string, EvaluationHandlerDeclaration> }>;
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

/**
 * Les handlers d'un propriétaire, rangés sous sa clé nue : c'est elle que le
 * run garde. Deux propriétaires de même clé (un flow et un module `x`) ne
 * peuvent donc pas tous deux en déclarer.
 */
function claimEvaluationHandlers(
  target: PlatformState["evaluationHandlers"],
  key: string,
  owner: string,
  declarations: readonly EvaluationHandlerDeclaration[] | undefined
): void {
  if (!declarations?.length) return;

  const existing = target.get(key);
  if (existing) {
    throw new Error(
      `[PlatformRegistry] Evaluation handlers under "${key}" are declared by both ${existing.owner} and ${owner}`
    );
  }

  const handlers = new Map<string, EvaluationHandlerDeclaration>();
  for (const declaration of declarations) {
    addUnique(handlers, `Evaluation handler ${owner}/`, declaration.key, declaration);
  }
  target.set(key, { owner, handlers });
}

/** Une configuration versionnée doit pouvoir monter depuis chaque version antérieure. */
function checkConfigVersions(flow: FlowDefinition): void {
  const config = flow.config;
  if (!config) return;

  const key = flow.descriptor.key;
  if (!Number.isInteger(config.version) || config.version < 1) {
    throw new Error(`[PlatformRegistry] Flow "${key}" declares an invalid config version ${config.version}`);
  }
  for (let from = 1; from < config.version; from++) {
    if (typeof config.upgrades?.[from] !== "function") {
      throw new Error(
        `[PlatformRegistry] Flow "${key}" config version ${config.version} has no upgrade from version ${from}`
      );
    }
  }
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
      evaluationHandlers: new Map(),
    };

    const owners: Array<{ key: string; owner: string; declarations: Declarations }> = [];

    for (const flow of definitions.flows) {
      addUnique(state.flows, "Flow", flow.descriptor.key, flow);
      checkConfigVersions(flow);
      owners.push({ key: flow.descriptor.key, owner: `flow:${flow.descriptor.key}`, declarations: flow });
    }
    for (const kit of definitions.kits ?? []) {
      addUnique(state.kits, "Kit", kit.key, kit);
      owners.push({ key: kit.key, owner: `kit:${kit.key}`, declarations: kit });
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
      owners.push({ key: extension.key, owner: `extension:${extension.key}`, declarations: extension });
    }
    for (const module of definitions.modules ?? []) {
      addUnique(state.modules, "Module", module.key, module);
      owners.push({ key: module.key, owner: `module:${module.key}`, declarations: module });
    }

    for (const { key, owner, declarations } of owners) {
      claim(state.ruleKeys, "Rule key", owner, declarations.ruleKeys);
      claim(state.contributionTypes, "Contribution type", owner, declarations.contributionTypes);
      claimEvaluationHandlers(state.evaluationHandlers, key, owner, declarations.evaluationHandlers);
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

  /** Les sources de CP extérieures au ledger des challenges. */
  static cpSources(): CpSourceDefinition[] {
    return [...current().modules.values()]
      .map((module) => module.cpSource)
      .filter((source): source is CpSourceDefinition => !!source);
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

  /** Le handler d'évaluation `handlerKey` du propriétaire `ownerKey` (flow, extension, kit ou module). */
  static evaluationHandler(ownerKey: string, handlerKey: string): Owned<EvaluationHandlerDeclaration> | undefined {
    const entry = current().evaluationHandlers.get(ownerKey);
    const handler = entry?.handlers.get(handlerKey);
    return entry && handler ? { ...handler, owner: entry.owner } : undefined;
  }
}
