import { PlatformRegistry, type FlowDefinition } from "../registry/platform.js";

/**
 * Capacité `flow-config`
 * ----------------------
 * La configuration d'un challenge vit dans `challenges.flow_config` (jsonb),
 * écrite sous `flow_config_version`. Le flow en déclare le schéma, la version
 * courante et les montées de version ; chaque extension attachée range la
 * sienne sous `flow_config.extensions[clé]`.
 *
 * - À la lecture, une config ancienne est montée en mémoire jusqu'à la version
 *   courante, sans écriture ; `db:upgrade-flow-configs` enregistre les montées
 *   au déploiement.
 * - À l'écriture, la config est validée et toujours enregistrée dans la
 *   version courante.
 * - Une config plus récente que le flow installé (retour arrière du code) ne
 *   se lit pas : aucune descente de version n'est tentée.
 */

/** Ce qu'il faut d'un challenge pour lire sa configuration. */
export interface FlowConfigSource {
  type?: string | null;
  flow_config?: unknown;
  flow_config_version?: number | null;
}

export type FlowConfig = Record<string, unknown> & {
  extensions?: Record<string, Record<string, unknown>>;
};

export type FlowConfigReading =
  | { state: "current"; config: FlowConfig; version: number; storedVersion: number }
  | { state: "unknown_flow"; flowKey: string }
  | { state: "newer"; storedVersion: number; version: number }
  | { state: "invalid"; error: string };

/** Une configuration refusée à l'écriture : flow inconnu, valeur invalide, clé non éditable. */
export class FlowConfigError extends Error {}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function currentVersion(flow: FlowDefinition): number {
  return flow.config?.version ?? 1;
}

/** Monte une configuration de `fromVersion` à la version courante du flow. */
function upgrade(flow: FlowDefinition, raw: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let config = raw;
  for (let version = fromVersion; version < currentVersion(flow); version++) {
    const step = flow.config?.upgrades?.[version];
    if (!step) throw new Error(`no upgrade from version ${version}`);
    config = step(config);
  }
  return config;
}

/**
 * Valide une configuration de la version courante : le schéma du flow sur ses
 * propres clés, celui de chaque extension attachée sur sa section. La section
 * d'une extension qui n'est plus installée est gardée telle quelle — la
 * retirer de la distribution ne doit rien effacer.
 */
function validate(flow: FlowDefinition, raw: Record<string, unknown>): FlowConfig {
  const { extensions: rawExtensions, ...given } = raw;
  // Les défauts de la distribution comblent les clés absentes, jamais une
  // valeur posée, même `null` : une clé laissée vide exprès le reste.
  const present = Object.fromEntries(Object.entries(given).filter(([, value]) => value !== undefined));
  const own = { ...(flow.configDefaults ?? {}), ...present };
  const config: FlowConfig = flow.config ? { ...flow.config.schema.parse(own) } : { ...own };

  const sections = asRecord(rawExtensions);
  const extensions: Record<string, Record<string, unknown>> = {};
  for (const [key, section] of Object.entries(sections)) {
    if (!PlatformRegistry.extension(key)) extensions[key] = asRecord(section);
  }
  for (const extension of PlatformRegistry.extensionsFor(flow.descriptor.key)) {
    if (!extension.config) continue;
    extensions[extension.key] = { ...extension.config.schema.parse(asRecord(sections[extension.key])) };
  }

  if (Object.keys(extensions).length > 0) config.extensions = extensions;
  return config;
}

/** La configuration d'un challenge, montée à la version courante de son flow. */
export function readFlowConfig(challenge: FlowConfigSource): FlowConfigReading {
  const flowKey = challenge.type ?? "";
  const flow = PlatformRegistry.flow(flowKey);
  if (!flow) return { state: "unknown_flow", flowKey };

  const version = currentVersion(flow);
  const storedVersion = challenge.flow_config_version ?? 1;
  if (storedVersion > version) return { state: "newer", storedVersion, version };

  try {
    const config = validate(flow, upgrade(flow, asRecord(challenge.flow_config), storedVersion));
    return { state: "current", config, version, storedVersion };
  } catch (error) {
    return { state: "invalid", error: messageOf(error) };
  }
}

/** La configuration lisible d'un challenge, ou `null` (flow absent, config plus récente ou invalide). */
export function flowConfigOf(challenge: FlowConfigSource): FlowConfig | null {
  const reading = readFlowConfig(challenge);
  return reading.state === "current" ? reading.config : null;
}

/** La section d'une extension dans la configuration d'un challenge, ou `null`. */
export function extensionConfigOf(challenge: FlowConfigSource, extensionKey: string): Record<string, unknown> | null {
  return flowConfigOf(challenge)?.extensions?.[extensionKey] ?? null;
}

export interface StoredFlowConfig {
  flow_config: FlowConfig;
  flow_config_version: number;
}

/** Valide la configuration d'un challenge à créer, dans la version courante de son flow. */
export function prepareFlowConfig(flowKey: string, raw: unknown): StoredFlowConfig {
  const flow = PlatformRegistry.flow(flowKey);
  if (!flow) throw new FlowConfigError(`Unknown challenge type "${flowKey}"`);

  try {
    return { flow_config: validate(flow, asRecord(raw)), flow_config_version: currentVersion(flow) };
  } catch (error) {
    throw new FlowConfigError(`Invalid ${flowKey} configuration: ${messageOf(error)}`);
  }
}

/**
 * Modifie la section d'une extension sur un challenge existant.
 *
 * `null` quand l'extension ne s'attache pas au flow du challenge : il n'y a
 * rien à modifier. Seules les clés que l'extension déclare éditables passent.
 */
export function patchExtensionConfig(
  challenge: FlowConfigSource,
  extensionKey: string,
  patch: Record<string, unknown>,
): StoredFlowConfig | null {
  const flowKey = challenge.type ?? "";
  const extension = PlatformRegistry.flow(flowKey)
    ? PlatformRegistry.extensionsFor(flowKey).find((candidate) => candidate.key === extensionKey)
    : undefined;
  if (!extension?.config) return null;

  const editable = new Set(extension.config.editableKeys ?? []);
  const locked = Object.keys(patch).filter((key) => !editable.has(key));
  if (locked.length > 0) {
    throw new FlowConfigError(`${extensionKey}: ${locked.join(", ")} cannot be changed after creation`);
  }

  const reading = readFlowConfig(challenge);
  if (reading.state !== "current") {
    throw new FlowConfigError(`The configuration of this challenge cannot be changed (${reading.state})`);
  }

  const section = { ...(reading.config.extensions?.[extensionKey] ?? {}), ...patch };
  return prepareFlowConfig(flowKey, {
    ...reading.config,
    extensions: { ...reading.config.extensions, [extensionKey]: section },
  });
}

export type FlowConfigUpgradePlan =
  | { state: "up_to_date" }
  | { state: "upgraded"; from: number; stored: StoredFlowConfig }
  | { state: "skipped"; reason: string };

/** Ce que `db:upgrade-flow-configs` doit écrire pour un challenge. */
export function planFlowConfigUpgrade(challenge: FlowConfigSource): FlowConfigUpgradePlan {
  const reading = readFlowConfig(challenge);
  switch (reading.state) {
    case "current":
      return reading.storedVersion === reading.version
        ? { state: "up_to_date" }
        : {
            state: "upgraded",
            from: reading.storedVersion,
            stored: { flow_config: reading.config, flow_config_version: reading.version },
          };
    case "unknown_flow":
      return { state: "skipped", reason: `flow "${reading.flowKey}" is not installed` };
    case "newer":
      return { state: "skipped", reason: `stored version ${reading.storedVersion} is newer than ${reading.version}` };
    case "invalid":
      return { state: "skipped", reason: reading.error };
  }
}

export type FlowRulesParse = { ok: true; rules: unknown } | { ok: false };

/**
 * Lit des règles de récompense avec le parseur du flow. `null` en entrée
 * efface les règles ; un flow sans règles n'en accepte aucune.
 */
export function parseFlowRules(flowKey: string, raw: unknown): FlowRulesParse {
  if (raw == null) return { ok: true, rules: null };
  const parse = PlatformRegistry.flow(flowKey)?.rules?.parse;
  const rules = parse ? parse(raw) : null;
  return rules == null ? { ok: false } : { ok: true, rules };
}
