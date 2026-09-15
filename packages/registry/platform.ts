import type { Challenge, ChallengeRepoRole } from "../database-service/domain/entities.js";
import type { FlowDescriptor } from "./flows.js";

/**
 * Registre de la plateforme
 * -------------------------
 * Ce que la distribution installée apporte côté serveur : les flows (un par
 * challenge), les extensions (attachables aux flows qu'elles déclarent), les
 * kits (code partagé entre flows), les modules produit et les qualifications
 * que ses flows exigent.
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

/**
 * Un livrable qu'un flow produit : un type de contribution, et ce qu'il
 * permet d'éprouver (`endpoint`, `deployed_app`…). Un flow de validation
 * choisit ses cibles par capacité, sans connaître le flow source.
 */
export interface DeliverableDeclaration {
  contributionType: string;
  capabilities: readonly string[];
}

/**
 * Une qualification qu'un compte peut détenir (`user_qualifications.key`),
 * distincte de son rôle : le rôle dit ce qu'il a le droit de faire sur la
 * plateforme, la qualification ce qu'on lui reconnaît de compétent pour juger.
 */
export interface QualificationDeclaration {
  key: string;
  label: string;
  description?: string;
}

export type ActionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Qui peut appeler une action. Une session est toujours exigée. Sans
 * condition, tout compte connecté passe ; avec des conditions, **une seule**
 * suffit : `{ roles: ["admin"], manager: true }` se lit « admin ou manager ».
 *
 * Ce contrôle est un portail : le handler garde ses vérifications propres
 * (la propriété d'une ligne, l'état d'une demande…).
 */
export interface ActionAccess {
  roles?: readonly string[];
  /** Le manager du projet du challenge. */
  manager?: boolean;
  /** Un participant du challenge (`challenge_teams`). */
  member?: boolean;
  /** La qualification exigée, lue dans la configuration du challenge. `null` : personne. */
  qualification?: (challenge: Challenge) => string | null;
}

/** L'appelant d'une action, relu en base par le shell. */
export interface ActionCaller {
  id: string;
  role: string;
}

/** Les lectures d'autorisation d'un appel, calculées une fois : le portail et le handler les partagent. */
export interface ActionAccessReader {
  isAdmin(): boolean;
  isManager(): Promise<boolean>;
  isMember(): Promise<boolean>;
  holds(qualification: string | null | undefined): Promise<boolean>;
}

export interface ActionContext {
  request: Request;
  challenge: Challenge;
  user: ActionCaller;
  /** Les segments `:nom` du chemin de l'action. */
  params: Readonly<Record<string, string>>;
  access: ActionAccessReader;
}

/**
 * Une action d'un flow ou d'une extension, servie par
 * `/api/challenges/[id]/flow/<path>` ou `/api/challenges/[id]/ext/<clé>/<path>`.
 */
export interface ChallengeActionDeclaration {
  /** `targets`, `targets/:targetId/claim`… sans barre de début ni de fin. */
  path: string;
  method: ActionMethod;
  access: ActionAccess;
  /** Une `Response` passe telle quelle (un fichier, un statut choisi) ; toute autre valeur part en JSON. */
  handle(ctx: ActionContext): Promise<unknown>;
}

/** Un dépôt qu'un challenge se voit créer à sa naissance (`repos` puis `challenge_repos`). */
export interface RepoDefinition {
  title: string;
  /** `github`, `kaggle_dataset`… */
  type: string;
  /** Le rôle du dépôt, quand le flow en distingue plusieurs. */
  role?: ChallengeRepoRole;
  /** Slug `owner/repo`, quand le créateur en a fourni un. */
  external_repo_id?: string;
}

export interface ChallengeCreateContext {
  challenge: Challenge;
  /** Les champs de création que la configuration ne garde pas (`github_repo`, `api_packaging_enabled`…). */
  input: Readonly<Record<string, unknown>>;
}

export interface ChallengeJoinContext {
  challenge: Challenge;
  userId: string;
  /** Le groupe que ce join crée, `null` en solo. */
  groupId: string | null;
}

export interface ChallengeGroupJoinContext {
  challenge: Challenge;
  userId: string;
  groupId: string;
}

/** Ce qu'un hook de join ajoute à la réponse (`missingGithub`…). */
export type ChallengeHookReport = Record<string, unknown>;

/**
 * Les moments de la vie d'un challenge où un flow ou une extension agit. Le
 * core les appelle pour le flow du challenge, puis pour chaque extension qui
 * s'y attache (`packages/capabilities/challenge-hooks.ts`).
 */
export interface ChallengeHooks {
  /**
   * Ce que la création doit persister. Pur : la route de création et la
   * promotion d'un sandbox l'écrivent chacune dans leur transaction.
   */
  onCreate?(ctx: ChallengeCreateContext): { repos?: readonly RepoDefinition[] };
  /** Après l'inscription d'un participant solo ou d'un créateur de groupe, board copié. */
  onJoin?(ctx: ChallengeJoinContext): Promise<ChallengeHookReport | void>;
  /** Après l'arrivée d'un membre dans un groupe existant. */
  onGroupJoin?(ctx: ChallengeGroupJoinContext): Promise<ChallengeHookReport | void>;
  /** À la clôture. Au mieux : un échec n'annule pas la clôture. */
  onClose?(challenge: Challenge): Promise<void>;
  /** Avant la suppression de la ligne, qui emporte ses dépendances en cascade. */
  onDelete?(challenge: Challenge): Promise<void>;
}

/** Les capacités du core qu'un flow active. */
export interface FlowUses {
  /** Un board personnel par participant, copié du template au join (`packages/capabilities/board.ts`). */
  board?: boolean;
  /** Le travail en groupe (`packages/capabilities/groups.ts`). */
  groups?: boolean;
}

/** Ce qu'un flow lit pour résumer les récompenses de son challenge. */
export interface FlowRewardsContext {
  challenge: Challenge;
  /** Toutes les lignes du ledger du challenge. */
  entries: readonly import("../database-service/domain/entities.js").RewardEntry[];
  /** Le plus grand nombre du champ `field` des `meta` des lignes de cette clé. */
  maxMetaNumber(opts: { ruleKey: string; field: string }): Promise<number | null>;
}

/**
 * Ce qu'un flow ajoute à l'état du pool de son challenge (`/api/challenges/[id]/rewards`) :
 * le core calcule le pool, le distribué et la répartition, le flow ses propres
 * champs (la métrique d'un challenge ML, par exemple).
 */
export interface FlowRewardsDeclaration {
  summarize(ctx: FlowRewardsContext): Promise<Record<string, unknown>>;
  /** Les champs servis à un visiteur anonyme. Aucun par défaut. */
  publicFields?: readonly string[];
}

/**
 * Un job planifié, lancé par le tick (`packages/capabilities/cron.ts`) quand
 * son horaire est échu. Sa clé est unique sur toute la plateforme.
 */
export interface JobDeclaration {
  /** `compute.expiration`, `digest.generate`… */
  key: string;
  /** Expression cron à 5 champs, en UTC. */
  schedule: string;
  /** Durée du verrou pris pendant l'exécution. 10 minutes par défaut. */
  lockSeconds?: number;
  run(): Promise<unknown>;
}

/** Un événement de la plateforme, lu dans l'outbox (`platform_events`). */
export interface PlatformEvent<Payload = Record<string, unknown>> {
  id: number;
  type: string;
  payload: Payload;
  occurredAt: Date;
}

/**
 * Un type d'événement qu'un propriétaire émet (`task.created`…). Un événement
 * n'existe que s'il a au moins un abonné : sans abonné, rien n'est écrit.
 */
export interface EventDeclaration {
  type: string;
  description?: string;
}

/**
 * Un abonné : il consomme dans l'ordre les événements d'un type, distribués
 * par le tick. Un événement peut être relivré après une panne : le handler
 * doit être idempotent. Une erreur arrête sa file jusqu'au tick suivant.
 */
export interface EventSubscriptionDeclaration {
  /** Unique sur la plateforme ; c'est le curseur de `event_deliveries`. */
  key: string;
  event: string;
  handle(event: PlatformEvent): Promise<void>;
}

/**
 * Une quête d'onboarding : accomplie quand survient l'événement déclaré, pour
 * l'utilisateur que l'événement désigne. Déclarée par son propriétaire (le
 * flow code pour `validated_task`, le module meetings pour `joined_meeting`…),
 * enregistrée par le module qui déclare `questRecorder`.
 */
export interface QuestDeclaration {
  /** Clé stable, conservée dans `onboarding_progress`. */
  key: string;
  label: string;
  description?: string;
  /** Rang d'affichage ; 0 par défaut. */
  order?: number;
  event: string;
  /** L'utilisateur qui accomplit la quête, lu dans l'événement ; `null` : personne. */
  userOf(event: PlatformEvent): string | null;
}

/**
 * Ce qu'un flow accepte comme proposition de la sandbox : les champs de la
 * proposition (`sandboxes.proposal_fields`) et son évaluation formative.
 */
export interface ProposableDeclaration {
  /** Le schéma des champs de la proposition. */
  fields: ConfigSchema;
  /** La source de bundle et la grille de l'évaluation formative, et l'entrée tirée des champs. */
  evaluation?: {
    bundleSource: string;
    grid: string;
    input(fields: Record<string, unknown>): unknown;
  };
}

interface Declarations {
  ruleKeys?: readonly RuleKeyDeclaration[];
  jobs?: readonly JobDeclaration[];
  contributionTypes?: readonly ContributionTypeDeclaration[];
  evaluationHandlers?: readonly EvaluationHandlerDeclaration[];
  events?: readonly EventDeclaration[];
  subscriptions?: readonly EventSubscriptionDeclaration[];
  quests?: readonly QuestDeclaration[];
}

export interface FlowDefinition extends Declarations {
  descriptor: FlowDescriptor;
  config?: FlowConfigDeclaration;
  /**
   * Valeurs que la distribution pose pour les clés de configuration absentes,
   * à la création comme à la lecture (une qualification exigée, par exemple).
   * Le flow reste générique ; c'est l'installation qui le règle.
   */
  configDefaults?: Readonly<Record<string, unknown>>;
  rules?: FlowRulesDeclaration;
  rewards?: FlowRewardsDeclaration;
  /** Les livrables que ses contributions constituent. */
  deliverables?: readonly DeliverableDeclaration[];
  /** Pour un flow qui éprouve les livrables d'un challenge parent (`source_challenge_id`). */
  requires?: { deliverableCapability: string };
  uses?: FlowUses;
  hooks?: ChallengeHooks;
  actions?: readonly ChallengeActionDeclaration[];
  /** La sandbox accepte des propositions pour ce flow. */
  proposable?: ProposableDeclaration;
}

export interface ExtensionDefinition extends Declarations {
  key: string;
  /** Les flows auxquels l'extension s'attache, ou `"*"` pour tous. */
  appliesTo: readonly string[] | "*";
  config?: ExtensionConfigDeclaration;
  hooks?: ChallengeHooks;
  actions?: readonly ChallengeActionDeclaration[];
}

export interface KitDefinition extends Declarations {
  key: string;
}

export interface ModuleDefinition extends Declarations {
  key: string;
  /** Nom de l'écran des modules. La clé, à défaut. */
  label?: string;
  description?: string;
  /** L'état d'un module sans ligne dans `module_settings`. Désactivé par défaut. */
  defaultEnabled?: boolean;
  /** Ses réglages (`module_settings.settings`), validés et complétés par le schéma. */
  settings?: { schema: ConfigSchema };
  /** Le module qui enregistre la progression des quêtes. Un seul par plateforme. */
  questRecorder?: { record(userId: string, questKey: string, completedAt: Date): Promise<void> };
  /** CP que le module verse hors du ledger des challenges. */
  cpSource?: CpSourceDefinition;
}

/**
 * Les événements que le core émet lui-même (identité, board, évaluation). Un
 * type n'y entre qu'avec le lot qui lui ajoute son premier abonné.
 */
export const CORE_EVENTS: readonly EventDeclaration[] = [];

export interface PlatformDefinitions {
  flows: readonly FlowDefinition[];
  extensions?: readonly ExtensionDefinition[];
  kits?: readonly KitDefinition[];
  modules?: readonly ModuleDefinition[];
  qualifications?: readonly QualificationDeclaration[];
}

/** Une déclaration, avec qui l'a faite (`flow:ml`, `extension:slack-signals`…). */
export type Owned<T> = T & { owner: string };

interface PlatformState {
  flows: Map<string, FlowDefinition>;
  extensions: Map<string, ExtensionDefinition>;
  kits: Map<string, KitDefinition>;
  modules: Map<string, ModuleDefinition>;
  qualifications: Map<string, QualificationDeclaration>;
  ruleKeys: Map<string, Owned<RuleKeyDeclaration>>;
  contributionTypes: Map<string, Owned<ContributionTypeDeclaration>>;
  jobs: Map<string, Owned<JobDeclaration>>;
  /** Par type d'événement. */
  events: Map<string, Owned<EventDeclaration>>;
  subscriptions: Map<string, Owned<EventSubscriptionDeclaration>>;
  quests: Map<string, Owned<QuestDeclaration>>;
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

/** Un type d'événement n'a qu'un émetteur déclaré. */
function claimEvents(
  target: Map<string, Owned<EventDeclaration>>,
  owner: string,
  declarations: readonly EventDeclaration[] | undefined
): void {
  for (const declaration of declarations ?? []) {
    const existing = target.get(declaration.type);
    if (existing) {
      throw new Error(
        `[PlatformRegistry] Event "${declaration.type}" is declared by both ${existing.owner} and ${owner}`
      );
    }
    target.set(declaration.type, { ...declaration, owner });
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

/**
 * Deux actions d'un même propriétaire ne peuvent pas répondre au même appel :
 * `targets/:id` et `targets/:targetId` sont le même chemin.
 */
function checkActions(owner: string, actions: readonly ChallengeActionDeclaration[] | undefined): void {
  const seen = new Set<string>();
  for (const action of actions ?? []) {
    if (!action.path || action.path.startsWith("/") || action.path.endsWith("/")) {
      throw new Error(`[PlatformRegistry] Action path "${action.path}" of ${owner} must not start or end with "/"`);
    }
    const signature = `${action.method} ${action.path.replace(/:[^/]+/g, ":")}`;
    if (seen.has(signature)) {
      throw new Error(`[PlatformRegistry] Action "${action.method} ${action.path}" is declared twice by ${owner}`);
    }
    seen.add(signature);
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
      qualifications: new Map(),
      ruleKeys: new Map(),
      contributionTypes: new Map(),
      jobs: new Map(),
      events: new Map(CORE_EVENTS.map((event) => [event.type, { ...event, owner: "core" }])),
      subscriptions: new Map(),
      quests: new Map(),
      evaluationHandlers: new Map(),
    };

    const owners: Array<{ key: string; owner: string; declarations: Declarations }> = [];

    for (const flow of definitions.flows) {
      addUnique(state.flows, "Flow", flow.descriptor.key, flow);
      checkConfigVersions(flow);
      checkActions(`flow:${flow.descriptor.key}`, flow.actions);
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
      checkActions(`extension:${extension.key}`, extension.actions);
      owners.push({ key: extension.key, owner: `extension:${extension.key}`, declarations: extension });
    }
    for (const module of definitions.modules ?? []) {
      addUnique(state.modules, "Module", module.key, module);
      owners.push({ key: module.key, owner: `module:${module.key}`, declarations: module });
    }
    for (const qualification of definitions.qualifications ?? []) {
      addUnique(state.qualifications, "Qualification", qualification.key, qualification);
    }

    for (const { key, owner, declarations } of owners) {
      claim(state.ruleKeys, "Rule key", owner, declarations.ruleKeys);
      claim(state.contributionTypes, "Contribution type", owner, declarations.contributionTypes);
      claim(state.jobs, "Job", owner, declarations.jobs);
      claimEvents(state.events, owner, declarations.events);
      claim(state.subscriptions, "Subscription", owner, declarations.subscriptions);
      claim(state.quests, "Quest", owner, declarations.quests);
      claimEvaluationHandlers(state.evaluationHandlers, key, owner, declarations.evaluationHandlers);
    }

    // Chaque quête devient un abonné du module qui enregistre les quêtes :
    // désactiver ce module arrête toutes les quêtes.
    const recorders = (definitions.modules ?? []).filter((module) => module.questRecorder);
    if (recorders.length > 1) {
      throw new Error(
        `[PlatformRegistry] Quests are recorded by both module:${recorders[0].key} and module:${recorders[1].key}`
      );
    }
    for (const quest of state.quests.values()) {
      if (!state.events.has(quest.event)) {
        throw new Error(
          `[PlatformRegistry] Quest "${quest.key}" of ${quest.owner} completes on "${quest.event}", which nothing declares`
        );
      }
      const recorder = recorders[0];
      if (!recorder?.questRecorder) continue;
      const record = recorder.questRecorder.record;
      claim(state.subscriptions, "Subscription", `module:${recorder.key}`, [
        {
          key: `quests.${quest.key}`,
          event: quest.event,
          async handle(event) {
            const userId = quest.userOf(event);
            if (userId) await record(userId, quest.key, event.occurredAt);
          },
        },
      ]);
    }

    // Un abonné n'écoute qu'un événement que quelqu'un émet.
    for (const subscription of state.subscriptions.values()) {
      if (!state.events.has(subscription.event)) {
        throw new Error(
          `[PlatformRegistry] Subscription "${subscription.key}" of ${subscription.owner} listens to "${subscription.event}", which nothing declares`
        );
      }
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

  static qualification(key: string | null | undefined): QualificationDeclaration | undefined {
    return key ? current().qualifications.get(key) : undefined;
  }

  static qualifications(): QualificationDeclaration[] {
    return [...current().qualifications.values()];
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

  /** Les jobs planifiés de la distribution, avec leur propriétaire. */
  static jobs(): Owned<JobDeclaration>[] {
    return [...current().jobs.values()];
  }

  /** Les modules installés, dans l'ordre de la distribution. */
  static modules(): ModuleDefinition[] {
    return [...current().modules.values()];
  }

  /** La déclaration d'un type d'événement, avec son émetteur. */
  static event(type: string): Owned<EventDeclaration> | undefined {
    return current().events.get(type);
  }

  static events(): Owned<EventDeclaration>[] {
    return [...current().events.values()];
  }

  /** Les abonnés de l'outbox, avec leur propriétaire. */
  static subscriptions(): Owned<EventSubscriptionDeclaration>[] {
    return [...current().subscriptions.values()];
  }

  /** Les quêtes déclarées, dans leur ordre d'affichage. */
  static quests(): Owned<QuestDeclaration>[] {
    return [...current().quests.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /** Le handler d'évaluation `handlerKey` du propriétaire `ownerKey` (flow, extension, kit ou module). */
  static evaluationHandler(ownerKey: string, handlerKey: string): Owned<EvaluationHandlerDeclaration> | undefined {
    const entry = current().evaluationHandlers.get(ownerKey);
    const handler = entry?.handlers.get(handlerKey);
    return entry && handler ? { ...handler, owner: entry.owner } : undefined;
  }
}
