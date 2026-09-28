import type { ActionAccess, ChallengeActionDeclaration } from "../../../../packages/registry/platform.js";

/** Un participant du challenge. */
const ANNOTATORS: ActionAccess = { member: true };
/** L'admin ou le manager du projet. */
const CAMPAIGN_MANAGERS: ActionAccess = { roles: ["admin"], manager: true };

// Import à la demande : déclarer le flow ne charge ni la capacité ni les repositories.
const work = () => import("./work.js");
const campaign = () => import("./campaign.js");

export const dataAnnotationActions: readonly ChallengeActionDeclaration[] = [
  { path: "draw", method: "POST", access: ANNOTATORS, handle: async (ctx) => (await work()).draw(ctx) },
  { path: "claims/:claimId/label", method: "POST", access: ANNOTATORS, handle: async (ctx) => (await work()).label(ctx) },
  { path: "claims/:claimId/release", method: "POST", access: ANNOTATORS, handle: async (ctx) => (await work()).release(ctx) },
  { path: "progress", method: "GET", access: ANNOTATORS, handle: async (ctx) => (await work()).progress(ctx) },

  { path: "batches", method: "POST", access: CAMPAIGN_MANAGERS, handle: async (ctx) => (await campaign()).importBatch(ctx) },
  { path: "overview", method: "GET", access: CAMPAIGN_MANAGERS, handle: async (ctx) => (await campaign()).overview(ctx) },
  {
    path: "items/:resourceId/resolve",
    method: "POST",
    access: CAMPAIGN_MANAGERS,
    handle: async (ctx) => (await campaign()).resolveItem(ctx),
  },
  { path: "export", method: "GET", access: CAMPAIGN_MANAGERS, handle: async (ctx) => (await campaign()).exportLabels(ctx) },
];
