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
