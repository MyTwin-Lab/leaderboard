# Validation Challenge Quorum Verdicts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing validation challenge's "CP on first successful call" reward with a quorum-based human verdict: each validator who successfully calls a target's endpoint casts **Fonctionne**/**Défectueux**, and once a target collects `required_validations` verdicts (odd, set once per challenge), the majority side is paid `cp_per_validation` each — the minority gets nothing — and the outcome is permanent.

**Architecture:** Splits the existing `ValidationChallengeService.validate()` into two concerns: a pure proxy call (`validate()`, unchanged SSRF guard/timeout/size cap, now with no CP logic) and a new `castVerdict()` that records a verdict, and — the moment a target's Nth verdict lands — resolves it via a race-safe conditional update (`ValidationTargetRepository.resolve`, mirroring the existing null-on-race pattern already used by `ValidationAttemptRepository.create`) and pays the majority as one batched, pool-clamped `reward_entries` write. The `validation_attempts` table, previously a pure dedupe record, becomes the verdict record itself.

**Tech Stack:** Next.js 16 Route Handlers, Drizzle ORM / PostgreSQL, Zod, Vitest, React (client components), Node's built-in `fetch`/`FormData`.

## Global Constraints

- `required_validations` must be odd (enforced at challenge creation) so a majority always exists — no tie-break logic anywhere in this plan.
- The minority side of a resolved target earns nothing; only validators whose verdict matches the resolved majority get a `reward_entries` row.
- A verdict is immutable once cast — one row per `(validation_challenge_id, contribution_id, validator_user_id)`, same unique index as today.
- A validator cannot cast a verdict on their own submission (self-vote rejected).
- A description is required when the verdict is `broken`, optional when `works`.
- Before resolution, only the admin/manager of the challenge sees the works/broken split for a pending target — every other validator (and the public target list) sees only a blind participation count. Once resolved, the outcome is visible to everyone.
- A technical failure of the proxied call (timeout/non-2xx/SSRF-blocked/unreachable) is unchanged from today: no verdict, no quorum progress, the validator can retry — it is never treated as an implicit "broken" verdict.
- A target that never reaches quorum simply stays `pending` forever — no error state, no forced resolution.
- No ground truth, no reward for the `api_packaging` contribution's author, and no changing `required_validations` after creation — all explicitly out of scope for this iteration.
- Spec: `docs/superpowers/specs/2026-07-31-validation-challenge-quorum-verdicts-design.md`

---

### Task 1: Schema — required_validations, outcome/resolved_at, verdict/description

**Files:**
- Modify: `packages/database-service/db/drizzle.ts`

**Interfaces:**
- Produces: `challenges.required_validations`, `validation_targets.outcome`/`resolved_at`, `validation_attempts.verdict`/`description` — every later task depends on these columns existing.

- [ ] **Step 1: Add `required_validations` to `challenges`**

In the `challenges` table definition, right after the `cp_per_validation` field:

```ts
  // Validation challenges only: fixed CP a validator earns per first-time
  // (validator, target) validation. Locked after creation.
  cp_per_validation: integer("cp_per_validation"),
  // Validation challenges only: how many verdicts a target must collect
  // before it resolves. Must be odd (enforced at creation) so a majority
  // always exists. Locked after creation, like cp_per_validation.
  required_validations: integer("required_validations"),
```

- [ ] **Step 2: Add `outcome`/`resolved_at` to `validation_targets`**

Right after the `position` field:

```ts
export const validation_targets = pgTable("validation_targets", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  position: integer("position").default(0),
  // 'pending' until required_validations verdicts are collected, then
  // permanently 'works' or 'broken'. Written only by the resolve step.
  outcome: varchar("outcome", { length: 20 }).default("pending"),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
```

- [ ] **Step 3: Add `verdict`/`description` to `validation_attempts`**

Right after `validator_user_id`:

```ts
export const validation_attempts = pgTable("validation_attempts", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  validator_user_id: uuid("validator_user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  // 'works' | 'broken' — what the validator concluded after seeing the
  // endpoint's output. Not nullable: a row only exists once a verdict is cast.
  verdict: varchar("verdict", { length: 10 }).notNull(),
  // Required by the API layer when verdict = 'broken', optional otherwise.
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
```

- [ ] **Step 4: Push the schema to your local database**

Run: `npm run db:push`
Expected: Drizzle Kit reports the new columns applied without errors.

If it complains that existing `validation_attempts` rows can't satisfy the new `NOT NULL` constraint on `verdict`, that means your local DB still has attempt rows from testing the old (pre-quorum) validation system — those predate the verdict concept entirely and are safe to clear on a dev database: run `DELETE FROM validation_attempts;` in `psql`, then re-run `db:push`. A fresh dev environment won't hit this.

- [ ] **Step 5: Commit**

```bash
git add packages/database-service/db/drizzle.ts
git commit -m "feat(db): add quorum-verdict columns (required_validations, outcome/resolved_at, verdict/description)"
```

---

### Task 2: Domain entities and Zod schemas

**Files:**
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/domain/schemas_zod.ts`

**Interfaces:**
- Consumes: Task 1's columns
- Produces: `Challenge.required_validations`, `ValidationTarget.outcome`/`resolved_at`, `ValidationAttempt.verdict`/`description` — Task 3 (mappers) and Task 4/5 (repos/service) depend on these exact shapes.

- [ ] **Step 1: Extend `Challenge` in entities.ts**

```ts
  source_challenge_id?: string | null; // Validation uniquement — le challenge ML validé
  cp_per_validation?: number | null;   // Validation uniquement — CP fixe par validation
  required_validations?: number | null; // Validation uniquement — nb de verdicts requis avant résolution (impair)
```

- [ ] **Step 2: Extend `ValidationTarget` and `ValidationAttempt` in entities.ts**

```ts
/** Une soumission api_packaging exposée pour validation manuelle. */
export interface ValidationTarget {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (la soumission api_packaging)
  position: number;
  outcome: 'pending' | 'works' | 'broken';
  resolved_at: Date | null;
  created_at: Date;
}

/** Un verdict (works/broken) rendu par un validateur sur une cible donnée. */
export interface ValidationAttempt {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (la cible validée)
  validator_user_id: string;       // FK -> users.uuid
  verdict: 'works' | 'broken';
  description: string | null;      // requis côté API quand verdict = 'broken'
  created_at: Date;
}
```

- [ ] **Step 3: Extend `challengeSchema` in schemas_zod.ts**

```ts
  source_challenge_id: z.string().uuid().nullish(),
  cp_per_validation: z.number().int().nonnegative().nullish(),
  required_validations: z.number().int().positive().nullish(),
```

- [ ] **Step 4: Extend `validationTargetSchema` and `validationAttemptSchema`**

```ts
export const validationTargetSchema = z.object({
  uuid: z.string().uuid(),
  validation_challenge_id: z.string().uuid(),
  contribution_id: z.string().uuid(),
  position: z.number().int().nonnegative().default(0),
  outcome: z.enum(['pending', 'works', 'broken']).default('pending'),
  resolved_at: z.coerce.date().nullish(),
  created_at: z.coerce.date(),
});

export const validationAttemptSchema = z.object({
  uuid: z.string().uuid(),
  validation_challenge_id: z.string().uuid(),
  contribution_id: z.string().uuid(),
  validator_user_id: z.string().uuid(),
  verdict: z.enum(['works', 'broken']),
  description: z.string().nullish(),
  created_at: z.coerce.date(),
});
```

- [ ] **Step 5: Commit**

```bash
git add packages/database-service/domain/entities.ts packages/database-service/domain/schemas_zod.ts
git commit -m "feat(domain): add quorum-verdict fields to Challenge/ValidationTarget/ValidationAttempt"
```

---

### Task 3: Mappers

**Files:**
- Modify: `packages/database-service/db/mappers.ts`

**Interfaces:**
- Consumes: Task 1 (columns), Task 2 (entities/schemas)
- Produces: `toDomainChallenge`/`toDbChallenge`, `toDomainValidationTarget`, `toDomainValidationAttempt`/`toDbValidationAttempt` updated — Task 4 (repositories) depends on these.

- [ ] **Step 1: Extend `toDomainChallenge`/`toDbChallenge`**

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
    required_validations: row.required_validations ?? null,
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
    required_validations: entity.required_validations ?? null,
  };
}
```

(only the `required_validations` line is new in each — everything else unchanged)

- [ ] **Step 2: Extend `toDomainValidationTarget`**

```ts
export function toDomainValidationTarget(row: DbValidationTarget): ValidationTarget {
  return {
    uuid: row.uuid,
    validation_challenge_id: row.validation_challenge_id,
    contribution_id: row.contribution_id,
    position: row.position ?? 0,
    outcome: (row.outcome as ValidationTarget['outcome']) ?? 'pending',
    resolved_at: row.resolved_at ? new Date(row.resolved_at) : null,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}
```

`toDbValidationTarget` is unchanged — `outcome`/`resolved_at` are never set through the insert path (the column default handles `outcome`, and the new `resolve()` repo method in Task 4 is the only writer of both).

- [ ] **Step 3: Extend `toDomainValidationAttempt`/`toDbValidationAttempt`**

```ts
export function toDomainValidationAttempt(row: DbValidationAttempt): ValidationAttempt {
  return {
    uuid: row.uuid,
    validation_challenge_id: row.validation_challenge_id,
    contribution_id: row.contribution_id,
    validator_user_id: row.validator_user_id,
    verdict: row.verdict as ValidationAttempt['verdict'],
    description: row.description ?? null,
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
    verdict: entity.verdict,
    description: entity.description ?? null,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/database-service/db/mappers.ts
git commit -m "feat(db): map quorum-verdict fields for Challenge/ValidationTarget/ValidationAttempt"
```

---

### Task 4: Repository additions — resolve() and findByChallengeAndContribution()

**Files:**
- Modify: `packages/database-service/repositories/validationTarget.repo.ts`
- Modify: `packages/database-service/repositories/validationAttempt.repo.ts`

**Interfaces:**
- Consumes: Task 3's mappers
- Produces: `ValidationTargetRepository.resolve(uuid, outcome): Promise<ValidationTarget | null>`, `ValidationAttemptRepository.findByChallengeAndContribution(validationChallengeId, contributionId): Promise<ValidationAttempt[]>` — Task 5 (service) depends on these exact names and the null-on-race contract of `resolve`.

- [ ] **Step 1: Add `resolve()` to `ValidationTargetRepository`**

Add after `findByChallengeAndContribution`:

```ts
  /**
   * Marks a target resolved — but only if it's still 'pending'. Returns null
   * if another concurrent request already resolved it first, mirroring the
   * null-on-race contract `ValidationAttemptRepository.create` already uses:
   * the WHERE clause is the actual race guard, not an app-level check.
   */
  async resolve(uuid: string, outcome: 'works' | 'broken'): Promise<ValidationTarget | null> {
    const [row] = await db
      .update(validation_targets)
      .set({ outcome, resolved_at: new Date() })
      .where(and(eq(validation_targets.uuid, uuid), eq(validation_targets.outcome, 'pending')))
      .returning();
    return row ? toDomainValidationTarget(row) : null;
  }
```

- [ ] **Step 2: Add `findByChallengeAndContribution()` to `ValidationAttemptRepository`**

Add after `findByChallengeAndValidator`:

```ts
  /**
   * Every verdict cast on one target, oldest first — used to count votes
   * toward quorum, compute the majority, and pay out in the chronological
   * order the verdicts were cast.
   */
  async findByChallengeAndContribution(
    validationChallengeId: string,
    contributionId: string
  ): Promise<ValidationAttempt[]> {
    const rows = await db
      .select()
      .from(validation_attempts)
      .where(
        and(
          eq(validation_attempts.validation_challenge_id, validationChallengeId),
          eq(validation_attempts.contribution_id, contributionId)
        )
      )
      .orderBy(validation_attempts.created_at);
    return rows.map(toDomainValidationAttempt);
  }
```

- [ ] **Step 3: No repository test file**

This codebase has no `*.repo.test.ts` precedent (repositories talk to a real Postgres connection with no test harness) — coverage comes from the service-level test in Task 5 instead, same convention the original validation-challenge plan used for `validationAttempt.repo.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/database-service/repositories/validationTarget.repo.ts packages/database-service/repositories/validationAttempt.repo.ts
git commit -m "feat(db): add ValidationTargetRepository.resolve and ValidationAttemptRepository.findByChallengeAndContribution"
```

---

### Task 5: ValidationChallengeService — split validate()/castVerdict(), quorum resolution, batch CP payout

**Files:**
- Modify: `packages/services/challenge/validation-challenge.service.ts`
- Modify: `packages/services/challenge/validation-challenge.service.test.ts`

**Interfaces:**
- Consumes: `ValidationTargetRepository.resolve`, `ValidationAttemptRepository.findByChallengeAndContribution` (Task 4); `RewardEntryDraft`, `RewardEntryRepository.createManyAndSyncRewards` (existing)
- Produces: `ValidationChallengeService.validate(input): Promise<ValidationCallResult>` (proxy only, no CP), `ValidationChallengeService.castVerdict(input): Promise<CastVerdictResult>`, `SelfVoteError`, `DuplicateVerdictError` — Task 6 (routes) depends on these exact exports and shapes.

- [ ] **Step 1: Replace the test file with the new test suite**

This rewrites `validate()`'s tests to drop CP/dedupe concerns (that logic moved to `castVerdict`) and adds a full `castVerdict()` suite covering self-vote, duplicate vote, quorum-not-reached, quorum-reached-and-paid, minority-gets-nothing, pool-clamped-batch, resolution race, and late votes on an already-resolved target.

```ts
// packages/services/challenge/validation-challenge.service.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  ValidationChallengeService,
  ValidationTargetError,
  EndpointCallError,
  SelfVoteError,
  DuplicateVerdictError,
} from "./validation-challenge.service.js";
import type { ValidationRunDeps } from "./validation-challenge.service.js";
import type {
  Challenge,
  Contribution,
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
    required_validations: 3,
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

function makeDeps(opts: {
  challenge?: Partial<Challenge>;
  target?: { outcome?: "pending" | "works" | "broken" };
  existingAttempts?: ValidationAttempt[];
  overrideResolve?: (uuid: string, outcome: "works" | "broken") => Promise<any>;
  callEndpoint?: ValidationRunDeps["callEndpoint"];
} = {}): ValidationRunDeps {
  const challenge = makeChallenge(opts.challenge);
  const contribution = makeContribution();
  let target = {
    uuid: "target-1",
    validation_challenge_id: "vch-1",
    contribution_id: "contrib-1",
    position: 0,
    outcome: opts.target?.outcome ?? ("pending" as const),
    resolved_at: null as Date | null,
    created_at: new Date(),
  };
  const attempts: ValidationAttempt[] = [...(opts.existingAttempts ?? [])];
  const entries: RewardEntry[] = [];
  const validatorContributions: Contribution[] = [];

  return {
    challengeRepo: { findById: vi.fn(async (id: string) => (id === challenge.uuid ? challenge : null)) },
    targetRepo: {
      findByChallenge: vi.fn(async () => [target]),
      resolve: opts.overrideResolve
        ? vi.fn(opts.overrideResolve)
        : vi.fn(async (uuid: string, outcome: "works" | "broken") => {
            if (uuid !== target.uuid || target.outcome !== "pending") return null;
            target = { ...target, outcome, resolved_at: new Date() };
            return target;
          }),
    },
    attemptRepo: {
      exists: vi.fn(async (_c: string, _t: string, validatorId: string) =>
        attempts.some(a => a.validator_user_id === validatorId)
      ),
      create: vi.fn(async (entity: any) => {
        const row: ValidationAttempt = { uuid: `att-${attempts.length + 1}`, created_at: new Date(), ...entity };
        attempts.push(row);
        return row;
      }),
      findByChallengeAndContribution: vi.fn(async () => [...attempts]),
    },
    contributionRepo: {
      findById: vi.fn(async (id: string) => (id === contribution.uuid ? contribution : null)),
      findByChallenge: vi.fn(async () => validatorContributions),
      create: vi.fn(async (entity: any) => {
        const row: Contribution = { uuid: `vc-${validatorContributions.length + 1}`, ...entity };
        validatorContributions.push(row);
        return row;
      }),
      update: vi.fn(async () => contribution),
    },
    rewardRepo: {
      sumByChallenge: vi.fn(async () => entries.reduce((s, e) => s + e.points, 0)),
      createManyAndSyncRewards: vi.fn(async (drafts: any[]) => {
        const rows = drafts.map((d, i) => ({ uuid: `re-${entries.length + i + 1}`, created_at: new Date(), ...d }));
        entries.push(...(rows as RewardEntry[]));
        return rows;
      }),
    },
    callEndpoint:
      opts.callEndpoint ??
      vi.fn(async () => ({ status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') })),
  } as ValidationRunDeps;
}

describe("ValidationChallengeService.validate", () => {
  it("returns the endpoint's response for a successful call", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", file });

    expect(result).toEqual({ status: 200, contentType: "application/json", body: Buffer.from('{"label":"cat"}') });
  });

  it("passes through a non-2xx status without throwing", async () => {
    const deps = makeDeps({
      callEndpoint: vi.fn(async () => ({ status: 500, contentType: "text/plain", body: Buffer.from("boom") })),
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", file });

    expect(result.status).toBe(500);
  });

  it("throws ValidationTargetError when the contribution isn't an exposed target", async () => {
    const deps = makeDeps();
    deps.targetRepo.findByChallenge = vi.fn(async () => []);
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("throws ValidationTargetError when the target contribution has no live endpoint", async () => {
    const deps = makeDeps();
    deps.contributionRepo.findById = vi.fn(async () => null);
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", file })
    ).rejects.toThrow(ValidationTargetError);
  });

  it("wraps a failing endpoint call in EndpointCallError", async () => {
    const deps = makeDeps({ callEndpoint: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.validate({ validationChallengeId: "vch-1", contributionId: "contrib-1", file })
    ).rejects.toThrow(EndpointCallError);
  });
});

describe("ValidationChallengeService.castVerdict", () => {
  it("records a verdict and reports the running count while below quorum", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({
      validationChallengeId: "vch-1",
      contributionId: "contrib-1",
      validatorUserId: "bob",
      verdict: "works",
      description: null,
    });

    expect(result).toEqual({
      verdictRecorded: true,
      resolved: false,
      outcome: "pending",
      verdictCount: 1,
      requiredValidations: 3,
      cpAwarded: 0,
    });
    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("throws SelfVoteError when the validator owns the target submission", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    await expect(
      service.castVerdict({
        validationChallengeId: "vch-1",
        contributionId: "contrib-1",
        validatorUserId: "alice", // same as makeContribution()'s user_id
        verdict: "works",
        description: null,
      })
    ).rejects.toThrow(SelfVoteError);
  });

  it("throws DuplicateVerdictError when the validator already voted", async () => {
    const deps = makeDeps({
      existingAttempts: [
        {
          uuid: "att-0",
          validation_challenge_id: "vch-1",
          contribution_id: "contrib-1",
          validator_user_id: "bob",
          verdict: "works",
          description: null,
          created_at: new Date(),
        },
      ],
    });
    const service = new ValidationChallengeService(deps);

    await expect(
      service.castVerdict({
        validationChallengeId: "vch-1",
        contributionId: "contrib-1",
        validatorUserId: "bob",
        verdict: "broken",
        description: "still bad",
      })
    ).rejects.toThrow(DuplicateVerdictError);
  });

  it("resolves the target and pays the majority once quorum is reached", async () => {
    const deps = makeDeps();
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", verdict: "works", description: null });
    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "carol", verdict: "broken", description: "bad output" });
    const result = await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "dave", verdict: "works", description: null });

    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe("works");
    expect(result.verdictCount).toBe(3);
    expect(result.cpAwarded).toBe(5); // dave voted with the majority

    const paid = vi.mocked(deps.rewardRepo.createManyAndSyncRewards).mock.calls[0][0] as any[];
    expect(paid.map(e => e.user_id).sort()).toEqual(["bob", "dave"]); // majority side only — carol gets nothing
  });

  it("clamps the payout batch to whatever remains in the pool", async () => {
    const deps = makeDeps({ challenge: { contribution_points_reward: 8, cp_per_validation: 5 } });
    const service = new ValidationChallengeService(deps);

    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "bob", verdict: "works", description: null });
    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "carol", verdict: "works", description: null });
    await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "dave", verdict: "broken", description: "nope" });

    const paid = vi.mocked(deps.rewardRepo.createManyAndSyncRewards).mock.calls[0][0] as any[];
    expect(paid.map(e => e.points)).toEqual([5, 3]); // bob gets the full 5, carol gets whatever's left
  });

  it("does not pay out twice if a concurrent request already resolved the target", async () => {
    const deps = makeDeps({
      existingAttempts: [
        { uuid: "att-1", validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "bob", verdict: "works", description: null, created_at: new Date() },
        { uuid: "att-2", validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "carol", verdict: "works", description: null, created_at: new Date() },
      ],
      overrideResolve: async () => null, // another request already resolved it
    });
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "dave", verdict: "works", description: null });

    expect(result.resolved).toBe(true);
    expect(result.cpAwarded).toBe(0);
    expect(deps.rewardRepo.createManyAndSyncRewards).not.toHaveBeenCalled();
  });

  it("still records a late vote on an already-resolved target but pays nothing", async () => {
    const deps = makeDeps({ target: { outcome: "works" } });
    const service = new ValidationChallengeService(deps);

    const result = await service.castVerdict({ validationChallengeId: "vch-1", contributionId: "contrib-1", validatorUserId: "erin", verdict: "broken", description: "seems off" });

    expect(result.verdictRecorded).toBe(true);
    expect(result.resolved).toBe(true);
    expect(result.outcome).toBe("works");
    expect(result.cpAwarded).toBe(0);
    expect(deps.attemptRepo.create).toHaveBeenCalledTimes(1);
    expect(deps.targetRepo.resolve).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/services && npx vitest run challenge/validation-challenge.service.test.ts`
Expected: FAIL — `castVerdict is not a function` / `SelfVoteError`/`DuplicateVerdictError` not exported, and the `validate` tests fail on the old CP-shaped return value.

- [ ] **Step 3: Replace the service implementation**

```ts
// packages/services/challenge/validation-challenge.service.ts
import {
  ChallengeRepository,
  ContributionRepository,
  ValidationTargetRepository,
  ValidationAttemptRepository,
  RewardEntryRepository,
} from "../../database-service/repositories/index.js";
import type { RewardEntryDraft } from "../../database-service/repositories/index.js";
import type { Challenge, Contribution, ValidationAttempt } from "../../database-service/domain/entities.js";
import { assertPublicHttpUrl } from "./ssrf-guard.js";

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** The submission isn't exposed on this validation challenge, or has no endpoint — a 4xx-shaped problem. */
export class ValidationTargetError extends Error {}
/** The proxied call itself failed (SSRF-blocked, unreachable, timed out, too large) — a 5xx-shaped problem. */
export class EndpointCallError extends Error {}
/** A validator tried to cast a verdict on their own submission. */
export class SelfVoteError extends Error {}
/** A validator tried to cast a second verdict on a target they already voted on. */
export class DuplicateVerdictError extends Error {}

export interface ValidationFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/** The raw result of proxying a file to a target's endpoint — no CP, no verdict. */
export interface ValidationCallResult {
  status: number;
  contentType: string;
  body: Buffer;
}

export interface CastVerdictResult {
  verdictRecorded: boolean;
  resolved: boolean;
  outcome: "pending" | "works" | "broken";
  verdictCount: number;
  requiredValidations: number;
  /** CP granted to *this* validator — 0 unless their vote both matched the
   * resolved majority and there was still pool left when it was their turn. */
  cpAwarded: number;
}

export interface ValidationRunDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  targetRepo: Pick<ValidationTargetRepository, "findByChallenge" | "resolve">;
  attemptRepo: {
    exists: (validationChallengeId: string, contributionId: string, validatorUserId: string) => Promise<boolean>;
    create: (entity: {
      validation_challenge_id: string;
      contribution_id: string;
      validator_user_id: string;
      verdict: "works" | "broken";
      description: string | null;
    }) => Promise<ValidationAttempt | null>;
    findByChallengeAndContribution: (validationChallengeId: string, contributionId: string) => Promise<ValidationAttempt[]>;
  };
  contributionRepo: Pick<ContributionRepository, "findById" | "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "sumByChallenge" | "createManyAndSyncRewards">;
  callEndpoint: (url: string, file: ValidationFile) => Promise<ValidationCallResult>;
}

/**
 * ValidationChallengeService
 * ---------------------------
 * `validate()` proxies a "drop a file, see the API's output" call — pure
 * network I/O, no CP, no identity involved. `castVerdict()` records what a
 * validator concluded after seeing that output and, once a target collects
 * `required_validations` verdicts, resolves it: the majority side is paid
 * `cp_per_validation` each (clamped to the pool, earliest voters first), the
 * minority gets nothing, and the outcome is permanent.
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
    file: ValidationFile;
  }): Promise<ValidationCallResult> {
    const { validationChallengeId, contributionId, file } = input;

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

    try {
      await assertPublicHttpUrl(contribution.live_endpoint_url);
      return await this.deps.callEndpoint(contribution.live_endpoint_url, file);
    } catch (error) {
      throw new EndpointCallError(error instanceof Error ? error.message : String(error));
    }
  }

  async castVerdict(input: {
    validationChallengeId: string;
    contributionId: string;
    validatorUserId: string;
    verdict: "works" | "broken";
    description: string | null;
  }): Promise<CastVerdictResult> {
    const { validationChallengeId, contributionId, validatorUserId, verdict, description } = input;

    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ValidationTargetError("Not a validation challenge");
    }
    const requiredValidations = challenge.required_validations ?? 0;

    const targets = await this.deps.targetRepo.findByChallenge(validationChallengeId);
    const target = targets.find(t => t.contribution_id === contributionId);
    if (!target) {
      throw new ValidationTargetError("Submission is not exposed on this validation challenge");
    }

    const contribution = await this.deps.contributionRepo.findById(contributionId);
    if (!contribution) {
      throw new ValidationTargetError("Submission has no deployed endpoint");
    }
    if (contribution.user_id === validatorUserId) {
      throw new SelfVoteError("Cannot cast a verdict on your own submission");
    }

    const alreadyVoted = await this.deps.attemptRepo.exists(validationChallengeId, contributionId, validatorUserId);
    if (alreadyVoted) {
      throw new DuplicateVerdictError("You already cast a verdict on this submission");
    }

    const created = await this.deps.attemptRepo.create({
      validation_challenge_id: validationChallengeId,
      contribution_id: contributionId,
      validator_user_id: validatorUserId,
      verdict,
      description,
    });
    if (!created) {
      // Lost a race against another request from the same validator.
      throw new DuplicateVerdictError("You already cast a verdict on this submission");
    }

    const allVerdicts = await this.deps.attemptRepo.findByChallengeAndContribution(validationChallengeId, contributionId);
    const verdictCount = allVerdicts.length;

    if (target.outcome !== "pending" || verdictCount < requiredValidations) {
      return {
        verdictRecorded: true,
        resolved: target.outcome !== "pending",
        outcome: target.outcome,
        verdictCount,
        requiredValidations,
        cpAwarded: 0,
      };
    }

    const worksCount = allVerdicts.filter(v => v.verdict === "works").length;
    const majority: "works" | "broken" = worksCount * 2 > verdictCount ? "works" : "broken";

    const resolvedTarget = await this.deps.targetRepo.resolve(target.uuid, majority);
    if (!resolvedTarget) {
      // Another concurrent request resolved this target first — this vote is
      // already recorded above, it just isn't the one paying out.
      return {
        verdictRecorded: true,
        resolved: true,
        outcome: majority,
        verdictCount,
        requiredValidations,
        cpAwarded: 0,
      };
    }

    const myCp = await this.payMajority(challenge, contributionId, allVerdicts, majority, validatorUserId);

    return {
      verdictRecorded: true,
      resolved: true,
      outcome: majority,
      verdictCount,
      requiredValidations,
      cpAwarded: myCp,
    };
  }

  private async payMajority(
    challenge: Challenge,
    contributionId: string,
    allVerdicts: ValidationAttempt[],
    majority: "works" | "broken",
    callingValidatorId: string
  ): Promise<number> {
    let remaining = await this.remainingPool(challenge);
    const entries: RewardEntryDraft[] = [];
    let myCp = 0;

    for (const v of allVerdicts) {
      if (v.verdict !== majority || remaining <= 0) continue;
      const grant = Math.min(challenge.cp_per_validation ?? 0, remaining);
      if (grant <= 0) continue;
      remaining -= grant;

      const validatorContribution = await this.findOrCreateValidatorContribution(challenge, v.validator_user_id);
      entries.push({
        challenge_id: challenge.uuid,
        user_id: v.validator_user_id,
        contribution_id: validatorContribution.uuid,
        rule_key: "validation",
        points: grant,
        meta: { targetContributionId: contributionId },
      });
      if (v.validator_user_id === callingValidatorId) myCp = grant;
    }

    if (entries.length > 0) {
      await this.deps.rewardRepo.createManyAndSyncRewards(entries);
    }
    return myCp;
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

  private async callEndpointDefault(url: string, file: ValidationFile): Promise<ValidationCallResult> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }), file.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      // `redirect: "manual"` is load-bearing for the SSRF guard — see the
      // original v1 plan's Task 6 for why redirects must not be followed.
      const res = await fetch(url, { method: "POST", body: form, signal: controller.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        throw new Error(`Endpoint responded with a redirect (${res.status}) — redirects are not followed`);
      }
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
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/services/challenge/validation-challenge.service.ts packages/services/challenge/validation-challenge.service.test.ts
git commit -m "feat(services): split ValidationChallengeService into proxy-only validate() and quorum-resolving castVerdict()"
```

---

### Task 6: API routes — proxy-only /validate, new /validation-verdicts

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/validate/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-verdicts/route.ts`

**Interfaces:**
- Consumes: `ValidationChallengeService.validate`/`castVerdict`, `SelfVoteError`, `DuplicateVerdictError`, `ValidationTargetError` (Task 5)
- Produces: `POST /api/challenges/:id/validate` (proxy only), `POST /api/challenges/:id/validation-verdicts` — Task 10 (frontend) depends on both response shapes.

- [ ] **Step 1: Trim `/validate` to a pure proxy**

Replace the whole file:

```ts
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
// Pure proxy: calls the target's endpoint and returns its raw response.
// Casting a verdict on what came back is a separate call — see
// POST .../validation-verdicts.
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
      file: { buffer, filename: file.name, mimeType: file.type || 'application/octet-stream' },
    });

    return new NextResponse(new Uint8Array(result.body), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'X-Validation-Status': String(result.status),
      },
    });
  } catch (error) {
    if (error instanceof ValidationTargetError) {
      console.error('Validation target error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof EndpointCallError) {
      console.error('Validation endpoint call error:', error.message);
      return NextResponse.json({ error: `The API didn't respond correctly: ${error.message}` }, { status: 502 });
    }
    console.error('Error running validation:', error);
    return NextResponse.json({ error: 'Failed to run validation' }, { status: 500 });
  }
}
```

(the `X-Validation-Cp-Awarded`/`X-Validation-Already-Validated` headers are gone — that information now comes from `/validation-verdicts` instead)

- [ ] **Step 2: Create `/validation-verdicts`**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/validation-verdicts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ValidationChallengeService,
  ValidationTargetError,
  SelfVoteError,
  DuplicateVerdictError,
} from '../../../../../../../../packages/services/challenge/validation-challenge.service';
import { getSessionUser } from '@/lib/auth';

const service = new ValidationChallengeService();

const castVerdictSchema = z
  .object({
    contribution_id: z.string().uuid(),
    verdict: z.enum(['works', 'broken']),
    description: z.string().trim().min(1).nullish(),
  })
  .refine((v) => v.verdict !== 'broken' || !!v.description, {
    message: 'A description is required when the verdict is "broken"',
    path: ['description'],
  });

// POST /api/challenges/[id]/validation-verdicts — any logged-in contributor,
// after having seen the target's output via POST .../validate
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const body = await req.json();
    const parsed = castVerdictSchema.parse(body);

    const result = await service.castVerdict({
      validationChallengeId: challengeId,
      contributionId: parsed.contribution_id,
      validatorUserId: user.id,
      verdict: parsed.verdict,
      description: parsed.description ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof SelfVoteError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateVerdictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationTargetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error casting validation verdict:', error);
    return NextResponse.json({ error: 'Failed to cast verdict' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev` (or your usual dev command for `apps/leaderboard-client`), then from a logged-in session `POST` a small file to `/api/challenges/:id/validate` for a real exposed target, confirm you get the raw output back with only `X-Validation-Status` set, then `POST` `{ contribution_id, verdict: "works" }` to `/api/challenges/:id/validation-verdicts` and confirm a `200` with `verdictRecorded: true`.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/[id]/validate/route.ts apps/leaderboard-client/src/app/api/challenges/[id]/validation-verdicts/route.ts
git commit -m "feat(api): trim /validate to a pure proxy, add POST /validation-verdicts"
```

---

### Task 7: Extend the validation-targets route — status fields + delete guard

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/[targetId]/route.ts`

**Interfaces:**
- Consumes: `ValidationAttemptRepository.findByChallengeAndContribution` (Task 4)
- Produces: `GET .../validation-targets` response gains `pool.requiredValidations` and, per target, `verdictCount`/`outcome`/`resolvedAt` (everyone) and `worksCount`/`brokenCount` (admin/manager only); `DELETE .../validation-targets/:targetId` now rejects with 409 if the target has any verdicts — Task 10 (contributor flow) and Task 11 (manager dashboard) depend on these fields.

- [ ] **Step 1: Extend the GET handler**

Add `ValidationAttemptRepository` to the imports and instantiate it alongside the others already at the top of the file (`attemptRepo` already exists — reuse it, it's already imported for `myAttempts`). Replace the final part of `GET` (from `const pool = ...` to the end of the function):

```ts
    const isManager = session
      ? session.role === 'admin' || (await isManagerOfChallenge(session.id, challengeId))
      : false;

    const attemptsByTarget = await Promise.all(
      targets.map(t => attemptRepo.findByChallengeAndContribution(challengeId, t.contribution_id))
    );

    const pool = challenge.contribution_points_reward;

    return NextResponse.json({
      currentUserId: session?.id ?? null,
      pool: {
        pool,
        distributed,
        remaining: Math.max(0, pool - distributed),
        cpPerValidation: challenge.cp_per_validation ?? 0,
        requiredValidations: challenge.required_validations ?? 0,
      },
      targets: targets.map((t, i) => {
        const c = contributions[i];
        const submitter = c ? submittersById.get(c.user_id) : undefined;
        const attempts = attemptsByTarget[i];
        const worksCount = attempts.filter(a => a.verdict === 'works').length;
        const brokenCount = attempts.length - worksCount;
        return {
          id: t.uuid,
          contributionId: t.contribution_id,
          submitterUserId: c?.user_id ?? null,
          submitterName: submitter?.full_name ?? 'Unknown',
          submitterAvatarUrl: submitter?.avatar_url ?? null,
          alreadyValidatedByMe: validatedContributionIds.has(t.contribution_id),
          verdictCount: attempts.length,
          outcome: t.outcome,
          resolvedAt: t.resolved_at,
          // Only the manager sees the live split before resolution — everyone
          // else gets a blind participation count, so their own verdict is an
          // independent judgment, not a reaction to the running tally.
          ...(isManager ? { worksCount, brokenCount } : {}),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching validation targets:', error);
    return NextResponse.json({ error: 'Failed to fetch validation targets' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Guard the DELETE handler**

Replace the whole file:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ValidationTargetRepository, ValidationAttemptRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const targetRepo = new ValidationTargetRepository();
const attemptRepo = new ValidationAttemptRepository();

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

    const attempts = await attemptRepo.findByChallengeAndContribution(challengeId, existing.contribution_id);
    if (attempts.length > 0) {
      return NextResponse.json(
        { error: `Cannot remove a target that already has ${attempts.length} vote(s)` },
        { status: 409 }
      );
    }

    await targetRepo.delete(targetId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing validation target:', error);
    return NextResponse.json({ error: 'Failed to remove validation target' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Manual smoke check**

As a non-manager, `GET /api/challenges/:id/validation-targets` and confirm the response has no `worksCount`/`brokenCount` keys on any target. As the challenge's manager, confirm they're present. Try `DELETE` on a target that already has a verdict and confirm a `409`.

- [ ] **Step 4: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts" "apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/[targetId]/route.ts"
git commit -m "feat(api): add quorum status fields to validation-targets, block deleting a voted-on target"
```

---

### Task 8: New route — validation-rewards pool state

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-rewards/route.ts`

**Interfaces:**
- Consumes: `RewardEntryRepository.findByChallenge`, `ChallengeRepository.findById`, `UserRepository.findByIds` (existing), `isManagerOfChallenge` (existing)
- Produces: `GET /api/challenges/:id/validation-rewards` — Task 11 (manager dashboard panel) depends on this response shape.

- [ ] **Step 1: Create the route**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/validation-rewards/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  RewardEntryRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const rewardRepo = new RewardEntryRepository();
const userRepo = new UserRepository();

// GET /api/challenges/[id]/validation-rewards — admin/manager only
// Pool state + per-validator breakdown for a validation challenge.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    if (challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const entries = await rewardRepo.findByChallenge(challengeId);
    const distributed = entries.reduce((sum, e) => sum + e.points, 0);
    const pool = challenge.contribution_points_reward;

    const byUser = new Map<string, number>();
    for (const e of entries) {
      byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + e.points);
    }
    const users = await userRepo.findByIds([...byUser.keys()]);
    const usersById = new Map(users.map(u => [u.uuid, u]));

    return NextResponse.json({
      pool,
      distributed,
      remaining: Math.max(0, pool - distributed),
      requiredValidations: challenge.required_validations ?? 0,
      cpPerValidation: challenge.cp_per_validation ?? 0,
      breakdown: [...byUser.entries()]
        .map(([userId, points]) => ({ userId, userName: usersById.get(userId)?.full_name ?? 'Unknown', points }))
        .sort((a, b) => b.points - a.points),
    });
  } catch (error) {
    console.error('Error fetching validation rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch validation rewards' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual smoke check**

As the challenge's manager, `GET /api/challenges/:id/validation-rewards` and confirm `pool`/`distributed`/`remaining`/`breakdown` come back correctly. As a non-manager, confirm `403`.

- [ ] **Step 3: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-rewards/route.ts"
git commit -m "feat(api): add GET /validation-rewards pool state for validation challenges"
```

---

### Task 9: Required validations at challenge creation

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/route.ts`
- Modify: `apps/leaderboard-client/src/components/admin/ChallengeForm.tsx`

**Interfaces:**
- Consumes: `Challenge.required_validations` (Task 2)
- Produces: challenge creation accepts and locks `required_validations` (odd, positive) for `type: 'validation'` challenges.

- [ ] **Step 1: Extend the creation schema and validation**

In `createChallengeSchema`, add after `cp_per_validation`:

```ts
  cp_per_validation: z.number().int().positive().optional(),
  required_validations: z.number().int().positive().optional(),
});
```

In the `if (validated.type === 'validation')` block, add after the `cp_per_validation` check:

```ts
      if (!validated.cp_per_validation) {
        return NextResponse.json({ error: 'cp_per_validation is required for validation challenges' }, { status: 400 });
      }
      if (!validated.required_validations) {
        return NextResponse.json({ error: 'required_validations is required for validation challenges' }, { status: 400 });
      }
      if (validated.required_validations % 2 === 0) {
        return NextResponse.json({ error: 'required_validations must be odd' }, { status: 400 });
      }
```

In the `challengeRepo.create` call, add:

```ts
      source_challenge_id: validated.type === 'validation' ? validated.source_challenge_id : null,
      cp_per_validation: validated.type === 'validation' ? validated.cp_per_validation : null,
      required_validations: validated.type === 'validation' ? validated.required_validations : null,
```

- [ ] **Step 2: Add the field to `ChallengeForm.tsx`**

Add state alongside `cpPerValidation`:

```tsx
  const [cpPerValidation, setCpPerValidation] = useState((challenge as any)?.cp_per_validation ?? 5);
  const [requiredValidations, setRequiredValidations] = useState((challenge as any)?.required_validations ?? 3);
```

In `handleSubmit`, extend the validation-only payload:

```tsx
      ...(formData.type === 'validation' && !challenge?.uuid
        ? { source_challenge_id: sourceChallengeId, cp_per_validation: cpPerValidation, required_validations: requiredValidations }
        : {}),
```

Add a new `FormField` right after the existing "CP per validation" one:

```tsx
        {formData.type === 'validation' && (
          <FormField label="Required validations" required>
            {challenge?.uuid ? (
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>{requiredValidations} validators must agree</p>
            ) : (
              <>
                <input
                  type="number"
                  required
                  min={1}
                  step={2}
                  value={requiredValidations}
                  onChange={e => {
                    const n = parseInt(e.target.value) || 1;
                    setRequiredValidations(n % 2 === 0 ? n + 1 : n);
                  }}
                  className={inputClass}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Must be odd — a target resolves once this many validators have voted, majority wins.
                </p>
              </>
            )}
          </FormField>
        )}
```

(the `n % 2 === 0 ? n + 1 : n` rounds an even input up to the next odd number client-side, as a nudge — the server still enforces it independently)

- [ ] **Step 3: Manual smoke check**

Create a new validation challenge from the admin UI: confirm "Required validations" defaults to 3, typing `4` snaps to `5`, and the created challenge has `required_validations` set and locked (re-opening it for edit shows the read-only text, not the input).

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/route.ts apps/leaderboard-client/src/components/admin/ChallengeForm.tsx
git commit -m "feat(admin): add required_validations field to validation challenge creation"
```

---

### Task 10: Contributor voting UI

**Files:**
- Modify: `apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx`

**Interfaces:**
- Consumes: `GET .../validation-targets` (Task 7), `POST .../validate` (Task 6), `POST .../validation-verdicts` (Task 6)
- Produces: the drop-file-then-vote flow described in the design doc's UI section.

- [ ] **Step 1: Replace the file**

```tsx
// apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, XCircle, Loader2, AlertCircle, Coins, ShieldCheck } from 'lucide-react';
import { ValidationOutputViewer } from './ValidationOutputViewer';

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  submitterAvatarUrl: string | null;
  alreadyValidatedByMe: boolean;
  verdictCount: number;
  outcome: 'pending' | 'works' | 'broken';
  resolvedAt: string | null;
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
  requiredValidations: number;
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
              <span className="text-xs text-white/35">
                left — {pool.cpPerValidation} CP to each validator on the winning side, once {pool.requiredValidations} verdicts are in
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {targets.map(t => (
          <TargetCard
            key={t.id}
            target={t}
            requiredValidations={pool?.requiredValidations ?? 0}
            challengeId={challengeId}
            expanded={activeContributionId === t.contributionId}
            onToggle={() => setActiveContributionId(activeContributionId === t.contributionId ? null : t.contributionId)}
            onResolved={fetchData}
          />
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ target, requiredValidations }: { target: TargetItem; requiredValidations: number }) {
  if (target.outcome === 'works') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Fonctionne ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  if (target.outcome === 'broken') {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-400">
        <XCircle className="h-3 w-3" /> Défectueux ({target.verdictCount}/{requiredValidations})
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium text-white/40">
      {target.verdictCount}/{requiredValidations} validations reçues
    </span>
  );
}

function TargetCard({
  target,
  requiredValidations,
  challengeId,
  expanded,
  onToggle,
  onResolved,
}: {
  target: TargetItem;
  requiredValidations: number;
  challengeId: string;
  expanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<{ blob: Blob; contentType: string } | null>(null);
  const [verdict, setVerdict] = useState<'works' | 'broken' | null>(null);
  const [description, setDescription] = useState('');
  const [submittingVerdict, setSubmittingVerdict] = useState(false);
  const [verdictResult, setVerdictResult] = useState<{ resolved: boolean; outcome: string; cpAwarded: number } | null>(null);

  const runValidation = async (file: File) => {
    setUploading(true);
    setError('');
    setOutput(null);
    setVerdict(null);
    setVerdictResult(null);
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
      setOutput({ blob, contentType: res.headers.get('content-type') ?? 'text/plain' });
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
    }
  };

  const submitVerdict = async () => {
    if (!verdict) return;
    if (verdict === 'broken' && !description.trim()) {
      setError('A description is required when marking a submission as Défectueux');
      return;
    }
    setSubmittingVerdict(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-verdicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contribution_id: target.contributionId, verdict, description: description.trim() || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || 'Failed to submit verdict');
        return;
      }
      setVerdictResult(d);
      onResolved();
    } catch {
      setError('Network error');
    } finally {
      setSubmittingVerdict(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runValidation(file);
  };

  const canVote = !target.alreadyValidatedByMe && !verdictResult;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium text-white/80">{target.submitterName}</span>
        <div className="flex items-center gap-2">
          {target.alreadyValidatedByMe && (
            <span className="text-xs text-white/30">Vous avez déjà voté</span>
          )}
          <StatusBadge target={target} requiredValidations={requiredValidations} />
        </div>
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

          {output && <ValidationOutputViewer blob={output.blob} contentType={output.contentType} />}

          {output && canVote && !verdictResult && (
            <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setVerdict('works')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    verdict === 'works' ? 'border-green-500/40 bg-green-500/15 text-green-400' : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  ✅ Fonctionne
                </button>
                <button
                  onClick={() => setVerdict('broken')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    verdict === 'broken' ? 'border-red-500/40 bg-red-500/15 text-red-400' : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  ❌ Défectueux
                </button>
              </div>
              {verdict && (
                <>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={verdict === 'broken' ? 'What went wrong? (required)' : 'Notes (optional)'}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-white/70"
                    rows={2}
                  />
                  <button
                    onClick={submitVerdict}
                    disabled={submittingVerdict || (verdict === 'broken' && !description.trim())}
                    className="w-full rounded-lg bg-brandCP/20 px-3 py-2 text-xs font-medium text-brandCP transition-colors hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {submittingVerdict ? 'Envoi…' : 'Envoyer le verdict'}
                  </button>
                </>
              )}
            </div>
          )}

          {verdictResult && (
            <div className="space-y-1 text-xs">
              {verdictResult.cpAwarded > 0 && (
                <p className="font-semibold text-brandCP">+{verdictResult.cpAwarded} CP earned</p>
              )}
              <p className="text-white/40">
                {verdictResult.resolved
                  ? `Résolu : ${verdictResult.outcome === 'works' ? 'Fonctionne' : 'Défectueux'}`
                  : 'Verdict enregistré — en attente des autres validateurs'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual browser check**

Start the dev server, open a validation challenge as a non-owning contributor, drop a file on a target, confirm the output renders, then confirm: choosing "Défectueux" without typing a description disables the submit button; submitting "Fonctionne" with no description succeeds; after submitting, the status badge and "Vous avez déjà voté" both appear and the vote buttons no longer show for that target.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/ValidationChallengeFlow.tsx
git commit -m "feat(ui): add verdict voting flow to the validation challenge page"
```

---

### Task 11: Manager dashboard — per-target status + pool panel

**Files:**
- Modify: `apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx`
- Create: `apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/ChallengeForm.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx`

**Interfaces:**
- Consumes: `GET .../validation-targets` (Task 7, manager-only `worksCount`/`brokenCount`), `GET .../validation-rewards` (Task 8)
- Produces: manager-visible live status per target, a new pool-state panel rendered next to `ValidationTargetsEditor` wherever it's already used.

- [ ] **Step 1: Extend `ValidationTargetsEditor`'s state and status display**

Update the `TargetItem` interface:

```tsx
interface TargetItem {
  id: string;
  contributionId: string;
  submitterName: string;
  verdictCount: number;
  outcome: 'pending' | 'works' | 'broken';
  worksCount?: number;
  brokenCount?: number;
}
```

Update the mapping inside `fetchAll`:

```tsx
      if (targetsRes.ok) {
        const d = await targetsRes.json();
        setTargets((d.targets ?? []).map((t: any) => ({
          id: t.id,
          contributionId: t.contributionId,
          submitterName: t.submitterName,
          verdictCount: t.verdictCount ?? 0,
          outcome: t.outcome ?? 'pending',
          worksCount: t.worksCount,
          brokenCount: t.brokenCount,
        })));
      }
```

Replace the target row rendering (inside the `targets.map(t => ...)` block) with a version that shows status and disables removal once votes exist:

```tsx
              {targets.map(t => (
                <div key={t.id} className="group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm" style={{ color: fgAt(0.75) }}>{t.submitterName}</span>
                    <span className="block text-[10px]" style={{ color: fgAt(0.35) }}>
                      {t.outcome === 'pending'
                        ? (t.worksCount !== undefined
                            ? `${t.verdictCount} votes (${t.worksCount} Fonctionne, ${t.brokenCount} Défectueux)`
                            : `${t.verdictCount} votes`)
                        : `${t.outcome === 'works' ? '✅ Fonctionne' : '❌ Défectueux'} (${t.verdictCount} votes)`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(t.id)}
                    disabled={deletingId === t.id || t.verdictCount > 0}
                    title={t.verdictCount > 0 ? 'Ce target a déjà reçu des votes — impossible de le retirer' : undefined}
                    className="shrink-0 rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/25"
                    aria-label="Remove submission"
                  >
                    {deletingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
```

- [ ] **Step 2: Create `ValidationRewardsPanel`**

```tsx
// apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Loader2 } from 'lucide-react';

interface RewardsState {
  pool: number;
  distributed: number;
  remaining: number;
  requiredValidations: number;
  cpPerValidation: number;
  breakdown: { userId: string; userName: string; points: number }[];
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/** Admin-side pool summary for a validation challenge — pool/distributed/remaining and who earned what. */
export function ValidationRewardsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [data, setData] = useState<RewardsState | null>(null);
  const [loading, setLoading] = useState(true);

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    fetch(`/api/challenges/${challengeId}/validation-rewards`)
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <Coins className="h-3.5 w-3.5" /> CP pool
      </p>
      <p className="text-sm" style={{ color: fgAt(0.75) }}>
        {data.remaining.toLocaleString()} / {data.pool.toLocaleString()} CP remaining
        <span className="ml-1 text-xs" style={{ color: fgAt(0.35) }}>
          ({data.cpPerValidation} CP each side of {data.requiredValidations})
        </span>
      </p>
      {data.breakdown.length > 0 && (
        <div className="space-y-1 pt-1">
          {data.breakdown.map(b => (
            <div key={b.userId} className="flex items-center justify-between text-xs" style={{ color: fgAt(0.5) }}>
              <span className="truncate">{b.userName}</span>
              <span className="shrink-0 font-medium" style={{ color: fgAt(0.7) }}>{b.points} CP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render it next to `ValidationTargetsEditor` in both places it's used**

In `ChallengeForm.tsx`, add the import and render it right after the existing `<ValidationTargetsEditor .../>`:

```tsx
import { ValidationRewardsPanel } from './ValidationRewardsPanel';
```

```tsx
      {challenge?.uuid && formData.type === 'validation' && (
        <FormSection title="Validation targets">
          <ValidationTargetsEditor challengeId={challenge.uuid} open />
          <div className="mt-3">
            <ValidationRewardsPanel challengeId={challenge.uuid} open />
          </div>
        </FormSection>
      )}
```

In `CreateChallengeDrawer.tsx`, add the import and render it right after its `<ValidationTargetsEditor .../>`:

```tsx
import { ValidationRewardsPanel } from '@/components/admin/ValidationRewardsPanel';
```

```tsx
          {/* ── Validation targets (edit only) — independent CRUD ── */}
          {type === 'validation' && isEdit && (
            <>
              <ValidationTargetsEditor challengeId={challenge!.uuid} open={open} />
              <div className="mt-3">
                <ValidationRewardsPanel challengeId={challenge!.uuid} open={open} />
              </div>
            </>
          )}
```

- [ ] **Step 4: Manual smoke check**

As the challenge's manager, open a validation challenge with at least one pending target that has partial votes: confirm the works/broken split is visible, confirm the pool panel shows correct remaining CP and a per-validator breakdown, and confirm the remove button is disabled (with the tooltip) on any target that already has votes.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/components/admin/ValidationTargetsEditor.tsx apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx apps/leaderboard-client/src/components/admin/ChallengeForm.tsx apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx
git commit -m "feat(admin): show live quorum status and a CP pool panel on the validation challenge manager view"
```

---

### Task 12: Update docs/validation-challenges.md

**Files:**
- Modify: `docs/validation-challenges.md`

**Interfaces:**
- Consumes: nothing (documentation only)
- Produces: accurate end-user documentation of the quorum-verdict mechanism, replacing the old "CP on first successful call" description.

- [ ] **Step 1: Rewrite the summary (lines 1–5) and "How it works" section**

Replace the opening summary:

```markdown
# Validation Challenges

`type: 'validation'` challenges let contributors manually test whether a submitted ML API packaging actually works — drop a file, call the live deployed endpoint, see the raw output, then vote **Fonctionne** or **Défectueux**. Once a submission collects a fixed number of votes, the majority side is paid CP from the validation challenge's own pool; the minority gets nothing. It's a human sanity-check tool, separate from AI scoring.
```

Replace the `POST /api/challenges/:id/validate` step in the flow diagram and the paragraph after it with:

```markdown
Validator (any logged-in contributor, on the validation challenge page)
  → drops a file on an exposed target
    → POST /api/challenges/:id/validate  (multipart: contribution_id, file)
      → server verifies the target is exposed
      → server SSRF-guards the endpoint URL (blocks private/loopback/link-local
        addresses, blocks redirects, enforces a 15s timeout and a 10MB response cap)
      → server proxies the file to the endpoint, returns the raw response
    → client renders the response generically: image/* → <img>, JSON → pretty
      field-by-field viewer (with base64/data-URI image fields shown inline),
      anything else → raw text
  → validator casts a verdict based on what they saw
    → POST /api/challenges/:id/validation-verdicts  { contribution_id, verdict, description }
      → rejects a self-vote (can't vote on your own submission) or a second vote
        from the same validator on the same target
      → once the target has collected `required_validations` verdicts, it
        resolves permanently: majority wins, and every validator on the
        majority side is paid `cp_per_validation` (minority gets nothing)
```

- [ ] **Step 2: Rewrite the "Rewards" section**

Replace the whole "Rewards: fixed, from the validation challenge's own pool" section body with:

```markdown
- Each validation challenge sets `cp_per_validation` (CP per validator, on the winning side) and `required_validations` (an odd number — how many verdicts a target needs before it resolves) once at creation; both are locked afterward.
- CP is paid only once a target resolves — never per individual call. Only validators whose verdict matches the resolved majority get paid; the minority earns nothing, even though they did the same work of testing.
- One `type: 'validation'` contribution per validator per validation challenge aggregates the ledger, mirroring the `type: 'discussion'` pattern used for Slack signals — a chip, not a contribution-list entry.
- Before a target resolves, everyone sees only a blind participation count ("3/5 validations reçues") — never the works/broken split. The challenge's admin/manager is the one exception, seeing the live split for oversight.
- A target that never collects enough votes just stays unresolved — no CP paid, no error.
```

- [ ] **Step 3: Update the "Limitations (v1)" section**

Add these two bullets to the existing list:

```markdown
- A target that never gets a single successful (2xx) response can never resolve, even if the endpoint is obviously broken — there's no "N technical failures = broken" path.
- No reward or recognition flows to the `api_packaging` contribution's author when their submission resolves `works` — CP in this system stays entirely on the validator side.
```

- [ ] **Step 4: Extend the "Key files" table**

Add these rows:

```markdown
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-verdicts/route.ts` | Casts a verdict; resolves the target and pays the majority once quorum is reached |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-rewards/route.ts` | Pool state + per-validator breakdown, admin/manager only |
| `apps/leaderboard-client/src/components/admin/ValidationRewardsPanel.tsx` | Admin: CP pool summary for a validation challenge |
```

- [ ] **Step 5: Commit**

```bash
git add docs/validation-challenges.md
git commit -m "docs: update validation-challenges.md for quorum verdicts"
```
