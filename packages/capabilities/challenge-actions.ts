import {
  ChallengeRepository,
  ChallengeTeamRepository,
  ProjectRepository,
} from "../database-service/repositories/index.js";
import type { Challenge } from "../database-service/domain/entities.js";
import {
  PlatformRegistry,
  type ActionAccess,
  type ActionAccessReader,
  type ActionCaller,
  type ChallengeActionDeclaration,
} from "../registry/platform.js";
import { hasQualification } from "./qualifications.js";

/**
 * Capacité `challenge-actions` — le dispatcher des actions de flow
 * ----------------------------------------------------------------
 * Une seule route sert toutes les actions d'un challenge :
 * `/api/challenges/[id]/flow/<chemin>` pour son flow,
 * `/api/challenges/[id]/ext/<clé>/<chemin>` pour une extension qui s'y attache.
 *
 * Le dispatcher résout le challenge, son flow et l'action, applique l'accès
 * que l'action déclare, puis appelle son handler. Le shell ne fournit que
 * l'appelant, relu en base.
 */

export type ActionScope = { kind: "flow" } | { kind: "extension"; key: string };

export interface ActionDispatchDeps {
  findChallenge(id: string): Promise<Challenge | null>;
  isManager(userId: string, challenge: Challenge): Promise<boolean>;
  isMember(userId: string, challengeId: string): Promise<boolean>;
  holds(userId: string, qualification: string): Promise<boolean>;
}

export interface ActionDispatchInput {
  request: Request;
  challengeId: string;
  scope: ActionScope;
  /** Le chemin de l'action, déjà découpé par la route. */
  segments: readonly string[];
  user: ActionCaller | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let defaultDeps: ActionDispatchDeps | null = null;

function databaseDeps(): ActionDispatchDeps {
  if (defaultDeps) return defaultDeps;
  const challengeRepo = new ChallengeRepository();
  const projectRepo = new ProjectRepository();
  const challengeTeamRepo = new ChallengeTeamRepository();
  defaultDeps = {
    // Un identifiant qui n'est pas un uuid ferait échouer la requête : il ne désigne aucun challenge.
    findChallenge: async (id) => (UUID_PATTERN.test(id) ? challengeRepo.findById(id) : null),
    isManager: async (userId, challenge) => (await projectRepo.findById(challenge.project_id))?.manager_id === userId,
    isMember: async (userId, challengeId) => !!(await challengeTeamRepo.findByChallengeAndUser(challengeId, userId)),
    holds: (userId, qualification) => hasQualification(userId, qualification),
  };
  return defaultDeps;
}

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** Les paramètres d'un chemin d'action, ou `null` s'il ne correspond pas. */
export function matchActionPath(pattern: string, segments: readonly string[]): Record<string, string> | null {
  const parts = pattern.split("/");
  if (parts.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) params[parts[i].slice(1)] = segments[i];
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

function accessReader(challenge: Challenge, user: ActionCaller, deps: ActionDispatchDeps): ActionAccessReader {
  const memo = new Map<string, Promise<boolean>>();
  const once = (key: string, read: () => Promise<boolean>) => {
    if (!memo.has(key)) memo.set(key, read());
    return memo.get(key)!;
  };
  return {
    isAdmin: () => user.role === "admin",
    isManager: () => once("manager", () => deps.isManager(user.id, challenge)),
    isMember: () => once("member", () => deps.isMember(user.id, challenge.uuid)),
    holds: (qualification) =>
      qualification ? once(`qualification:${qualification}`, () => deps.holds(user.id, qualification)) : Promise.resolve(false),
  };
}

async function isAllowed(access: ActionAccess, challenge: Challenge, user: ActionCaller, reader: ActionAccessReader) {
  const conditions = [access.roles, access.manager, access.member, access.qualification].filter((c) => c !== undefined);
  if (conditions.length === 0) return true;

  if (access.roles?.includes(user.role)) return true;
  if (access.manager && (await reader.isManager())) return true;
  if (access.member && (await reader.isMember())) return true;
  if (access.qualification && (await reader.holds(access.qualification(challenge)))) return true;
  return false;
}

function declarationsFor(challenge: Challenge, scope: ActionScope): readonly ChallengeActionDeclaration[] | string {
  const flow = PlatformRegistry.flow(challenge.type);
  if (!flow) return `No flow installed for challenge type "${challenge.type}"`;
  if (scope.kind === "flow") return flow.actions ?? [];

  const extension = PlatformRegistry.extensionsFor(flow.descriptor.key).find((e) => e.key === scope.key);
  if (!extension) return `Extension "${scope.key}" does not apply to this challenge`;
  return extension.actions ?? [];
}

export async function dispatchChallengeAction(
  input: ActionDispatchInput,
  deps: ActionDispatchDeps = databaseDeps(),
): Promise<Response> {
  const challenge = await deps.findChallenge(input.challengeId);
  if (!challenge) return jsonError(404, "Challenge not found");

  const declarations = declarationsFor(challenge, input.scope);
  if (typeof declarations === "string") return jsonError(404, declarations);

  const candidates = declarations
    .map((action) => ({ action, params: matchActionPath(action.path, input.segments) }))
    .filter((candidate): candidate is { action: ChallengeActionDeclaration; params: Record<string, string> } => !!candidate.params);
  if (candidates.length === 0) return jsonError(404, "Unknown action");

  const method = input.request.method.toUpperCase();
  const match = candidates.find((candidate) => candidate.action.method === method);
  if (!match) {
    const allow = [...new Set(candidates.map((candidate) => candidate.action.method))].join(", ");
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: allow } });
  }

  const user = input.user;
  if (!user) return jsonError(401, "Unauthorized");

  const reader = accessReader(challenge, user, deps);
  if (!(await isAllowed(match.action.access, challenge, user, reader))) return jsonError(403, "Forbidden");

  try {
    const result = await match.action.handle({
      request: input.request,
      challenge,
      user,
      params: match.params,
      access: reader,
    });
    return result instanceof Response ? result : Response.json(result ?? null);
  } catch (error) {
    const owner = input.scope.kind === "flow" ? `flow ${challenge.type}` : `extension ${input.scope.key}`;
    console.error(`[challenge-actions] ${method} ${match.action.path} (${owner}) failed:`, error);
    return jsonError(500, "Action failed");
  }
}
