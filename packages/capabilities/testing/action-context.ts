import type { Challenge } from "../../database-service/domain/entities.js";
import type { ActionCaller, ActionContext } from "../../registry/platform.js";

/**
 * Contexte d'action pour les tests de handlers
 * --------------------------------------------
 * Un handler reçoit ce que le dispatcher a déjà résolu : le challenge,
 * l'appelant et les paramètres du chemin. Ses tests n'ont ni route, ni
 * session, ni proxy à monter — le dispatcher a les siens.
 */

export interface ActionContextOptions {
  challenge?: Partial<Challenge>;
  user?: Partial<ActionCaller>;
  params?: Record<string, string>;
  method?: string;
  /** Chemin et query de la requête (`/api/challenges/c/flow/targets?eligible=true`). */
  url?: string;
  /** Sérialisé en JSON, sauf une chaîne ou un `FormData`, envoyés tels quels. */
  body?: unknown;
  /** Ce que les lectures d'autorisation répondent : non, par défaut. */
  access?: { manager?: boolean; member?: boolean; qualifications?: readonly string[] };
}

export function actionContext(options: ActionContextOptions = {}): ActionContext {
  const challenge = {
    uuid: "challenge-1",
    title: "Challenge",
    slug: "challenge",
    status: "active",
    type: "code",
    contribution_points_reward: 100,
    completion: 0,
    project_id: "project-1",
    ...options.challenge,
  } as Challenge;
  const user: ActionCaller = { id: "user-1", role: "contributor", ...options.user };

  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const init: RequestInit = { method };
  if (options.body !== undefined) {
    if (typeof options.body === "string" || options.body instanceof FormData) {
      init.body = options.body;
    } else {
      init.body = JSON.stringify(options.body);
      init.headers = { "Content-Type": "application/json" };
    }
  }
  const request = new Request(new URL(options.url ?? `/api/challenges/${challenge.uuid}/flow`, "http://localhost"), init);

  const held = new Set(options.access?.qualifications ?? []);
  return {
    request,
    challenge,
    user,
    params: options.params ?? {},
    access: {
      isAdmin: () => user.role === "admin",
      isManager: async () => options.access?.manager ?? false,
      isMember: async () => options.access?.member ?? false,
      holds: async (qualification) => !!qualification && held.has(qualification),
    },
  };
}
