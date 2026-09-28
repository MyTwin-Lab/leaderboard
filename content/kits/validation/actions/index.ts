import type { ActionAccess, ChallengeActionDeclaration } from "../../../../packages/registry/platform.js";

/** Un admin, ou le manager du challenge. */
export const VALIDATION_MANAGERS: ActionAccess = { roles: ["admin"], manager: true };

// Import à la demande : déclarer les actions ne charge pas les repositories.
const targets = () => import("./targets.js");
const rewards = () => import("./rewards.js");

/**
 * Les actions communes aux flows de validation. Un flow les reprend dans ses
 * propres `actions`.
 */
export const validationKitActions: readonly ChallengeActionDeclaration[] = [
  // Tout participant lit les cibles ; `?eligible=true`, la liste des
  // soumissions exposables, est réservée aux managers dans le handler.
  { path: "targets", method: "GET", access: {}, handle: async (ctx) => (await targets()).listTargets(ctx) },
  { path: "targets", method: "POST", access: VALIDATION_MANAGERS, handle: async (ctx) => (await targets()).addTarget(ctx) },
  {
    path: "targets/:targetId",
    method: "DELETE",
    access: VALIDATION_MANAGERS,
    handle: async (ctx) => (await targets()).removeTarget(ctx),
  },
  { path: "rewards", method: "GET", access: VALIDATION_MANAGERS, handle: async (ctx) => (await rewards()).validationRewards(ctx) },
];
