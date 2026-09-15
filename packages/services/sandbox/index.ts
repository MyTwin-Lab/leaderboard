// Module Sandbox — voir docs/sandbox.md et docs/input/plan-sandbox.md.

export { SandboxService } from "./sandbox.service.js";
export {
  SandboxNotFoundError,
  SandboxForbiddenError,
  SelfStarError,
  SandboxNotOpenError,
  StarRateLimitedError,
  InvalidRewardRulesError,
} from "./sandbox.service.js";
export type {
  SandboxServiceDeps,
  SandboxCreateCommand,
  SandboxEditCommand,
  StarIdentity,
  StarState,
} from "./sandbox.service.js";

// Propositions — le lien entre un sandbox et la déclaration `proposable` de son flow.
export {
  InvalidProposalError,
  SandboxFlowUnavailableError,
  installedProposable,
  parseProposalFields,
  proposalFieldsInput,
  proposalFieldsOf,
} from "./proposal.js";

// Réglages du module sandbox : l'économie des étoiles.
export { SANDBOX_MODULE, readSandboxSettings } from "./settings.js";
export type { SandboxEconomySettings } from "./settings.js";

// Paliers — purs, réutilisés par l'UI pour la progression.
export { sortTiers, tiersToPay, nextTier, tierProgress } from "./starTiers.js";

// Politique anti-abus — `hashIp` et `pickClientIp` sont consommés par les
// helpers de route du palier 3 (`lib/server/clientIp.ts`).
export {
  STAR_RATE_LIMIT_PER_HOUR,
  IP_HASH_RETENTION_DAYS,
  FALLBACK_CLIENT_IP,
  hashIp,
  pickClientIp,
  isRateLimited,
  rateLimitWindowStart,
  ipHashRetentionCutoff,
} from "./starPolicy.js";
export type { HeaderSource } from "./starPolicy.js";

export { planAnonAttach } from "./starAttach.js";
export type { AnonAttachPlan } from "./starAttach.js";

// Évaluation formative — déclarée par le flow (`proposable.evaluation`), zéro CP.
export {
  SandboxEvaluationService,
  SANDBOX_EVALUATION_OWNER,
  SANDBOX_EVALUATION_HANDLER,
  buildEvaluationContext,
} from "./sandbox-evaluation.service.js";
export type {
  SandboxEvaluationDeps,
  SandboxEvaluationEvent,
  CannotEvaluateSandboxReason,
} from "./sandbox-evaluation.service.js";

// Promotion — le passage d'une proposition à un challenge officiel.
export { SandboxPromotionService } from "./sandbox-promotion.service.js";
export type {
  SandboxPromotionDeps,
  PromoteCommand,
  PromoteResult,
} from "./sandbox-promotion.service.js";
export {
  buildPromotedChallengeDraft,
  buildPromotedDescription,
  buildAuthorParticipation,
} from "./promotion.js";
export type {
  PromotionInput,
  PromotedChallengeDraft,
  AuthorParticipation,
} from "./promotion.js";
