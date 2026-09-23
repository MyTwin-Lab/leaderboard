// Module Sandbox — voir docs/sandbox.md et docs/input/plan-sandbox.md.

export { SandboxService } from "./sandbox.service.js";
export {
  SandboxNotFoundError,
  SandboxForbiddenError,
  SelfStarError,
  SandboxNotOpenError,
  StarRateLimitedError,
} from "./sandbox.service.js";
export type { SandboxServiceDeps, StarIdentity, StarState } from "./sandbox.service.js";

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

// L'évaluation formative a été retirée avec le type et le dépôt obligatoire :
// elle notait un repo GitHub sur la grille `code`, c'est-à-dire un challenge.
// Un sandbox est un projet — ce qui le fait avancer, ce sont ses stars.

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
