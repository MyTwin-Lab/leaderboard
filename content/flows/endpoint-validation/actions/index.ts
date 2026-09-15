import type { ActionAccess, ChallengeActionDeclaration } from "../../../../packages/registry/platform.js";
import { VALIDATION_MANAGERS, reviewerQualificationOf } from "../../../kits/validation/index.js";

/** Détenir la qualification que la configuration du challenge exige des relecteurs. */
const REVIEWERS: ActionAccess = { qualification: reviewerQualificationOf };

// Import à la demande : déclarer le flow ne charge ni les services ni les repositories.
const claims = () => import("./claims.js");
const referenceCases = () => import("./reference-cases.js");
const verdicts = () => import("./verdicts.js");
const runs = () => import("./runs.js");

/** Les actions propres à la validation d'endpoints : cas de référence, réclamations, verdicts, runs. */
export const endpointValidationActions: readonly ChallengeActionDeclaration[] = [
  { path: "targets/:targetId/claim", method: "POST", access: REVIEWERS, handle: async (ctx) => (await claims()).claimCase(ctx) },
  {
    path: "targets/:targetId/claimable-cases",
    method: "GET",
    access: REVIEWERS,
    handle: async (ctx) => (await claims()).claimableCases(ctx),
  },
  {
    path: "case-claims/:claimId/observation",
    method: "POST",
    access: REVIEWERS,
    handle: async (ctx) => (await claims()).recordObservation(ctx),
  },
  {
    path: "case-claims/:claimId/reveal",
    method: "POST",
    access: REVIEWERS,
    handle: async (ctx) => (await claims()).revealExpectedOutput(ctx),
  },

  // Admin et manager voient tous les cas ; un relecteur qualifié, les siens.
  {
    path: "reference-cases",
    method: "GET",
    access: { ...VALIDATION_MANAGERS, ...REVIEWERS },
    handle: async (ctx) => (await referenceCases()).listReferenceCases(ctx),
  },
  // Pas de passe-droit admin ni manager : seul un relecteur qualifié écrit un cas.
  {
    path: "reference-cases",
    method: "POST",
    access: REVIEWERS,
    handle: async (ctx) => (await referenceCases()).authorReferenceCase(ctx),
  },
  // L'auteur ou un admin — vérifié dans le handler, qui connaît l'auteur.
  {
    path: "reference-cases/:caseId",
    method: "DELETE",
    access: {},
    handle: async (ctx) => (await referenceCases()).removeReferenceCase(ctx),
  },
  // L'auteur, un admin ou le manager — vérifié dans le handler.
  {
    path: "reference-cases/:caseId/input",
    method: "GET",
    access: {},
    handle: async (ctx) => (await referenceCases()).referenceCaseInput(ctx),
  },

  { path: "verdicts", method: "POST", access: REVIEWERS, handle: async (ctx) => (await verdicts()).castVerdict(ctx) },

  { path: "runs", method: "GET", access: VALIDATION_MANAGERS, handle: async (ctx) => (await runs()).listRuns(ctx) },
  { path: "runs/:attemptId/file", method: "GET", access: VALIDATION_MANAGERS, handle: async (ctx) => (await runs()).runFile(ctx) },
  {
    path: "runs/:attemptId/response",
    method: "GET",
    access: VALIDATION_MANAGERS,
    handle: async (ctx) => (await runs()).runResponse(ctx),
  },
];
