# Validation Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `challenges.type = 'validation'` challenge that links 1:1 to an ML "work challenge", lets an admin expose specific `api_packaging` submissions (those with a deployed endpoint URL), and lets any contributor drop a file, have the server proxy it to that live endpoint, see the raw output rendered generically (image/JSON/text), and earn a fixed CP reward the first time they validate a given submission.

**Architecture:** Reuses the existing `challenges` / `contributions` / `reward_entries` infrastructure (mirrors how Slack discussion signals already layer a fixed, per-event CP mechanism onto a challenge) instead of building a parallel system. Two new small tables (`validation_targets`, `validation_attempts`) record what's exposed and who has already been paid for validating it. The browser never calls a contributor's deployed API directly — a server route proxies the call (with an SSRF guard, timeout, and size cap) so the CP award is based on something the server actually observed, not a client's self-report.

**Tech Stack:** Next.js 16 Route Handlers, Drizzle ORM / PostgreSQL, Zod, Vitest, Node's built-in `fetch`/`FormData`/`dns/promises`.

## Global Constraints

- v1 scope is `ml` challenges' `api_packaging` submissions only — no other submission types, no automated/scheduled validation.
- No file content or API response body is ever persisted to the database — only enough metadata (validator, target, timestamp) to dedupe CP and audit who validated what.
- CP earned by a validator once per `(validation_challenge, target_contribution, validator)` triple — repeat testing is allowed, repeat CP is not.
- `cp_per_validation` and `source_challenge_id` are set once at validation-challenge creation and are never editable afterward (same "locked" treatment as `contribution_points_reward`/`project_id` on ML challenges).
- This feature never touches AI scoring (`contributions.evaluation`, `evaluation_status` on the *source* contribution stays exactly as ML scoring already sets it).

---

### Task 1: Schema — new columns and tables

**Files:**
- Modify: `packages/database-service/db/drizzle.ts`

**Interfaces:**
- Produces: `challenges.source_challenge_id`, `challenges.cp_per_validation`, `contributions.live_endpoint_url`, `validation_targets` table, `validation_attempts` table — every later task depends on these existing.

- [ ] **Step 1: Add the two new columns**

In the `challenges` table definition, add a self-referencing FK (needs `AnyPgColumn` for the forward type reference) and a plain nullable integer:

```ts
// at the top of the file, alongside the other pg-core imports:
import { pgTable, text, varchar, timestamp, uuid, integer, json, date, serial, real, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
```

```ts
// --- CHALLENGES ---
export const challenges = pgTable("challenges", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  index: serial("index"),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 100 }).notNull(),
  type: varchar("type", { length: 50 }).default("code"), // 'code' | 'ml' | 'validation'
  start_date: date("start_date"),
  end_date: date("end_date"),
  description: text("description"),
  roadmap: text("roadmap"),
  contribution_points_reward: integer("contribution_points_reward").default(0),
  completion: real("completion").default(0),
  project_id: uuid("project_id").references(() => projects.uuid, { onDelete: "cascade" }),
  reward_rules: json("reward_rules"), // ML challenges only — see domain/mlRewardRules.ts
  // Validation challenges only: the ML challenge this one validates. 1:1,
  // enforced at the service layer (a source challenge can back at most one).
  source_challenge_id: uuid("source_challenge_id").references((): AnyPgColumn => challenges.uuid, { onDelete: "cascade" }),
  // Validation challenges only: fixed CP a validator earns per first-time
  // (validator, target) validation. Locked after creation.
  cp_per_validation: integer("cp_per_validation"),
}, (table) => ({
  projectIdIdx: index("idx_challenges_project_id").on(table.project_id),
  statusIdx: index("idx_challenges_status").on(table.status),
}));
```

In the `contributions` table definition, add:

```ts
  // Deployed API endpoint for an `api_packaging` contribution — distinct from
  // `artifact_url` (the GitHub packaging repo). Set via the ML workspace's
  // API packaging step. Only contributions with this set can be exposed on a
  // validation challenge.
  live_endpoint_url: varchar("live_endpoint_url", { length: 500 }),
```
(add this line inside the `contributions = pgTable("contributions", {...})` block, next to `artifact_url`)

- [ ] **Step 2: Add the two new tables**

Add these right after the `reward_entries` table definition (so `challenges`/`contributions` are already declared above them):

```ts
// --- VALIDATION_TARGETS ---
// What an admin exposed on a validation challenge: one row per api_packaging
// contribution selected for manual testing.
export const validation_targets = pgTable("validation_targets", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  position: integer("position").default(0),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_validation_targets_challenge_id").on(table.validation_challenge_id),
  uniqueTargetIdx: uniqueIndex("idx_validation_targets_unique").on(table.validation_challenge_id, table.contribution_id),
}));

// --- VALIDATION_ATTEMPTS ---
// One row the first time a validator successfully validates a given target.
// No file, no response body — just enough to dedupe CP and audit who tested
// what. The unique index is the actual dedupe guarantee under races.
export const validation_attempts = pgTable("validation_attempts", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  validator_user_id: uuid("validator_user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_validation_attempts_challenge_id").on(table.validation_challenge_id),
  validatorIdx: index("idx_validation_attempts_validator_id").on(table.validator_user_id),
  uniqueAttemptIdx: uniqueIndex("idx_validation_attempts_unique").on(table.validation_challenge_id, table.contribution_id, table.validator_user_id),
}));
```

- [ ] **Step 3: Push the schema to your local database**

Run: `npm run db:push`
Expected: Drizzle Kit reports the new columns/tables applied without errors. If it prompts about the self-referencing FK, accept creating it as a nullable constraint (no data migration needed — it's a new column).

- [ ] **Step 4: Commit**

```bash
git add packages/database-service/db/drizzle.ts
git commit -m "feat(db): add validation challenge schema (columns + validation_targets/validation_attempts)"
```

---

### Task 2: Domain entities and Zod schemas

**Files:**
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/domain/schemas_zod.ts`

**Interfaces:**
- Consumes: nothing new (pure type/schema additions)
- Produces: `Challenge.source_challenge_id`, `Challenge.cp_per_validation`, `Contribution.live_endpoint_url`, `RewardRuleKey` includes `'validation'`, `ValidationTarget`, `ValidationAttempt`, `validationTargetSchema`, `validationAttemptSchema` — Task 3 (mappers) and Task 4 (repositories) depend on these.

- [ ] **Step 1: Extend `Challenge` and `Contribution` in entities.ts**

```ts
export interface Challenge {
  uuid: string;
  index?: number;
  title: string;
  status: string;
  type: string; // 'code' | 'ml' | 'validation'
  start_date?: Date | null;
  end_date?: Date | null;
  description?: string;
  roadmap?: string;
  contribution_points_reward: number;
  completion: number;
  project_id: string; // FK -> projects.uuid
  reward_rules?: MlRewardRules | null; // ML uniquement
  source_challenge_id?: string | null; // Validation uniquement — le challenge ML validé
  cp_per_validation?: number | null;   // Validation uniquement — CP fixe par validation
}
```

```ts
export interface Contribution {
  uuid: string;
  title: string;
  type: string;
  description?: string;
  evaluation?: any;
  tags?: string[];
  reward: number;
  user_id: string;
  challenge_id: string;
  task_id?: string;
  artifact_url?: string;
  live_endpoint_url?: string; // api_packaging uniquement — endpoint déployé
  evaluation_status?: ContributionEvaluationStatus;
  submitted_at: Date;
}
```

- [ ] **Step 2: Add `'validation'` to `RewardRuleKey` and add the two new entities**

```ts
export type RewardRuleKey =
  | 'dataset'
  | 'model_metric'
  | 'model_code'
  | 'beat_best'
  | 'api_packaging'
  | 'reuse_dataset'
  | 'reuse_model'
  | 'slack_signal'
  | 'validation';
```

Add near the end of the "REWARD ENTRIES" section:

```ts
// --- VALIDATION CHALLENGES ---

/** Une soumission api_packaging exposée pour validation manuelle. */
export interface ValidationTarget {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (la soumission api_packaging)
  position: number;
  created_at: Date;
}

/** Trace qu'un validateur a déjà été payé pour une cible donnée. */
export interface ValidationAttempt {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (la cible validée)
  validator_user_id: string;       // FK -> users.uuid
  created_at: Date;
}
```

- [ ] **Step 3: Extend schemas_zod.ts to match**

```ts
export const challengeSchema = z.object({
  uuid: z.string().uuid(),
  index: z.number().int().optional(),
  title: z.string(),
  status: z.string(),
  type: z.string().default('code'),
  start_date: z.coerce.date().nullish(),
  end_date: z.coerce.date().nullish(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  completion: z.number().int().nonnegative().default(0),
  project_id: z.string().uuid(),
  reward_rules: mlRewardRulesSchema.nullish(),
  source_challenge_id: z.string().uuid().nullish(),
  cp_per_validation: z.number().int().nonnegative().nullish(),
});
```

```ts
export const contributionSchema = z.object({
  uuid: z.string().uuid(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  evaluation: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  reward: z.number().default(0),
  user_id: z.string().uuid(),
  challenge_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  artifact_url: z.string().max(500).optional(),
  live_endpoint_url: z.string().max(500).optional(),
  evaluation_status: z
    .enum(['pending', 'running', 'done', 'failed', 'skipped_reuse'])
    .optional(),
  submitted_at: z.coerce.date(),
});

export const rewardRuleKeySchema = z.enum([
  'dataset',
  'model_metric',
  'model_code',
  'beat_best',
  'api_packaging',
  'reuse_dataset',
  'reuse_model',
  'slack_signal',
  'validation',
]);
```

Add after `rewardEntrySchema`:

```ts
export const validationTargetSchema = z.object({
  uuid: z.string().uuid(),
  validation_challenge_id: z.string().uuid(),
  contribution_id: z.string().uuid(),
  position: z.number().int().nonnegative().default(0),
  created_at: z.coerce.date(),
});

export const validationAttemptSchema = z.object({
  uuid: z.string().uuid(),
  validation_challenge_id: z.string().uuid(),
  contribution_id: z.string().uuid(),
  validator_user_id: z.string().uuid(),
  created_at: z.coerce.date(),
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/database-service/domain/entities.ts packages/database-service/domain/schemas_zod.ts
git commit -m "feat(domain): add validation challenge entities and zod schemas"
```

---

### Task 3: Mappers

**Files:**
- Modify: `packages/database-service/db/mappers.ts`

**Interfaces:**
- Consumes: `challenges`, `contributions`, `validation_targets`, `validation_attempts` (Task 1), `Challenge`/`Contribution`/`ValidationTarget`/`ValidationAttempt` (Task 2)
- Produces: `toDomainChallenge`/`toDbChallenge`/`toDomainContribution`/`toDbContribution` updated; `toDomainValidationTarget`, `toDbValidationTarget`, `toDomainValidationAttempt`, `toDbValidationAttempt` — Task 4 (repositories) depends on these.

- [ ] **Step 1: Import the new tables**

```ts
import {
  projects,
  repos,
  challenges,
  challenge_repos,
  challenge_teams,
  users,
  contributions,
  refresh_tokens,
  tasks,
  task_assignees,
  task_workspaces,
  evaluation_runs,
  evaluation_run_contributions,
  evaluation_grids,
  evaluation_grid_categories,
  evaluation_grid_subcriteria,
  sync_meetings,
  meeting_participants,
  meeting_analyses,
  onboarding_progress,
  app_settings,
  challenge_documents,
  challenge_signals,
  challenge_slack_configs,
  reward_entries,
  validation_targets,
  validation_attempts,
} from "./drizzle.js";
```

Add `ValidationTarget, ValidationAttempt` to the type import list from `../domain/entities.js`.

- [ ] **Step 2: Extend `toDomainChallenge`, `toDbChallenge`, `toDomainContribution`, `toDbContribution`**

```ts
export function toDomainChallenge(row: DbChallenge): Challenge {
  return {
    uuid: row.uuid,
    index: row.index,
    title: row.title,
    status: row.status,
    type: row.type ?? 'code',
    start_date: row.start_date ? new Date(row.start_date) : undefined,
    end_date: row.end_date ? new Date(row.end_date) : undefined,
    description: row.description ?? "",
    roadmap: row.roadmap ?? "",
    contribution_points_reward: row.contribution_points_reward ?? 0,
    completion: row.completion ?? 0,
    project_id: row.project_id ?? "",
    reward_rules: parseMlRewardRules(row.reward_rules),
    source_challenge_id: row.source_challenge_id ?? null,
    cp_per_validation: row.cp_per_validation ?? null,
  };
}
```

```ts
export function toDbChallenge(entity: Omit<Challenge, "uuid">): typeof challenges.$inferInsert {
  return {
    title: entity.title,
    status: entity.status,
    type: entity.type ?? 'code',
    start_date: entity.start_date?.toISOString().split("T")[0] ?? null,
    end_date: entity.end_date?.toISOString().split("T")[0] ?? null,
    description: entity.description || null,
    roadmap: entity.roadmap || null,
    contribution_points_reward: entity.contribution_points_reward,
    completion: entity.completion ?? 0,
    project_id: entity.project_id || null,
    reward_rules: entity.reward_rules ?? null,
    source_challenge_id: entity.source_challenge_id ?? null,
    cp_per_validation: entity.cp_per_validation ?? null,
  };
}
```

```ts
export function toDomainContribution(row: DbContribution): Contribution {
  return {
    uuid: row.uuid,
    title: row.title,
    type: row.type,
    description: row.description ?? "",
    evaluation: row.evaluation ?? null,
    tags: (row.tags as string[]) ?? [],
    reward: row.reward ?? 0,
    user_id: row.user_id ?? "",
    challenge_id: row.challenge_id ?? "",
    task_id: row.task_id ?? undefined,
    artifact_url: row.artifact_url ?? undefined,
    live_endpoint_url: row.live_endpoint_url ?? undefined,
    evaluation_status: (row.evaluation_status as ContributionEvaluationStatus) ?? undefined,
    submitted_at: new Date(row.submitted_at),
  };
}
```

```ts
export function toDbContribution(entity: Omit<Contribution, "uuid">): typeof contributions.$inferInsert {
  return {
    title: entity.title,
    type: entity.type,
    description: entity.description || null,
    evaluation: entity.evaluation ?? null,
    tags: entity.tags && entity.tags.length > 0 ? entity.tags : null,
    reward: entity.reward,
    user_id: entity.user_id || null,
    challenge_id: entity.challenge_id || null,
    task_id: entity.task_id || null,
    artifact_url: entity.artifact_url || null,
    live_endpoint_url: entity.live_endpoint_url || null,
    evaluation_status: entity.evaluation_status ?? null,
    submitted_at: entity.submitted_at,
  };
}
```

- [ ] **Step 3: Add the validation target/attempt mappers**

Add near the `toDomainChallengeSignal`/`toDbChallengeSignal` pair:

```ts
type DbValidationTarget = InferSelectModel<typeof validation_targets>;
type DbValidationAttempt = InferSelectModel<typeof validation_attempts>;

export function toDomainValidationTarget(row: DbValidationTarget): ValidationTarget {
  return {
    uuid: row.uuid,
    validation_challenge_id: row.validation_challenge_id,
    contribution_id: row.contribution_id,
    position: row.position ?? 0,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbValidationTarget(
  entity: Omit<ValidationTarget, "uuid" | "created_at">
): typeof validation_targets.$inferInsert {
  return {
    validation_challenge_id: entity.validation_challenge_id,
    contribution_id: entity.contribution_id,
    position: entity.position ?? 0,
  };
}

export function toDomainValidationAttempt(row: DbValidationAttempt): ValidationAttempt {
  return {
    uuid: row.uuid,
    validation_challenge_id: row.validation_challenge_id,
    contribution_id: row.contribution_id,
    validator_user_id: row.validator_user_id,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbValidationAttempt(
  entity: Omit<ValidationAttempt, "uuid" | "created_at">
): typeof validation_attempts.$inferInsert {
  return {
    validation_challenge_id: entity.validation_challenge_id,
    contribution_id: entity.contribution_id,
    validator_user_id: entity.validator_user_id,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/database-service/db/mappers.ts
git commit -m "feat(db): add mappers for validation targets/attempts, extend challenge/contribution mappers"
```

---

### Task 4: Repositories

**Files:**
- Create: `packages/database-service/repositories/validationTarget.repo.ts`
- Create: `packages/database-service/repositories/validationAttempt.repo.ts`
- Modify: `packages/database-service/repositories/index.ts`
- Modify: `packages/database-service/repositories/contribution.repo.ts`

**Interfaces:**
- Consumes: mappers from Task 3, `challengeSchema`/`contributionSchema` from Task 2
- Produces: `ValidationTargetRepository` (`findByChallenge`, `findById`, `create`, `delete`), `ValidationAttemptRepository` (`exists`, `create`, `findByChallengeAndValidator`) — Task 6 (service) and Task 8 (API routes) depend on these exact method names.

- [ ] **Step 1: Create `validationTarget.repo.ts`**

```ts
import { db } from "../db/drizzle";
import { validation_targets } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainValidationTarget, toDbValidationTarget } from "../db/mappers";
import type { ValidationTarget } from "../domain/entities";
import { validationTargetSchema } from "../domain/schemas_zod";

export class ValidationTargetRepository {
  async findByChallenge(validationChallengeId: string): Promise<ValidationTarget[]> {
    const rows = await db
      .select()
      .from(validation_targets)
      .where(eq(validation_targets.validation_challenge_id, validationChallengeId))
      .orderBy(validation_targets.position, validation_targets.created_at);
    return rows.map(toDomainValidationTarget);
  }

  async findById(uuid: string): Promise<ValidationTarget | null> {
    const [row] = await db.select().from(validation_targets).where(eq(validation_targets.uuid, uuid));
    return row ? toDomainValidationTarget(row) : null;
  }

  async findByChallengeAndContribution(
    validationChallengeId: string,
    contributionId: string
  ): Promise<ValidationTarget | null> {
    const [row] = await db
      .select()
      .from(validation_targets)
      .where(
        and(
          eq(validation_targets.validation_challenge_id, validationChallengeId),
          eq(validation_targets.contribution_id, contributionId)
        )
      );
    return row ? toDomainValidationTarget(row) : null;
  }

  async create(entity: Omit<ValidationTarget, "uuid" | "created_at">): Promise<ValidationTarget> {
    const validated = validationTargetSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(validation_targets)
      .values(toDbValidationTarget(validated))
      .returning();
    return toDomainValidationTarget(row);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(validation_targets).where(eq(validation_targets.uuid, uuid));
  }
}
```

- [ ] **Step 2: Create `validationAttempt.repo.ts`**

```ts
import { db } from "../db/drizzle";
import { validation_attempts } from "../db/drizzle";
import { eq, and } from "drizzle-orm";
import { toDomainValidationAttempt, toDbValidationAttempt } from "../db/mappers";
import type { ValidationAttempt } from "../domain/entities";
import { validationAttemptSchema } from "../domain/schemas_zod";

/** Unique-violation code Postgres raises on a duplicate (challenge, contribution, validator) triple. */
const POSTGRES_UNIQUE_VIOLATION = "23505";

export class ValidationAttemptRepository {
  async exists(
    validationChallengeId: string,
    contributionId: string,
    validatorUserId: string
  ): Promise<boolean> {
    const [row] = await db
      .select({ uuid: validation_attempts.uuid })
      .from(validation_attempts)
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          eq(validation_attempts.contribution_id, contributionId),
          eq(validation_attempts.validator_user_id, validatorUserId)
        )
      );
    return !!row;
  }

  async findByChallengeAndValidator(
    validationChallengeId: string,
    validatorUserId: string
  ): Promise<ValidationAttempt[]> {
    const rows = await db
      .select()
      .from(validation_attempts)
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          eq(validation_attempts.validator_user_id, validatorUserId)
        )
      );
    return rows.map(toDomainValidationAttempt);
  }

  /**
   * Returns null instead of throwing on a duplicate — the unique index is the
   * real dedupe guarantee under concurrent requests; a race here means someone
   * else's request already recorded (and paid for) this exact attempt.
   */
  async create(entity: Omit<ValidationAttempt, "uuid" | "created_at">): Promise<ValidationAttempt | null> {
    const validated = validationAttemptSchema.omit({ uuid: true, created_at: true }).parse(entity);
    try {
      const [row] = await db
        .insert(validation_attempts)
        .values(toDbValidationAttempt(validated))
        .returning();
      return toDomainValidationAttempt(row);
    } catch (error: any) {
      if (error?.code === POSTGRES_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }
}
```

- [ ] **Step 3: Export both from `repositories/index.ts`**

```ts
export { ValidationTargetRepository } from "./validationTarget.repo.js";
export { ValidationAttemptRepository } from "./validationAttempt.repo.js";
```

- [ ] **Step 4: Add `live_endpoint_url` handling to `ContributionRepository.update()`**

In `contribution.repo.ts`, inside `update()`:

```ts
  async update(uuid: string, entity: Partial<Omit<Contribution, "uuid">>): Promise<Contribution> {
    const validated = contributionSchema.omit({ uuid: true }).partial().parse(entity);
    const dbData: any = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.type) dbData.type = validated.type;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.evaluation !== undefined) dbData.evaluation = validated.evaluation;
    if (validated.tags !== undefined) dbData.tags = validated.tags.length > 0 ? validated.tags : null;
    if (validated.reward !== undefined) dbData.reward = validated.reward;
    if (validated.user_id) dbData.user_id = validated.user_id;
    if (validated.challenge_id) dbData.challenge_id = validated.challenge_id;
    if (validated.artifact_url !== undefined) dbData.artifact_url = validated.artifact_url || null;
    if (validated.live_endpoint_url !== undefined) dbData.live_endpoint_url = validated.live_endpoint_url || null;
    if (validated.evaluation_status !== undefined) dbData.evaluation_status = validated.evaluation_status;

    const [updated] = await db.update(contributions)
      .set(dbData)
      .where(eq(contributions.uuid, uuid))
      .returning();
    return toDomainContribution(updated);
  }
```

(only the new `live_endpoint_url` line is added — everything else is unchanged)

- [ ] **Step 5: Write a repository smoke test**

Create `packages/database-service/repositories/validationAttempt.repo.test.ts`... — **skip**: this repo has no existing precedent for DB-backed repository tests (all repo classes talk to a real Postgres connection with no test harness in this codebase — coverage instead comes from the service-level fake-DB integration test in Task 6, following the `mlRewards.integration.test.ts` precedent). Confirm this by checking there is no `*.repo.test.ts` file anywhere in the repo:

Run: `find packages/database-service/repositories -name "*.test.ts"`
Expected: no output (confirms the convention — repositories are exercised indirectly through service-level tests, not unit-tested directly)

- [ ] **Step 6: Commit**

```bash
git add packages/database-service/repositories/validationTarget.repo.ts packages/database-service/repositories/validationAttempt.repo.ts packages/database-service/repositories/index.ts packages/database-service/repositories/contribution.repo.ts
git commit -m "feat(db): add ValidationTarget/ValidationAttempt repositories"
```

---

### Task 5: SSRF guard utility

**Files:**
- Create: `packages/services/challenge/ssrf-guard.ts`
- Test: `packages/services/challenge/ssrf-guard.test.ts`

**Interfaces:**
- Produces: `assertPublicHttpUrl(rawUrl: string): Promise<URL>`, `UnsafeEndpointError` — Task 6 (ValidationChallengeService) depends on both.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/services/challenge/ssrf-guard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

import { lookup } from "node:dns/promises";
import { assertPublicHttpUrl, UnsafeEndpointError } from "./ssrf-guard.js";

const mockLookup = vi.mocked(lookup);

describe("assertPublicHttpUrl", () => {
  beforeEach(() => mockLookup.mockReset());

  it("rejects a non-http(s) scheme", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com/x")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects an unparseable URL", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects localhost by hostname", async () => {
    await expect(assertPublicHttpUrl("http://localhost:3000/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects a hostname resolving to a private IPv4 address", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as any);
    await expect(assertPublicHttpUrl("https://internal.example.com/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects the cloud metadata address", async () => {
    mockLookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }] as any);
    await expect(assertPublicHttpUrl("https://metadata.example.com/")).rejects.toThrow(UnsafeEndpointError);
  });

  it("rejects an IPv6 loopback literal directly in the URL", async () => {
    await expect(assertPublicHttpUrl("http://[::1]:8080/predict")).rejects.toThrow(UnsafeEndpointError);
  });

  it("accepts a hostname resolving only to public addresses", async () => {
    mockLookup.mockResolvedValue([{ address: "203.0.113.10", family: 4 }] as any);
    const url = await assertPublicHttpUrl("https://model.example.com/predict");
    expect(url.hostname).toBe("model.example.com");
  });

  it("rejects when any resolved address (of several) is private", async () => {
    mockLookup.mockResolvedValue([
      { address: "203.0.113.10", family: 4 },
      { address: "192.168.1.1", family: 4 },
    ] as any);
    await expect(assertPublicHttpUrl("https://model.example.com/predict")).rejects.toThrow(UnsafeEndpointError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && npx vitest run challenge/ssrf-guard.test.ts`
Expected: FAIL — `Cannot find module './ssrf-guard.js'`

- [ ] **Step 3: Implement the guard**

```ts
// packages/services/challenge/ssrf-guard.ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UnsafeEndpointError extends Error {}

/** [network base, prefix length] — ranges that must never be reachable from a proxied validation call. */
const PRIVATE_V4_RANGES: [string, number][] = [
  ["0.0.0.0", 8],       // "this" network
  ["10.0.0.0", 8],      // RFC1918
  ["100.64.0.0", 10],   // carrier-grade NAT
  ["127.0.0.0", 8],     // loopback
  ["169.254.0.0", 16],  // link-local (incl. cloud metadata: 169.254.169.254)
  ["172.16.0.0", 12],   // RFC1918
  ["192.0.0.0", 24],    // IETF protocol assignments
  ["192.168.0.0", 16],  // RFC1918
  ["198.18.0.0", 15],   // benchmarking
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return PRIVATE_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||         // loopback
    normalized.startsWith("fc") ||  // unique local
    normalized.startsWith("fd") ||  // unique local
    normalized.startsWith("fe80")   // link-local
  );
}

/**
 * Blocks proxying a validation request to a private, loopback, link-local, or
 * non-http(s) target. Resolves the hostname once up front — a DNS-rebinding
 * attacker who changes the record between this check and the actual `fetch`
 * call in ValidationChallengeService could still slip through; that gap is a
 * known v1 limitation, not something this guard tries to close.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeEndpointError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeEndpointError(`Unsupported scheme: ${url.protocol}`);
  }
  if (url.hostname === "localhost") {
    throw new UnsafeEndpointError("Endpoint resolves to a local address");
  }

  const literalVersion = isIP(url.hostname.replace(/^\[|\]$/g, ""));
  const addresses = literalVersion
    ? [{ address: url.hostname.replace(/^\[|\]$/g, ""), family: literalVersion }]
    : (await lookup(url.hostname, { all: true })) as { address: string; family: number }[];

  if (addresses.length === 0) {
    throw new UnsafeEndpointError(`Could not resolve ${url.hostname}`);
  }

  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (isPrivate) {
      throw new UnsafeEndpointError(`Endpoint resolves to a non-public address: ${address}`);
    }
  }

  return url;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/services && npx vitest run challenge/ssrf-guard.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/services/challenge/ssrf-guard.ts packages/services/challenge/ssrf-guard.test.ts
git commit -m "feat(services): add SSRF guard for validation-challenge endpoint calls"
```

---

### Task 6: ValidationChallengeService

**Files:**
- Create: `packages/services/challenge/validation-challenge.service.ts`
- Test: `packages/services/challenge/validation-challenge.service.test.ts`

**Interfaces:**
- Consumes: `ValidationTargetRepository`, `ValidationAttemptRepository`, `ContributionRepository`, `ChallengeRepository`, `RewardEntryRepository` (Task 4); `assertPublicHttpUrl`, `UnsafeEndpointError` (Task 5)
- Produces: `ValidationChallengeService` with `validate(input): Promise<ValidationResult>`, `ValidationTargetError`, `EndpointCallError` — Task 9 (the `/validate` route) depends on these exact exports and the `ValidationResult` shape.

- [ ] **Step 1: Write the failing integration test**

This mirrors the fake-DB style of `apps/leaderboard-client/src/test/mlRewards.integration.test.ts` — exercising the full flow (target lookup, endpoint call, dedupe, ledger write, pool clamp) against in-memory fakes rather than mocking each repository method individually.

```ts
// packages/services/challenge/validation-challenge.service.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  ValidationChallengeService,
  ValidationTargetError,
  EndpointCallError,
} from "./validation-challenge.service.js";
import type { ValidationRunDeps } from "./validation-challenge.service.js";
import type {
  Challenge,
  Contribution,
  ValidationTarget,
  ValidationAttempt,
  RewardEntry,
} from "../../database-service/domain/entities.js";

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    uuid: "vch-1",
    title: "Validate the sentiment API",
    status: "active",
    type: "validation",
    contribution_points_reward: 100,
    completion: 0,
    project_id: "proj-1",
    source_challenge_id: "ml-ch-1",
    cp_per_validation: 5,
    ...over,
  };
}

function makeContribution(over: Partial<Contribution> = {}): Contribution {
  return {
    uuid: "contrib-1",
    title: "API Packaging Submission",
    type: "api_packaging",
    reward: 0,
    user_id: "alice",
    challenge_id: "ml-ch-1",
    live_endpoint_url: "https://alice-model.example.com/predict",
    submitted_at: new Date(),
    ...over,
  };
}

const file = { buffer: Buffer.from("fake-bytes"), filename: "cat.png", mimeType: "image/png" };

function makeDeps(over: Partial<ValidationRunDeps> = {}): ValidationRunDeps {
  const challenge = makeChallenge();
  const contribution = makeContribution();
  const target: ValidationTarget = {
    uuid: "target-1",
    validation_challenge_id: "vch-1",
    contribution_id: "contrib-1",
    position: 0,
    created_at: new Date(),
  };
  const attempts: ValidationAttempt[] = [];
  const entries: RewardEntry[] = [];
  const validatorContributions: Contribution[] = [];

  return {
    challengeRepo: { findById: vi.fn(async (id: string) => (id === challenge.uuid ? challenge : null)) },
    targetRepo: { findByChallenge: vi.fn(async () => [target]) },
    attemptRepo: {
      exists: vi.fn(async (_c, _t, validatorId) => attempts.some(a => a.validator_user_id === validatorId)),
      create: vi.fn(async (entity) => {
        const row: ValidationAttempt = { uuid: `att-${attempts.length + 1}`, created_at: new Date(), ...entity };
        attempts.push(row);
        return row;
      }),
    },
    contributionRepo: {
      findById: vi.fn(async (id: string) => (id === contribution.uuid ? contribution : null)),
      findByChallenge: vi.fn(async () => validatorContributions),
      create: vi.fn(async (entity) => {
        const row: Contribution = { uuid: `vc-${validatorContributions.length + 1}`, ...entity } as Contribution;
        validatorContributions.push(row);
        return row;
      }),
      update: vi.fn(async () => contribution),
    },
    rewardRepo: {
      sumByChallenge: vi.fn(async () => entries.reduce((s, e) => s + e.points, 0)),
      create: vi.fn(async (entity) => {
        const row: RewardEntry = { uuid: `re-${entries.length + 1}`, created_at: new Date(), ...entity } as RewardEntry;
        entries.push(row);
        return row;
      }),
    },
    callEndpoint: vi.fn(async () => ({ status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') })),
    ...over,
  } as ValidationRunDeps;
}

describe("ValidationChallengeService.validate", () => {
  it("awards cp_per_validation on a first-time successful call", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({
      validationChallengeId: "vch-1",
      contributionId: "contrib-1",
      validatorUserId: "bob",
      file,
    });

    expect(result.status).toBe(200);
    expect(result.cpAwarded).toBe(5);
    expect(result.alreadyValidated).toBe(false);
    expect(deps.rewardRepo.create).toHaveBeenCalledTimes(1);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
  });

  it("awards nothing the second time the same validator tests the same target", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);
    await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    const second = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(second.cpAwarded).toBe(0);
    expect(second.alreadyValidated).toBe(true);
    expect(deps.rewardRepo.create).toHaveBeenCalledTimes(1); // still just the first call
  });

  it("awards nothing when the proxied call fails (non-2xx)", async () => {
    const deps = makeDeps({
      callEndpoint: vi.fn(async () => ({ status: 500, contentType: "text/plain", body: Buffer.from("boom") })),
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(result.status).toBe(500);
    expect(result.cpAwarded).toBe(0);
    expect(deps.rewardRepo.create).not.toHaveBeenCalled();
  });

  it("clamps the award to whatever remains in the pool", async () => {
    const deps = makeDeps({
      challengeRepo: { findById: vi.fn(async () => makeChallenge({ contribution_points_reward: 3, cp_per_validation: 5 })) },
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file });

    expect(result.cpAwarded).toBe(3);
  });

  it("throws ValidationTargetError when the contribution isn't an exposed target", async () => {
    const deps = makeDeps({ targetRepo: { findByChallenge: vi.fn(async () => []) } });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("throws ValidationTargetError when the target contribution has no live endpoint", async () => {
    const deps = makeDeps({
      contributionRepo: {
        findById: vi.fn(async () => makeContribution({ live_endpoint_url: undefined })),
        findByChallenge: vi.fn(async () => []),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("wraps a failing endpoint call in EndpointCallError", async () => {
    const deps = makeDeps({ callEndpoint: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", file })
    ).rejects.toThrow(EndpointCallError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && npx vitest run challenge/validation-challenge.service.test.ts`
Expected: FAIL — `Cannot find module './validation-challenge.service.js'`

- [ ] **Step 3: Implement the service**

```ts
// packages/services/challenge/validation-challenge.service.ts
import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
} from "../../database-service/repositories/index.js";
import type { Challenge, Contribution } from "../../database-service/domain/entities.js";
import { assertPublicHttpUrl } from "./ssrf-guard.js";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** The submission isn't exposed on this validation challenge, or has no endpoint — a 4xx-shaped problem. */
export class ValidationTargetError extends Error {}
/** The proxied call itself failed (SSRF-blocked, unreachable, timed out, too large) — a 5xx-shaped problem. */
export class EndpointCallError extends Error {}

export interface ValidationFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface ValidationResult {
  status: number;
  contentType: string;
  body: Buffer;
  cpAwarded: number;
  alreadyValidated: boolean;
}

export interface EndpointCallResponse {
  status: number;
  contentType: string;
  body: Buffer;
}

export interface ValidationRunDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  targetRepo: Pick<ValidationTargetRepository, "findByChallenge">;
  attemptRepo: {
    exists: (validationChallengeId: string, contributionId: string, validatorUserId: string) => Promise<boolean>;
    create: (entity: { validation_challenge_id: string; contribution_id: string; validator_user_id: string }) => Promise<unknown>;
  };
  contributionRepo: Pick<ContributionRepository, "findById" | "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "sumByChallenge" | "create">;
  callEndpoint: (url: string, file: ValidationFile) => Promise<EndpointCallResponse>;
}

/**
 * ValidationChallengeService
 * ---------------------------
 * Proxies a "drop a file, see the API's output" validation call and — on a
 * first-time successful call from a given validator against a given target —
 * awards `cp_per_validation` from the validation challenge's own pool.
 *
 * The browser never calls the target endpoint directly (CORS + trust — see
 * the design doc); this service is the one thing that observes the response,
 * so it's the one thing allowed to decide whether CP is earned.
 */
export class ValidationChallengeService {
  private deps: ValidationRunDeps;

  constructor(deps?: Partial<ValidationRunDeps>) {
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      targetRepo: new ValidationTargetRepository(),
      attemptRepo: new ValidationAttemptRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      callEndpoint: (url, file) => this.callEndpointDefault(url, file),
      ...deps,
    };
  }

  async validate(input: {
    validationChallengeId: string;
    contributionId: string;
    validatorUserId: string;
    file: ValidationFile;
  }): Promise<ValidationResult> {
    const { validationChallengeId, contributionId, validatorUserId, file } = input;

    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ValidationTargetError("Not a validation challenge");
    }

    const targets = await this.deps.targetRepo.findByChallenge(validationChallengeId);
    if (!targets.some(t => t.contribution_id === contributionId)) {
      throw new ValidationTargetError("Submission is not exposed on this validation challenge");
    }

    const contribution = await this.deps.contributionRepo.findById(contributionId);
    if (!contribution?.live_endpoint_url) {
      throw new ValidationTargetError("Submission has no deployed endpoint");
    }

    let response: EndpointCallResponse;
    try {
      await assertPublicHttpUrl(contribution.live_endpoint_url);
      response = await this.deps.callEndpoint(contribution.live_endpoint_url, file);
    } catch (error) {
      throw new EndpointCallError(error instanceof Error ? error.message : String(error));
    }

    const alreadyValidatedBefore = await this.deps.attemptRepo.exists(validationChallengeId, contributionId, validatorUserId);
    let cpAwarded = 0;
    // Set only when `attemptRepo.create` loses a unique-violation race (two
    // concurrent requests from the same validator) — the other request's
    // attempt is now the one of record, so this one reports "already
    // validated" too instead of silently claiming a fresh attempt.
    let raceLost = false;

    if (response.status >= 200 && response.status < 300 && !alreadyValidatedBefore) {
      const remaining = await this.remainingPool(challenge);
      const grant = Math.min(challenge.cp_per_validation ?? 0, remaining);
      if (grant > 0) {
        const attempt = await this.deps.attemptRepo.create({
          validation_challenge_id: validationChallengeId,
          contribution_id: contributionId,
          validator_user_id: validatorUserId,
        });
        if (attempt) {
          const validatorContribution = await this.findOrCreateValidatorContribution(challenge, validatorUserId);
          await this.deps.rewardRepo.create({
            challenge_id: validationChallengeId,
            user_id: validatorUserId,
            contribution_id: validatorContribution.uuid,
            rule_key: "validation",
            points: grant,
            meta: { targetContributionId: contributionId },
          });
          cpAwarded = grant;
        } else {
          raceLost = true;
        }
      }
    }

    return {
      status: response.status,
      contentType: response.contentType,
      body: response.body,
      cpAwarded,
      alreadyValidated: alreadyValidatedBefore || raceLost,
    };
  }

  private async remainingPool(challenge: Challenge): Promise<number> {
    const distributed = await this.deps.rewardRepo.sumByChallenge(challenge.uuid);
    return Math.max(0, challenge.contribution_points_reward - distributed);
  }

  private async findOrCreateValidatorContribution(challenge: Challenge, userId: string): Promise<Contribution> {
    const all = await this.deps.contributionRepo.findByChallenge(challenge.uuid);
    const existing = all.find(c => c.type === "validation" && c.user_id === userId);
    if (existing) return existing;
    return this.deps.contributionRepo.create({
      title: "Validations performed",
      type: "validation",
      description: `Validations on ${challenge.title}`,
      reward: 0,
      user_id: userId,
      challenge_id: challenge.uuid,
      submitted_at: new Date(),
      evaluation_status: "done",
    });
  }

  private async callEndpointDefault(url: string, file: ValidationFile): Promise<EndpointCallResponse> {
    const form = new FormData();
    form.append("file", new Blob([file.buffer], { type: file.mimeType }), file.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: "POST", body: form, signal: controller.signal });
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_RESPONSE_BYTES) {
        throw new Error(`Response exceeded ${MAX_RESPONSE_BYTES} bytes`);
      }
      return { status: res.status, contentType, body: Buffer.from(arrayBuffer) };
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/services && npx vitest run challenge/validation-challenge.service.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/services/challenge/validation-challenge.service.ts packages/services/challenge/validation-challenge.service.test.ts
git commit -m "feat(services): add ValidationChallengeService (proxy call, dedupe, pool-clamped CP award)"
```

---

### Task 7: ML workspace — deployed endpoint field

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/ml-workspace/route.ts`
- Modify: `apps/leaderboard-client/src/components/challenges/MLChallengeFlow.tsx`

**Interfaces:**
- Consumes: `ContributionRepository.update` (now accepts `live_endpoint_url`, Task 4), `ChallengeRepoRepository.updateWorkspace`
- Produces: `contributions.live_endpoint_url` gets populated for `api_packaging` contributions — Task 8 (validation-targets picker) depends on this being queryable.

- [ ] **Step 1: Extend the PATCH handler to accept an independent `live_endpoint_url` field**

Replace the body-parsing and validation block:

```ts
    const { id: challengeId } = await params;
    const body = await request.json();
    const { repo_id, workspace_url, live_endpoint_url } = body;

    if (!repo_id || typeof repo_id !== 'string') {
      return NextResponse.json({ error: 'repo_id is required' }, { status: 400 });
    }
    const hasWorkspaceUrl = Object.prototype.hasOwnProperty.call(body, 'workspace_url');
    const hasEndpointUrl = Object.prototype.hasOwnProperty.call(body, 'live_endpoint_url');
    if (!hasWorkspaceUrl && !hasEndpointUrl) {
      return NextResponse.json({ error: 'workspace_url or live_endpoint_url is required' }, { status: 400 });
    }
    if (hasWorkspaceUrl && workspace_url !== null && (typeof workspace_url !== 'string' || !workspace_url.trim())) {
      return NextResponse.json({ error: 'workspace_url must be a non-empty string or null' }, { status: 400 });
    }
    if (hasEndpointUrl && live_endpoint_url !== null && (typeof live_endpoint_url !== 'string' || !live_endpoint_url.trim())) {
      return NextResponse.json({ error: 'live_endpoint_url must be a non-empty string or null' }, { status: 400 });
    }

    const existing = await challengeRepoRepo.findByChallengeAndRepo(challengeId, repo_id);
    if (!existing) {
      return NextResponse.json({ error: 'Repo not found for this challenge' }, { status: 404 });
    }

    let current = existing;
```

Then, replace `const updated = await challengeRepoRepo.updateWorkspace(...)` (the block that currently always runs) so it only runs `if (hasWorkspaceUrl)`, assigning into `current` instead of `updated`:

```ts
    if (hasWorkspaceUrl) {
      const existingMeta = (current.workspace_meta as Record<string, unknown>) ?? {};
      const existingUserUrls = (existingMeta.userUrls as Record<string, string>) ?? {};

      const updatedUserUrls = { ...existingUserUrls };
      if (workspace_url === null) {
        delete updatedUserUrls[session.userId];
      } else {
        updatedUserUrls[session.userId] = workspace_url.trim();
      }

      const updatedMeta = { ...existingMeta, userUrls: updatedUserUrls };
      current = (await challengeRepoRepo.updateWorkspace(challengeId, repo_id, { workspace_meta: updatedMeta })) ?? current;
    }
```

Then add a new block right after it, only for the `api` role, that stores the endpoint in `workspace_meta.userEndpoints` (mirroring `userUrls`) and patches the existing `api_packaging` contribution if one already exists (it must — the contributor submits the GitHub repo URL first, which is what creates the contribution):

```ts
    if (hasEndpointUrl && existing.role === 'api') {
      const existingMeta = (current.workspace_meta as Record<string, unknown>) ?? {};
      const existingEndpoints = (existingMeta.userEndpoints as Record<string, string>) ?? {};

      const updatedEndpoints = { ...existingEndpoints };
      if (live_endpoint_url === null) {
        delete updatedEndpoints[session.userId];
      } else {
        updatedEndpoints[session.userId] = live_endpoint_url.trim();
      }

      const updatedMeta = { ...existingMeta, userEndpoints: updatedEndpoints };
      current = (await challengeRepoRepo.updateWorkspace(challengeId, repo_id, { workspace_meta: updatedMeta })) ?? current;

      const challengeContribs = await contributionRepo.findByChallenge(challengeId);
      const contribution = challengeContribs.find(
        c => c.user_id === session.userId && c.type === 'api_packaging'
      );
      if (contribution) {
        await contributionRepo.update(contribution.uuid, {
          live_endpoint_url: live_endpoint_url === null ? '' : live_endpoint_url.trim(),
        });
      }
    }
```

Finally, update the existing ML-reward-scheduling block (the one calling `MlRewardsService`) so it stays scoped to `hasWorkspaceUrl` (the GitHub repo submission — endpoint changes never re-trigger AI scoring), and the final response line uses `current`:

```ts
    // Points are awarded live, but the agent call takes tens of seconds —
    // far past this request's budget. Progress is tracked on the
    // contribution's evaluation_status instead.
    if (hasWorkspaceUrl && workspace_url !== null && existing.role) {
      // ...unchanged body of this block, exactly as it was before this task...
    }

    return NextResponse.json({ repo: current });
```

- [ ] **Step 2: Add the endpoint field to the API step UI**

In `MLChallengeFlow.tsx`, `RepoSubmission` currently renders one URL field per repo. Add a second, independent field shown only when `repo.role === 'api'`. Extend the component:

```tsx
function RepoSubmission({
  repo,
  challengeId,
  currentUserId,
  showCommunityPicker = false,
  onSaved,
}: {
  repo: MLRepo;
  challengeId: string;
  currentUserId: string | null;
  showCommunityPicker?: boolean;
  onSaved: () => void;
}) {
  const myUrl = getUserUrl(repo, currentUserId);
  const myEndpoint = repo.role === 'api' && currentUserId
    ? (repo.workspace_meta as { userEndpoints?: Record<string, string> })?.userEndpoints?.[currentUserId]
    : undefined;
  const community = getCommunityUrls(repo, currentUserId);
  const meta = repo.role ? ROLE_META[repo.role] : null;

  const [urlInput, setUrlInput] = useState(myUrl ?? '');
  const [endpointInput, setEndpointInput] = useState(myEndpoint ?? '');
  const [saving, setSaving] = useState(false);
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [error, setError] = useState('');
  const [showCommunity, setShowCommunity] = useState(false);

  useEffect(() => { setUrlInput(myUrl ?? ''); }, [myUrl]);
  useEffect(() => { setEndpointInput(myEndpoint ?? ''); }, [myEndpoint]);

  // ...existing handleSubmit / handleSelectCommunity unchanged...

  const handleSubmitEndpoint = async () => {
    const url = endpointInput.trim();
    if (!url) return;
    setSavingEndpoint(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/ml-workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repo.repo_id, live_endpoint_url: url }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to save endpoint');
      }
    } catch {
      setError('Network error');
    } finally {
      setSavingEndpoint(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* ...existing meta header, url input, submitted-url confirmation, community picker... */}

      {/* Deployed endpoint — API packaging step only, requires the GitHub repo already submitted */}
      {repo.role === 'api' && myUrl && (
        <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-xs font-medium text-white/70">Deployed API endpoint (optional)</p>
          <p className="text-xs text-white/35">
            If you've deployed your packaged API somewhere reachable, share the URL here so it can be
            tested from a validation challenge.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={endpointInput}
              onChange={e => setEndpointInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmitEndpoint()}
              placeholder="https://your-model.example.com/predict"
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
            />
            <button
              onClick={handleSubmitEndpoint}
              disabled={savingEndpoint || !endpointInput.trim() || endpointInput.trim() === myEndpoint}
              className="shrink-0 rounded-xl bg-brandCP/15 px-4 py-2.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingEndpoint ? <Loader2 className="h-4 w-4 animate-spin" /> : myEndpoint ? 'Update' : 'Save'}
            </button>
          </div>
          {myEndpoint && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
              <span className="text-xs text-green-400 truncate max-w-xs">{myEndpoint}</span>
            </div>
          )}
        </div>
      )}

      {error && ( /* ...unchanged... */ )}
    </div>
  );
}
```

Also widen the `MLRepo['workspace_meta']` type at the top of the file:

```ts
interface MLRepo {
  repo_id: string;
  repo_type: 'kaggle_dataset' | 'kaggle_model' | 'github' | string;
  repo_external_id?: string;
  role: MLRepoRole | null;
  workspace_meta: { userUrls?: Record<string, string>; userEndpoints?: Record<string, string>; [key: string]: unknown };
}
```

- [ ] **Step 3: Manual verification**

Run: `cd apps/leaderboard-client && npm run dev`
Then in the browser: open an ML challenge you've submitted an API packaging GitHub repo for, confirm a new "Deployed API endpoint" box appears under that step, save a URL, refresh, confirm it persists (green checkmark + URL shown).
Expected: the endpoint saves and reloads correctly; nothing about the existing GitHub-repo submission flow or ML scoring changes.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/[id]/ml-workspace/route.ts apps/leaderboard-client/src/components/challenges/MLChallengeFlow.tsx
git commit -m "feat(ml-workspace): let contributors attach a deployed API endpoint to their packaging submission"
```

---

### Task 8: Challenge creation — support `type: 'validation'`

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/route.ts`

**Interfaces:**
- Consumes: `challengeSchema` (Task 2), `ChallengeRepository.create` (Task 3/4)
- Produces: `POST /api/challenges` accepts `type: 'validation'` with `source_challenge_id` + `cp_per_validation` — Task 10 (admin UI) depends on this contract.

- [ ] **Step 1: Extend the request schema**

```ts
const createChallengeSchema = z.object({
  title: z.string().min(1),
  status: z.string(),
  type: z.string().default('code'),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative(),
  project_id: z.string().uuid(),
  github_repo: z.string().optional(),
  reward_rules: mlRewardRulesSchema.nullish(),
  source_challenge_id: z.string().uuid().optional(),
  cp_per_validation: z.number().int().positive().optional(),
});
```

- [ ] **Step 2: Validate the validation-specific requirements and enforce 1:1**

Insert right after `const validated = createChallengeSchema.parse(body);`, before the admin/manager authorization check stays where it is:

```ts
    if (validated.type === 'validation') {
      if (!validated.source_challenge_id) {
        return NextResponse.json({ error: 'source_challenge_id is required for validation challenges' }, { status: 400 });
      }
      if (!validated.cp_per_validation) {
        return NextResponse.json({ error: 'cp_per_validation is required for validation challenges' }, { status: 400 });
      }
      const source = await challengeRepo.findById(validated.source_challenge_id);
      if (!source || source.type !== 'ml') {
        return NextResponse.json({ error: 'source_challenge_id must reference an ML challenge' }, { status: 400 });
      }
      const allChallenges = await challengeRepo.findAll();
      const alreadyLinked = allChallenges.some(
        c => c.type === 'validation' && c.source_challenge_id === validated.source_challenge_id
      );
      if (alreadyLinked) {
        return NextResponse.json({ error: 'This ML challenge already has a validation challenge' }, { status: 409 });
      }
    }
```

- [ ] **Step 3: Fix repo auto-creation so it doesn't fire for `validation` type, and pass the new fields to `create`**

```ts
    const challenge = await challengeRepo.create({
      ...validated,
      start_date: validated.start_date ? new Date(validated.start_date) : null,
      end_date: validated.end_date ? new Date(validated.end_date) : null,
      completion: 0,
      source_challenge_id: validated.type === 'validation' ? validated.source_challenge_id : null,
      cp_per_validation: validated.type === 'validation' ? validated.cp_per_validation : null,
    });
```

```ts
    // Auto-create repos based on challenge type and link them. Validation
    // challenges never own repos of their own — they reference an existing ML
    // challenge's submissions instead.
    const repoDefinitions: {
      title: string;
      type: string;
      role?: ChallengeRepoRole;
      external_repo_id?: string;
    }[] =
      validated.type === 'ml'
        ? [
            { title: `${validated.title} — Dataset`,    type: 'kaggle_dataset', role: 'dataset'    },
            { title: `${validated.title} — Model`,      type: 'kaggle_model',   role: 'model'      },
            { title: `${validated.title} — Model Code`, type: 'github',         role: 'model_code' },
            { title: `${validated.title} — API`,        type: 'github',         role: 'api'        },
          ]
        : validated.type === 'validation'
          ? []
          : [{ title: `${validated.title} — Code`, type: 'github', external_repo_id: githubSlug }];
```

- [ ] **Step 4: Manual verification**

Run: `cd apps/leaderboard-client && npm run dev`
Using `curl` or the browser devtools console against a running dev server (after logging in as admin), POST to `/api/challenges` with `type: 'validation'`, a valid `source_challenge_id` pointing at an existing `ml` challenge, and `cp_per_validation: 5`.
Expected: 201 with the created challenge; a second POST with the same `source_challenge_id` returns 409; a POST with `source_challenge_id` pointing at a `code` challenge returns 400.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/route.ts
git commit -m "feat(api): support creating validation challenges linked to an ML challenge"
```

---

### Task 9: Validation targets CRUD API

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/[targetId]/route.ts`

**Interfaces:**
- Consumes: `ChallengeRepository`, `ContributionRepository`, `ValidationTargetRepository`, `ValidationAttemptRepository`, `RewardEntryRepository` (Task 4), `getSessionUser`/`isManagerOfChallenge` (existing `@/lib/auth`, `@/lib/server/managerAuth`)
- Produces: `GET /api/challenges/[id]/validation-targets` (public; `?eligible=true` admin/manager-only), `POST .../validation-targets` (admin/manager), `DELETE .../validation-targets/[targetId]` (admin/manager) — Task 11 (admin UI) and Task 12 (contributor UI) depend on these response shapes.

- [ ] **Step 1: `GET`/`POST` handler**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const targetRepo = new ValidationTargetRepository();
const attemptRepo = new ValidationAttemptRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

async function authorize(challengeId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const isAdmin = user.role === 'admin';
  const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
  if (!isAdmin && !isManager) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

// GET /api/challenges/[id]/validation-targets
// Public: the exposed targets + pool state (+ "already validated by me" if logged in).
// ?eligible=true (admin/manager only): api_packaging contributions from the source
// challenge that have a live endpoint and aren't already a target.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    if (req.nextUrl.searchParams.get('eligible') === 'true') {
      const auth = await authorize(challengeId);
      if ('error' in auth) return auth.error;

      const sourceContribs = challenge.source_challenge_id
        ? await contributionRepo.findByChallenge(challenge.source_challenge_id)
        : [];
      const existingTargets = await targetRepo.findByChallenge(challengeId);
      const targetedContributionIds = new Set(existingTargets.map(t => t.contribution_id));

      const eligible = sourceContribs.filter(
        c => c.type === 'api_packaging' && c.live_endpoint_url && !targetedContributionIds.has(c.uuid)
      );
      const users = await userRepo.findByIds([...new Set(eligible.map(c => c.user_id))]);
      const usersById = new Map(users.map(u => [u.uuid, u]));

      return NextResponse.json({
        eligible: eligible.map(c => ({
          contributionId: c.uuid,
          userId: c.user_id,
          userName: usersById.get(c.user_id)?.full_name ?? 'Unknown',
          liveEndpointUrl: c.live_endpoint_url,
        })),
      });
    }

    const [targets, entries] = await Promise.all([
      targetRepo.findByChallenge(challengeId),
      rewardRepo.sumByChallenge(challengeId),
    ]);

    const contributions = await Promise.all(targets.map(t => contributionRepo.findById(t.contribution_id)));
    const submitterIds = [...new Set(contributions.filter((c): c is NonNullable<typeof c> => !!c).map(c => c.user_id))];
    const submitters = await userRepo.findByIds(submitterIds);
    const submittersById = new Map(submitters.map(u => [u.uuid, u]));

    const session = await getSessionUser();
    const myAttempts = session
      ? await attemptRepo.findByChallengeAndValidator(challengeId, session.id)
      : [];
    const validatedContributionIds = new Set(myAttempts.map(a => a.contribution_id));

    const pool = challenge.contribution_points_reward;
    const distributed = entries;

    return NextResponse.json({
      currentUserId: session?.id ?? null,
      pool: { pool, distributed, remaining: Math.max(0, pool - distributed), cpPerValidation: challenge.cp_per_validation ?? 0 },
      targets: targets.map((t, i) => {
        const c = contributions[i];
        const submitter = c ? submittersById.get(c.user_id) : undefined;
        return {
          id: t.uuid,
          contributionId: t.contribution_id,
          submitterUserId: c?.user_id ?? null,
          submitterName: submitter?.full_name ?? 'Unknown',
          submitterAvatarUrl: submitter?.avatar_url ?? null,
          alreadyValidatedByMe: validatedContributionIds.has(t.contribution_id),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching validation targets:', error);
    return NextResponse.json({ error: 'Failed to fetch validation targets' }, { status: 500 });
  }
}

const addTargetSchema = z.object({ contribution_id: z.string().uuid() });

// POST /api/challenges/[id]/validation-targets — admin/manager only
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const auth = await authorize(challengeId);
    if ('error' in auth) return auth.error;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const body = await req.json();
    const { contribution_id } = addTargetSchema.parse(body);

    const contribution = await contributionRepo.findById(contribution_id);
    if (
      !contribution ||
      contribution.challenge_id !== challenge.source_challenge_id ||
      contribution.type !== 'api_packaging' ||
      !contribution.live_endpoint_url
    ) {
      return NextResponse.json({ error: 'Contribution is not an eligible api_packaging submission' }, { status: 400 });
    }

    const existing = await targetRepo.findByChallengeAndContribution(challengeId, contribution_id);
    if (existing) {
      return NextResponse.json({ error: 'Already exposed on this validation challenge' }, { status: 409 });
    }

    const target = await targetRepo.create({ validation_challenge_id: challengeId, contribution_id, position: 0 });
    return NextResponse.json(target, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 400 });
    }
    console.error('Error adding validation target:', err);
    return NextResponse.json({ error: 'Failed to add validation target' }, { status: 500 });
  }
}
```

- [ ] **Step 2: `DELETE` handler**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/[targetId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ValidationTargetRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const targetRepo = new ValidationTargetRepository();

// DELETE /api/challenges/[id]/validation-targets/[targetId] — admin/manager only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; targetId: string }> }
) {
  try {
    const { id: challengeId, targetId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const existing = await targetRepo.findById(targetId);
    if (!existing || existing.validation_challenge_id !== challengeId) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 });
    }

    await targetRepo.delete(targetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing validation target:', error);
    return NextResponse.json({ error: 'Failed to remove validation target' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manual verification**

Run: `cd apps/leaderboard-client && npm run dev`
Create a validation challenge (Task 8) linked to an ML challenge that has at least one `api_packaging` submission with a deployed endpoint (Task 7). As admin, `GET /api/challenges/:id/validation-targets?eligible=true` should list it; `POST` with its `contribution_id` should add it; the base `GET` should then list it as a target; `DELETE` should remove it.
Expected: all four calls behave as described; a non-admin/non-manager `POST`/`DELETE` gets 403.

- [ ] **Step 4: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets"
git commit -m "feat(api): add validation-targets CRUD (list eligible, add, remove)"
```

---

### Task 10: Validate proxy API route

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validate/route.ts`

**Interfaces:**
- Consumes: `ValidationChallengeService`, `ValidationTargetError`, `EndpointCallError` (Task 6), `getSessionUser`
- Produces: `POST /api/challenges/[id]/validate` — Task 12 (contributor UI) depends on this exact request/response contract.

- [ ] **Step 1: Implement the route**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  ValidationChallengeService,
  ValidationTargetError,
  EndpointCallError,
} from '../../../../../../../../packages/services/challenge/validation-challenge.service';
import { getSessionUser } from '@/lib/auth';

const service = new ValidationChallengeService();

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// POST /api/challenges/[id]/validate — any logged-in contributor
// multipart/form-data body: contribution_id (string), file (File)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;

    const form = await req.formData();
    const contributionId = form.get('contribution_id');
    const file = form.get('file');

    if (typeof contributionId !== 'string' || !contributionId) {
      return NextResponse.json({ error: 'contribution_id is required' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await service.validate({
      validationChallengeId: challengeId,
      contributionId,
      validatorUserId: user.id,
      file: { buffer, filename: file.name, mimeType: file.type || 'application/octet-stream' },
    });

    return new NextResponse(result.body, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'X-Validation-Status': String(result.status),
        'X-Validation-Cp-Awarded': String(result.cpAwarded),
        'X-Validation-Already-Validated': String(result.alreadyValidated),
      },
    });
  } catch (error) {
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EndpointCallError) {
      return NextResponse.json({ error: `The API didn't respond correctly: ${error.message}` }, { status: 502 });
    }
    console.error('Error running validation:', error);
    return NextResponse.json({ error: 'Failed to run validation' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual verification**

Run: `cd apps/leaderboard-client && npm run dev`
With a validation target configured against a small local test server (e.g. a throwaway Express/Flask app on `http://127.0.0.1:xxxx` — note this should be rejected by the SSRF guard, so use a real public tunnel or a deployed test endpoint that echoes uploaded files as JSON), POST a file via `curl -F "contribution_id=<id>" -F "file=@test.png"` with the session cookie attached.
Expected: first call returns the proxied body with `X-Validation-Cp-Awarded` equal to the challenge's `cp_per_validation`; a second call from the same session returns the proxied body again but with `X-Validation-Cp-Awarded: 0` and `X-Validation-Already-Validated: true`; a call against a `contribution_id` not in the challenge's targets returns 400; a call whose endpoint resolves privately returns 502.

- [ ] **Step 3: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validate"
git commit -m "feat(api): add validate proxy route (SSRF-guarded, dedupe-aware CP award)"
```

---

### Task 11: Admin UI — validation challenge creation and targets editor

**Files:**
- Create: `apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/ChallengeForm.tsx`

**Interfaces:**
- Consumes: `GET/POST/DELETE /api/challenges/[id]/validation-targets*` (Task 9), `POST /api/challenges` with `type: 'validation'` (Task 8)
- Produces: an admin can create a validation challenge and manage its exposed targets from both existing challenge-editing surfaces.

- [ ] **Step 1: Write the targets editor component**

Mirrors `ChallengeSlackSignalsEditor.tsx`'s "independent CRUD, edit-only" pattern:

```tsx
// apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Loader2, ShieldCheck } from 'lucide-react';

interface EligibleSubmission {
  contributionId: string;
  userId: string;
  userName: string;
  liveEndpointUrl: string;
}

interface TargetItem {
  id: string;
  contributionId: string;
  submitterName: string;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

export function ValidationTargetsEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [eligible, setEligible] = useState<EligibleSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchAll();
  }, [open]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [targetsRes, eligibleRes] = await Promise.all([
        fetch(`/api/challenges/${challengeId}/validation-targets`),
        fetch(`/api/challenges/${challengeId}/validation-targets?eligible=true`),
      ]);
      if (targetsRes.ok) {
        const d = await targetsRes.json();
        setTargets((d.targets ?? []).map((t: any) => ({ id: t.id, contributionId: t.contributionId, submitterName: t.submitterName })));
      }
      if (eligibleRes.ok) {
        const d = await eligibleRes.json();
        setEligible(d.eligible ?? []);
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async (contributionId: string) => {
    setAddingId(contributionId);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contribution_id: contributionId }),
      });
      if (res.ok) await fetchAll();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to add'); }
    } catch { setError('Network error'); }
    finally { setAddingId(null); }
  };

  const handleRemove = async (targetId: string) => {
    setDeletingId(targetId);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets/${targetId}`, { method: 'DELETE' });
      if (res.ok) await fetchAll();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to remove'); }
    } catch { setError('Network error'); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <ShieldCheck className="h-3.5 w-3.5" />
        Exposed submissions
        {targets.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
            {targets.length}
          </span>
        )}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {targets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
              No submission exposed yet. Add one below.
            </p>
          ) : (
            <div className="space-y-1.5">
              {targets.map(t => (
                <div key={t.id} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm" style={{ color: fgAt(0.75) }}>{t.submitterName}</span>
                  <button
                    onClick={() => handleRemove(t.id)}
                    disabled={deletingId === t.id}
                    className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                    aria-label="Remove submission"
                  >
                    {deletingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {eligible.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>
                Eligible (has a deployed endpoint, not yet exposed)
              </p>
              {eligible.map(e => (
                <button
                  key={e.contributionId}
                  onClick={() => handleAdd(e.contributionId)}
                  disabled={addingId === e.contributionId}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left transition-all hover:border-brandCP/20 hover:bg-brandCP/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1 truncate text-xs text-white/60">{e.userName}</span>
                  {addingId === e.contributionId ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brandCP/50" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0 text-brandCP/60" />
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `type: 'validation'` into `CreateChallengeDrawer.tsx`**

Add a third type option (creation-only, since like `ml` the type is locked on edit) and its conditional fields — `source_challenge_id` picker (populated from ML challenges) and `cp_per_validation`:

```tsx
import { ShieldCheck } from 'lucide-react'; // add to the existing lucide-react import
import { ValidationTargetsEditor } from '@/components/admin/ValidationTargetsEditor';
```

```tsx
  const [type, setType] = useState<'code' | 'ml' | 'validation'>('code');
  // ...
  const [sourceChallengeId, setSourceChallengeId] = useState('');
  const [cpPerValidation, setCpPerValidation] = useState(5);
  const [mlChallenges, setMlChallenges] = useState<{ id: string; title: string }[]>([]);
```

Fetch the list of ML challenges to populate the source picker (only needed when creating a `validation` challenge):

```tsx
  useEffect(() => {
    if (!open || isEdit) return;
    fetch('/api/challenges')
      .then(r => r.ok ? r.json() : [])
      .then((all: any[]) => setMlChallenges(
        all.filter(c => c.type === 'ml').map(c => ({ id: c.uuid, title: c.title }))
      ))
      .catch(() => {});
  }, [open, isEdit]);
```

Extend the type picker buttons array:

```tsx
              {([
                { value: 'code',       label: 'Code',       icon: Code2,        desc: 'Tasks, Kanban, GitHub' },
                { value: 'ml',         label: 'ML',         icon: BrainCircuit, desc: 'Dataset, Model, API' },
                { value: 'validation', label: 'Validation', icon: ShieldCheck,  desc: 'Test a submitted API live' },
              ] as const).map(opt => {
```

Add the conditional fields (near the existing `{type === 'ml' && <MlRewardRulesEditor .../>}` block):

```tsx
          {type === 'validation' && !isEdit && (
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Source ML challenge">
              <SelectDropdown
                options={mlChallenges.map(c => ({ value: c.id, label: c.title }))}
                value={sourceChallengeId}
                onChange={setSourceChallengeId}
              />
              <p className="text-[11px] mt-1.5" style={{ color: fgAt(0.25) }}>
                Only ML challenges without a validation challenge yet will actually save — the API rejects duplicates.
              </p>
            </Field>
          )}

          {type === 'validation' && (
            <Field icon={<Trophy className="h-3.5 w-3.5" />} label="CP per validation">
              {isEdit ? (
                <LockedValue text={`${cpPerValidation} CP`} />
              ) : (
                <input
                  type="number"
                  min={1}
                  value={cpPerValidation}
                  onChange={e => setCpPerValidation(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm focus:border-brandCP/40 focus:outline-none focus:shadow-[0_0_0_1px_rgba(10,247,193,0.15)]"
                  style={{ color: 'var(--foreground)' }}
                />
              )}
            </Field>
          )}

          {type === 'validation' && isEdit && (
            <ValidationTargetsEditor challengeId={challenge!.uuid} open={open} />
          )}
```

Update `handleSubmit`'s payload to include the new fields on creation:

```tsx
      const res = await fetch(
        isEdit ? `/api/challenges/${challenge!.uuid}` : '/api/challenges',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isEdit
              ? shared
              : {
                  ...shared,
                  project_id: projectId,
                  contribution_points_reward: cp,
                  github_repo: type === 'code' && githubRepo.trim() ? githubRepo.trim() : undefined,
                  source_challenge_id: type === 'validation' ? sourceChallengeId : undefined,
                  cp_per_validation: type === 'validation' ? cpPerValidation : undefined,
                }
          ),
        }
      );
```

And guard submission: extend the pre-flight validation at the top of `handleSubmit`:

```tsx
    if (!title.trim() || !projectId) {
      setError('Title and project are required.');
      return;
    }
    if (type === 'validation' && !isEdit && !sourceChallengeId) {
      setError('Pick the ML challenge this validation challenge tests.');
      return;
    }
```

Also extend the edit-mode `useEffect` that fills the form from an existing challenge, and `EditableChallenge`, to carry `cp_per_validation` for display in the locked field — add `cp_per_validation?: number | null;` to the `EditableChallenge` interface and `setCpPerValidation(challenge.cp_per_validation ?? 5);` inside the existing `if (challenge) { ... }` block.

- [ ] **Step 3: Mirror the same additions in `ChallengeForm.tsx`**

Apply the equivalent changes to `ChallengeForm.tsx` (the `/admin/challenges` full-page create/edit form): extend its type-picker array with the `validation` option, add the same conditional `source_challenge_id`/`cp_per_validation` fields, add `<ValidationTargetsEditor challengeId={challenge.uuid} open />` inside the existing `{challenge?.uuid && (...)}` edit-only block, and extend `handleSubmit`'s payload the same way `CreateChallengeDrawer` was extended.

- [ ] **Step 4: Manual verification**

Run: `cd apps/leaderboard-client && npm run dev`
On `/admin/challenges`, create a validation challenge picking an existing ML challenge and a CP-per-validation value; confirm it appears in the list; edit it and confirm the `ValidationTargetsEditor` lists eligible `api_packaging` submissions (from Task 7's endpoint field) and lets you add/remove targets.
Expected: full admin flow works end-to-end without console errors.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx apps/leaderboard-client/src/components/admin/ChallengeForm.tsx
git commit -m "feat(admin): support creating and configuring validation challenges"
```

---

### Task 12: Contributor UI — validation flow

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx`
- Create: `apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx`

**Interfaces:**
- Consumes: `GET /api/challenges/[id]/validation-targets` (Task 9), `POST /api/challenges/[id]/validate` (Task 10)
- Produces: `ValidationChallengeFlow` — Task 13 wires it into the challenge detail page.

- [ ] **Step 1: The generic output viewer**

```tsx
// apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

interface ValidationOutputViewerProps {
  blob: Blob;
  contentType: string;
}

/** True for a string that looks like a base64/data-URI image, worth rendering inline. */
function looksLikeImageDataUri(value: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp);base64,/.test(value);
}

function JsonValue({ value }: { value: unknown }) {
  if (typeof value === 'string' && looksLikeImageDataUri(value)) {
    return <img src={value} alt="" className="max-h-64 rounded-lg border border-white/10" />;
  }
  if (typeof value === 'object' && value !== null) {
    return (
      <pre className="whitespace-pre-wrap break-all text-xs text-white/60">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="text-xs text-white/70">{String(value)}</span>;
}

export function ValidationOutputViewer({ blob, contentType }: ValidationOutputViewerProps) {
  const [text, setText] = useState<string | null>(null);
  const [json, setJson] = useState<Record<string, unknown> | null>(null);
  const objectUrl = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => {
    if (contentType.startsWith('image/')) return;
    blob.text().then(t => {
      if (contentType.includes('application/json')) {
        try { setJson(JSON.parse(t)); return; } catch { /* fall through to plain text */ }
      }
      setText(t);
    });
  }, [blob, contentType]);

  if (contentType.startsWith('image/')) {
    return <img src={objectUrl} alt="Model output" className="max-h-96 rounded-xl border border-white/10" />;
  }

  if (json) {
    return (
      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        {Object.entries(json).map(([key, value]) => (
          <div key={key} className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{key}</p>
            <JsonValue value={value} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-all rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-white/60">
      {text ?? 'Loading…'}
    </pre>
  );
}
```

- [ ] **Step 2: The flow component**

```tsx
// apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2, AlertCircle, Coins, ShieldCheck } from 'lucide-react';
import { ValidationOutputViewer } from './ValidationOutputViewer';

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  submitterAvatarUrl: string | null;
  alreadyValidatedByMe: boolean;
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
}

export function ValidationChallengeFlow({ challengeId }: { challengeId: string }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeContributionId, setActiveContributionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-targets`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data.targets ?? []);
        setPool(data.pool ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
        <ShieldCheck className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No submission exposed for validation yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {pool && pool.pool > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <Coins className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-brandCP/60" />
              <span className="text-sm font-semibold text-brandCP">{pool.remaining.toLocaleString()} CP</span>
              <span className="text-xs text-white/35">left — {pool.cpPerValidation} CP per first-time validation</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {targets.map(t => (
          <TargetCard
            key={t.id}
            target={t}
            challengeId={challengeId}
            expanded={activeContributionId === t.contributionId}
            onToggle={() => setActiveContributionId(activeContributionId === t.contributionId ? null : t.contributionId)}
            onValidated={fetchData}
          />
        ))}
      </div>
    </div>
  );
}

function TargetCard({
  target,
  challengeId,
  expanded,
  onToggle,
  onValidated,
}: {
  target: TargetItem;
  challengeId: string;
  expanded: boolean;
  onToggle: () => void;
  onValidated: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ blob: Blob; contentType: string; cpAwarded: number; alreadyValidated: boolean } | null>(null);

  const runValidation = async (file: File) => {
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('contribution_id', target.contributionId);
      form.append('file', file);
      const res = await fetch(`/api/challenges/${challengeId}/validate`, { method: 'POST', body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Validation failed');
        return;
      }
      const blob = await res.blob();
      setResult({
        blob,
        contentType: res.headers.get('content-type') ?? 'text/plain',
        cpAwarded: Number(res.headers.get('x-validation-cp-awarded') ?? 0),
        alreadyValidated: res.headers.get('x-validation-already-validated') === 'true',
      });
      if (Number(res.headers.get('x-validation-cp-awarded') ?? 0) > 0) onValidated();
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runValidation(file);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium text-white/80">{target.submitterName}</span>
        {target.alreadyValidatedByMe && (
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Validated by you
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/[0.06] p-4 animate-fade-up">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? 'border-brandCP/60 bg-brandCP/[0.06]' : 'border-white/15 bg-white/[0.01]'
            }`}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-brandCP" />
            ) : (
              <UploadCloud className="h-6 w-6 text-white/25" />
            )}
            <p className="text-xs text-white/40">
              {uploading ? 'Calling the API…' : 'Drop a file here to test this submission'}
            </p>
            <label className="cursor-pointer text-xs font-medium text-brandCP underline">
              or browse
              <input
                type="file"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) runValidation(f); }}
              />
            </label>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {result.cpAwarded > 0 && (
                <p className="text-xs font-semibold text-brandCP">+{result.cpAwarded} CP earned</p>
              )}
              <ValidationOutputViewer blob={result.blob} contentType={result.contentType} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/ValidationOutputViewer.tsx apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx
git commit -m "feat(ui): add contributor-facing validation challenge flow (dropzone + generic output viewer)"
```

---

### Task 13: Wire the challenge detail page and type badges

**Files:**
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx`
- Modify: `apps/leaderboard-client/src/components/public/ChallengeCard.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/ChallengeList.tsx`

**Interfaces:**
- Consumes: `ValidationChallengeFlow` (Task 12)
- Produces: opening a validation challenge renders the new flow instead of the code/ML views; validation challenges get a distinct badge everywhere challenge type is shown.

- [ ] **Step 1: Branch the detail page on `type === 'validation'`**

```ts
import { ValidationChallengeFlow } from '@/components/challenges/ValidationChallengeFlow';
```

```ts
  const isML = challenge?.type === 'ml' || repoTypes.some(t => ML_REPO_TYPES.includes(t));
  const isValidation = challenge?.type === 'validation';
```

Find the render branch that currently renders `<MLChallengeFlow challengeId={challengeId} />` (guarded by `isML`) and add a preceding, mutually-exclusive branch:

```tsx
        {isValidation ? (
          <ValidationChallengeFlow challengeId={challengeId} />
        ) : isML ? (
          <MLChallengeFlow challengeId={challengeId} />
        ) : (
          /* ...existing code-challenge board... */
        )}
```

(match this against the actual existing conditional structure around line 700 — the goal is `isValidation` short-circuits before the `isML`/code branches, since a validation challenge has no tasks, no ML workspace, and no repos of its own)

- [ ] **Step 2: Extend the type badge components**

```tsx
// ChallengeCard.tsx
import { BrainCircuit, Code2, ShieldCheck } from "lucide-react";

function ChallengeTypeBadge({ type }: { type: string }) {
  const config = {
    ml: { icon: BrainCircuit, label: 'ML' },
    validation: { icon: ShieldCheck, label: 'Validation' },
  }[type] ?? { icon: Code2, label: 'Code' };
  const Icon = config.icon;
  return (
    <span className="flex items-center gap-1 text-[11px] text-white/30">
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
```

Apply the equivalent change to `ChallengeList.tsx`'s badge logic (currently `const isML = type === 'ml';` gating an ML/Code icon choice) — replace the boolean with the same `{ ml, validation }` lookup-with-fallback pattern.

- [ ] **Step 3: Manual verification**

Run: `cd apps/leaderboard-client && npm run dev`
Open the validation challenge created in Task 11's manual test from `/challenges/[id]`; confirm the dropzone flow renders (not the ML stepper, not the code kanban); confirm the challenge card on the challenges list shows a "Validation" badge.
Expected: full end-to-end flow — create validation challenge → configure targets → open as a contributor → drop a file → see rendered output → CP awarded once.

- [ ] **Step 4: Commit**

```bash
git add "apps/leaderboard-client/src/app/challenges/[id]/page.tsx" apps/leaderboard-client/src/components/public/ChallengeCard.tsx apps/leaderboard-client/src/components/admin/ChallengeList.tsx
git commit -m "feat(ui): render validation challenges on the challenge detail page, add type badges"
```

---

### Task 14: Documentation

**Files:**
- Create: `docs/validation-challenges.md`
- Modify: `docs/overview.md`
- Modify: `docs/challenges-and-tasks.md`
- Modify: `docs/database.md`
- Modify: `docs/index.md`

**Interfaces:**
- Consumes: nothing (documentation only)
- Produces: a new doc page following the existing `ml-rewards.md`/`slack-signals.md` structure (Why → How it works → Key files), linked from the docs that describe challenge types and the schema.

- [ ] **Step 1: Write `docs/validation-challenges.md`**

Follow the structure of `docs/slack-signals.md` and `docs/ml-rewards.md`: a "Why" section, "How it works" (the proxy flow, the SSRF guard, the dedupe rule), "Setting it up" (admin creates the challenge, links the source ML challenge, exposes targets), "Rewards" (fixed CP per first-time validator/target pair, from the validation challenge's own pool), "Limitations (v1)" (ML `api_packaging` only, no persisted history, no automated runs, DNS-rebinding TOCTOU gap in the SSRF guard), and a "Key files" table listing every file touched in Tasks 1–13.

- [ ] **Step 2: Cross-link from the existing docs**

In `docs/overview.md`'s "Core concepts" table, extend the **Challenge** row to mention the third type; in `docs/challenges-and-tasks.md`'s "Challenge types" section, add a `validation` bullet pointing at the new doc; in `docs/database.md`'s "Challenges & Teams" table, mention the two new `challenges` columns and the two new tables; in `docs/index.md`, add `validation-challenges.md` to the doc listing.

- [ ] **Step 3: Commit**

```bash
git add docs/validation-challenges.md docs/overview.md docs/challenges-and-tasks.md docs/database.md docs/index.md
git commit -m "docs: document validation challenges"
```

---

### Task 15: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test` (from repo root)
Expected: all tests pass, including the new `ssrf-guard.test.ts` and `validation-challenge.service.test.ts`, and no existing test (especially `mlRewards.integration.test.ts`) regressed.

- [ ] **Step 2: Type-check**

Run: `cd apps/leaderboard-client && npx tsc --noEmit` (or the project's existing typecheck script if `package.json` defines one — check first)
Expected: no new type errors introduced by the entity/schema/mapper changes.

- [ ] **Step 3: End-to-end manual smoke test in the browser**

Run: `cd apps/leaderboard-client && npm run dev`
Walk the full path once more end to end: admin creates an ML challenge → a contributor submits an `api_packaging` GitHub repo + a deployed endpoint URL → admin creates a validation challenge linked to it, sets `cp_per_validation`, exposes that submission → a different contributor opens the validation challenge, drops a file, sees the rendered output, and their CP total goes up by exactly `cp_per_validation` — repeating the same drop earns nothing more.

- [ ] **Step 4: Final commit (if anything was fixed during verification)**

```bash
git add -A
git commit -m "chore: fix issues found during validation-challenges verification pass"
```
