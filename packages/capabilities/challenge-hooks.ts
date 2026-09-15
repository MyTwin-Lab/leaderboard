import type { Challenge } from "../database-service/domain/entities.js";
import {
  PlatformRegistry,
  type ChallengeGroupJoinContext,
  type ChallengeHookReport,
  type ChallengeHooks,
  type ChallengeJoinContext,
  type FlowUses,
  type RepoDefinition,
} from "../registry/platform.js";

/**
 * Capacité `challenge-hooks`
 * --------------------------
 * Les routes du core (création, join, clôture, suppression) ne savent pas ce
 * que fait un flow à ces moments-là : elles appellent ses hooks, puis ceux des
 * extensions qui s'attachent à lui, dans cet ordre.
 */

/** Les statuts d'un challenge clos. */
const CLOSED_STATUSES: readonly string[] = ["completed", "archived"];

export function isClosedStatus(status: string | null | undefined): boolean {
  return !!status && CLOSED_STATUSES.includes(status);
}

/** Le flow de ce type active cette capacité du core. */
export function flowUses(type: string | null | undefined, capability: keyof FlowUses): boolean {
  return PlatformRegistry.flow(type)?.uses?.[capability] === true;
}

function hooksOf(challenge: Pick<Challenge, "type">): Array<{ owner: string; hooks: ChallengeHooks }> {
  const flow = PlatformRegistry.flow(challenge.type);
  if (!flow) return [];

  const owners: Array<{ owner: string; hooks: ChallengeHooks }> = [];
  if (flow.hooks) owners.push({ owner: `flow:${flow.descriptor.key}`, hooks: flow.hooks });
  for (const extension of PlatformRegistry.extensionsFor(flow.descriptor.key)) {
    if (extension.hooks) owners.push({ owner: `extension:${extension.key}`, hooks: extension.hooks });
  }
  return owners;
}

/** Les dépôts qu'un challenge doit se voir créer, tels que son flow et ses extensions les déclarent. */
export function creationRepos(challenge: Challenge, input: Readonly<Record<string, unknown>> = {}): RepoDefinition[] {
  return hooksOf(challenge).flatMap(({ hooks }) => [...(hooks.onCreate?.({ challenge, input }).repos ?? [])]);
}

/** Les hooks de join, dont les rapports se fusionnent dans la réponse. Une erreur fait échouer le join. */
export async function runJoinHooks(ctx: ChallengeJoinContext): Promise<ChallengeHookReport> {
  const report: ChallengeHookReport = {};
  for (const { hooks } of hooksOf(ctx.challenge)) {
    if (hooks.onJoin) Object.assign(report, (await hooks.onJoin(ctx)) ?? {});
  }
  return report;
}

export async function runGroupJoinHooks(ctx: ChallengeGroupJoinContext): Promise<ChallengeHookReport> {
  const report: ChallengeHookReport = {};
  for (const { hooks } of hooksOf(ctx.challenge)) {
    if (hooks.onGroupJoin) Object.assign(report, (await hooks.onGroupJoin(ctx)) ?? {});
  }
  return report;
}

/** Au mieux : un hook qui échoue est journalisé, les suivants tournent quand même, et rien ne remonte. */
export async function runCloseHooks(challenge: Challenge): Promise<void> {
  for (const { owner, hooks } of hooksOf(challenge)) {
    if (!hooks.onClose) continue;
    try {
      await hooks.onClose(challenge);
    } catch (error) {
      console.error(`[challenge-hooks] onClose of ${owner} failed:`, error);
    }
  }
}

/** Attendus avant la suppression : une erreur l'empêche, pour ne rien laisser tourner d'orphelin. */
export async function runDeleteHooks(challenge: Challenge): Promise<void> {
  for (const { hooks } of hooksOf(challenge)) {
    if (hooks.onDelete) await hooks.onDelete(challenge);
  }
}
