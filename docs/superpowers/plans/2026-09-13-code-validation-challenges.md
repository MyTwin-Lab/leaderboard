# Code Validation Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `validation` challenge back a `code` challenge, so contributors walk a fixed scenario through a deployed application step by step and get paid CP from the validation challenge's own pool.

**Architecture:** The existing `validation` challenge type is extended rather than duplicated. The half about *the application under test* (`validation_targets`, the endpoint URL on `contributions`, the `rule_key: 'validation'` ledger, `ValidationRewardsPanel`) is reused verbatim. The half about *how you judge* gets three new tables (`validation_scenario_steps`, `validation_scenario_runs`, `validation_step_feedbacks`), two new services, five new API route files and four new React components. **The mode is derived, never stored:** `source_challenge_id` pointing at an `ml` challenge means the existing reference-case flow, pointing at a `code` challenge means the new scenario flow.

**Tech Stack:** Next.js 15 App Router (route handlers with `params: Promise<{...}>`), React 19 client components, TanStack Query on the manage/challenge pages, Drizzle ORM + Postgres, Zod at the API boundary, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-11-code-validation-challenges-design.md`

## Global Constraints

- **Never touch `evaluation_status`, `evaluation` or `globalScore`** on the source `project` contribution. This mechanism has its own budget and answers its own question.
- **No `validation_mode` column.** The mode is computed from the source challenge's `type` on every read. Adding a stored column is an explicit violation of the design.
- **No quorum, no majority, no verdict.** Every completed walkthrough pays `cp_per_validation`, clamped to the remaining pool.
- **The platform never calls the application.** The validator's browser loads it in an iframe. No proxy, no timeout, no size cap, no SSRF check at walkthrough time. The SSRF guard at *exposure* time (`assertPublicHttpUrl` in `POST /validation-targets`) stays exactly as it is.
- **CP rule key is `'validation'`**, attributed to the validator's aggregate `type: 'validation'` contribution for that challenge — identical to the ML flow, so `GET /api/challenges/:id/validation-rewards` and `ValidationRewardsPanel` need no change.
- **Never call a step a "task".** `tasks` already means the personal kanban of a `code` challenge and both live in the same app. The words are `scenario`, `step`, `walkthrough`, `target`.
- **Schema changes must land in `scripts/db-apply-schema.ts`**, not only in `drizzle.ts`. `docs/deployment.md` is explicit that the `postdeploy` hook does not run `drizzle-kit push`, so a change confined to `drizzle.ts` never reaches production.
- **Test runner:** `cd apps/leaderboard-client && npx vitest run <path>` for app tests; `npx vitest run <path>` from the repo root for `packages/**` tests. Type gate: `cd apps/leaderboard-client && npx tsc --noEmit`. There is no working ESLint config — those two commands are the gate.
- **Repository tests never hit the database.** Existing repo test files only cover pure helpers. Test mappers, services (with injected deps) and route handlers (with mocked repository classes). Do not write a test that needs a live Postgres.
- **Route files are reached by deep relative paths** into `packages/`: eight `../` from `app/api/challenges/[id]/<name>/route.ts`, nine from `app/api/challenges/[id]/<name>/[param]/route.ts`, eleven from `app/api/challenges/[id]/<name>/[param]/steps/[param]/route.ts`. Count the segments against a neighbouring route before writing the import.
- **`packages/**` imports use the `.js` extension** (`from "./validation-mode.js"`); `apps/leaderboard-client` imports do not. Follow the file you are in.
- **Routes import services by full relative path, not through the barrel.** `ValidationChallengeService` and `ReferenceCaseService` are deliberately absent from `packages/services/challenge/index.ts`, and every validation route reaches for the file directly — the tasks below do the same, so each route's `vi.mock` targets exactly one module. The barrel additions the tasks make are for other `packages/**` consumers and for discoverability; they are not what the routes import.

---

## File Structure

### Created

| File | Responsibility |
|---|---|
| `packages/services/challenge/validation-mode.ts` | Pure derivation of the mode from the source challenge's type, plus which contribution type is targetable in each mode. |
| `packages/services/challenge/validation-mode.test.ts` | Tests for the above. |
| `packages/services/challenge/scenario-errors.ts` | The error classes shared by both scenario services and by every scenario route's status mapping. |
| `packages/services/challenge/validatorContribution.ts` | `findOrCreateValidatorContribution` — the aggregate `type: 'validation'` contribution, extracted from `ValidationChallengeService` so both payment paths use one implementation. |
| `packages/services/challenge/scenario-steps.service.ts` | Authoring the scenario: list, add, edit (incl. reorder with dense renumbering), remove — and the freeze rule. |
| `packages/services/challenge/scenario-steps.service.test.ts` | Tests for the above. |
| `packages/services/challenge/scenario-walkthrough.service.ts` | Walking the scenario: open/resume, save one step's feedback, complete + pay. Carries the not-my-own-application guard (holder **and** group members) and the `medical_pro` gate on the medical comment. |
| `packages/services/challenge/scenario-walkthrough.service.test.ts` | Tests for the above. |
| `packages/database-service/repositories/scenarioStep.repo.ts` | `ScenarioStepRepository`. |
| `packages/database-service/repositories/scenarioRun.repo.ts` | `ScenarioRunRepository` — includes the null-on-unique-violation create and the null-on-race complete. |
| `packages/database-service/repositories/stepFeedback.repo.ts` | `StepFeedbackRepository` — one upsert on (run, step). |
| `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-steps/route.ts` | `GET` (any signed-in contributor) + `POST` (admin/manager). |
| `…/validation-scenario-steps/route.test.ts` | Tests for the above. |
| `…/validation-scenario-steps/[stepId]/route.ts` | `PATCH` + `DELETE` (admin/manager). |
| `…/validation-scenario-steps/[stepId]/route.test.ts` | Tests for the above. |
| `…/validation-scenario-runs/route.ts` | `POST` (open/resume a walkthrough) + `GET` (admin/manager oversight). |
| `…/validation-scenario-runs/route.test.ts` | Tests for the above. |
| `…/validation-scenario-runs/[runId]/steps/[stepId]/route.ts` | `PUT` one step's feedback. |
| `…/validation-scenario-runs/[runId]/steps/[stepId]/route.test.ts` | Tests for the above. |
| `…/validation-scenario-runs/[runId]/complete/route.ts` | `POST` complete + pay. |
| `…/validation-scenario-runs/[runId]/complete/route.test.ts` | Tests for the above. |
| `apps/leaderboard-client/src/components/admin/ScenarioStepsEditor.tsx` | Admin: the ordered list of steps, reorderable and deletable, read-only once frozen. |
| `apps/leaderboard-client/src/components/admin/ScenarioWalkthroughsPanel.tsx` | Admin/manager oversight: per application, who walked it, every step result, every comment, the medical opinions and the overall feedback. The only quality control in v1. |
| `apps/leaderboard-client/src/components/challenges/ScenarioChallengeFlow.tsx` | Validator: pool banner + the exposed applications with my state, and the entry point into a walkthrough. |
| `apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx` | Validator: the iframe, one step at a time, the progress strip, the final screen, and the read-only recap after completion. |

*(`…` above stands for `apps/leaderboard-client/src/app/api/challenges/[id]`.)*

### Modified

| File | Change |
|---|---|
| `packages/database-service/db/drizzle.ts` | Three new `pgTable`s + registration in the `db` schema object. |
| `packages/database-service/domain/entities.ts` | Three new interfaces + the `ScenarioStepResult` union. |
| `packages/database-service/domain/schemas_zod.ts` | Three new Zod schemas. |
| `packages/database-service/db/mappers.ts` | Six new mapper functions. |
| `packages/database-service/repositories/index.ts` | Three new exports. |
| `scripts/db-apply-schema.ts` | Three `CREATE TABLE IF NOT EXISTS` + their indexes. |
| `packages/services/challenge/validation-challenge.service.ts` | Uses the extracted `findOrCreateValidatorContribution`. |
| `apps/leaderboard-client/src/app/api/challenges/route.ts` | A `validation` challenge may now source a `code` challenge; `required_validations` is required only when the source is `ml`. |
| `…/validation-targets/route.ts` | Eligible list and POST guard become mode-aware (`api_packaging` vs `project`); GET publishes `mode`, `endpointUrl`, and per-target `myWalkthrough` / `walkthroughCount` in scenario mode. |
| `…/overview/route.ts` | Publishes the derived `source_challenge_type` so both page shells know the mode without a second request. |
| `apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx` | Source dropdown lists `ml` **and** `code` challenges; the `required_validations` field disappears when the source is a `code` challenge. |
| `apps/leaderboard-client/src/components/admin/ChallengeForm.tsx` | Same two changes, for the older `/admin/challenges` form. |
| `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx` | In scenario mode the Targets tab swaps `ReferenceCasesOverviewPanel` for `ScenarioStepsEditor`, and the Runs tab becomes a Walkthroughs tab. |
| `apps/leaderboard-client/src/app/challenges/[id]/page.tsx` | In scenario mode the Validate tab renders `ScenarioChallengeFlow` instead of `ReferenceCaseAuthorPanel` + `ValidationChallengeFlow`. |
| `docs/validation-challenges.md` | Documents the two modes and the scenario flow end to end. |
| `docs/api.md` | The five new route files + the eligible-list change. |
| `docs/database.md` | The three new tables + the relationship diagram. |

---

## Task list

1. Schema, domain, mappers, repositories, deploy script
2. The derived mode + creating a validation challenge over a `code` challenge
3. The creation forms
4. `validation-targets` becomes mode-aware
5. `ScenarioStepsService`
6. The scenario-steps routes
7. `ScenarioStepsEditor` + the manage view in scenario mode
8. `ScenarioWalkthroughService.openWalkthrough`
9. `ScenarioWalkthroughService.saveStepFeedback`
10. `ScenarioWalkthroughService.completeWalkthrough` + payment
11. The walkthrough routes
12. The oversight route
13. `ScenarioWalkthroughsPanel`
14. `ScenarioChallengeFlow` + the contributor page
15. `ScenarioWalkthroughScreen`
16. Documentation

---

## Design reference

The screen design lives in the user's Claude Design project, file **`Challenge Code Validation.dc.html`** (project `18a3c9b0-12af-40bf-a659-4b9a8dba6ec7`). It carries two views — *Contributor* (tabs `Applications`, `My walkthrough`) and *Manager* (tabs `Scenario`, `Targets`, `Walkthroughs`, `Rewards`) — and is the authority on **layout, hierarchy, states and copy**.

**It is not the authority on colour.** The mock is painted in a light teal palette (`#f0fdf4` ground, `#0d9488` accent, `#0b1a15` ink). The live app is dark-first with an admin-overrideable accent: `--background: #0a0a0a`, `--foreground: #ededed`, `--theme-primary: #0af7c1` exposed to Tailwind as `brandCP`, and a `html[data-mode="light"]` inversion layer in `apps/leaderboard-client/src/app/globals.css`. **Translate, never transcribe:** every `#0d9488` in the mock becomes `brandCP` / `border-brandCP/40` / `bg-brandCP/10`; every `#0b1a15`, `#4f605a`, `#566761`, `#8aa199` becomes the local `fgAt(opacity)` helper that `ValidationTargetsEditor` and `ValidationRunsPanel` already define; every `#ffffff` card becomes `border border-white/[0.06] bg-white/[0.02]`. Hard-coding a hex from the mock is a review rejection — it breaks light mode and the admin's theme colour.

**What to take verbatim from the design:**

- **The result triad and its semantics** — `passed` / `failed` / `blocked`, in that order, as three pill buttons. Map to the green/red/amber the codebase already uses for verdicts (`text-green-400`, `text-red-400`, and amber for `blocked`). The compact mark in oversight is a single letter in a 26px rounded square: `P`, `F`, `B`.
- **Per-application state vocabulary:** `Never started` → button *Start*; `In progress · 4/7` → button *Resume*; `Completed · N CP` → button *Review*; `Your own application` → button *Not eligible*, card at 60% opacity, `cursor: not-allowed`.
- **The walkthrough layout:** a two-column grid, `repeat(auto-fit, minmax(320px, 1fr))` — so it collapses to one column under ~700px with no media query. Left: the iframe at `min-height: min(620px, 70vh)`, rounded, with an **Open in a tab** link and the line *"The platform never calls this application — your browser does."* underneath. Right: `Step N of M` + `X / M answered`, then the progress strip, then the single step card.
- **The progress strip** is a row of equal-width 5px bars (`flex:1`), not dots: untouched is a neutral track, answered takes the result colour, and the current step gets a 2px accent ring. Clicking one jumps to that step.
- **Gating copy:** *Next step* is disabled until the current step has a result, with the hint *"Mark this step passed, failed or blocked to continue"*. **Finish walkthrough** carries a `+N CP` badge and its hint states exactly why it is blocked — *"2 steps still have no result"*, *"1 step still has no result"* (singular), *"The overall feedback is required"*, or when ready *"Pays N CP from the remaining pool"*.
- **The medical opinion field** is a dashed-border accent block *underneath* the comment box inside the same step card, labelled `MEDICAL OPINION`, placeholder *"Clinical reading of this step (optional)"*. Not a tab, not a mode — both lenses coexist.
- **The frozen-scenario banner** (amber, padlock icon): *"The scenario is frozen — a walkthrough has already started. Editing, reordering or deleting a step would make the walkthroughs incomparable."* And the add-step row degrades to *"Add a step — disabled while the scenario is frozen"*.
- **Step numbering is `01`-padded monospace** throughout (`String(i + 1).padStart(2, '0')`).
- **The scenario recap card** on the Applications tab: the whole step list, title only, in a `repeat(auto-fit, minmax(240px, 1fr))` grid, headed `THE SCENARIO` + *"N steps · same for every application"*. It tells a validator what they are signing up for before they start.
- **Oversight run rows:** validator name, a `medical_pro` chip when applicable, the date, a right-aligned state chip (`Completed` green / `Draft · 4/7` amber), then the mark row, then the overall feedback as a paragraph, then each medical opinion in its own accent block labelled `MEDICAL OPINION · STEP 05`.

Two details in the mock are **out of scope for this plan** and must not be built: the mock's `Rewards` manager tab is the existing `ValidationRewardsPanel` (unchanged, per the spec), and its hero stat row is the existing `HeroStats` component (the middle measure already has a `validation` branch).

---

### Task 1: Schema, domain, mappers, repositories

**Files:**
- Modify: `packages/database-service/db/drizzle.ts` (after `validation_attempts`, around line 346; and the `db` schema object around line 1155)
- Modify: `packages/database-service/domain/entities.ts` (after the `ValidationAttempt` interface, around line 255)
- Modify: `packages/database-service/domain/schemas_zod.ts` (after `validationAttemptSchema`, around line 192)
- Modify: `packages/database-service/db/mappers.ts` (after `toDbValidationAttempt`, end of the validation block)
- Create: `packages/database-service/repositories/scenarioStep.repo.ts`
- Create: `packages/database-service/repositories/scenarioRun.repo.ts`
- Create: `packages/database-service/repositories/stepFeedback.repo.ts`
- Modify: `packages/database-service/repositories/index.ts`
- Modify: `scripts/db-apply-schema.ts` (append to `STATEMENTS`, before the closing `];`)
- Test: `packages/database-service/db/mappers.scenario.test.ts`

**Interfaces:**
- Consumes: nothing — this is the foundation.
- Produces: tables `validation_scenario_steps`, `validation_scenario_runs`, `validation_step_feedbacks`; types `ValidationScenarioStep`, `ValidationScenarioRun`, `ValidationStepFeedback`, `ScenarioStepResult`; classes `ScenarioStepRepository`, `ScenarioRunRepository`, `StepFeedbackRepository` exported from `packages/database-service/repositories/index.ts`.

- [ ] **Step 1: Add the three tables to `drizzle.ts`**

Insert directly after the `validation_attempts` table definition (the block ending with `uniqueAttemptIdx: uniqueIndex("idx_validation_attempts_unique")...}));`). All the imports used here (`pgTable`, `uuid`, `varchar`, `text`, `integer`, `timestamp`, `index`, `uniqueIndex`) are already imported at the top of the file.

```ts
// --- VALIDATION_SCENARIO_STEPS ---
// The ordered walkthrough a validator performs on every application exposed
// on a scenario-mode validation challenge (source challenge is `code`).
//
// Never called a "task": `tasks` already means the personal kanban of a code
// challenge, and both live in the same app.
//
// Shared by every target on the challenge — all contributors built against
// the same brief, so they face the same walkthrough. Frozen (no insert, no
// update, no delete) the moment the first validation_scenario_runs row
// exists; that freeze is what keeps validation_step_feedbacks.step_id from
// ever dangling, and what keeps walkthroughs comparable to each other.
export const validation_scenario_steps = pgTable("validation_scenario_steps", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  // Dense and 0-based. ScenarioStepsService renumbers every sibling on a
  // reorder rather than shuffling one row's value, so positions never
  // collide and never leave gaps.
  position: integer("position").default(0).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  instructions: text("instructions"),
  // Not in the design doc's column list — it is the tiebreaker `position`
  // alone can't give two steps added in the same reorder-free session,
  // exactly as validation_targets orders on (position, created_at).
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_validation_scenario_steps_challenge_id").on(table.validation_challenge_id, table.position),
}));

// --- VALIDATION_SCENARIO_RUNS ---
// One validator's pass over one application. `completed_at IS NULL` is a
// draft: a validator who closes the tab at step 4 of 7 comes back to exactly
// what they had filled in. There is no reservation step, so there is no
// abandoned-walkthrough state to clean up.
//
// The unique index does the same job idx_validation_attempts_unique does:
// one walkthrough per (validator, application), so cp_per_validation is paid
// once — enforced by the database rather than an application-level check, so
// concurrent requests race safely.
//
// Deliberately hangs off `challenges` and `contributions`, NOT off
// validation_targets: un-exposing a target must not silently destroy feedback
// that has already been paid for.
export const validation_scenario_runs = pgTable("validation_scenario_runs", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  validation_challenge_id: uuid("validation_challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }).notNull(),
  // The application walked — a `project` contribution of the source code challenge.
  contribution_id: uuid("contribution_id").references(() => contributions.uuid, { onDelete: "cascade" }).notNull(),
  validator_user_id: uuid("validator_user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  // Required at completion, enforced at the API layer (zod) and in the
  // service; nullable here because a draft doesn't have one yet.
  global_feedback: text("global_feedback"),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_validation_scenario_runs_challenge_id").on(table.validation_challenge_id),
  validatorIdx: index("idx_validation_scenario_runs_validator_id").on(table.validator_user_id),
  uniqueRunIdx: uniqueIndex("idx_validation_scenario_runs_unique").on(table.validation_challenge_id, table.contribution_id, table.validator_user_id),
}));

// --- VALIDATION_STEP_FEEDBACKS ---
// One row per (walkthrough, step). Upserted on the unique index as the
// validator moves through the scenario, so navigating between steps never
// loses anything and closing the tab loses nothing either.
//
// `medical_comment` is a column rather than a row-per-lens because there are
// exactly two lenses. A third one (security, accessibility) would justify
// splitting into rows with a discriminator; two does not.
export const validation_step_feedbacks = pgTable("validation_step_feedbacks", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  run_id: uuid("run_id").references(() => validation_scenario_runs.uuid, { onDelete: "cascade" }).notNull(),
  step_id: uuid("step_id").references(() => validation_scenario_steps.uuid, { onDelete: "cascade" }).notNull(),
  // 'passed' | 'failed' | 'blocked'. Not nullable: a row exists only once the
  // validator has answered. Already a vote — it simply isn't counted in this
  // iteration (no quorum, no majority).
  result: varchar("result", { length: 10 }).notNull(),
  // The user-experience comment, open to every validator.
  comment: text("comment"),
  // The clinical reading, writable only by a medical_pro — alongside
  // `comment`, never instead of it.
  medical_comment: text("medical_comment"),
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  runIdIdx: index("idx_validation_step_feedbacks_run_id").on(table.run_id),
  uniqueFeedbackIdx: uniqueIndex("idx_validation_step_feedbacks_unique").on(table.run_id, table.step_id),
}));
```

- [ ] **Step 2: Register the three tables in the `db` schema object**

In the `drizzle(pool, { schema: { ... } })` call at the bottom of `drizzle.ts`, add the three names next to `digests`:

```ts
    digests,
    validation_scenario_steps,
    validation_scenario_runs,
    validation_step_feedbacks,
```

- [ ] **Step 3: Add the domain entities**

Append to `packages/database-service/domain/entities.ts`, directly after the `ValidationAttempt` interface:

```ts
/** Ce qu'un validateur a conclu d'une étape : déjà un vote, simplement non compté en v1. */
export type ScenarioStepResult = 'passed' | 'failed' | 'blocked';

/** Une étape du scénario d'un challenge de validation en mode scénario (source `code`). */
export interface ValidationScenarioStep {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  position: number;                // dense, 0-based
  title: string;
  instructions: string | null;
  created_at: Date;
}

/**
 * Le passage d'un validateur sur une application. `completed_at === null`
 * signifie brouillon : reprenable à l'identique, modifiable partout.
 * Une fois complété, immuable — et payé.
 */
export interface ValidationScenarioRun {
  uuid: string;
  validation_challenge_id: string; // FK -> challenges.uuid
  contribution_id: string;         // FK -> contributions.uuid (l'application parcourue)
  validator_user_id: string;       // FK -> users.uuid
  global_feedback: string | null;  // requis à la complétion
  completed_at: Date | null;
  created_at: Date;
}

/** Le retour d'un validateur sur une étape : un résultat, un commentaire UX, et un avis médical réservé aux medical_pro. */
export interface ValidationStepFeedback {
  uuid: string;
  run_id: string;  // FK -> validation_scenario_runs.uuid
  step_id: string; // FK -> validation_scenario_steps.uuid
  result: ScenarioStepResult;
  comment: string | null;
  medical_comment: string | null;
  created_at: Date;
}
```

- [ ] **Step 4: Add the Zod schemas**

Append to `packages/database-service/domain/schemas_zod.ts`, directly after `validationAttemptSchema`:

```ts
export const validationScenarioStepSchema = z.object({
  uuid: z.string().uuid(),
  validation_challenge_id: z.string().uuid(),
  position: z.number().int().nonnegative().default(0),
  title: z.string().min(1).max(255),
  instructions: z.string().nullable(),
  created_at: z.coerce.date(),
});

export const validationScenarioRunSchema = z.object({
  uuid: z.string().uuid(),
  validation_challenge_id: z.string().uuid(),
  contribution_id: z.string().uuid(),
  validator_user_id: z.string().uuid(),
  global_feedback: z.string().nullable(),
  completed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
});

export const validationStepFeedbackSchema = z.object({
  uuid: z.string().uuid(),
  run_id: z.string().uuid(),
  step_id: z.string().uuid(),
  result: z.enum(['passed', 'failed', 'blocked']),
  comment: z.string().nullable(),
  medical_comment: z.string().nullable(),
  created_at: z.coerce.date(),
});
```

- [ ] **Step 5: Write the failing mapper test**

Create `packages/database-service/db/mappers.scenario.test.ts`. This runs under the root `packages` Vitest project (node, no `@` alias) — plain relative imports with `.js` extensions.

```ts
import { describe, it, expect } from "vitest";
import {
  toDomainValidationScenarioStep,
  toDbValidationScenarioStep,
  toDomainValidationScenarioRun,
  toDbValidationScenarioRun,
  toDomainValidationStepFeedback,
  toDbValidationStepFeedback,
} from "./mappers.js";

describe("scenario step mappers", () => {
  it("keeps a null instructions null rather than turning it into an empty string", () => {
    // Le distinguo compte à l'affichage : une étape sans détail ne doit pas
    // rendre un bloc de texte vide sous son titre.
    const step = toDomainValidationScenarioStep({
      uuid: "step-1", validation_challenge_id: "vch-1",
      position: 0, title: "Create an account", instructions: null, created_at: null,
    } as any);

    expect(step.instructions).toBeNull();
    expect(step.title).toBe("Create an account");
  });

  it("defaults a null position to 0 so an ordered list never breaks on legacy rows", () => {
    const step = toDomainValidationScenarioStep({
      uuid: "step-1", validation_challenge_id: "vch-1",
      position: null, title: "Log in", instructions: null, created_at: null,
    } as any);

    expect(step.position).toBe(0);
  });

  it("drops uuid/created_at on the way to the database", () => {
    const row = toDbValidationScenarioStep({
      validation_challenge_id: "vch-1", position: 2,
      title: "Export the record", instructions: "As a PDF.",
    });

    expect(row).toEqual({
      validation_challenge_id: "vch-1", position: 2,
      title: "Export the record", instructions: "As a PDF.",
    });
  });
});

describe("scenario run mappers", () => {
  it("reads a draft as completed_at null — the single source of truth for 'resumable'", () => {
    const run = toDomainValidationScenarioRun({
      uuid: "run-1", validation_challenge_id: "vch-1", contribution_id: "contrib-1",
      validator_user_id: "bob", global_feedback: null, completed_at: null, created_at: null,
    } as any);

    expect(run.completed_at).toBeNull();
    expect(run.global_feedback).toBeNull();
  });

  it("hydrates completed_at into a Date", () => {
    const when = new Date("2026-09-12T10:00:00Z");
    const run = toDomainValidationScenarioRun({
      uuid: "run-1", validation_challenge_id: "vch-1", contribution_id: "contrib-1",
      validator_user_id: "bob", global_feedback: "Usable end to end.", completed_at: when, created_at: when,
    } as any);

    expect(run.completed_at).toEqual(when);
    expect(run.global_feedback).toBe("Usable end to end.");
  });

  it("never writes global_feedback or completed_at at insert time — a run is born a draft", () => {
    const row = toDbValidationScenarioRun({
      validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "bob",
    });

    expect(row).toEqual({
      validation_challenge_id: "vch-1", contribution_id: "contrib-1", validator_user_id: "bob",
    });
  });
});

describe("step feedback mappers", () => {
  it("narrows result to the ScenarioStepResult union", () => {
    const feedback = toDomainValidationStepFeedback({
      uuid: "fb-1", run_id: "run-1", step_id: "step-1",
      result: "blocked", comment: "The save button does nothing.",
      medical_comment: null, created_at: null,
    } as any);

    expect(feedback.result).toBe("blocked");
    expect(feedback.medical_comment).toBeNull();
  });

  it("carries both lenses at once — the medical comment is alongside the comment, not instead of it", () => {
    const row = toDbValidationStepFeedback({
      run_id: "run-1", step_id: "step-1", result: "failed",
      comment: "The PDF opens blank.",
      medical_comment: "A measurement without its unit is not a clinical record.",
    });

    expect(row.comment).toBe("The PDF opens blank.");
    expect(row.medical_comment).toBe("A measurement without its unit is not a clinical record.");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run packages/database-service/db/mappers.scenario.test.ts`
Expected: FAIL — `No "toDomainValidationScenarioStep" export is defined on the "./mappers.js" mock` / import resolution error, because none of the six functions exist yet.

- [ ] **Step 7: Write the mappers**

In `packages/database-service/db/mappers.ts`: add the three tables to the existing `import { ... } from "./drizzle"` list and the three entity types to the existing `import type { ... } from "../domain/entities"` list, then append after `toDbValidationAttempt`:

```ts
type DbValidationScenarioStep = InferSelectModel<typeof validation_scenario_steps>;
type DbValidationScenarioRun = InferSelectModel<typeof validation_scenario_runs>;
type DbValidationStepFeedback = InferSelectModel<typeof validation_step_feedbacks>;

export function toDomainValidationScenarioStep(row: DbValidationScenarioStep): ValidationScenarioStep {
  return {
    uuid: row.uuid,
    validation_challenge_id: row.validation_challenge_id,
    position: row.position ?? 0,
    title: row.title,
    instructions: row.instructions ?? null,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbValidationScenarioStep(
  entity: Omit<ValidationScenarioStep, "uuid" | "created_at">
): typeof validation_scenario_steps.$inferInsert {
  return {
    validation_challenge_id: entity.validation_challenge_id,
    position: entity.position ?? 0,
    title: entity.title,
    instructions: entity.instructions ?? null,
  };
}

export function toDomainValidationScenarioRun(row: DbValidationScenarioRun): ValidationScenarioRun {
  return {
    uuid: row.uuid,
    validation_challenge_id: row.validation_challenge_id,
    contribution_id: row.contribution_id,
    validator_user_id: row.validator_user_id,
    global_feedback: row.global_feedback ?? null,
    completed_at: row.completed_at ? new Date(row.completed_at) : null,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

// global_feedback et completed_at ne sont volontairement pas dans le insert :
// une run naît brouillon, et seul `complete()` les écrit — en une update
// gardée sur `completed_at IS NULL`, qui est le vrai garde-fou anti-double-paiement.
export function toDbValidationScenarioRun(
  entity: Omit<ValidationScenarioRun, "uuid" | "created_at" | "global_feedback" | "completed_at">
): typeof validation_scenario_runs.$inferInsert {
  return {
    validation_challenge_id: entity.validation_challenge_id,
    contribution_id: entity.contribution_id,
    validator_user_id: entity.validator_user_id,
  };
}

export function toDomainValidationStepFeedback(row: DbValidationStepFeedback): ValidationStepFeedback {
  return {
    uuid: row.uuid,
    run_id: row.run_id,
    step_id: row.step_id,
    result: row.result as ScenarioStepResult,
    comment: row.comment ?? null,
    medical_comment: row.medical_comment ?? null,
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbValidationStepFeedback(
  entity: Omit<ValidationStepFeedback, "uuid" | "created_at">
): typeof validation_step_feedbacks.$inferInsert {
  return {
    run_id: entity.run_id,
    step_id: entity.step_id,
    result: entity.result,
    comment: entity.comment ?? null,
    medical_comment: entity.medical_comment ?? null,
  };
}
```

`ScenarioStepResult` must be added to the `import type { ... }` list too.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run packages/database-service/db/mappers.scenario.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 9: Write `ScenarioStepRepository`**

Create `packages/database-service/repositories/scenarioStep.repo.ts`:

```ts
import { db } from "../db/drizzle";
import { validation_scenario_steps } from "../db/drizzle";
import { eq } from "drizzle-orm";
import { toDomainValidationScenarioStep, toDbValidationScenarioStep } from "../db/mappers";
import type { ValidationScenarioStep } from "../domain/entities";
import { validationScenarioStepSchema } from "../domain/schemas_zod";

export class ScenarioStepRepository {
  /** Le scénario dans l'ordre. `created_at` départage deux étapes de même position. */
  async findByChallenge(validationChallengeId: string): Promise<ValidationScenarioStep[]> {
    const rows = await db
      .select()
      .from(validation_scenario_steps)
      .where(eq(validation_scenario_steps.validation_challenge_id, validationChallengeId))
      .orderBy(validation_scenario_steps.position, validation_scenario_steps.created_at);
    return rows.map(toDomainValidationScenarioStep);
  }

  async findById(uuid: string): Promise<ValidationScenarioStep | null> {
    const [row] = await db.select().from(validation_scenario_steps).where(eq(validation_scenario_steps.uuid, uuid));
    return row ? toDomainValidationScenarioStep(row) : null;
  }

  async create(entity: Omit<ValidationScenarioStep, "uuid" | "created_at">): Promise<ValidationScenarioStep> {
    const validated = validationScenarioStepSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [row] = await db
      .insert(validation_scenario_steps)
      .values(toDbValidationScenarioStep(validated))
      .returning();
    return toDomainValidationScenarioStep(row);
  }

  async update(
    uuid: string,
    patch: Partial<Pick<ValidationScenarioStep, "title" | "instructions" | "position">>
  ): Promise<ValidationScenarioStep> {
    const [row] = await db
      .update(validation_scenario_steps)
      .set(patch)
      .where(eq(validation_scenario_steps.uuid, uuid))
      .returning();
    return toDomainValidationScenarioStep(row);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(validation_scenario_steps).where(eq(validation_scenario_steps.uuid, uuid));
  }
}
```

- [ ] **Step 10: Write `ScenarioRunRepository`**

Create `packages/database-service/repositories/scenarioRun.repo.ts`:

```ts
import { db } from "../db/drizzle";
import { validation_scenario_runs } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { toDomainValidationScenarioRun, toDbValidationScenarioRun } from "../db/mappers";
import type { ValidationScenarioRun } from "../domain/entities";

/** Code d'unicité que Postgres lève sur un doublon (challenge, contribution, validateur). */
const POSTGRES_UNIQUE_VIOLATION = "23505";

export class ScenarioRunRepository {
  /** Toutes les runs du challenge, plus ancienne d'abord — alimente la supervision et le gel du scénario. */
  async findByChallenge(validationChallengeId: string): Promise<ValidationScenarioRun[]> {
    const rows = await db
      .select()
      .from(validation_scenario_runs)
      .where(eq(validation_scenario_runs.validation_challenge_id, validationChallengeId))
      .orderBy(validation_scenario_runs.created_at);
    return rows.map(toDomainValidationScenarioRun);
  }

  async findById(uuid: string): Promise<ValidationScenarioRun | null> {
    const [row] = await db.select().from(validation_scenario_runs).where(eq(validation_scenario_runs.uuid, uuid));
    return row ? toDomainValidationScenarioRun(row) : null;
  }

  async findByChallengeAndValidator(
    validationChallengeId: string,
    validatorUserId: string
  ): Promise<ValidationScenarioRun[]> {
    const rows = await db
      .select()
      .from(validation_scenario_runs)
      .where(
        and(
          eq(validation_scenario_runs.validation_challenge_id, validationChallengeId),
          eq(validation_scenario_runs.validator_user_id, validatorUserId)
        )
      );
    return rows.map(toDomainValidationScenarioRun);
  }

  async findOne(
    validationChallengeId: string,
    contributionId: string,
    validatorUserId: string
  ): Promise<ValidationScenarioRun | null> {
    const [row] = await db
      .select()
      .from(validation_scenario_runs)
      .where(
        and(
          eq(validation_scenario_runs.validation_challenge_id, validationChallengeId),
          eq(validation_scenario_runs.contribution_id, contributionId),
          eq(validation_scenario_runs.validator_user_id, validatorUserId)
        )
      );
    return row ? toDomainValidationScenarioRun(row) : null;
  }

  /**
   * Renvoie null au lieu de lever sur un doublon — l'index unique est la
   * vraie garantie « une walkthrough par (validateur, application) » sous
   * requêtes concurrentes. Même contrat que ValidationAttemptRepository.create.
   */
  async create(
    entity: Omit<ValidationScenarioRun, "uuid" | "created_at" | "global_feedback" | "completed_at">
  ): Promise<ValidationScenarioRun | null> {
    try {
      const [row] = await db
        .insert(validation_scenario_runs)
        .values(toDbValidationScenarioRun(entity))
        .returning();
      return toDomainValidationScenarioRun(row);
    } catch (error: any) {
      // drizzle-orm emballe l'erreur pg dans DrizzleQueryError — le code vit
      // sur .cause, pas sur le wrapper.
      const code = error?.code ?? error?.cause?.code;
      if (code === POSTGRES_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  /**
   * Complète la walkthrough — mais seulement si elle est encore brouillon.
   * Renvoie null si une requête concurrente l'a complétée d'abord : c'est le
   * WHERE qui empêche de payer deux fois, pas un contrôle applicatif.
   */
  async complete(uuid: string, globalFeedback: string): Promise<ValidationScenarioRun | null> {
    const [row] = await db
      .update(validation_scenario_runs)
      .set({ global_feedback: globalFeedback, completed_at: new Date() })
      .where(and(eq(validation_scenario_runs.uuid, uuid), isNull(validation_scenario_runs.completed_at)))
      .returning();
    return row ? toDomainValidationScenarioRun(row) : null;
  }
}
```

- [ ] **Step 11: Write `StepFeedbackRepository`**

Create `packages/database-service/repositories/stepFeedback.repo.ts`:

```ts
import { db } from "../db/drizzle";
import { validation_step_feedbacks } from "../db/drizzle";
import { eq, inArray } from "drizzle-orm";
import { toDomainValidationStepFeedback } from "../db/mappers";
import type { ValidationStepFeedback } from "../domain/entities";

export class StepFeedbackRepository {
  async findByRun(runId: string): Promise<ValidationStepFeedback[]> {
    const rows = await db
      .select()
      .from(validation_step_feedbacks)
      .where(eq(validation_step_feedbacks.run_id, runId));
    return rows.map(toDomainValidationStepFeedback);
  }

  /** Une seule requête pour la supervision, qui affiche toutes les runs du challenge d'un coup. */
  async findByRuns(runIds: string[]): Promise<ValidationStepFeedback[]> {
    if (runIds.length === 0) return [];
    const rows = await db
      .select()
      .from(validation_step_feedbacks)
      .where(inArray(validation_step_feedbacks.run_id, runIds));
    return rows.map(toDomainValidationStepFeedback);
  }

  /**
   * Upsert sur (run_id, step_id) : le validateur peut revenir sur une étape
   * tant que la walkthrough est brouillon, et chaque passage réécrit la même
   * ligne. Le PUT porte l'état complet du panneau d'étape — un champ absent
   * vaut vide, jamais « garde l'ancienne valeur » — donc un seul statement
   * suffit, sans lecture préalable.
   */
  async upsert(entity: Omit<ValidationStepFeedback, "uuid" | "created_at">): Promise<ValidationStepFeedback> {
    const [row] = await db
      .insert(validation_step_feedbacks)
      .values({
        run_id: entity.run_id,
        step_id: entity.step_id,
        result: entity.result,
        comment: entity.comment ?? null,
        medical_comment: entity.medical_comment ?? null,
      })
      .onConflictDoUpdate({
        target: [validation_step_feedbacks.run_id, validation_step_feedbacks.step_id],
        set: {
          result: entity.result,
          comment: entity.comment ?? null,
          medical_comment: entity.medical_comment ?? null,
        },
      })
      .returning();
    return toDomainValidationStepFeedback(row);
  }
}
```

- [ ] **Step 12: Export the three repositories**

Append to `packages/database-service/repositories/index.ts`, next to the other validation exports:

```ts
export { ScenarioStepRepository } from "./scenarioStep.repo.js";
export { ScenarioRunRepository } from "./scenarioRun.repo.js";
export { StepFeedbackRepository } from "./stepFeedback.repo.js";
```

- [ ] **Step 13: Add the tables to `scripts/db-apply-schema.ts`**

Append to the `STATEMENTS` array, just before the closing `];`. Without this the tables never reach production — `docs/deployment.md` is explicit that the `postdeploy` hook does not run `drizzle-kit push`.

```ts
  // --- Challenges de validation en mode scénario (source = challenge `code`) ---
  // Le mode n'est pas stocké : il se déduit du type du challenge source. Ces
  // trois tables ne portent donc aucune colonne de mode.
  {
    label: "validation_scenario_steps",
    sql: `
      CREATE TABLE IF NOT EXISTS validation_scenario_steps (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        validation_challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        position integer NOT NULL DEFAULT 0,
        title varchar(255) NOT NULL,
        instructions text,
        created_at timestamp DEFAULT now()
      )`,
  },
  {
    label: "idx_validation_scenario_steps_challenge_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_scenario_steps_challenge_id ON validation_scenario_steps (validation_challenge_id, position)`,
  },
  {
    label: "validation_scenario_runs",
    sql: `
      CREATE TABLE IF NOT EXISTS validation_scenario_runs (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        validation_challenge_id uuid NOT NULL REFERENCES challenges(uuid) ON DELETE CASCADE,
        contribution_id uuid NOT NULL REFERENCES contributions(uuid) ON DELETE CASCADE,
        validator_user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
        global_feedback text,
        completed_at timestamp,
        created_at timestamp DEFAULT now()
      )`,
  },
  {
    label: "idx_validation_scenario_runs_challenge_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_scenario_runs_challenge_id ON validation_scenario_runs (validation_challenge_id)`,
  },
  {
    label: "idx_validation_scenario_runs_validator_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_scenario_runs_validator_id ON validation_scenario_runs (validator_user_id)`,
  },
  // Porte la garantie « une walkthrough par (validateur, application) », donc
  // « cp_per_validation payé une fois ». C'est la base qui l'applique, pas
  // l'application : deux requêtes concurrentes se départagent ici.
  {
    label: "idx_validation_scenario_runs_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_scenario_runs_unique ON validation_scenario_runs (validation_challenge_id, contribution_id, validator_user_id)`,
  },
  {
    label: "validation_step_feedbacks",
    sql: `
      CREATE TABLE IF NOT EXISTS validation_step_feedbacks (
        uuid uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id uuid NOT NULL REFERENCES validation_scenario_runs(uuid) ON DELETE CASCADE,
        step_id uuid NOT NULL REFERENCES validation_scenario_steps(uuid) ON DELETE CASCADE,
        result varchar(10) NOT NULL,
        comment text,
        medical_comment text,
        created_at timestamp DEFAULT now()
      )`,
  },
  {
    label: "idx_validation_step_feedbacks_run_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_validation_step_feedbacks_run_id ON validation_step_feedbacks (run_id)`,
  },
  // La cible du ON CONFLICT de StepFeedbackRepository.upsert.
  {
    label: "idx_validation_step_feedbacks_unique",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_validation_step_feedbacks_unique ON validation_step_feedbacks (run_id, step_id)`,
  },
```

- [ ] **Step 14: Apply the schema locally and type-check**

Run: `npm run db:apply-schema`
Expected: the ten new labels print with a `✓`, and re-running prints them again with no error (every statement is `IF NOT EXISTS`).

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add packages/database-service scripts/db-apply-schema.ts
git commit -m "feat(validation): give a scenario walkthrough its own three tables"
```

---

### Task 2: The derived mode, and creating a validation challenge over a `code` challenge

**Files:**
- Create: `packages/services/challenge/validation-mode.ts`
- Test: `packages/services/challenge/validation-mode.test.ts`
- Modify: `packages/services/challenge/index.ts` (add the re-export next to the others)
- Modify: `apps/leaderboard-client/src/app/api/challenges/route.ts:108-132` (the `if (validated.type === 'validation')` block)
- Test: `apps/leaderboard-client/src/app/api/challenges/route.test.ts:215-280` (the `validation challenge business rules` describe block)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `type ValidationMode = 'reference_case' | 'scenario'`
  - `validationModeFor(sourceChallengeType: string | null | undefined): ValidationMode | null`
  - `TARGET_CONTRIBUTION_TYPE: Record<ValidationMode, string>` — `{ reference_case: 'api_packaging', scenario: 'project' }`
  - `VALIDATION_SOURCE_TYPES: readonly string[]` — `['ml', 'code']`

- [ ] **Step 1: Write the failing test for the mode helper**

Create `packages/services/challenge/validation-mode.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validationModeFor, TARGET_CONTRIBUTION_TYPE, VALIDATION_SOURCE_TYPES } from "./validation-mode.js";

describe("validationModeFor", () => {
  it("reads an ml source challenge as the reference-case flow", () => {
    expect(validationModeFor("ml")).toBe("reference_case");
  });

  it("reads a code source challenge as the scenario flow", () => {
    expect(validationModeFor("code")).toBe("scenario");
  });

  it("returns null rather than guessing when there is no source challenge", () => {
    // Volontairement null et non 'reference_case' : un défaut ferait tomber
    // silencieusement un challenge mal câblé dans le flux ML, où il
    // proposerait des cas de référence qui n'existent pas.
    expect(validationModeFor(null)).toBeNull();
    expect(validationModeFor(undefined)).toBeNull();
  });

  it("returns null for a source type that is neither ml nor code", () => {
    expect(validationModeFor("validation")).toBeNull();
  });
});

describe("TARGET_CONTRIBUTION_TYPE", () => {
  it("targets api_packaging submissions in reference-case mode and project deliverables in scenario mode", () => {
    expect(TARGET_CONTRIBUTION_TYPE.reference_case).toBe("api_packaging");
    expect(TARGET_CONTRIBUTION_TYPE.scenario).toBe("project");
  });
});

describe("VALIDATION_SOURCE_TYPES", () => {
  it("lists exactly the challenge types a validation challenge may source", () => {
    expect([...VALIDATION_SOURCE_TYPES]).toEqual(["ml", "code"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/services/challenge/validation-mode.test.ts`
Expected: FAIL — cannot resolve `./validation-mode.js`.

- [ ] **Step 3: Write the mode helper**

Create `packages/services/challenge/validation-mode.ts`:

```ts
/**
 * De quel côté du challenge de validation on se trouve.
 *
 * Le mode n'est PAS stocké. Il se déduit du type du challenge source à chaque
 * lecture : `source_challenge_id` qui pointe un challenge `ml` veut dire flux
 * cas de référence, un challenge `code` veut dire flux scénario. Une colonne
 * `validation_mode` serait une seconde source de vérité qui peut dériver de
 * la première — donc une source de bugs impossibles à diagnostiquer.
 */
export type ValidationMode = 'reference_case' | 'scenario';

/** Les types de challenge qu'un challenge de validation peut adosser. */
export const VALIDATION_SOURCE_TYPES = ['ml', 'code'] as const;

/**
 * Le type de contribution exposable comme cible, par mode. En ML c'est le
 * packaging d'API du contributeur ; en scénario c'est son livrable `project`,
 * que l'équipe a déployé à la main.
 */
export const TARGET_CONTRIBUTION_TYPE: Record<ValidationMode, string> = {
  reference_case: 'api_packaging',
  scenario: 'project',
};

/**
 * Renvoie null — plutôt qu'un mode par défaut — quand le challenge source
 * n'existe pas ou n'est ni `ml` ni `code`. Un défaut ferait tomber un
 * challenge mal câblé dans le flux ML, où il proposerait un parcours de cas
 * de référence qui n'a jamais été écrit. L'appelant doit décider quoi
 * répondre (400 dans toutes les routes de ce plan).
 */
export function validationModeFor(sourceChallengeType: string | null | undefined): ValidationMode | null {
  if (sourceChallengeType === 'code') return 'scenario';
  if (sourceChallengeType === 'ml') return 'reference_case';
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/services/challenge/validation-mode.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Re-export from the challenge services barrel**

Add to `packages/services/challenge/index.ts`, following whatever export style the neighbouring lines use:

```ts
export { validationModeFor, TARGET_CONTRIBUTION_TYPE, VALIDATION_SOURCE_TYPES } from "./validation-mode.js";
export type { ValidationMode } from "./validation-mode.js";
```

- [ ] **Step 6: Rewrite the two creation-route tests that assume an `ml` source, and add the new cases**

In `apps/leaderboard-client/src/app/api/challenges/route.test.ts`, inside `describe('validation challenge business rules')`:

**Replace** this existing test — a `code` source is now the whole point of the feature, so the assertion inverts:

```ts
    it('rejects a source_challenge_id that does not reference an ML challenge', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'code' });

      const res = await postChallenge(validationBody(), 'valid-token');

      expect(res.status).toBe(400);
    });
```

**with** these four:

```ts
    it('accepts a code source challenge — the scenario flow', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'code' });

      const res = await postChallenge(
        validationBody({ required_validations: undefined }),
        'valid-token'
      );

      expect(res.status).toBe(201);
    });

    it('stores required_validations as null for a code source — nothing resolves in scenario mode', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'code' });

      await postChallenge(validationBody({ required_validations: 3 }), 'valid-token');

      // Même envoyé par un client obsolète, le champ ne doit pas être écrit :
      // il n'a aucun sens sans quorum, et une valeur non nulle en base
      // laisserait croire qu'un target peut se résoudre.
      expect(mockChallengeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ required_validations: null })
      );
    });

    it('rejects a source_challenge_id that is neither an ml nor a code challenge', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'validation' });

      const res = await postChallenge(validationBody(), 'valid-token');

      expect(res.status).toBe(400);
    });

    it('still requires an odd required_validations when the source is an ML challenge', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'ml' });

      const res = await postChallenge(validationBody({ required_validations: 4 }), 'valid-token');

      expect(res.status).toBe(400);
    });
```

Also **replace** the existing `it('requires required_validations', ...)` so it states which mode it is about:

```ts
    it('requires required_validations when the source is an ML challenge', async () => {
      const res = await postChallenge(validationBody({ required_validations: undefined }), 'valid-token');
      expect(res.status).toBe(400);
    });
```

And add one case guarding the 1:1 rule across both modes:

```ts
    it('returns 409 when the code challenge already has a linked validation challenge', async () => {
      mockChallengeFindById.mockResolvedValue({ uuid: mlSourceId, type: 'code' });
      mockChallengeFindAll.mockResolvedValue([
        { uuid: 'existing-validation', type: 'validation', source_challenge_id: mlSourceId },
      ]);

      const res = await postChallenge(validationBody({ required_validations: undefined }), 'valid-token');

      expect(res.status).toBe(409);
    });
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `cd apps/leaderboard-client && npx vitest run src/app/api/challenges/route.test.ts`
Expected: FAIL — the `code` source cases get 400 (`source_challenge_id must reference an ML challenge`), and the "stores required_validations as null" case gets `3`.

- [ ] **Step 8: Make the creation route mode-aware**

In `apps/leaderboard-client/src/app/api/challenges/route.ts`, add the import:

```ts
import { validationModeFor } from '../../../../../packages/services/challenge/validation-mode';
```

Replace the whole `if (validated.type === 'validation') { ... }` block (lines 108-132) with:

```ts
    // Le mode se déduit du type du challenge source, il ne se stocke pas :
    // `ml` -> flux cas de référence, `code` -> flux scénario. Les règles
    // communes (source obligatoire, CP par validation, 1:1) valent dans les
    // deux ; le quorum n'existe que côté ML.
    let validationMode: ReturnType<typeof validationModeFor> = null;
    if (validated.type === 'validation') {
      if (!validated.source_challenge_id) {
        return NextResponse.json({ error: 'source_challenge_id is required for validation challenges' }, { status: 400 });
      }
      if (!validated.cp_per_validation) {
        return NextResponse.json({ error: 'cp_per_validation is required for validation challenges' }, { status: 400 });
      }

      const source = await challengeRepo.findById(validated.source_challenge_id);
      validationMode = validationModeFor(source?.type);
      if (!validationMode) {
        return NextResponse.json(
          { error: 'source_challenge_id must reference an ML or a Code challenge' },
          { status: 400 }
        );
      }

      // Le quorum n'a de sens que face à un endpoint qui répond works/broken.
      // En mode scénario chaque walkthrough complétée paie, il n'y a rien à
      // résoudre — le champ n'est donc ni demandé ni écrit.
      if (validationMode === 'reference_case') {
        if (!validated.required_validations) {
          return NextResponse.json({ error: 'required_validations is required for validation challenges' }, { status: 400 });
        }
        if (validated.required_validations % 2 === 0) {
          return NextResponse.json({ error: 'required_validations must be odd' }, { status: 400 });
        }
      }

      const allChallenges = await challengeRepo.findAll();
      const alreadyLinked = allChallenges.some(
        c => c.type === 'validation' && c.source_challenge_id === validated.source_challenge_id
      );
      if (alreadyLinked) {
        return NextResponse.json({ error: 'This challenge already has a validation challenge' }, { status: 409 });
      }
    }
```

Then, in the `challengeRepo.create({ ... })` call below, replace the `required_validations` line:

```ts
      required_validations: validationMode === 'reference_case' ? validated.required_validations : null,
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd apps/leaderboard-client && npx vitest run src/app/api/challenges/route.test.ts`
Expected: PASS — the whole file, including the pre-existing ML cases.

- [ ] **Step 10: Commit**

```bash
git add packages/services/challenge/validation-mode.ts packages/services/challenge/validation-mode.test.ts packages/services/challenge/index.ts apps/leaderboard-client/src/app/api/challenges/route.ts apps/leaderboard-client/src/app/api/challenges/route.test.ts
git commit -m "feat(validation): let a validation challenge answer for a code challenge"
```

---

### Task 3: The creation forms offer a code source challenge

**Files:**
- Modify: `apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx` (state around line 136, the fetch around line 248-257, the request body around line 390-392, the fields around line 735-798)
- Modify: `apps/leaderboard-client/src/components/admin/ChallengeForm.tsx` (state around line 40-42, the payload around line 62-70, the fields around line 195-255)

**Interfaces:**
- Consumes: `validationModeFor` from Task 2 — but **do not import it into a client component**; `packages/services/challenge/validation-mode.ts` pulls no server-only module today, yet importing across that boundary from a `'use client'` file is not a pattern this codebase uses. Derive the mode inline from the selected source challenge's `type`, which the form already has in local state.
- Produces: a validation challenge whose `source_challenge_id` may be a `code` challenge, and which omits `required_validations` in that case.

- [ ] **Step 1: Widen the source-challenge fetch in `CreateChallengeDrawer`**

Replace the `mlChallenges` state (line 136) with a list that keeps the type:

```ts
  const [sourceChallenges, setSourceChallenges] = useState<{ id: string; title: string; type: string }[]>([]);
```

Replace the fetch effect body (lines 250-257):

```ts
    // Sert seulement au sélecteur de challenge source d'un challenge de
    // validation — inaccessible en édition comme en promotion. `ml` et `code`
    // sont tous deux adossables : le type retenu décide du mode (cas de
    // référence vs scénario), qui n'est jamais stocké.
    if (!open || typeLocked) return;
    fetch('/api/challenges')
      .then(r => r.ok ? r.json() : [])
      .then((all: any[]) => setSourceChallenges(
        (Array.isArray(all) ? all : [])
          .filter(c => c.type === 'ml' || c.type === 'code')
          .map(c => ({ id: c.uuid, title: c.title, type: c.type }))
      ))
      .catch(() => {});
  }, [open, typeLocked]);
```

- [ ] **Step 2: Derive the mode in the component body**

Add next to the other derived values in the render body (before the `return`):

```ts
  // Le mode se lit sur le type du challenge source sélectionné, exactement
  // comme le fait l'API. Rien à stocker, rien à synchroniser.
  const sourceChallenge = sourceChallenges.find(c => c.id === sourceChallengeId);
  const isScenarioMode = sourceChallenge?.type === 'code';
```

- [ ] **Step 3: Update the source-challenge field**

Replace the `{/* ── Validation: source challenge ── */}` block's label and body so it names both types and says what the choice decides:

```tsx
          {/* ── Validation: source challenge (creation only, locked after) ── */}
          {type === 'validation' && (
            <Field icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Source challenge">
              {isEdit ? (
                <LockedValue text={sourceChallenges.find(c => c.id === sourceChallengeId)?.title ?? 'Source challenge'} />
              ) : (
                <>
                  <SelectDropdown
                    options={sourceChallenges.map(c => ({
                      value: c.id,
                      label: `${c.title} · ${c.type === 'ml' ? 'ML' : 'Code'}`,
                    }))}
                    value={sourceChallengeId}
                    onChange={setSourceChallengeId}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: fgAt(0.25) }}>
                    {isScenarioMode
                      ? 'A Code challenge: validators walk a scenario through each deployed application.'
                      : 'An ML challenge: validators test each endpoint against a ground-truth reference case.'}
                    {' '}Only challenges without a validation challenge yet will actually save - the API rejects duplicates.
                  </p>
                </>
              )}
            </Field>
          )}
```

- [ ] **Step 4: Hide `required_validations` in scenario mode**

Change the guard on the `{/* ── Validation: required validations ── */}` block from `{type === 'validation' && (` to:

```tsx
          {/* ── Validation: required validations (ML source only — no quorum in scenario mode) ── */}
          {type === 'validation' && !isScenarioMode && (
```

- [ ] **Step 5: Stop sending `required_validations` in scenario mode**

In the request body (line 392):

```ts
                    required_validations: type === 'validation' && !isScenarioMode ? requiredValidations : undefined,
```

- [ ] **Step 6: Apply the same three changes to `ChallengeForm.tsx`**

`ChallengeForm` is the older `/admin/challenges` form and duplicates these fields. Mirror Steps 1-5 in it: keep the type alongside each source challenge, derive `isScenarioMode` the same way, label the field "Source challenge", and gate both the `required_validations` input and its slot in the payload (line 69) on `!isScenarioMode`.

- [ ] **Step 7: Type-check**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors. In particular, no remaining reference to `mlChallenges`.

- [ ] **Step 8: Verify by hand**

Run: `npm run dev`, open `/admin/challenges`, create a `validation` challenge and pick a `code` challenge as its source. Expected: the **Required validations** field disappears the moment a Code source is selected, the helper line switches to the scenario wording, and saving succeeds.

- [ ] **Step 9: Commit**

```bash
git add apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx apps/leaderboard-client/src/components/admin/ChallengeForm.tsx
git commit -m "feat(validation): offer a code challenge as a validation source"
```

---

### Task 4: Exposing an application — `validation-targets` becomes mode-aware

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts`
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.test.ts`

**Interfaces:**
- Consumes: `validationModeFor`, `TARGET_CONTRIBUTION_TYPE` (Task 2); `ScenarioRunRepository` (Task 1).
- Produces the `GET` response shape every later UI task reads:

```ts
{
  currentUserId: string | null,
  mode: 'reference_case' | 'scenario' | null,
  pool: { pool: number, distributed: number, remaining: number, cpPerValidation: number, requiredValidations: number },
  targets: Array<{
    id: string,
    contributionId: string,
    submitterUserId: string | null,
    submitterName: string,
    submitterAvatarUrl: string | null,
    endpointUrl: string | null,              // NEW — the validator's browser needs it
    alreadyValidatedByMe: boolean,
    verdictCount: number,
    outcome: 'pending' | 'works' | 'broken',
    resolvedAt: string | null,
    myOpenClaims: Array<{ id: string, observed: boolean, revealed: boolean }>,  // [] in scenario mode
    walkthroughCount?: number,               // scenario mode only
    myWalkthrough?: { runId: string, completedAt: string | null } | null,       // scenario mode only
    worksCount?: number, brokenCount?: number,  // manager only, reference-case mode only
  }>,
}
```

`POST` is unchanged in shape; only which contribution types it accepts changes.

- [ ] **Step 1: Write the failing tests**

Append to `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.test.ts`. The existing `vi.mock` of the repositories barrel must first gain the new repository — add to the hoisted mocks `mockScenarioRunFindByChallenge: vi.fn()` and `mockScenarioRunFindByChallengeAndValidator: vi.fn()`, add to the barrel mock:

```ts
  ScenarioRunRepository: class {
    findByChallenge = mockScenarioRunFindByChallenge;
    findByChallengeAndValidator = mockScenarioRunFindByChallengeAndValidator;
  },
```

and default both to `[]` in `beforeEach`. Then add:

```ts
describe('scenario mode (source challenge is a code challenge)', () => {
  const CODE_SOURCE_ID = 'code-challenge-1';
  const SCENARIO_CHALLENGE = {
    uuid: CHALLENGE_ID, type: 'validation', contribution_points_reward: 12000,
    cp_per_validation: 200, required_validations: null, source_challenge_id: CODE_SOURCE_ID,
  };

  beforeEach(() => {
    mockChallengeFindById.mockImplementation(async (id: string) =>
      id === CHALLENGE_ID ? SCENARIO_CHALLENGE : { uuid: CODE_SOURCE_ID, type: 'code' }
    );
    mockGetSessionUser.mockResolvedValue({ id: 'validator-1', role: 'contributor' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    mockRewardSumByChallenge.mockResolvedValue(2600);
    mockUserFindByIds.mockResolvedValue([]);
  });

  it('publishes the derived mode so the client picks the right flow', async () => {
    mockTargetFindByChallenge.mockResolvedValue([]);

    const body = await (await getTargets()).json();

    expect(body.mode).toBe('scenario');
  });

  it('lists the source challenge project contributions as eligible, not its api_packaging ones', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockContributionFindByChallenge.mockResolvedValue([
      { uuid: 'proj-1', type: 'project', user_id: 'alice' },
      { uuid: 'pack-1', type: 'api_packaging', user_id: 'bob' },
    ]);
    mockTargetFindByChallenge.mockResolvedValue([]);
    mockUserFindByIds.mockResolvedValue([{ uuid: 'alice', full_name: 'Alice' }]);

    const body = await (await getTargets('?eligible=true')).json();

    expect(body.eligible).toHaveLength(1);
    expect(body.eligible[0].contributionId).toBe('proj-1');
  });

  it('publishes each exposed application endpoint — the validator browser is what loads it', async () => {
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 'target-1', contribution_id: CONTRIBUTION_ID, outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue({
      uuid: CONTRIBUTION_ID, user_id: 'alice', type: 'project',
      live_endpoint_url: 'https://val-a.patient-record.mytwin.dev',
    });

    const body = await (await getTargets()).json();

    expect(body.targets[0].endpointUrl).toBe('https://val-a.patient-record.mytwin.dev');
  });

  it('reports my own draft walkthrough so the client can offer Resume instead of Start', async () => {
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 'target-1', contribution_id: CONTRIBUTION_ID, outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'alice', type: 'project' });
    mockScenarioRunFindByChallengeAndValidator.mockResolvedValue([
      { uuid: 'run-1', contribution_id: CONTRIBUTION_ID, completed_at: null },
    ]);
    mockScenarioRunFindByChallenge.mockResolvedValue([
      { uuid: 'run-1', contribution_id: CONTRIBUTION_ID, completed_at: null },
      { uuid: 'run-2', contribution_id: CONTRIBUTION_ID, completed_at: new Date('2026-09-10') },
    ]);

    const body = await (await getTargets()).json();

    expect(body.targets[0].myWalkthrough).toEqual({ runId: 'run-1', completedAt: null });
    expect(body.targets[0].walkthroughCount).toBe(2);
  });

  it('returns null myWalkthrough when I have never started', async () => {
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 'target-1', contribution_id: CONTRIBUTION_ID, outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'alice', type: 'project' });

    const body = await (await getTargets()).json();

    expect(body.targets[0].myWalkthrough).toBeNull();
  });

  it('never queries reference-case claims in scenario mode', async () => {
    mockTargetFindByChallenge.mockResolvedValue([
      { uuid: 'target-1', contribution_id: CONTRIBUTION_ID, outcome: 'pending', resolved_at: null },
    ]);
    mockContributionFindById.mockResolvedValue({ uuid: CONTRIBUTION_ID, user_id: 'alice', type: 'project' });

    await getTargets();

    // Il n'y a pas de cas de référence en mode scénario : interroger la table
    // serait une requête par cible pour un résultat toujours vide.
    expect(mockCaseClaimFindByValidatorAndTarget).not.toHaveBeenCalled();
  });

  it('exposes a project contribution and records its URL', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockContributionFindById.mockResolvedValue({
      uuid: CONTRIBUTION_ID, challenge_id: CODE_SOURCE_ID, type: 'project', user_id: 'alice',
    });
    mockTargetFindByChallengeAndContribution.mockResolvedValue(null);
    mockAssertPublicHttpUrl.mockResolvedValue(undefined);
    mockTargetCreate.mockResolvedValue({ uuid: 'target-1' });

    const res = await postTarget({
      contribution_id: CONTRIBUTION_ID,
      live_endpoint_url: 'https://val-a.patient-record.mytwin.dev',
    });

    expect(res.status).toBe(201);
    expect(mockContributionUpdate).toHaveBeenCalledWith(CONTRIBUTION_ID, {
      live_endpoint_url: 'https://val-a.patient-record.mytwin.dev',
    });
  });

  it('refuses to expose an api_packaging contribution when the source is a code challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockContributionFindById.mockResolvedValue({
      uuid: CONTRIBUTION_ID, challenge_id: CODE_SOURCE_ID, type: 'api_packaging', user_id: 'alice',
    });

    const res = await postTarget({
      contribution_id: CONTRIBUTION_ID,
      live_endpoint_url: 'https://val-a.patient-record.mytwin.dev',
    });

    expect(res.status).toBe(400);
  });

  it('still SSRF-guards the URL at exposure time', async () => {
    // Le garde ne protège plus un appel serveur — il n'y en a plus — mais il
    // empêche de stocker un `javascript:` qu'on rendrait ensuite en lien, et
    // il attrape une adresse privée pendant que l'admin regarde encore le
    // formulaire.
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockContributionFindById.mockResolvedValue({
      uuid: CONTRIBUTION_ID, challenge_id: CODE_SOURCE_ID, type: 'project', user_id: 'alice',
    });
    mockTargetFindByChallengeAndContribution.mockResolvedValue(null);
    mockAssertPublicHttpUrl.mockRejectedValue(new Error('private address'));

    const res = await postTarget({
      contribution_id: CONTRIBUTION_ID,
      live_endpoint_url: 'http://192.168.0.10',
    });

    expect(res.status).toBe(400);
    expect(mockTargetCreate).not.toHaveBeenCalled();
  });
});
```

One pre-existing test needs a one-line fix: the `beforeEach` at the top sets `mockChallengeFindById.mockResolvedValue(VALIDATION_CHALLENGE)`, which would now also answer for the *source* challenge lookup and derive `mode: null`. Change it to an implementation that answers `{ uuid: 'ml-challenge-1', type: 'ml' }` for the source id:

```ts
  mockChallengeFindById.mockImplementation(async (id: string) =>
    id === CHALLENGE_ID ? VALIDATION_CHALLENGE : { uuid: 'ml-challenge-1', type: 'ml' }
  );
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-targets/route.test.ts"`
Expected: FAIL — `body.mode` is `undefined`, `endpointUrl` is `undefined`, the eligible list contains the `api_packaging` row, and the project POST returns 400.

- [ ] **Step 3: Make the route mode-aware**

In `apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets/route.ts`:

Add the imports and the repository instance:

```ts
import { validationModeFor, TARGET_CONTRIBUTION_TYPE } from '../../../../../../../../packages/services/challenge/validation-mode';
```

Add `ScenarioRunRepository` to the existing repositories import list and instantiate it next to the others:

```ts
const scenarioRunRepo = new ScenarioRunRepository();
```

Add a helper above `GET`:

```ts
/**
 * Le mode d'un challenge de validation, déduit du type de son challenge
 * source. Une requête de plus par appel, assumée : c'est le prix de ne pas
 * stocker une seconde source de vérité qui pourrait dériver.
 */
async function resolveMode(challenge: { source_challenge_id?: string | null }) {
  const source = challenge.source_challenge_id
    ? await challengeRepo.findById(challenge.source_challenge_id)
    : null;
  return validationModeFor(source?.type);
}
```

In `GET`, right after the `challenge.type !== 'validation'` guard:

```ts
    const mode = await resolveMode(challenge);
```

In the `?eligible=true` branch, replace the filter:

```ts
      // `api_packaging` quand la source est un challenge ML, `project` quand
      // c'est un challenge code : dans les deux cas, le livrable que l'équipe
      // a déployé et qu'un validateur va éprouver.
      const eligibleType = mode ? TARGET_CONTRIBUTION_TYPE[mode] : null;
      const eligible = eligibleType
        ? sourceContribs.filter(c => c.type === eligibleType && !targetedContributionIds.has(c.uuid))
        : [];
```

In the main branch, replace the `myAttempts` / `attemptsByTarget` / `myOpenClaimsByTarget` block with a mode split. Reference-case mode keeps exactly today's queries; scenario mode runs two cheap ones instead:

```ts
    const session = await getSessionUser();
    const isManager = session
      ? session.role === 'admin' || (await isManagerOfChallenge(session.id, challengeId))
      : false;

    const isScenario = mode === 'scenario';

    // Mode scénario : pas de verdict, pas de cas de référence, donc aucune des
    // requêtes du flux ML. Deux lectures suffisent — toutes les runs du
    // challenge (le compte par application) et les miennes (mon état).
    const [allRuns, myRuns] = isScenario
      ? await Promise.all([
          scenarioRunRepo.findByChallenge(challengeId),
          session ? scenarioRunRepo.findByChallengeAndValidator(challengeId, session.id) : Promise.resolve([]),
        ])
      : [[], []];

    const myAttempts = !isScenario && session
      ? await attemptRepo.findByChallengeAndValidator(challengeId, session.id)
      : [];
    const validatedContributionIds = new Set(myAttempts.map(a => a.contribution_id));

    const attemptsByTarget = isScenario
      ? targets.map(() => [])
      : await Promise.all(
          targets.map(t => attemptRepo.findByChallengeAndContribution(challengeId, t.contribution_id))
        );

    const myOpenClaimsByTarget = !isScenario && session
      ? await Promise.all(
          targets.map(async t => {
            const claims = await caseClaimRepo.findByValidatorAndTarget(session.id, t.contribution_id);
            return claims
              .filter(c => !c.observed_at || !c.revealed_at)
              .map(c => ({ id: c.uuid, observed: !!c.observed_at, revealed: !!c.revealed_at }));
          })
        )
      : targets.map(() => []);
```

Then in the response, add `mode` at the top level and the three new per-target fields:

```ts
    return NextResponse.json({
      currentUserId: session?.id ?? null,
      mode,
      pool: { /* unchanged */ },
      targets: targets.map((t, i) => {
        const c = contributions[i];
        const submitter = c ? submittersById.get(c.user_id) : undefined;
        const attempts = attemptsByTarget[i];
        const worksCount = attempts.filter(a => a.verdict === 'works').length;
        const brokenCount = attempts.length - worksCount;
        const myRun = myRuns.find(r => r.contribution_id === t.contribution_id) ?? null;
        return {
          id: t.uuid,
          contributionId: t.contribution_id,
          submitterUserId: c?.user_id ?? null,
          submitterName: submitter?.full_name ?? 'Unknown',
          submitterAvatarUrl: submitter?.avatar_url ?? null,
          // Le navigateur du validateur est ce qui charge l'application, donc
          // l'URL doit sortir jusqu'au client. Elle a déjà passé
          // assertPublicHttpUrl à l'exposition.
          endpointUrl: c?.live_endpoint_url ?? null,
          alreadyValidatedByMe: validatedContributionIds.has(t.contribution_id),
          verdictCount: attempts.length,
          outcome: t.outcome,
          resolvedAt: t.resolved_at,
          myOpenClaims: myOpenClaimsByTarget[i],
          ...(isScenario ? {
            walkthroughCount: allRuns.filter(r => r.contribution_id === t.contribution_id).length,
            myWalkthrough: myRun ? { runId: myRun.uuid, completedAt: myRun.completed_at } : null,
          } : {}),
          // Le manager est le seul à voir le partage works/broken avant
          // résolution — et il n'existe pas en mode scénario.
          ...(isManager && !isScenario ? { worksCount, brokenCount } : {}),
        };
      }),
    });
```

In `POST`, replace the eligibility guard:

```ts
    const mode = await resolveMode(challenge);
    if (!mode) {
      return NextResponse.json(
        { error: 'This validation challenge has no ML or Code source challenge' },
        { status: 400 }
      );
    }
    const expectedType = TARGET_CONTRIBUTION_TYPE[mode];

    const contribution = await contributionRepo.findById(contribution_id);
    if (
      !contribution ||
      contribution.challenge_id !== challenge.source_challenge_id ||
      contribution.type !== expectedType
    ) {
      return NextResponse.json(
        { error: `Contribution is not an eligible ${expectedType} submission` },
        { status: 400 }
      );
    }
```

Everything below — the duplicate check, `assertPublicHttpUrl`, the `contributionRepo.update`, the `targetRepo.create` — stays byte for byte as it is. The SSRF guard is shared by both modes on purpose.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-targets/route.test.ts"`
Expected: PASS — the new `scenario mode` block **and** every pre-existing reference-case test.

- [ ] **Step 5: Run the neighbouring suites as a regression gate**

Run: `cd apps/leaderboard-client && npx vitest run src/app/api/challenges`
Expected: PASS. `validation-targets/[targetId]/route.test.ts` and `validation-verdicts/route.test.ts` must be untouched and green.

- [ ] **Step 6: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-targets"
git commit -m "feat(validation): expose a deployed application, not only a packaged endpoint"
```

---

### Task 5: `ScenarioStepsService` — authoring the scenario, and the freeze

**Files:**
- Create: `packages/services/challenge/scenario-errors.ts`
- Create: `packages/services/challenge/scenario-steps.service.ts`
- Test: `packages/services/challenge/scenario-steps.service.test.ts`
- Modify: `packages/services/challenge/index.ts`

**Interfaces:**
- Consumes: `ScenarioStepRepository`, `ScenarioRunRepository`, `ValidationScenarioStep` (Task 1); `validationModeFor` (Task 2).
- Produces:
  - `scenario-errors.ts`: `ScenarioModeError`, `ScenarioFrozenError`, `EmptyScenarioError`, `StepNotFoundError`, `RunNotFoundError`, `ForbiddenRunAccessError`, `SelfWalkthroughError`, `RunAlreadyCompletedError`, `IncompleteWalkthroughError` (carries `missingStepIds: string[]`), `GlobalFeedbackRequiredError`, `MedicalCommentForbiddenError`, `TargetNotExposedError`
  - `ScenarioStepsService` with `listSteps`, `addStep`, `editStep`, `removeStep` and the `ScenarioStepsDeps` interface

- [ ] **Step 1: Write the shared error classes**

Create `packages/services/challenge/scenario-errors.ts`. One file so every scenario route maps errors to statuses from one import, and the two services can throw each other's errors without a cycle.

```ts
/**
 * Les erreurs du flux scénario, partagées par ScenarioStepsService,
 * ScenarioWalkthroughService et les cinq routes qui les appellent.
 *
 * Regroupées ici pour deux raisons : les deux services lèvent des erreurs
 * communes (mode, étape introuvable), et chaque route veut une seule import
 * pour faire sa table erreur -> statut HTTP.
 */

/** Le challenge n'est pas un challenge de validation en mode scénario. -> 400 */
export class ScenarioModeError extends Error {}

/** Une walkthrough existe déjà : le scénario ne bouge plus. -> 409 */
export class ScenarioFrozenError extends Error {}

/** Aucune étape n'a encore été écrite : il n'y a rien à parcourir. -> 400 */
export class EmptyScenarioError extends Error {}

/** L'étape n'existe pas, ou pas sur ce challenge. -> 404 */
export class StepNotFoundError extends Error {}

/** La walkthrough n'existe pas, ou pas sur ce challenge. -> 404 */
export class RunNotFoundError extends Error {}

/** La walkthrough appartient à quelqu'un d'autre. -> 403 */
export class ForbiddenRunAccessError extends Error {}

/**
 * Le validateur essaie de parcourir sa propre application — en tant que
 * porteur ou en tant que membre du groupe. -> 403
 */
export class SelfWalkthroughError extends Error {}

/** Une walkthrough complétée est immuable. -> 409 */
export class RunAlreadyCompletedError extends Error {}

/** Le retour global est obligatoire à la complétion. -> 400 */
export class GlobalFeedbackRequiredError extends Error {}

/** Un non-medical_pro a envoyé un avis médical. -> 403 */
export class MedicalCommentForbiddenError extends Error {}

/** L'application n'est pas exposée sur ce challenge de validation. -> 400 */
export class TargetNotExposedError extends Error {}

/**
 * Il reste des étapes sans résultat. Porte leurs identifiants pour que le
 * client puisse allumer les points correspondants dans la barre de
 * progression, au lieu de laisser le validateur chercher. -> 400
 */
export class IncompleteWalkthroughError extends Error {
  constructor(message: string, readonly missingStepIds: string[]) {
    super(message);
  }
}
```

- [ ] **Step 2: Write the failing service test**

Create `packages/services/challenge/scenario-steps.service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

import { ScenarioStepsService } from "./scenario-steps.service.js";
import type { ScenarioStepsDeps } from "./scenario-steps.service.js";
import { ScenarioModeError, ScenarioFrozenError, StepNotFoundError } from "./scenario-errors.js";
import type { Challenge, ValidationScenarioStep, ValidationScenarioRun } from "../../database-service/domain/entities.js";

const VCH = "vch-1";
const CODE_SOURCE = "code-ch-1";

function makeStep(over: Partial<ValidationScenarioStep> = {}): ValidationScenarioStep {
  return {
    uuid: "step-1",
    validation_challenge_id: VCH,
    position: 0,
    title: "Create an account",
    instructions: null,
    created_at: new Date(),
    ...over,
  };
}

function makeDeps(opts: {
  sourceType?: string | null;
  steps?: ValidationScenarioStep[];
  runs?: ValidationScenarioRun[];
} = {}) {
  const steps = opts.steps ?? [];
  const updates: Array<{ uuid: string; patch: Partial<ValidationScenarioStep> }> = [];
  const created: Array<Omit<ValidationScenarioStep, "uuid" | "created_at">> = [];
  const deleted: string[] = [];

  const deps: ScenarioStepsDeps = {
    challengeRepo: {
      findById: vi.fn(async (id: string) => {
        if (id === VCH) {
          return {
            uuid: VCH, title: "Usability walkthrough", status: "active", type: "validation",
            contribution_points_reward: 12000, completion: 0, project_id: "proj-1",
            source_challenge_id: opts.sourceType === null ? null : CODE_SOURCE,
            cp_per_validation: 200, required_validations: null, compute_enabled: false,
          } as Challenge;
        }
        if (opts.sourceType === null) return null;
        return { uuid: CODE_SOURCE, type: opts.sourceType ?? "code" } as Challenge;
      }),
    },
    stepRepo: {
      findByChallenge: vi.fn(async () => steps),
      findById: vi.fn(async (uuid: string) => steps.find(s => s.uuid === uuid) ?? null),
      create: vi.fn(async (entity: any) => { created.push(entity); return makeStep({ ...entity, uuid: "step-new" }); }),
      update: vi.fn(async (uuid: string, patch: any) => { updates.push({ uuid, patch }); return makeStep({ uuid, ...patch }); }),
      delete: vi.fn(async (uuid: string) => { deleted.push(uuid); }),
    },
    runRepo: {
      findByChallenge: vi.fn(async () => opts.runs ?? []),
    },
  };

  return { deps, updates, created, deleted };
}

describe("ScenarioStepsService.listSteps", () => {
  it("returns the scenario in order", async () => {
    const { deps } = makeDeps({ steps: [makeStep({ uuid: "a", position: 0 }), makeStep({ uuid: "b", position: 1 })] });

    const steps = await new ScenarioStepsService(deps).listSteps(VCH);

    expect(steps.map(s => s.uuid)).toEqual(["a", "b"]);
  });

  it("refuses a validation challenge whose source is an ML challenge", async () => {
    // Un challenge ML se valide par cas de référence : il n'a pas de scénario,
    // et en servir un vide ferait croire à l'admin qu'il peut en écrire un.
    const { deps } = makeDeps({ sourceType: "ml" });

    await expect(new ScenarioStepsService(deps).listSteps(VCH)).rejects.toThrow(ScenarioModeError);
  });

  it("refuses a validation challenge with no source challenge at all", async () => {
    const { deps } = makeDeps({ sourceType: null });

    await expect(new ScenarioStepsService(deps).listSteps(VCH)).rejects.toThrow(ScenarioModeError);
  });
});

describe("ScenarioStepsService.addStep", () => {
  it("appends at the end of the current scenario", async () => {
    const { deps, created } = makeDeps({
      steps: [makeStep({ uuid: "a", position: 0 }), makeStep({ uuid: "b", position: 1 })],
    });

    await new ScenarioStepsService(deps).addStep({
      validationChallengeId: VCH, title: "Export the record", instructions: "As a PDF.",
    });

    expect(created).toEqual([{
      validation_challenge_id: VCH, position: 2,
      title: "Export the record", instructions: "As a PDF.",
    }]);
  });

  it("refuses to add once a walkthrough exists", async () => {
    const { deps } = makeDeps({ runs: [{ uuid: "run-1" } as ValidationScenarioRun] });

    await expect(
      new ScenarioStepsService(deps).addStep({ validationChallengeId: VCH, title: "Late step", instructions: null })
    ).rejects.toThrow(ScenarioFrozenError);
  });

  it("counts a draft walkthrough as a freeze — the scenario locks when the first one starts, not when it finishes", async () => {
    const { deps } = makeDeps({
      runs: [{ uuid: "run-1", completed_at: null } as ValidationScenarioRun],
    });

    await expect(
      new ScenarioStepsService(deps).addStep({ validationChallengeId: VCH, title: "Late step", instructions: null })
    ).rejects.toThrow(ScenarioFrozenError);
  });
});

describe("ScenarioStepsService.editStep", () => {
  it("patches the title and instructions of one step", async () => {
    const { deps, updates } = makeDeps({ steps: [makeStep({ uuid: "a", position: 0 })] });

    await new ScenarioStepsService(deps).editStep({
      validationChallengeId: VCH, stepId: "a", title: "Sign up", instructions: "With an email address.",
    });

    expect(updates).toEqual([{ uuid: "a", patch: { title: "Sign up", instructions: "With an email address." } }]);
  });

  it("renumbers every sibling on a reorder so positions stay dense and never collide", async () => {
    // Écrire seulement la nouvelle position du déplacé laisserait deux étapes
    // à la même position, et l'ordre dépendrait alors de created_at — donc de
    // l'ordre de saisie, pas de l'intention de l'admin.
    const { deps, updates } = makeDeps({
      steps: [
        makeStep({ uuid: "a", position: 0 }),
        makeStep({ uuid: "b", position: 1 }),
        makeStep({ uuid: "c", position: 2 }),
      ],
    });

    await new ScenarioStepsService(deps).editStep({ validationChallengeId: VCH, stepId: "c", position: 0 });

    expect(updates).toEqual([
      { uuid: "c", patch: { position: 0 } },
      { uuid: "a", patch: { position: 1 } },
      { uuid: "b", patch: { position: 2 } },
    ]);
  });

  it("clamps a position past the end instead of leaving a gap", async () => {
    const { deps, updates } = makeDeps({
      steps: [makeStep({ uuid: "a", position: 0 }), makeStep({ uuid: "b", position: 1 })],
    });

    await new ScenarioStepsService(deps).editStep({ validationChallengeId: VCH, stepId: "a", position: 99 });

    expect(updates).toEqual([
      { uuid: "b", patch: { position: 0 } },
      { uuid: "a", patch: { position: 1 } },
    ]);
  });

  it("404s on a step that belongs to another challenge", async () => {
    const { deps } = makeDeps({ steps: [makeStep({ uuid: "a" })] });

    await expect(
      new ScenarioStepsService(deps).editStep({ validationChallengeId: VCH, stepId: "elsewhere", title: "Nope" })
    ).rejects.toThrow(StepNotFoundError);
  });

  it("refuses to edit once a walkthrough exists", async () => {
    const { deps } = makeDeps({
      steps: [makeStep({ uuid: "a" })],
      runs: [{ uuid: "run-1" } as ValidationScenarioRun],
    });

    await expect(
      new ScenarioStepsService(deps).editStep({ validationChallengeId: VCH, stepId: "a", title: "Reworded" })
    ).rejects.toThrow(ScenarioFrozenError);
  });
});

describe("ScenarioStepsService.removeStep", () => {
  it("deletes the step and renumbers what is left", async () => {
    const { deps, deleted, updates } = makeDeps({
      steps: [
        makeStep({ uuid: "a", position: 0 }),
        makeStep({ uuid: "b", position: 1 }),
        makeStep({ uuid: "c", position: 2 }),
      ],
    });

    await new ScenarioStepsService(deps).removeStep({ validationChallengeId: VCH, stepId: "b" });

    expect(deleted).toEqual(["b"]);
    expect(updates).toEqual([{ uuid: "c", patch: { position: 1 } }]);
  });

  it("refuses to delete once a walkthrough exists", async () => {
    // C'est ce refus qui empêche validation_step_feedbacks.step_id de pendre
    // dans le vide — aucun ON DELETE ne peut le garantir à sa place.
    const { deps } = makeDeps({
      steps: [makeStep({ uuid: "a" })],
      runs: [{ uuid: "run-1" } as ValidationScenarioRun],
    });

    await expect(
      new ScenarioStepsService(deps).removeStep({ validationChallengeId: VCH, stepId: "a" })
    ).rejects.toThrow(ScenarioFrozenError);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run packages/services/challenge/scenario-steps.service.test.ts`
Expected: FAIL — cannot resolve `./scenario-steps.service.js`.

- [ ] **Step 4: Write the service**

Create `packages/services/challenge/scenario-steps.service.ts`:

```ts
import {
  ChallengeRepository,
  ScenarioStepRepository,
  ScenarioRunRepository,
} from "../../database-service/repositories/index.js";
import type { ValidationScenarioStep } from "../../database-service/domain/entities.js";
import { validationModeFor } from "./validation-mode.js";
import { ScenarioModeError, ScenarioFrozenError, StepNotFoundError } from "./scenario-errors.js";

export interface ScenarioStepsDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  stepRepo: Pick<ScenarioStepRepository, "findByChallenge" | "findById" | "create" | "update" | "delete">;
  runRepo: Pick<ScenarioRunRepository, "findByChallenge">;
}

/**
 * ScenarioStepsService
 * --------------------
 * Le scénario d'un challenge de validation en mode scénario : une liste
 * ordonnée d'étapes, écrite par l'admin/manager, partagée par toutes les
 * applications exposées — tous les contributeurs ont livré contre le même
 * brief, ils affrontent donc le même parcours.
 *
 * Deux invariants vivent ici, et nulle part ailleurs :
 *
 * 1. **Le gel.** Dès qu'une walkthrough existe — même brouillon — plus aucune
 *    écriture n'est acceptée. Sans ça les walkthroughs cesseraient d'être
 *    comparables entre elles, et surtout supprimer une étape laisserait
 *    validation_step_feedbacks.step_id pointer dans le vide. Aucun ON DELETE
 *    ne peut porter cette garantie à la place du service.
 *
 * 2. **Des positions denses.** Un réordonnancement réécrit toute la fratrie
 *    plutôt que la seule ligne déplacée : deux étapes de même position
 *    laisseraient l'ordre final à created_at, donc à l'ordre de saisie.
 */
export class ScenarioStepsService {
  private deps: ScenarioStepsDeps;

  constructor(deps?: Partial<ScenarioStepsDeps>) {
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      stepRepo: new ScenarioStepRepository(),
      runRepo: new ScenarioRunRepository(),
      ...deps,
    };
  }

  async listSteps(validationChallengeId: string): Promise<ValidationScenarioStep[]> {
    await this.assertScenarioMode(validationChallengeId);
    return this.deps.stepRepo.findByChallenge(validationChallengeId);
  }

  /** Vrai dès qu'une walkthrough existe, brouillon comprise. Lu par la route pour que l'éditeur s'affiche déjà en lecture seule. */
  async isFrozen(validationChallengeId: string): Promise<boolean> {
    const runs = await this.deps.runRepo.findByChallenge(validationChallengeId);
    return runs.length > 0;
  }

  async addStep(input: {
    validationChallengeId: string;
    title: string;
    instructions: string | null;
  }): Promise<ValidationScenarioStep> {
    await this.assertScenarioMode(input.validationChallengeId);
    await this.assertNotFrozen(input.validationChallengeId);

    const existing = await this.deps.stepRepo.findByChallenge(input.validationChallengeId);
    return this.deps.stepRepo.create({
      validation_challenge_id: input.validationChallengeId,
      position: existing.length,
      title: input.title,
      instructions: input.instructions,
    });
  }

  async editStep(input: {
    validationChallengeId: string;
    stepId: string;
    title?: string;
    instructions?: string | null;
    position?: number;
  }): Promise<ValidationScenarioStep> {
    await this.assertScenarioMode(input.validationChallengeId);
    await this.assertNotFrozen(input.validationChallengeId);

    const steps = await this.deps.stepRepo.findByChallenge(input.validationChallengeId);
    const step = steps.find(s => s.uuid === input.stepId);
    if (!step) throw new StepNotFoundError("Step not found on this validation challenge");

    const patch: Partial<Pick<ValidationScenarioStep, "title" | "instructions" | "position">> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.instructions !== undefined) patch.instructions = input.instructions;

    if (input.position === undefined) {
      return this.deps.stepRepo.update(input.stepId, patch);
    }

    // Réordonnancement : on sort l'étape de la liste, on la réinsère à
    // l'index demandé (borné), puis on réécrit 0..n-1. Les positions restent
    // denses, donc l'ordre ne dépend jamais de created_at.
    const others = steps.filter(s => s.uuid !== input.stepId);
    const target = Math.max(0, Math.min(input.position, others.length));
    const reordered = [...others.slice(0, target), step, ...others.slice(target)];

    let moved = step;
    for (const [index, s] of reordered.entries()) {
      const isMovedStep = s.uuid === input.stepId;
      if (!isMovedStep && s.position === index) continue;
      const written = await this.deps.stepRepo.update(
        s.uuid,
        isMovedStep ? { ...patch, position: index } : { position: index }
      );
      if (isMovedStep) moved = written;
    }
    return moved;
  }

  async removeStep(input: { validationChallengeId: string; stepId: string }): Promise<void> {
    await this.assertScenarioMode(input.validationChallengeId);
    await this.assertNotFrozen(input.validationChallengeId);

    const steps = await this.deps.stepRepo.findByChallenge(input.validationChallengeId);
    const step = steps.find(s => s.uuid === input.stepId);
    if (!step) throw new StepNotFoundError("Step not found on this validation challenge");

    await this.deps.stepRepo.delete(input.stepId);

    const remaining = steps.filter(s => s.uuid !== input.stepId);
    for (const [index, s] of remaining.entries()) {
      if (s.position === index) continue;
      await this.deps.stepRepo.update(s.uuid, { position: index });
    }
  }

  /**
   * Le mode se déduit du type du challenge source, jamais d'une colonne.
   * Exporté en interne pour que ScenarioWalkthroughService fasse la même
   * vérification sans dupliquer la règle.
   */
  private async assertScenarioMode(validationChallengeId: string): Promise<void> {
    const challenge = await this.deps.challengeRepo.findById(validationChallengeId);
    if (!challenge || challenge.type !== "validation") {
      throw new ScenarioModeError("Not a validation challenge");
    }
    const source = challenge.source_challenge_id
      ? await this.deps.challengeRepo.findById(challenge.source_challenge_id)
      : null;
    if (validationModeFor(source?.type) !== "scenario") {
      throw new ScenarioModeError("This validation challenge does not use a scenario walkthrough");
    }
  }

  private async assertNotFrozen(validationChallengeId: string): Promise<void> {
    if (await this.isFrozen(validationChallengeId)) {
      throw new ScenarioFrozenError(
        "A walkthrough has already started on this challenge - the scenario is frozen"
      );
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run packages/services/challenge/scenario-steps.service.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 6: Re-export from the barrel**

Add to `packages/services/challenge/index.ts`:

```ts
export { ScenarioStepsService } from "./scenario-steps.service.js";
export type { ScenarioStepsDeps } from "./scenario-steps.service.js";
export * from "./scenario-errors.js";
```

- [ ] **Step 7: Commit**

```bash
git add packages/services/challenge/scenario-errors.ts packages/services/challenge/scenario-steps.service.ts packages/services/challenge/scenario-steps.service.test.ts packages/services/challenge/index.ts
git commit -m "feat(validation): author a scenario, and freeze it at the first walkthrough"
```

---

### Task 6: The scenario-steps routes

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-steps/route.ts`
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-steps/route.test.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-steps/[stepId]/route.ts`
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-steps/[stepId]/route.test.ts`

**Interfaces:**
- Consumes: `ScenarioStepsService`, `ScenarioModeError`, `ScenarioFrozenError`, `StepNotFoundError` (Task 5).
- Produces the wire shape `ScenarioStepsEditor` (Task 7) and `ScenarioWalkthroughScreen` (Task 15) read:

```ts
// GET  -> { steps: Array<{ id, position, title, instructions }>, frozen: boolean }
// POST -> 201 { id, position, title, instructions }
// PATCH -> 200 { id, position, title, instructions }
// DELETE -> 200 { success: true }
```

- [ ] **Step 1: Write the failing collection-route test**

Create `…/validation-scenario-steps/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetSessionUser, mockIsManagerOfChallenge,
  mockListSteps, mockIsFrozen, mockAddStep,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockListSteps: vi.fn(),
  mockIsFrozen: vi.fn(),
  mockAddStep: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));

vi.mock('../../../../../../../../packages/services/challenge/scenario-steps.service', () => ({
  ScenarioStepsService: class {
    listSteps = mockListSteps;
    isFrozen = mockIsFrozen;
    addStep = mockAddStep;
  },
}));

import { GET, POST } from './route';
import {
  ScenarioModeError,
  ScenarioFrozenError,
} from '../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';

function getSteps() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

function postStep(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockListSteps.mockResolvedValue([
    { uuid: 'step-1', position: 0, title: 'Create an account', instructions: 'Sign up with an email address.' },
  ]);
  mockIsFrozen.mockResolvedValue(false);
});

describe('GET /api/challenges/[id]/validation-scenario-steps', () => {
  it('serves the scenario to any signed-in contributor', async () => {
    // Le scénario est le protocole, pas un secret : contrairement à la sortie
    // attendue d'un cas de référence, rien n'est caché au validateur.
    const res = await getSteps();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.steps).toEqual([
      { id: 'step-1', position: 0, title: 'Create an account', instructions: 'Sign up with an email address.' },
    ]);
  });

  it('reports the freeze so the editor can render read-only without trying a write first', async () => {
    mockIsFrozen.mockResolvedValue(true);

    const body = await (await getSteps()).json();

    expect(body.frozen).toBe(true);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await getSteps()).status).toBe(401);
  });

  it('returns 400 on a reference-case validation challenge', async () => {
    mockListSteps.mockRejectedValue(new ScenarioModeError('nope'));

    expect((await getSteps()).status).toBe(400);
  });
});

describe('POST /api/challenges/[id]/validation-scenario-steps', () => {
  beforeEach(() => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockAddStep.mockResolvedValue({
      uuid: 'step-new', position: 1, title: 'Log in', instructions: null,
    });
  });

  it('adds a step for an admin', async () => {
    const res = await postStep({ title: 'Log in' });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toEqual({ id: 'step-new', position: 1, title: 'Log in', instructions: null });
    expect(mockAddStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, title: 'Log in', instructions: null,
    });
  });

  it('adds a step for a manager of this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'project_manager' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    expect((await postStep({ title: 'Log in' })).status).toBe(201);
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    expect((await postStep({ title: 'Log in' })).status).toBe(403);
    expect(mockAddStep).not.toHaveBeenCalled();
  });

  it('rejects an empty title', async () => {
    expect((await postStep({ title: '   ' })).status).toBe(400);
  });

  it('returns 409 once a walkthrough exists', async () => {
    mockAddStep.mockRejectedValue(new ScenarioFrozenError('frozen'));

    expect((await postStep({ title: 'Late step' })).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-steps/route.test.ts"`
Expected: FAIL — `Failed to load url ./route`.

- [ ] **Step 3: Write the collection route**

Create `…/validation-scenario-steps/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioStepsService } from '../../../../../../../../packages/services/challenge/scenario-steps.service';
import {
  ScenarioModeError,
  ScenarioFrozenError,
  StepNotFoundError,
} from '../../../../../../../../packages/services/challenge/scenario-errors';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const service = new ScenarioStepsService();

/** La forme que lisent ScenarioStepsEditor et l'écran de walkthrough. */
function toWire(step: { uuid: string; position: number; title: string; instructions: string | null }) {
  return { id: step.uuid, position: step.position, title: step.title, instructions: step.instructions };
}

/** Table erreur -> statut, partagée par les quatre handlers de ce dossier. */
export function scenarioErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ScenarioFrozenError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof StepNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ScenarioModeError) return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}

// GET /api/challenges/[id]/validation-scenario-steps
// N'importe quel contributeur connecté. Le scénario est le protocole, pas un
// secret : contrairement à la sortie attendue d'un cas de référence, rien
// n'est caché au validateur en mode scénario.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const [steps, frozen] = await Promise.all([
      service.listSteps(challengeId),
      service.isFrozen(challengeId),
    ]);

    return NextResponse.json({ steps: steps.map(toWire), frozen });
  } catch (error) {
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error fetching scenario steps:', error);
    return NextResponse.json({ error: 'Failed to fetch scenario steps' }, { status: 500 });
  }
}

const addStepSchema = z.object({
  title: z.string().trim().min(1).max(255),
  instructions: z.string().trim().min(1).nullish(),
});

// POST /api/challenges/[id]/validation-scenario-steps — admin/manager only.
// 409 dès qu'une walkthrough existe : le scénario est gelé.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isAdmin = user.role === 'admin';
    const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { title, instructions } = addStepSchema.parse(await req.json());

    const created = await service.addStep({
      validationChallengeId: challengeId,
      title,
      instructions: instructions ?? null,
    });

    return NextResponse.json(toWire(created), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error adding scenario step:', error);
    return NextResponse.json({ error: 'Failed to add scenario step' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-steps/route.test.ts"`
Expected: PASS — 10 tests.

- [ ] **Step 5: Write the failing item-route test**

Create `…/validation-scenario-steps/[stepId]/route.test.ts`. Same mock scaffolding as Step 1, with **nine** `../` in the service paths, mocking `editStep` and `removeStep`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockIsManagerOfChallenge, mockEditStep, mockRemoveStep } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockIsManagerOfChallenge: vi.fn(),
  mockEditStep: vi.fn(),
  mockRemoveStep: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));
vi.mock('../../../../../../../../../packages/services/challenge/scenario-steps.service', () => ({
  ScenarioStepsService: class {
    editStep = mockEditStep;
    removeStep = mockRemoveStep;
  },
}));

import { PATCH, DELETE } from './route';
import {
  ScenarioFrozenError,
  StepNotFoundError,
} from '../../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';
const STEP_ID = 'step-1';
const routeParams = { params: Promise.resolve({ id: CHALLENGE_ID, stepId: STEP_ID }) };

function patchStep(body: unknown) {
  const req = new NextRequest(
    `http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps/${STEP_ID}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  return PATCH(req, routeParams);
}

function deleteStep() {
  const req = new NextRequest(
    `http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-steps/${STEP_ID}`,
    { method: 'DELETE' }
  );
  return DELETE(req, routeParams);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
  mockIsManagerOfChallenge.mockResolvedValue(false);
  mockEditStep.mockResolvedValue({ uuid: STEP_ID, position: 0, title: 'Sign up', instructions: null });
  mockRemoveStep.mockResolvedValue(undefined);
});

describe('PATCH .../validation-scenario-steps/[stepId]', () => {
  it('renames a step', async () => {
    const res = await patchStep({ title: 'Sign up' });

    expect(res.status).toBe(200);
    expect(mockEditStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, title: 'Sign up',
    });
  });

  it('reorders a step', async () => {
    await patchStep({ position: 2 });

    expect(mockEditStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, position: 2,
    });
  });

  it('clears the instructions when sent an explicit null', async () => {
    // `undefined` veut dire « n'y touche pas », `null` veut dire « vide-le ».
    // Sans ce distinguo on ne pourrait jamais retirer un détail déjà écrit.
    await patchStep({ instructions: null });

    expect(mockEditStep).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, stepId: STEP_ID, instructions: null,
    });
  });

  it('rejects a body with nothing to change', async () => {
    expect((await patchStep({})).status).toBe(400);
  });

  it('rejects a negative position', async () => {
    expect((await patchStep({ position: -1 })).status).toBe(400);
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    expect((await patchStep({ title: 'Sign up' })).status).toBe(403);
  });

  it('returns 404 for a step on another challenge', async () => {
    mockEditStep.mockRejectedValue(new StepNotFoundError('nope'));

    expect((await patchStep({ title: 'Sign up' })).status).toBe(404);
  });

  it('returns 409 once a walkthrough exists', async () => {
    mockEditStep.mockRejectedValue(new ScenarioFrozenError('frozen'));

    expect((await patchStep({ title: 'Sign up' })).status).toBe(409);
  });
});

describe('DELETE .../validation-scenario-steps/[stepId]', () => {
  it('deletes a step', async () => {
    const res = await deleteStep();

    expect(res.status).toBe(200);
    expect(mockRemoveStep).toHaveBeenCalledWith({ validationChallengeId: CHALLENGE_ID, stepId: STEP_ID });
  });

  it('returns 409 once a walkthrough exists', async () => {
    mockRemoveStep.mockRejectedValue(new ScenarioFrozenError('frozen'));

    expect((await deleteStep()).status).toBe(409);
  });

  it('returns 403 for a plain contributor', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });

    expect((await deleteStep()).status).toBe(403);
    expect(mockRemoveStep).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-steps/[stepId]/route.test.ts"`
Expected: FAIL — `Failed to load url ./route`.

- [ ] **Step 7: Write the item route**

Create `…/validation-scenario-steps/[stepId]/route.ts`. Note the **nine** `../` and the local copy of the error mapping (importing it from the sibling `route.ts` would drag that file's `POST` handler into this module graph):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioStepsService } from '../../../../../../../../../packages/services/challenge/scenario-steps.service';
import {
  ScenarioModeError,
  ScenarioFrozenError,
  StepNotFoundError,
} from '../../../../../../../../../packages/services/challenge/scenario-errors';
import { getSessionUser } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

const service = new ScenarioStepsService();

function scenarioErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ScenarioFrozenError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof StepNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof ScenarioModeError) return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}

async function authorize(challengeId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const isAdmin = user.role === 'admin';
  const isManager = !isAdmin && (await isManagerOfChallenge(user.id, challengeId));
  if (!isAdmin && !isManager) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

// `instructions: null` vide le détail, `instructions` absent le laisse tel
// quel — d'où le .nullish() plutôt qu'un .optional() seul.
const patchStepSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  instructions: z.string().trim().min(1).nullish(),
  position: z.number().int().nonnegative().optional(),
}).refine(
  b => b.title !== undefined || b.instructions !== undefined || b.position !== undefined,
  { message: 'Nothing to update' }
);

// PATCH /api/challenges/[id]/validation-scenario-steps/[stepId] — admin/manager only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: challengeId, stepId } = await params;
    const auth = await authorize(challengeId);
    if ('error' in auth) return auth.error;

    const patch = patchStepSchema.parse(await req.json());

    const updated = await service.editStep({
      validationChallengeId: challengeId,
      stepId,
      ...patch,
    });

    return NextResponse.json({
      id: updated.uuid, position: updated.position, title: updated.title, instructions: updated.instructions,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error updating scenario step:', error);
    return NextResponse.json({ error: 'Failed to update scenario step' }, { status: 500 });
  }
}

// DELETE /api/challenges/[id]/validation-scenario-steps/[stepId] — admin/manager only.
// 409 dès qu'une walkthrough existe : c'est ce refus qui empêche
// validation_step_feedbacks.step_id de pendre dans le vide.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const { id: challengeId, stepId } = await params;
    const auth = await authorize(challengeId);
    if ('error' in auth) return auth.error;

    await service.removeStep({ validationChallengeId: challengeId, stepId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error deleting scenario step:', error);
    return NextResponse.json({ error: 'Failed to delete scenario step' }, { status: 500 });
  }
}
```

- [ ] **Step 8: Run both suites and type-check**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-steps"`
Expected: PASS — 21 tests across the two files.

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-steps"
git commit -m "feat(validation): read and write the scenario over HTTP"
```

---

### Task 7: `ScenarioStepsEditor`, and the manage view in scenario mode

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.ts:49-52` and `:102-106`
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.test.ts`
- Create: `apps/leaderboard-client/src/components/admin/ScenarioStepsEditor.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx:38-47` (the `Challenge` interface) and `:572-592` (the `isValidation` tab array)

**Interfaces:**
- Consumes: the step routes from Task 6.
- Produces:
  - `GET /api/challenges/:id/overview` gains `source_challenge_type: string | null` at the top level of the payload (signed-in only — `toPublicOverview` is an allowlist and drops it, which is correct: an anonymous visitor never walks anything).
  - `ScenarioStepsEditor({ challengeId, open }: { challengeId: string; open: boolean })` — same prop contract as `ValidationTargetsEditor`.

- [ ] **Step 1: Write the failing overview-route test**

Append to `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.test.ts`, reusing whatever mock scaffolding that file already sets up:

```ts
describe('validation mode derivation', () => {
  it('publishes the source challenge type so the page knows which validation flow to render', async () => {
    // Dérivé, jamais stocké. Le publier ici évite une seconde requête sur les
    // deux coquilles de page, qui lisent déjà cet endpoint.
    mockChallengeFindById.mockImplementation(async (id: string) =>
      id === CHALLENGE_ID
        ? { uuid: CHALLENGE_ID, type: 'validation', status: 'active', source_challenge_id: 'code-ch-1' }
        : { uuid: 'code-ch-1', type: 'code' }
    );

    const body = await (await getOverview('valid-token')).json();

    expect(body.source_challenge_type).toBe('code');
  });

  it('publishes null for a challenge with no source challenge', async () => {
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'code', status: 'active' });

    const body = await (await getOverview('valid-token')).json();

    expect(body.source_challenge_type).toBeNull();
  });

  it('never publishes it to an anonymous visitor', async () => {
    // toPublicOverview est une liste blanche : un nouveau champ est privé par
    // défaut. Ce test est là pour que ça reste vrai si quelqu'un la réécrit.
    mockChallengeFindById.mockImplementation(async (id: string) =>
      id === CHALLENGE_ID
        ? { uuid: CHALLENGE_ID, type: 'validation', status: 'active', source_challenge_id: 'code-ch-1' }
        : { uuid: 'code-ch-1', type: 'code' }
    );

    const body = await (await getOverview()).json();

    expect(body.source_challenge_type).toBeUndefined();
  });
});
```

If the existing test file has no `getOverview(token?)` helper, add one mirroring the `getTargets` helper in the validation-targets test: a `NextRequest` on `http://localhost/api/challenges/${CHALLENGE_ID}/overview` with an optional `cookie: access_token=…` header, called as `GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) })`. Also confirm the challenge under test is publicly visible, or the anonymous case 404s before reaching the payload.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/overview/route.test.ts"`
Expected: FAIL — `source_challenge_type` is `undefined` in the signed-in cases.

- [ ] **Step 3: Publish the derived type from the overview route**

In `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.ts`, after the `session` guard and before the big `Promise.all`:

```ts
    // Le type du challenge source, d'où les deux coquilles de page déduisent
    // le mode de validation (cas de référence vs scénario). Dérivé et non
    // stocké : une colonne `validation_mode` serait une seconde source de
    // vérité capable de dériver de la première. Une requête de plus seulement
    // pour un challenge qui en a un.
    const sourceChallenge = challenge.source_challenge_id
      ? await challengeRepo.findById(challenge.source_challenge_id)
      : null;
```

And in the `payload` object:

```ts
    const payload = {
      challenge, team, tasks, meetings, repos, contributions,
      participants: safeParticipants,
      my_workspace_owner_id: myWorkspaceOwnerId,
      contribution_members: contributionMembers,
      source_challenge_type: sourceChallenge?.type ?? null,
    };
```

`toPublicOverview` needs no change — it is an allowlist, so the field stays private to signed-in callers by construction.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/overview/route.test.ts"`
Expected: PASS, including the pre-existing cases.

- [ ] **Step 5: Write `ScenarioStepsEditor`**

Create `apps/leaderboard-client/src/components/admin/ScenarioStepsEditor.tsx`. It follows `ValidationTargetsEditor`'s shape exactly — the same `open`-transition fetch, the same independent CRUD (each gesture hits the API immediately, not on the challenge's "Save changes"), the same `fgAt` helper. The design's frozen banner, `01`-padded numbering and disabled add-row are reproduced in the app's own tokens.

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ListOrdered, Loader2, Lock, Plus, Trash2 } from 'lucide-react';

interface StepItem {
  id: string;
  position: number;
  title: string;
  instructions: string | null;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Le scénario d'un challenge de validation en mode scénario : la liste
 * ordonnée d'étapes que chaque validateur parcourra sur chaque application
 * exposée.
 *
 * Passe en lecture seule dès qu'une walkthrough existe — le serveur renvoie
 * `frozen`, donc l'éditeur l'affiche sans avoir à tenter une écriture pour
 * l'apprendre. Même geste que le bouton de suppression déjà désactivé sur un
 * target qui porte des verdicts.
 */
export function ScenarioStepsEditor({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [frozen, setFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftInstructions, setDraftInstructions] = useState('');
  const [error, setError] = useState('');

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (justOpened) fetchSteps();
  }, [open]);

  const fetchSteps = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-scenario-steps`);
      if (res.ok) {
        const d = await res.json();
        setSteps(d.steps ?? []);
        setFrozen(!!d.frozen);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to load the scenario');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-scenario-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, instructions: draftInstructions.trim() || null }),
      });
      if (res.ok) {
        setDraftTitle('');
        setDraftInstructions('');
        await fetchSteps();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to add the step');
      }
    } catch { setError('Network error'); }
    finally { setAdding(false); }
  };

  const patchStep = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-scenario-steps/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) await fetchSteps();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to update the step'); }
    } catch { setError('Network error'); }
    finally { setBusyId(null); }
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/validation-scenario-steps/${id}`, { method: 'DELETE' });
      if (res.ok) await fetchSteps();
      else { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to delete the step'); }
    } catch { setError('Network error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: fgAt(0.3) }}>
        <ListOrdered className="h-3.5 w-3.5" />
        The scenario
        {steps.length > 0 && (
          <span className="ml-1 rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] font-normal" style={{ color: fgAt(0.4) }}>
            {steps.length} {steps.length === 1 ? 'step' : 'steps'} · same for every application
          </span>
        )}
      </p>

      {frozen && (
        <div className="flex items-start gap-2 rounded-[16px] border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-300/90">
            The scenario is frozen — a walkthrough has already started. Editing, reordering or deleting a step
            would make the walkthroughs incomparable.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {steps.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
              No step yet. A validator cannot start a walkthrough until the scenario has at least one.
            </p>
          ) : (
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div key={s.id} className="group flex items-start gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 font-mono text-[11px]" style={{ color: fgAt(0.3) }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-sm font-medium" style={{ color: fgAt(0.8) }}>{s.title}</span>
                    {s.instructions && (
                      <span className="block text-[11px] leading-relaxed" style={{ color: fgAt(0.4) }}>{s.instructions}</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => patchStep(s.id, { position: i - 1 })}
                      disabled={frozen || i === 0 || busyId === s.id}
                      aria-label="Move step up"
                      className="rounded-md p-1 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => patchStep(s.id, { position: i + 1 })}
                      disabled={frozen || i === steps.length - 1 || busyId === s.id}
                      aria-label="Move step down"
                      className="rounded-md p-1 text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(s.id)}
                      disabled={frozen || busyId === s.id}
                      title={frozen ? 'The scenario is frozen - a walkthrough has already started' : undefined}
                      aria-label="Delete step"
                      className="rounded-md p-1 text-white/25 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/25"
                    >
                      {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {frozen ? (
            <p className="rounded-[14px] border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-3 text-xs" style={{ color: fgAt(0.25) }}>
              Add a step — disabled while the scenario is frozen
            </p>
          ) : (
            <div className="space-y-2 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: fgAt(0.25) }}>
                Add a step
              </p>
              <input
                type="text"
                value={draftTitle}
                onChange={e => setDraftTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="Create an account"
                disabled={adding}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none disabled:opacity-50"
              />
              <textarea
                rows={2}
                value={draftInstructions}
                onChange={e => setDraftInstructions(e.target.value)}
                placeholder="Optional - the detail of the instruction"
                disabled={adding}
                className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-white/20 transition-all duration-200 focus:border-brandCP/40 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !draftTitle.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-brandCP/10 px-3 py-1.5 text-xs font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-brandCP/10"
              >
                {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add step
              </button>
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

- [ ] **Step 6: Wire the manage view**

In `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx`:

Import the editor next to the other admin panels:

```tsx
import { ScenarioStepsEditor } from '@/components/admin/ScenarioStepsEditor';
```

The overview query's result type must learn the new field. Add it to the `queryFn` type parameter alongside `contribution_members`:

```ts
      /** Type du challenge source — d'où se déduit le mode de validation. */
      source_challenge_type: string | null;
```

Then derive the mode next to `isValidation` (around line 543):

```ts
  const isValidation = challenge.type === 'validation';
  // Le mode se lit sur le type du challenge source, comme partout ailleurs.
  const isScenarioValidation = isValidation && overviewQuery.data?.source_challenge_type === 'code';
```

Note `challenge` here comes from `overviewQuery.data`, so `source_challenge_type` is available on the same render — no flicker, no second request.

Finally, replace the `isValidation` tab array (lines 572-592) with:

```tsx
  ] : isValidation ? [
    {
      label: 'Overview',
      panel: <TabOverview challenge={challenge} team={team} contributions={contributions} contributionMembers={contributionMembers} />,
    },
    {
      label: isScenarioValidation ? 'Scenario' : 'Targets',
      panel: (
        <div className="space-y-6">
          <ValidationTargetsEditor challengeId={challengeId} open />
          {isScenarioValidation
            ? <ScenarioStepsEditor challengeId={challengeId} open />
            : <ReferenceCasesOverviewPanel challengeId={challengeId} open />}
          <ValidationRewardsPanel challengeId={challengeId} open />
        </div>
      ),
    },
    {
      label: isScenarioValidation ? 'Walkthroughs' : 'Runs',
      panel: isScenarioValidation
        ? <ScenarioWalkthroughsPanel challengeId={challengeId} open />
        : <ValidationRunsPanel challengeId={challengeId} open />,
    },
  ] : [
```

`ScenarioWalkthroughsPanel` does not exist yet — **leave the second tab as `<ValidationRunsPanel …>` for now** and come back to this exact spot in Task 13. Everything else in this step lands.

- [ ] **Step 7: Type-check and verify by hand**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev`. On a validation challenge sourced from a `code` challenge, open `/challenges/<id>/manage`. Expected: the second tab reads **Scenario**, `ScenarioStepsEditor` renders beneath the exposed-applications editor, adding a step works, the up/down arrows reorder it, and the numbering stays `01`, `02`, `03` with no gaps. On a validation challenge sourced from an `ml` challenge, nothing changed: the tab still reads **Targets** and still shows `ReferenceCasesOverviewPanel`.

- [ ] **Step 8: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/overview" apps/leaderboard-client/src/components/admin/ScenarioStepsEditor.tsx apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx
git commit -m "feat(validation): write the scenario from the challenge's own manage view"
```

---

### Task 8: `openWalkthrough` — starting or resuming a pass, and the not-my-own-application guard

**Files:**
- Create: `packages/services/challenge/scenario-guard.ts`
- Modify: `packages/services/challenge/scenario-steps.service.ts` (use the extracted guard)
- Create: `packages/services/challenge/scenario-walkthrough.service.ts`
- Test: `packages/services/challenge/scenario-walkthrough.service.test.ts`
- Modify: `packages/services/challenge/index.ts`

**Interfaces:**
- Consumes: every repository from Task 1, `validationModeFor` (Task 2), the error classes (Task 5).
- Produces:

```ts
export async function assertScenarioChallenge(
  challengeRepo: { findById(id: string): Promise<Challenge | null> },
  validationChallengeId: string
): Promise<Challenge>   // returns the validation challenge; throws ScenarioModeError otherwise

export interface WalkthroughStepState {
  stepId: string; position: number; title: string; instructions: string | null;
  result: ScenarioStepResult | null; comment: string | null; medicalComment: string | null;
}
export interface WalkthroughState {
  runId: string; contributionId: string;
  completedAt: Date | null; globalFeedback: string | null;
  steps: WalkthroughStepState[];
}
export interface ScenarioWalkthroughDeps { /* see Step 4 */ }
export class ScenarioWalkthroughService {
  openWalkthrough(input: { validationChallengeId: string; contributionId: string; validatorUserId: string }): Promise<WalkthroughState>
}
```

- [ ] **Step 1: Extract the scenario-mode guard**

Create `packages/services/challenge/scenario-guard.ts`:

```ts
import type { Challenge } from "../../database-service/domain/entities.js";
import { validationModeFor } from "./validation-mode.js";
import { ScenarioModeError } from "./scenario-errors.js";

/**
 * « Ce challenge est-il bien un challenge de validation en mode scénario ? »
 *
 * Deux lectures, parce que le mode se déduit du type du challenge source et
 * ne se stocke jamais. Extraite dans son propre fichier parce que
 * ScenarioStepsService et ScenarioWalkthroughService posent exactement la
 * même question, et qu'une règle dupliquée est une règle qui divergera.
 *
 * Renvoie le challenge de validation, que les appelants ont de toute façon
 * besoin de lire (pool, cp_per_validation).
 */
export async function assertScenarioChallenge(
  challengeRepo: { findById(id: string): Promise<Challenge | null> },
  validationChallengeId: string
): Promise<Challenge> {
  const challenge = await challengeRepo.findById(validationChallengeId);
  if (!challenge || challenge.type !== "validation") {
    throw new ScenarioModeError("Not a validation challenge");
  }
  const source = challenge.source_challenge_id
    ? await challengeRepo.findById(challenge.source_challenge_id)
    : null;
  if (validationModeFor(source?.type) !== "scenario") {
    throw new ScenarioModeError("This validation challenge does not use a scenario walkthrough");
  }
  return challenge;
}
```

Then in `scenario-steps.service.ts`: delete the private `assertScenarioMode` method, import the helper, and replace its three call sites with `await assertScenarioChallenge(this.deps.challengeRepo, validationChallengeId)`. The `validationModeFor` and `ScenarioModeError` imports become unused there — remove them.

- [ ] **Step 2: Run Task 5's suite as the regression gate**

Run: `npx vitest run packages/services/challenge/scenario-steps.service.test.ts`
Expected: PASS — all 13 tests, unchanged. The extraction must be behaviour-preserving; if a test fails, the guard moved a check, it didn't extract one.

- [ ] **Step 3: Write the failing `openWalkthrough` test**

Create `packages/services/challenge/scenario-walkthrough.service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

import { ScenarioWalkthroughService } from "./scenario-walkthrough.service.js";
import type { ScenarioWalkthroughDeps } from "./scenario-walkthrough.service.js";
import {
  ScenarioModeError,
  EmptyScenarioError,
  SelfWalkthroughError,
  TargetNotExposedError,
} from "./scenario-errors.js";
import type {
  Challenge, Contribution, ContributionMember, User,
  ValidationScenarioStep, ValidationScenarioRun, ValidationStepFeedback,
} from "../../database-service/domain/entities.js";

const VCH = "vch-1";
const CODE_SOURCE = "code-ch-1";
const APP = "contrib-app";
const VALIDATOR = "bob";

function makeSteps(): ValidationScenarioStep[] {
  return [
    { uuid: "step-1", validation_challenge_id: VCH, position: 0, title: "Create an account", instructions: "Sign up with an email address.", created_at: new Date() },
    { uuid: "step-2", validation_challenge_id: VCH, position: 1, title: "Log in", instructions: null, created_at: new Date() },
  ];
}

interface Opts {
  sourceType?: string | null;
  steps?: ValidationScenarioStep[];
  targets?: Array<{ uuid: string; contribution_id: string }>;
  existingRun?: ValidationScenarioRun | null;
  /** create() renvoie null : une requête concurrente a gagné la course. */
  createLosesRace?: boolean;
  feedbacks?: ValidationStepFeedback[];
  appHolder?: string;
  appMembers?: string[];
  validatorRole?: string;
  pool?: number;
  distributed?: number;
  cpPerValidation?: number;
  completeReturnsNull?: boolean;
}

function makeDeps(opts: Opts = {}) {
  const steps = opts.steps ?? makeSteps();
  const targets = opts.targets ?? [{ uuid: "target-1", contribution_id: APP }];
  const runsCreated: any[] = [];
  const upserts: Array<Omit<ValidationStepFeedback, "uuid" | "created_at">> = [];
  const rewardBatches: any[][] = [];
  const contributionsCreated: any[] = [];
  const completed: Array<{ uuid: string; feedback: string }> = [];
  let stored: ValidationScenarioRun | null = opts.existingRun ?? null;

  const challenge: Challenge = {
    uuid: VCH, title: "Usability walkthrough", status: "active", type: "validation",
    contribution_points_reward: opts.pool ?? 12000, completion: 0, project_id: "proj-1",
    source_challenge_id: opts.sourceType === null ? null : CODE_SOURCE,
    cp_per_validation: opts.cpPerValidation ?? 200,
    required_validations: null, compute_enabled: false,
  };

  const app: Contribution = {
    uuid: APP, title: "Patient record app", type: "project", reward: 0,
    user_id: opts.appHolder ?? "alice", challenge_id: CODE_SOURCE, submitted_at: new Date(),
  } as Contribution;

  const deps: ScenarioWalkthroughDeps = {
    challengeRepo: {
      findById: vi.fn(async (id: string) => {
        if (id === VCH) return challenge;
        if (opts.sourceType === null) return null;
        return { uuid: CODE_SOURCE, type: opts.sourceType ?? "code" } as Challenge;
      }),
    },
    targetRepo: { findByChallenge: vi.fn(async () => targets as any) },
    stepRepo: { findByChallenge: vi.fn(async () => steps) },
    runRepo: {
      findById: vi.fn(async (uuid: string) => (stored && stored.uuid === uuid ? stored : null)),
      findOne: vi.fn(async () => stored),
      create: vi.fn(async (entity: any) => {
        runsCreated.push(entity);
        if (opts.createLosesRace) {
          // La course : l'index unique a rejeté l'insert, mais la ligne de
          // l'autre requête existe désormais bel et bien.
          stored = { uuid: "run-concurrent", validation_challenge_id: VCH, contribution_id: APP, validator_user_id: VALIDATOR, global_feedback: null, completed_at: null, created_at: new Date() };
          return null;
        }
        stored = { uuid: "run-new", validation_challenge_id: VCH, contribution_id: APP, validator_user_id: VALIDATOR, global_feedback: null, completed_at: null, created_at: new Date() };
        return stored;
      }),
      complete: vi.fn(async (uuid: string, feedback: string) => {
        if (opts.completeReturnsNull) return null;
        completed.push({ uuid, feedback });
        stored = { ...(stored as ValidationScenarioRun), global_feedback: feedback, completed_at: new Date() };
        return stored;
      }),
    },
    feedbackRepo: {
      findByRun: vi.fn(async () => opts.feedbacks ?? []),
      upsert: vi.fn(async (entity: any) => { upserts.push(entity); return { uuid: "fb-1", created_at: new Date(), ...entity }; }),
    },
    contributionRepo: {
      findById: vi.fn(async (id: string) => (id === APP ? app : null)),
      findByChallenge: vi.fn(async () => []),
      create: vi.fn(async (entity: any) => { contributionsCreated.push(entity); return { uuid: "validator-contrib", ...entity }; }),
    },
    memberRepo: {
      findByContribution: vi.fn(async () =>
        (opts.appMembers ?? []).map(user_id => ({ contribution_id: APP, user_id, share_cp: 0 } as ContributionMember))
      ),
    },
    userRepo: {
      findById: vi.fn(async () => ({ uuid: VALIDATOR, full_name: "Bob", role: opts.validatorRole ?? "contributor", created_at: new Date() } as User)),
    },
    rewardRepo: {
      sumByChallenge: vi.fn(async () => opts.distributed ?? 0),
      createManyAndSyncRewards: vi.fn(async (entries: any[]) => { rewardBatches.push(entries); return entries; }),
    },
  };

  return { deps, runsCreated, upserts, rewardBatches, contributionsCreated, completed, steps };
}

function open(deps: ScenarioWalkthroughDeps) {
  return new ScenarioWalkthroughService(deps).openWalkthrough({
    validationChallengeId: VCH, contributionId: APP, validatorUserId: VALIDATOR,
  });
}

describe("openWalkthrough", () => {
  it("creates a draft with every step still unanswered", async () => {
    const { deps, runsCreated } = makeDeps();

    const state = await open(deps);

    expect(runsCreated).toEqual([{
      validation_challenge_id: VCH, contribution_id: APP, validator_user_id: VALIDATOR,
    }]);
    expect(state.runId).toBe("run-new");
    expect(state.completedAt).toBeNull();
    expect(state.steps.map(s => s.result)).toEqual([null, null]);
  });

  it("returns the steps in scenario order with their titles and instructions", async () => {
    const { deps } = makeDeps();

    const state = await open(deps);

    expect(state.steps.map(s => [s.position, s.title, s.instructions])).toEqual([
      [0, "Create an account", "Sign up with an email address."],
      [1, "Log in", null],
    ]);
  });

  it("is idempotent: reopening returns the draft I left, with what I had already filled in", async () => {
    // C'est toute la promesse du brouillon : fermer l'onglet à l'étape 4 sur 7
    // et revenir exactement là où on était.
    const { deps, runsCreated } = makeDeps({
      existingRun: { uuid: "run-mine", validation_challenge_id: VCH, contribution_id: APP, validator_user_id: VALIDATOR, global_feedback: null, completed_at: null, created_at: new Date() },
      feedbacks: [
        { uuid: "fb-1", run_id: "run-mine", step_id: "step-1", result: "failed", comment: "The confirmation email never arrives.", medical_comment: null, created_at: new Date() },
      ],
    });

    const state = await open(deps);

    expect(runsCreated).toEqual([]);
    expect(state.runId).toBe("run-mine");
    expect(state.steps[0]).toMatchObject({ result: "failed", comment: "The confirmation email never arrives." });
    expect(state.steps[1].result).toBeNull();
  });

  it("returns the completed walkthrough read-only rather than starting a second one", async () => {
    const completedAt = new Date("2026-09-11T09:00:00Z");
    const { deps, runsCreated } = makeDeps({
      existingRun: { uuid: "run-done", validation_challenge_id: VCH, contribution_id: APP, validator_user_id: VALIDATOR, global_feedback: "Usable end to end.", completed_at: completedAt, created_at: new Date() },
    });

    const state = await open(deps);

    expect(runsCreated).toEqual([]);
    expect(state.completedAt).toEqual(completedAt);
    expect(state.globalFeedback).toBe("Usable end to end.");
  });

  it("recovers the winner's row when it loses the unique-index race", async () => {
    // create() renvoie null sur violation d'unicité : la ligne existe, elle
    // vient juste d'une autre requête. Relire est la bonne réponse, pas 409.
    const { deps } = makeDeps({ createLosesRace: true });

    const state = await open(deps);

    expect(state.runId).toBe("run-concurrent");
  });

  it("refuses the application whose contribution I hold", async () => {
    const { deps } = makeDeps({ appHolder: VALIDATOR });

    await expect(open(deps)).rejects.toThrow(SelfWalkthroughError);
  });

  it("refuses the application of a group I am a member of, even though I am not the holder", async () => {
    // Les challenges code acceptent des groupes de 2-3 où `user_id` n'est que
    // le porteur. Un contrôle sur `user_id` seul laisserait un co-équipier
    // valider l'application de son propre groupe — et se payer pour.
    const { deps } = makeDeps({ appHolder: "alice", appMembers: ["alice", VALIDATOR, "carol"] });

    await expect(open(deps)).rejects.toThrow(SelfWalkthroughError);
  });

  it("accepts an application whose group I am not part of", async () => {
    const { deps } = makeDeps({ appHolder: "alice", appMembers: ["alice", "carol"] });

    await expect(open(deps)).resolves.toMatchObject({ runId: "run-new" });
  });

  it("refuses an application that is not exposed on this validation challenge", async () => {
    const { deps } = makeDeps({ targets: [{ uuid: "target-1", contribution_id: "someone-else" }] });

    await expect(open(deps)).rejects.toThrow(TargetNotExposedError);
  });

  it("refuses to start when the scenario has no step yet", async () => {
    // Sinon la walkthrough serait immédiatement complétable — zéro étape
    // manquante — et paierait pour rien.
    const { deps } = makeDeps({ steps: [] });

    await expect(open(deps)).rejects.toThrow(EmptyScenarioError);
  });

  it("refuses a validation challenge whose source is an ML challenge", async () => {
    const { deps } = makeDeps({ sourceType: "ml" });

    await expect(open(deps)).rejects.toThrow(ScenarioModeError);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run packages/services/challenge/scenario-walkthrough.service.test.ts`
Expected: FAIL — cannot resolve `./scenario-walkthrough.service.js`.

- [ ] **Step 5: Write the service with `openWalkthrough`**

Create `packages/services/challenge/scenario-walkthrough.service.ts`:

```ts
import {
  ChallengeRepository,
  ContributionRepository,
  ContributionMemberRepository,
  RewardEntryRepository,
  UserRepository,
  ValidationTargetRepository,
  ScenarioStepRepository,
  ScenarioRunRepository,
  StepFeedbackRepository,
} from "../../database-service/repositories/index.js";
import type {
  ScenarioStepResult,
  ValidationScenarioRun,
  ValidationScenarioStep,
  ValidationStepFeedback,
} from "../../database-service/domain/entities.js";
import { assertScenarioChallenge } from "./scenario-guard.js";
import {
  EmptyScenarioError,
  RunNotFoundError,
  SelfWalkthroughError,
  TargetNotExposedError,
} from "./scenario-errors.js";

/** Une étape telle que le client la reçoit : le contenu du scénario + ce que j'y ai répondu. */
export interface WalkthroughStepState {
  stepId: string;
  position: number;
  title: string;
  instructions: string | null;
  result: ScenarioStepResult | null;
  comment: string | null;
  medicalComment: string | null;
}

/**
 * L'état complet d'une walkthrough. Une seule forme sert à l'ouverture et à
 * chaque enregistrement d'étape : le client n'a jamais à recoller deux
 * réponses de formes différentes pour savoir où il en est.
 */
export interface WalkthroughState {
  runId: string;
  contributionId: string;
  completedAt: Date | null;
  globalFeedback: string | null;
  steps: WalkthroughStepState[];
}

export interface ScenarioWalkthroughDeps {
  challengeRepo: Pick<ChallengeRepository, "findById">;
  targetRepo: Pick<ValidationTargetRepository, "findByChallenge">;
  stepRepo: Pick<ScenarioStepRepository, "findByChallenge">;
  runRepo: Pick<ScenarioRunRepository, "findById" | "findOne" | "create" | "complete">;
  feedbackRepo: Pick<StepFeedbackRepository, "findByRun" | "upsert">;
  contributionRepo: Pick<ContributionRepository, "findById" | "findByChallenge" | "create">;
  memberRepo: Pick<ContributionMemberRepository, "findByContribution">;
  userRepo: Pick<UserRepository, "findById">;
  rewardRepo: Pick<RewardEntryRepository, "sumByChallenge" | "createManyAndSyncRewards">;
}

/**
 * ScenarioWalkthroughService
 * --------------------------
 * Un validateur parcourt le scénario sur une application déployée : il ouvre
 * (ou reprend) sa walkthrough, marque chaque étape passed/failed/blocked avec
 * un commentaire, puis la clôt sur un retour global obligatoire — ce qui la
 * rend immuable et paie `cp_per_validation` depuis le pool du challenge.
 *
 * Ce service n'appelle jamais l'application : c'est le navigateur du
 * validateur qui la charge, dans une iframe. Il n'y a donc ni proxy, ni
 * timeout, ni garde SSRF ici — cette garde existait pour protéger le serveur
 * qui émettait la requête, et elle reste seulement à l'exposition de la cible.
 *
 * Il ne touche jamais `evaluation_status`, `evaluation` ni `globalScore` de la
 * contribution `project` : il répond à une autre question (« cette
 * application est-elle utilisable ? ») avec son propre budget.
 */
export class ScenarioWalkthroughService {
  private deps: ScenarioWalkthroughDeps;

  constructor(deps?: Partial<ScenarioWalkthroughDeps>) {
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      targetRepo: new ValidationTargetRepository(),
      stepRepo: new ScenarioStepRepository(),
      runRepo: new ScenarioRunRepository(),
      feedbackRepo: new StepFeedbackRepository(),
      contributionRepo: new ContributionRepository(),
      memberRepo: new ContributionMemberRepository(),
      userRepo: new UserRepository(),
      rewardRepo: new RewardEntryRepository(),
      ...deps,
    };
  }

  /**
   * Idempotent : crée le brouillon, ou renvoie celui que j'ai laissé en
   * cours avec les retours d'étape déjà enregistrés. Il n'y a pas d'étape de
   * réservation, donc pas d'état « abandonné » à nettoyer — même propriété que
   * la réclamation du flux ML.
   */
  async openWalkthrough(input: {
    validationChallengeId: string;
    contributionId: string;
    validatorUserId: string;
  }): Promise<WalkthroughState> {
    const { validationChallengeId, contributionId, validatorUserId } = input;

    await assertScenarioChallenge(this.deps.challengeRepo, validationChallengeId);
    await this.assertExposed(validationChallengeId, contributionId);

    const steps = await this.deps.stepRepo.findByChallenge(validationChallengeId);
    if (steps.length === 0) {
      // Sans étape, la walkthrough serait complétable immédiatement — aucune
      // étape ne manquerait — et paierait pour un parcours qui n'existe pas.
      throw new EmptyScenarioError("This challenge has no scenario step yet");
    }

    await this.assertNotOwnApplication(contributionId, validatorUserId);

    const existing = await this.deps.runRepo.findOne(validationChallengeId, contributionId, validatorUserId);
    if (existing) return this.stateOf(existing, steps);

    const created = await this.deps.runRepo.create({
      validation_challenge_id: validationChallengeId,
      contribution_id: contributionId,
      validator_user_id: validatorUserId,
    });
    if (created) return this.stateOf(created, steps);

    // create() a renvoyé null : l'index unique a rejeté l'insert parce qu'une
    // requête concurrente du même validateur a gagné. La ligne existe, on la
    // relit — ce n'est pas un conflit du point de vue de l'utilisateur, qui a
    // simplement double-cliqué.
    const winner = await this.deps.runRepo.findOne(validationChallengeId, contributionId, validatorUserId);
    if (!winner) throw new RunNotFoundError("Could not open the walkthrough");
    return this.stateOf(winner, steps);
  }

  /** L'application doit être exposée comme cible sur ce challenge de validation. */
  private async assertExposed(validationChallengeId: string, contributionId: string): Promise<void> {
    const targets = await this.deps.targetRepo.findByChallenge(validationChallengeId);
    if (!targets.some(t => t.contribution_id === contributionId)) {
      throw new TargetNotExposedError("This application is not exposed on this validation challenge");
    }
  }

  /**
   * Pas ma propre application — vérifié contre `contributions.user_id` ET
   * contre `contribution_members`.
   *
   * Les challenges code acceptent des groupes de 2-3 contributeurs partageant
   * une contribution, où `user_id` n'est que le *porteur*. Un contrôle naïf
   * sur `user_id` laisserait un co-équipier valider l'application de son
   * propre groupe. Les challenges ML n'ont pas de groupes : cette garde n'a
   * aucun équivalent dans le flux existant, c'est du code neuf, pas un port.
   */
  private async assertNotOwnApplication(contributionId: string, userId: string): Promise<void> {
    const contribution = await this.deps.contributionRepo.findById(contributionId);
    if (!contribution) {
      throw new TargetNotExposedError("This application no longer exists");
    }
    if (contribution.user_id === userId) {
      throw new SelfWalkthroughError("You cannot walk through your own application");
    }
    const members = await this.deps.memberRepo.findByContribution(contributionId);
    if (members.some(m => m.user_id === userId)) {
      throw new SelfWalkthroughError("You cannot walk through your own group's application");
    }
  }

  /** Le scénario joint à mes réponses, dans l'ordre des étapes. */
  private async stateOf(run: ValidationScenarioRun, steps: ValidationScenarioStep[]): Promise<WalkthroughState> {
    const feedbacks = await this.deps.feedbackRepo.findByRun(run.uuid);
    const byStep = new Map<string, ValidationStepFeedback>(feedbacks.map(f => [f.step_id, f]));

    return {
      runId: run.uuid,
      contributionId: run.contribution_id,
      completedAt: run.completed_at,
      globalFeedback: run.global_feedback,
      steps: steps.map(s => {
        const f = byStep.get(s.uuid);
        return {
          stepId: s.uuid,
          position: s.position,
          title: s.title,
          instructions: s.instructions,
          result: f?.result ?? null,
          comment: f?.comment ?? null,
          medicalComment: f?.medical_comment ?? null,
        };
      }),
    };
  }
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run packages/services/challenge/scenario-walkthrough.service.test.ts`
Expected: PASS — 11 tests. (`saveStepFeedback` and `completeWalkthrough` arrive in Tasks 9 and 10; the unused mock fields in `makeDeps` are there for them.)

- [ ] **Step 7: Re-export from the barrel**

Add to `packages/services/challenge/index.ts`:

```ts
export { assertScenarioChallenge } from "./scenario-guard.js";
export { ScenarioWalkthroughService } from "./scenario-walkthrough.service.js";
export type { ScenarioWalkthroughDeps, WalkthroughState, WalkthroughStepState } from "./scenario-walkthrough.service.js";
```

- [ ] **Step 8: Commit**

```bash
git add packages/services/challenge/scenario-guard.ts packages/services/challenge/scenario-walkthrough.service.ts packages/services/challenge/scenario-walkthrough.service.test.ts packages/services/challenge/scenario-steps.service.ts packages/services/challenge/index.ts
git commit -m "feat(validation): open a walkthrough, and keep it off your own application"
```

---

### Task 9: `saveStepFeedback` — one step at a time, saved as you go

**Files:**
- Modify: `packages/services/challenge/scenario-walkthrough.service.ts`
- Test: `packages/services/challenge/scenario-walkthrough.service.test.ts`

**Interfaces:**
- Consumes: `WalkthroughState`, the deps and private helpers from Task 8.
- Produces:

```ts
saveStepFeedback(input: {
  validationChallengeId: string; runId: string; stepId: string; validatorUserId: string;
  result: ScenarioStepResult; comment: string | null; medicalComment: string | null;
}): Promise<WalkthroughState>
```

- [ ] **Step 1: Write the failing tests**

Append to `packages/services/challenge/scenario-walkthrough.service.test.ts`. Add `MedicalCommentForbiddenError`, `RunNotFoundError`, `ForbiddenRunAccessError`, `RunAlreadyCompletedError` and `StepNotFoundError` to the imports from `./scenario-errors.js`, then:

```ts
const DRAFT: ValidationScenarioRun = {
  uuid: "run-mine", validation_challenge_id: VCH, contribution_id: APP,
  validator_user_id: VALIDATOR, global_feedback: null, completed_at: null, created_at: new Date(),
};

function save(deps: ScenarioWalkthroughDeps, over: Partial<Parameters<ScenarioWalkthroughService["saveStepFeedback"]>[0]> = {}) {
  return new ScenarioWalkthroughService(deps).saveStepFeedback({
    validationChallengeId: VCH, runId: "run-mine", stepId: "step-1", validatorUserId: VALIDATOR,
    result: "passed", comment: null, medicalComment: null,
    ...over,
  });
}

describe("saveStepFeedback", () => {
  it("upserts the result and the comment, and returns the whole walkthrough state", async () => {
    const { deps, upserts } = makeDeps({ existingRun: DRAFT });

    const state = await save(deps, { result: "blocked", comment: "The save button does nothing." });

    expect(upserts).toEqual([{
      run_id: "run-mine", step_id: "step-1", result: "blocked",
      comment: "The save button does nothing.", medical_comment: null,
    }]);
    expect(state.runId).toBe("run-mine");
    expect(state.steps).toHaveLength(2);
  });

  it("lets a medical_pro record a medical comment alongside the user-experience one", async () => {
    // Les deux lentilles coexistent sur la même étape : ce n'est pas un
    // onglet, pas un mode, pas un remplacement.
    const { deps, upserts } = makeDeps({ existingRun: DRAFT, validatorRole: "medical_pro" });

    await save(deps, {
      result: "failed",
      comment: "The PDF opens blank.",
      medicalComment: "A measurement without its unit is not a clinical record.",
    });

    expect(upserts[0]).toMatchObject({
      comment: "The PDF opens blank.",
      medical_comment: "A measurement without its unit is not a clinical record.",
    });
  });

  it("refuses a medical comment from a validator who is not a medical_pro", async () => {
    const { deps, upserts } = makeDeps({ existingRun: DRAFT, validatorRole: "contributor" });

    await expect(save(deps, { medicalComment: "Clinically unsafe." })).rejects.toThrow(MedicalCommentForbiddenError);
    expect(upserts).toEqual([]);
  });

  it("accepts an empty-string medical comment from a non-medical_pro as no comment at all", async () => {
    // Le champ n'existe pas dans leur interface ; un client qui envoie une
    // chaîne vide ne doit pas être traité comme une tentative d'écriture.
    const { deps, upserts } = makeDeps({ existingRun: DRAFT, validatorRole: "contributor" });

    await save(deps, { medicalComment: "   " });

    expect(upserts[0].medical_comment).toBeNull();
  });

  it("lets me go back and change an earlier step while the walkthrough is a draft", async () => {
    // Revenir n'est pas un rollback : un validateur qui comprend à l'étape 5
    // que l'étape 2 était cassée doit pouvoir la corriger.
    const { deps, upserts } = makeDeps({
      existingRun: DRAFT,
      feedbacks: [{ uuid: "fb-1", run_id: "run-mine", step_id: "step-1", result: "passed", comment: null, medical_comment: null, created_at: new Date() }],
    });

    await save(deps, { stepId: "step-1", result: "failed", comment: "Actually broken." });

    expect(upserts[0]).toMatchObject({ step_id: "step-1", result: "failed", comment: "Actually broken." });
  });

  it("refuses to touch a completed walkthrough", async () => {
    const { deps } = makeDeps({
      existingRun: { ...DRAFT, completed_at: new Date(), global_feedback: "Done." },
    });

    await expect(save(deps)).rejects.toThrow(RunAlreadyCompletedError);
  });

  it("refuses a walkthrough that belongs to someone else", async () => {
    const { deps } = makeDeps({ existingRun: { ...DRAFT, validator_user_id: "carol" } });

    await expect(save(deps)).rejects.toThrow(ForbiddenRunAccessError);
  });

  it("404s on a walkthrough that does not exist", async () => {
    const { deps } = makeDeps({ existingRun: null });

    await expect(save(deps)).rejects.toThrow(RunNotFoundError);
  });

  it("404s on a walkthrough recorded against another challenge", async () => {
    const { deps } = makeDeps({ existingRun: { ...DRAFT, validation_challenge_id: "other-vch" } });

    await expect(save(deps)).rejects.toThrow(RunNotFoundError);
  });

  it("404s on a step that is not part of this challenge's scenario", async () => {
    const { deps } = makeDeps({ existingRun: DRAFT });

    await expect(save(deps, { stepId: "step-elsewhere" })).rejects.toThrow(StepNotFoundError);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run packages/services/challenge/scenario-walkthrough.service.test.ts`
Expected: FAIL — `service.saveStepFeedback is not a function`.

- [ ] **Step 3: Implement `saveStepFeedback`**

Add to `ScenarioWalkthroughService`, and add `MedicalCommentForbiddenError`, `ForbiddenRunAccessError`, `RunAlreadyCompletedError`, `StepNotFoundError` to the `scenario-errors.js` import:

```ts
  /**
   * Enregistre le retour sur une étape. Appelé à chaque saisie, ce qui est ce
   * qui rend la navigation entre étapes non destructive et la fermeture de
   * l'onglet sans conséquence.
   *
   * Le corps porte l'état complet du panneau d'étape : un champ commentaire
   * absent vaut vide, jamais « garde l'ancienne valeur ». C'est ce contrat qui
   * permet un seul upsert, sans lecture préalable.
   */
  async saveStepFeedback(input: {
    validationChallengeId: string;
    runId: string;
    stepId: string;
    validatorUserId: string;
    result: ScenarioStepResult;
    comment: string | null;
    medicalComment: string | null;
  }): Promise<WalkthroughState> {
    const { validationChallengeId, runId, stepId, validatorUserId, result } = input;

    await assertScenarioChallenge(this.deps.challengeRepo, validationChallengeId);
    const run = await this.loadDraft(validationChallengeId, runId, validatorUserId);

    const steps = await this.deps.stepRepo.findByChallenge(validationChallengeId);
    if (!steps.some(s => s.uuid === stepId)) {
      throw new StepNotFoundError("Step not found in this challenge's scenario");
    }

    const medicalComment = await this.resolveMedicalComment(validatorUserId, input.medicalComment);

    await this.deps.feedbackRepo.upsert({
      run_id: run.uuid,
      step_id: stepId,
      result,
      comment: blankToNull(input.comment),
      medical_comment: medicalComment,
    });

    return this.stateOf(run, steps);
  }

  /**
   * L'avis médical est réservé au rôle `medical_pro` — la même frontière de
   * qualification que le flux ML trace déjà, et non une frontière
   * d'appartenance au challenge.
   *
   * Une chaîne vide n'est pas une tentative d'écriture : un validateur sans
   * le rôle n'a simplement pas le champ, et un client qui poste `""` ne doit
   * pas récolter un 403.
   */
  private async resolveMedicalComment(validatorUserId: string, raw: string | null): Promise<string | null> {
    const value = blankToNull(raw);
    if (value === null) return null;

    const user = await this.deps.userRepo.findById(validatorUserId);
    if (user?.role !== "medical_pro") {
      throw new MedicalCommentForbiddenError("Only medical_pro users can leave a medical opinion");
    }
    return value;
  }

  /** La walkthrough doit exister sur ce challenge, m'appartenir, et être encore brouillon. */
  private async loadDraft(
    validationChallengeId: string,
    runId: string,
    validatorUserId: string
  ): Promise<ValidationScenarioRun> {
    const run = await this.deps.runRepo.findById(runId);
    if (!run || run.validation_challenge_id !== validationChallengeId) {
      throw new RunNotFoundError("Walkthrough not found on this validation challenge");
    }
    if (run.validator_user_id !== validatorUserId) {
      throw new ForbiddenRunAccessError("This walkthrough does not belong to you");
    }
    if (run.completed_at) {
      throw new RunAlreadyCompletedError("This walkthrough is completed and cannot be changed");
    }
    return run;
  }
```

And add the helper at module scope, below the imports:

```ts
/** Un champ texte vide ou blanc vaut « pas de contenu », jamais une chaîne vide en base. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run packages/services/challenge/scenario-walkthrough.service.test.ts`
Expected: PASS — 21 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/services/challenge/scenario-walkthrough.service.ts packages/services/challenge/scenario-walkthrough.service.test.ts
git commit -m "feat(validation): record one step's verdict without losing the rest"
```

---

### Task 10: `completeWalkthrough` — closing the pass, and paying for it

**Files:**
- Create: `packages/services/challenge/validatorContribution.ts`
- Modify: `packages/services/challenge/validation-challenge.service.ts:220-240` (use the extracted helper)
- Modify: `packages/services/challenge/scenario-walkthrough.service.ts`
- Test: `packages/services/challenge/scenario-walkthrough.service.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 8 and 9.
- Produces:

```ts
export async function findOrCreateValidatorContribution(
  deps: { contributionRepo: Pick<ContributionRepository, "findByChallenge" | "create"> },
  challenge: Challenge,
  userId: string
): Promise<Contribution>

export interface CompleteWalkthroughResult { completed: true; cpAwarded: number }

completeWalkthrough(input: {
  validationChallengeId: string; runId: string; validatorUserId: string; globalFeedback: string;
}): Promise<CompleteWalkthroughResult>
```

- [ ] **Step 1: Extract the validator-contribution helper**

Create `packages/services/challenge/validatorContribution.ts`. The body is lifted verbatim from `ValidationChallengeService.findOrCreateValidatorContribution`:

```ts
import { ContributionRepository } from "../../database-service/repositories/index.js";
import type { Challenge, Contribution } from "../../database-service/domain/entities.js";

/**
 * La contribution `type: 'validation'` qui agrège le ledger d'un validateur
 * sur un challenge — une par (validateur, challenge), créée à la première
 * récompense. Miroir du motif `type: 'discussion'` des signaux Slack : une
 * puce sur le profil, pas une entrée dans la liste des contributions.
 *
 * Extraite parce que les deux modes de validation paient exactement pareil —
 * `rule_key: 'validation'`, mêmes points, même contribution d'agrégation. Une
 * seconde copie de ces dix lignes serait une seconde façon de nommer la même
 * contribution, donc deux lignes d'agrégat pour une seule personne.
 */
export async function findOrCreateValidatorContribution(
  deps: { contributionRepo: Pick<ContributionRepository, "findByChallenge" | "create"> },
  challenge: Challenge,
  userId: string
): Promise<Contribution> {
  const all = await deps.contributionRepo.findByChallenge(challenge.uuid);
  const existing = all.find(c => c.type === "validation" && c.user_id === userId);
  if (existing) return existing;
  return deps.contributionRepo.create({
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
```

In `validation-challenge.service.ts`, delete the private `findOrCreateValidatorContribution` method, import the helper, and change the one call site in `payMajority`:

```ts
      const validatorContribution = await findOrCreateValidatorContribution(this.deps, challenge, v.validator_user_id);
```

- [ ] **Step 2: Run the ML suite as the regression gate**

Run: `npx vitest run packages/services/challenge/validation-challenge.service.test.ts`
Expected: PASS — every existing test, unchanged. The extraction is behaviour-preserving.

- [ ] **Step 3: Write the failing completion tests**

Append to `packages/services/challenge/scenario-walkthrough.service.test.ts`. Add `IncompleteWalkthroughError` and `GlobalFeedbackRequiredError` to the error imports, then:

```ts
function bothAnswered(): ValidationStepFeedback[] {
  return [
    { uuid: "fb-1", run_id: "run-mine", step_id: "step-1", result: "passed", comment: null, medical_comment: null, created_at: new Date() },
    { uuid: "fb-2", run_id: "run-mine", step_id: "step-2", result: "failed", comment: "Login loops.", medical_comment: null, created_at: new Date() },
  ];
}

function complete(deps: ScenarioWalkthroughDeps, globalFeedback = "Usable, but the login loops.") {
  return new ScenarioWalkthroughService(deps).completeWalkthrough({
    validationChallengeId: VCH, runId: "run-mine", validatorUserId: VALIDATOR, globalFeedback,
  });
}

describe("completeWalkthrough", () => {
  it("stamps the walkthrough completed and pays cp_per_validation", async () => {
    const { deps, completed, rewardBatches } = makeDeps({
      existingRun: DRAFT, feedbacks: bothAnswered(), cpPerValidation: 200, pool: 12000, distributed: 2600,
    });

    const result = await complete(deps);

    expect(completed).toEqual([{ uuid: "run-mine", feedback: "Usable, but the login loops." }]);
    expect(result).toEqual({ completed: true, cpAwarded: 200 });
    expect(rewardBatches).toEqual([[{
      challenge_id: VCH,
      user_id: VALIDATOR,
      contribution_id: "validator-contrib",
      rule_key: "validation",
      points: 200,
      meta: { targetContributionId: APP, runId: "run-mine" },
    }]]);
  });

  it("attributes the entry to the validator's aggregate validation contribution", async () => {
    const { deps, contributionsCreated } = makeDeps({ existingRun: DRAFT, feedbacks: bothAnswered() });

    await complete(deps);

    expect(contributionsCreated).toEqual([expect.objectContaining({
      type: "validation", user_id: VALIDATOR, challenge_id: VCH, reward: 0,
    })]);
  });

  it("clamps the payment to what is left in the pool", async () => {
    const { deps, rewardBatches } = makeDeps({
      existingRun: DRAFT, feedbacks: bothAnswered(), cpPerValidation: 200, pool: 12000, distributed: 11950,
    });

    const result = await complete(deps);

    expect(result.cpAwarded).toBe(50);
    expect(rewardBatches[0][0].points).toBe(50);
  });

  it("completes for 0 CP against an exhausted pool rather than refusing the work already done", async () => {
    // La bannière de pool est ce qui évite la surprise ; refuser ici
    // effacerait un parcours entier déjà effectué.
    const { deps, completed, rewardBatches } = makeDeps({
      existingRun: DRAFT, feedbacks: bothAnswered(), pool: 12000, distributed: 12000,
    });

    const result = await complete(deps);

    expect(result).toEqual({ completed: true, cpAwarded: 0 });
    expect(completed).toHaveLength(1);
    expect(rewardBatches).toEqual([]);
  });

  it("refuses while a step has no result, and names the offending steps", async () => {
    // Le client allume les points correspondants dans la barre de
    // progression : le validateur saute dessus au lieu de les chercher.
    const { deps, completed } = makeDeps({
      existingRun: DRAFT,
      feedbacks: [{ uuid: "fb-1", run_id: "run-mine", step_id: "step-1", result: "passed", comment: null, medical_comment: null, created_at: new Date() }],
    });

    await expect(complete(deps)).rejects.toMatchObject({
      constructor: IncompleteWalkthroughError,
      missingStepIds: ["step-2"],
    });
    expect(completed).toEqual([]);
  });

  it("refuses an empty overall feedback", async () => {
    const { deps } = makeDeps({ existingRun: DRAFT, feedbacks: bothAnswered() });

    await expect(complete(deps, "   ")).rejects.toThrow(GlobalFeedbackRequiredError);
  });

  it("refuses to complete twice", async () => {
    const { deps } = makeDeps({
      existingRun: { ...DRAFT, completed_at: new Date(), global_feedback: "Done." },
      feedbacks: bothAnswered(),
    });

    await expect(complete(deps)).rejects.toThrow(RunAlreadyCompletedError);
  });

  it("pays nothing when it loses the completion race", async () => {
    // complete() garde sur `completed_at IS NULL` : renvoyer null veut dire
    // qu'une requête concurrente a déjà complété ET payé cette walkthrough.
    const { deps, rewardBatches } = makeDeps({
      existingRun: DRAFT, feedbacks: bothAnswered(), completeReturnsNull: true,
    });

    await expect(complete(deps)).rejects.toThrow(RunAlreadyCompletedError);
    expect(rewardBatches).toEqual([]);
  });

  it("re-checks the not-my-own-application guard at completion, not only at opening", async () => {
    // Même posture de défense en profondeur que castVerdict, qui revérifie ce
    // que la route de révélation a déjà imposé.
    const { deps } = makeDeps({
      existingRun: DRAFT, feedbacks: bothAnswered(), appHolder: "alice", appMembers: ["alice", VALIDATOR],
    });

    await expect(complete(deps)).rejects.toThrow(SelfWalkthroughError);
  });

  it("refuses a walkthrough that belongs to someone else", async () => {
    const { deps } = makeDeps({ existingRun: { ...DRAFT, validator_user_id: "carol" }, feedbacks: bothAnswered() });

    await expect(complete(deps)).rejects.toThrow(ForbiddenRunAccessError);
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `npx vitest run packages/services/challenge/scenario-walkthrough.service.test.ts`
Expected: FAIL — `service.completeWalkthrough is not a function`.

- [ ] **Step 5: Implement `completeWalkthrough`**

Add to the imports of `scenario-walkthrough.service.ts`:

```ts
import type { RewardEntryDraft } from "../../database-service/repositories/index.js";
import type { Challenge } from "../../database-service/domain/entities.js";
import { findOrCreateValidatorContribution } from "./validatorContribution.js";
import { GlobalFeedbackRequiredError, IncompleteWalkthroughError } from "./scenario-errors.js";
```

Add the result type next to `WalkthroughState`:

```ts
export interface CompleteWalkthroughResult {
  completed: true;
  /** CP réellement versés — 0 si le pool était déjà vide quand c'est arrivé à ce validateur. */
  cpAwarded: number;
}
```

And the method:

```ts
  /**
   * Clôt la walkthrough : elle devient immuable et paie `cp_per_validation`,
   * écrêté au reliquat du pool.
   *
   * L'ordre compte. `runRepo.complete()` est gardé sur `completed_at IS NULL`
   * et renvoie null si une requête concurrente est passée avant — on paie
   * donc **après** l'avoir gagné, jamais avant. C'est ce qui rend un
   * double-clic inoffensif sans transaction explicite, exactement comme
   * `targetRepo.resolve()` côté ML.
   *
   * Ne touche ni `evaluation_status`, ni `evaluation`, ni `globalScore` de la
   * contribution `project` parcourue, et ne verse rien à son auteur : les CP
   * restent entièrement du côté validateur.
   */
  async completeWalkthrough(input: {
    validationChallengeId: string;
    runId: string;
    validatorUserId: string;
    globalFeedback: string;
  }): Promise<CompleteWalkthroughResult> {
    const { validationChallengeId, runId, validatorUserId } = input;

    const challenge = await assertScenarioChallenge(this.deps.challengeRepo, validationChallengeId);
    const run = await this.loadDraft(validationChallengeId, runId, validatorUserId);

    const globalFeedback = blankToNull(input.globalFeedback);
    if (!globalFeedback) {
      throw new GlobalFeedbackRequiredError("An overall feedback is required to finish a walkthrough");
    }

    // Défense en profondeur : la garde a déjà tourné à l'ouverture, mais une
    // adhésion de groupe a pu naître entre-temps — et castVerdict revérifie
    // pareil ce que la route de révélation avait déjà imposé.
    await this.assertNotOwnApplication(run.contribution_id, validatorUserId);

    const steps = await this.deps.stepRepo.findByChallenge(validationChallengeId);
    const answered = new Set((await this.deps.feedbackRepo.findByRun(run.uuid)).map(f => f.step_id));
    const missingStepIds = steps.filter(s => !answered.has(s.uuid)).map(s => s.uuid);
    if (missingStepIds.length > 0) {
      throw new IncompleteWalkthroughError(
        missingStepIds.length === 1
          ? "1 step still has no result"
          : `${missingStepIds.length} steps still have no result`,
        missingStepIds
      );
    }

    const completedRun = await this.deps.runRepo.complete(run.uuid, globalFeedback);
    if (!completedRun) {
      // Une requête concurrente a complété — et payé — cette walkthrough.
      throw new RunAlreadyCompletedError("This walkthrough is completed and cannot be changed");
    }

    const cpAwarded = await this.payWalkthrough(challenge, completedRun);
    return { completed: true, cpAwarded };
  }

  /** Une seule ligne de ledger, écrêtée au reliquat. Même forme exactement que le paiement ML, donc `validation-rewards` et ValidationRewardsPanel n'ont rien à apprendre. */
  private async payWalkthrough(challenge: Challenge, run: ValidationScenarioRun): Promise<number> {
    const distributed = await this.deps.rewardRepo.sumByChallenge(challenge.uuid);
    const remaining = Math.max(0, challenge.contribution_points_reward - distributed);
    const grant = Math.min(challenge.cp_per_validation ?? 0, remaining);
    // Pool vide : la walkthrough est complétée quand même. Refuser ici
    // effacerait un parcours entier déjà effectué ; la bannière de pool est
    // ce qui évite la surprise, en amont.
    if (grant <= 0) return 0;

    const validatorContribution = await findOrCreateValidatorContribution(this.deps, challenge, run.validator_user_id);
    const entry: RewardEntryDraft = {
      challenge_id: challenge.uuid,
      user_id: run.validator_user_id,
      contribution_id: validatorContribution.uuid,
      rule_key: "validation",
      points: grant,
      meta: { targetContributionId: run.contribution_id, runId: run.uuid },
    };
    await this.deps.rewardRepo.createManyAndSyncRewards([entry]);
    return grant;
  }
```

- [ ] **Step 6: Run the full service suite**

Run: `npx vitest run packages/services/challenge/scenario-walkthrough.service.test.ts`
Expected: PASS — 31 tests.

- [ ] **Step 7: Run every service suite as a regression gate**

Run: `npx vitest run packages/services/challenge`
Expected: PASS — in particular `validation-challenge.service.test.ts` and `scenario-steps.service.test.ts`, both of which this task refactored under.

- [ ] **Step 8: Commit**

```bash
git add packages/services/challenge/validatorContribution.ts packages/services/challenge/validation-challenge.service.ts packages/services/challenge/scenario-walkthrough.service.ts packages/services/challenge/scenario-walkthrough.service.test.ts packages/services/challenge/index.ts
git commit -m "feat(validation): finish a walkthrough and pay for it once"
```

---

### Task 11: The walkthrough routes

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-runs/route.ts` (`POST` only for now; `GET` lands in Task 12)
- Test: `…/validation-scenario-runs/route.test.ts`
- Create: `…/validation-scenario-runs/[runId]/steps/[stepId]/route.ts`
- Test: `…/validation-scenario-runs/[runId]/steps/[stepId]/route.test.ts`
- Create: `…/validation-scenario-runs/[runId]/complete/route.ts`
- Test: `…/validation-scenario-runs/[runId]/complete/route.test.ts`
- Create: `apps/leaderboard-client/src/lib/server/scenarioErrorResponse.ts`

**Interfaces:**
- Consumes: `ScenarioWalkthroughService` and all the scenario errors (Tasks 8-10).
- Produces the wire contract `ScenarioWalkthroughScreen` (Task 15) consumes:

```ts
// POST /api/challenges/:id/validation-scenario-runs            { contribution_id }  -> 200 WalkthroughWire
// PUT  .../validation-scenario-runs/:runId/steps/:stepId       { result, comment?, medical_comment? } -> 200 WalkthroughWire
// POST .../validation-scenario-runs/:runId/complete            { global_feedback }  -> 200 { completed: true, cpAwarded: number }

interface WalkthroughWire {
  runId: string;
  contributionId: string;
  completedAt: string | null;
  globalFeedback: string | null;
  steps: Array<{
    stepId: string; position: number; title: string; instructions: string | null;
    result: 'passed' | 'failed' | 'blocked' | null;
    comment: string | null; medicalComment: string | null;
  }>;
}
```

A 400 from `/complete` caused by unanswered steps also carries `missingStepIds: string[]`, so the client can highlight those dots in the progress strip.

- [ ] **Step 1: Write the shared error mapping**

Create `apps/leaderboard-client/src/lib/server/scenarioErrorResponse.ts`. All three routes plus the oversight route map the same errors; one table beats four.

```ts
import { NextResponse } from 'next/server';
import {
  ScenarioModeError,
  ScenarioFrozenError,
  EmptyScenarioError,
  StepNotFoundError,
  RunNotFoundError,
  ForbiddenRunAccessError,
  SelfWalkthroughError,
  RunAlreadyCompletedError,
  GlobalFeedbackRequiredError,
  MedicalCommentForbiddenError,
  TargetNotExposedError,
  IncompleteWalkthroughError,
} from '../../../../../packages/services/challenge/scenario-errors';

/**
 * Erreur du flux scénario -> statut HTTP. Renvoie null si l'erreur n'est pas
 * l'une des siennes, pour que l'appelant la logge et réponde 500.
 *
 * IncompleteWalkthroughError sort avec `missingStepIds` : le client allume
 * les points concernés dans la barre de progression au lieu de laisser le
 * validateur chercher lesquels il a sautés.
 */
export function scenarioErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof IncompleteWalkthroughError) {
    return NextResponse.json({ error: error.message, missingStepIds: error.missingStepIds }, { status: 400 });
  }
  if (error instanceof SelfWalkthroughError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof ForbiddenRunAccessError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof MedicalCommentForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
  if (error instanceof RunNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof StepNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof RunAlreadyCompletedError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof ScenarioFrozenError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof GlobalFeedbackRequiredError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof EmptyScenarioError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof TargetNotExposedError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof ScenarioModeError) return NextResponse.json({ error: error.message }, { status: 400 });
  return null;
}
```

Verify the `../` depth against a neighbouring file in `src/lib/server/` before committing — it must resolve to the repo-root `packages/`.

- [ ] **Step 2: Write the failing tests for all three routes**

Each file uses the same scaffolding: mock `@/lib/auth`, mock the service module, import the handler. Depth is **eight** `../` for `validation-scenario-runs/route.ts` and **eleven** for `[runId]/steps/[stepId]/route.ts`, **ten** for `[runId]/complete/route.ts`.

`…/validation-scenario-runs/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockOpenWalkthrough } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockOpenWalkthrough: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));
vi.mock('../../../../../../../../packages/services/challenge/scenario-walkthrough.service', () => ({
  ScenarioWalkthroughService: class { openWalkthrough = mockOpenWalkthrough; },
}));

import { POST } from './route';
import {
  SelfWalkthroughError,
  EmptyScenarioError,
  TargetNotExposedError,
} from '../../../../../../../../packages/services/challenge/scenario-errors';

const CHALLENGE_ID = 'vch-1';
const APP = '11111111-1111-4111-8111-111111111111';

function openRun(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-runs`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });
  mockOpenWalkthrough.mockResolvedValue({
    runId: 'run-1', contributionId: APP, completedAt: null, globalFeedback: null,
    steps: [{ stepId: 'step-1', position: 0, title: 'Create an account', instructions: null, result: null, comment: null, medicalComment: null }],
  });
});

describe('POST /api/challenges/[id]/validation-scenario-runs', () => {
  it('opens a walkthrough for any signed-in contributor', async () => {
    // Aucun rôle requis : n'importe quel contributeur peut parcourir une
    // application. Seul l'avis médical est gardé sur medical_pro.
    const res = await openRun({ contribution_id: APP });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runId).toBe('run-1');
    expect(mockOpenWalkthrough).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, contributionId: APP, validatorUserId: 'bob',
    });
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await openRun({ contribution_id: APP })).status).toBe(401);
    expect(mockOpenWalkthrough).not.toHaveBeenCalled();
  });

  it('rejects a body with no contribution_id', async () => {
    expect((await openRun({})).status).toBe(400);
  });

  it('returns 403 on my own application', async () => {
    mockOpenWalkthrough.mockRejectedValue(new SelfWalkthroughError('own'));

    expect((await openRun({ contribution_id: APP })).status).toBe(403);
  });

  it('returns 400 when the application is not exposed here', async () => {
    mockOpenWalkthrough.mockRejectedValue(new TargetNotExposedError('nope'));

    expect((await openRun({ contribution_id: APP })).status).toBe(400);
  });

  it('returns 400 when no scenario step has been written yet', async () => {
    mockOpenWalkthrough.mockRejectedValue(new EmptyScenarioError('empty'));

    expect((await openRun({ contribution_id: APP })).status).toBe(400);
  });
});
```

`…/[runId]/steps/[stepId]/route.test.ts` — same shape, mocking `saveStepFeedback`:

```ts
describe('PUT .../validation-scenario-runs/[runId]/steps/[stepId]', () => {
  it('saves a result and returns the whole walkthrough state', async () => {
    const res = await putStep({ result: 'passed' });

    expect(res.status).toBe(200);
    expect(mockSaveStepFeedback).toHaveBeenCalledWith({
      validationChallengeId: CHALLENGE_ID, runId: RUN_ID, stepId: STEP_ID, validatorUserId: 'bob',
      result: 'passed', comment: null, medicalComment: null,
    });
  });

  it('carries both the comment and the medical comment', async () => {
    await putStep({
      result: 'failed',
      comment: 'The PDF opens blank.',
      medical_comment: 'A measurement without its unit is not a clinical record.',
    });

    expect(mockSaveStepFeedback).toHaveBeenCalledWith(expect.objectContaining({
      comment: 'The PDF opens blank.',
      medicalComment: 'A measurement without its unit is not a clinical record.',
    }));
  });

  it('rejects a result outside passed/failed/blocked', async () => {
    expect((await putStep({ result: 'maybe' })).status).toBe(400);
  });

  it('returns 403 when a non-medical_pro sends a medical comment', async () => {
    mockSaveStepFeedback.mockRejectedValue(new MedicalCommentForbiddenError('no'));

    expect((await putStep({ result: 'passed', medical_comment: 'Unsafe.' })).status).toBe(403);
  });

  it('returns 409 on a completed walkthrough', async () => {
    mockSaveStepFeedback.mockRejectedValue(new RunAlreadyCompletedError('done'));

    expect((await putStep({ result: 'passed' })).status).toBe(409);
  });

  it('returns 403 on someone else\'s walkthrough', async () => {
    mockSaveStepFeedback.mockRejectedValue(new ForbiddenRunAccessError('not yours'));

    expect((await putStep({ result: 'passed' })).status).toBe(403);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await putStep({ result: 'passed' })).status).toBe(401);
  });
});
```

`…/[runId]/complete/route.test.ts` — mocking `completeWalkthrough`:

```ts
describe('POST .../validation-scenario-runs/[runId]/complete', () => {
  it('completes the walkthrough and reports the CP awarded', async () => {
    mockCompleteWalkthrough.mockResolvedValue({ completed: true, cpAwarded: 200 });

    const res = await completeRun({ global_feedback: 'Usable end to end.' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: true, cpAwarded: 200 });
  });

  it('rejects an empty overall feedback before it reaches the service', async () => {
    expect((await completeRun({ global_feedback: '   ' })).status).toBe(400);
    expect(mockCompleteWalkthrough).not.toHaveBeenCalled();
  });

  it('returns the unanswered step ids so the client can point at them', async () => {
    mockCompleteWalkthrough.mockRejectedValue(
      new IncompleteWalkthroughError('2 steps still have no result', ['step-3', 'step-5'])
    );

    const res = await completeRun({ global_feedback: 'Done.' });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.missingStepIds).toEqual(['step-3', 'step-5']);
    expect(body.error).toBe('2 steps still have no result');
  });

  it('returns 409 on an already-completed walkthrough', async () => {
    mockCompleteWalkthrough.mockRejectedValue(new RunAlreadyCompletedError('done'));

    expect((await completeRun({ global_feedback: 'Done.' })).status).toBe(409);
  });

  it('returns 403 when the application turns out to be my own group\'s', async () => {
    mockCompleteWalkthrough.mockRejectedValue(new SelfWalkthroughError('own'));

    expect((await completeRun({ global_feedback: 'Done.' })).status).toBe(403);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await completeRun({ global_feedback: 'Done.' })).status).toBe(401);
  });
});
```

- [ ] **Step 3: Run the three suites to verify they fail**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-runs"`
Expected: FAIL — `Failed to load url ./route` for all three.

- [ ] **Step 4: Write the three routes**

`…/validation-scenario-runs/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import type { WalkthroughState } from '../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';

const service = new ScenarioWalkthroughService();

/** Une seule forme pour l'ouverture et pour chaque enregistrement d'étape : le client n'a jamais deux réponses à recoller. */
export function toWalkthroughWire(state: WalkthroughState) {
  return {
    runId: state.runId,
    contributionId: state.contributionId,
    completedAt: state.completedAt,
    globalFeedback: state.globalFeedback,
    steps: state.steps,
  };
}

const openRunSchema = z.object({ contribution_id: z.string().uuid() });

// POST /api/challenges/[id]/validation-scenario-runs — tout contributeur connecté.
// Idempotent : crée le brouillon, ou renvoie celui laissé en cours avec les
// retours d'étape déjà enregistrés. Aucun rôle requis — seul l'avis médical
// est gardé sur medical_pro, étape par étape.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;
    const { contribution_id } = openRunSchema.parse(await req.json());

    const state = await service.openWalkthrough({
      validationChallengeId: challengeId,
      contributionId: contribution_id,
      validatorUserId: user.id,
    });

    return NextResponse.json(toWalkthroughWire(state));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error opening scenario walkthrough:', error);
    return NextResponse.json({ error: 'Failed to open the walkthrough' }, { status: 500 });
  }
}
```

`…/[runId]/steps/[stepId]/route.ts` — **eleven** `../`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';

const service = new ScenarioWalkthroughService();

// Le corps porte l'état complet du panneau d'étape : un champ commentaire
// absent vaut vide, jamais « garde l'ancienne valeur ». C'est ce contrat qui
// permet un seul upsert côté base, sans lecture préalable.
const saveStepSchema = z.object({
  result: z.enum(['passed', 'failed', 'blocked']),
  comment: z.string().nullish(),
  medical_comment: z.string().nullish(),
});

// PUT /api/challenges/[id]/validation-scenario-runs/[runId]/steps/[stepId]
// Émis à chaque saisie — c'est ce qui rend la navigation entre étapes non
// destructive et la fermeture de l'onglet sans conséquence.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string; stepId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId, runId, stepId } = await params;
    const body = saveStepSchema.parse(await req.json());

    const state = await service.saveStepFeedback({
      validationChallengeId: challengeId,
      runId,
      stepId,
      validatorUserId: user.id,
      result: body.result,
      comment: body.comment ?? null,
      medicalComment: body.medical_comment ?? null,
    });

    return NextResponse.json({
      runId: state.runId,
      contributionId: state.contributionId,
      completedAt: state.completedAt,
      globalFeedback: state.globalFeedback,
      steps: state.steps,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error saving scenario step feedback:', error);
    return NextResponse.json({ error: 'Failed to save the step' }, { status: 500 });
  }
}
```

`…/[runId]/complete/route.ts` — **ten** `../`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ScenarioWalkthroughService } from '../../../../../../../../../../packages/services/challenge/scenario-walkthrough.service';
import { scenarioErrorResponse } from '@/lib/server/scenarioErrorResponse';
import { getSessionUser } from '@/lib/auth';

const service = new ScenarioWalkthroughService();

const completeSchema = z.object({ global_feedback: z.string().trim().min(1) });

// POST /api/challenges/[id]/validation-scenario-runs/[runId]/complete
// Rend la walkthrough immuable et paie cp_per_validation, écrêté au reliquat
// du pool. 400 avec `missingStepIds` s'il reste des étapes sans résultat.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId, runId } = await params;
    const { global_feedback } = completeSchema.parse(await req.json());

    const result = await service.completeWalkthrough({
      validationChallengeId: challengeId,
      runId,
      validatorUserId: user.id,
      globalFeedback: global_feedback,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'An overall feedback is required', details: error.issues }, { status: 400 });
    }
    const mapped = scenarioErrorResponse(error);
    if (mapped) return mapped;
    console.error('Error completing scenario walkthrough:', error);
    return NextResponse.json({ error: 'Failed to complete the walkthrough' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run the three suites to verify they pass**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-runs"`
Expected: PASS — 19 tests across the three files.

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors — in particular, every `../` depth resolves.

- [ ] **Step 6: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-runs" apps/leaderboard-client/src/lib/server/scenarioErrorResponse.ts
git commit -m "feat(validation): walk, save and close a walkthrough over HTTP"
```

---

### Task 12: The oversight route

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-runs/route.ts` (add `GET`)
- Test: `…/validation-scenario-runs/route.test.ts`

**Interfaces:**
- Consumes: `ScenarioStepRepository`, `ScenarioRunRepository`, `StepFeedbackRepository` (Task 1).
- Produces the shape `ScenarioWalkthroughsPanel` (Task 13) renders:

```ts
{
  steps: Array<{ id: string; position: number; title: string }>,
  runs: Array<{
    id: string;
    contributionId: string;
    submitterName: string;
    endpointUrl: string | null;
    validatorId: string;
    validatorName: string;
    isMedicalPro: boolean;
    completedAt: string | null;
    globalFeedback: string | null;
    answeredCount: number;
    stepFeedbacks: Array<{ stepId: string; result: 'passed' | 'failed' | 'blocked'; comment: string | null; medicalComment: string | null }>,
  }>,
}
```

`steps` ships alongside so the panel can render marks in scenario order without a second request. Runs are ordered oldest first, and `stepFeedbacks` follows scenario order — not insertion order, which would scramble the mark row.

- [ ] **Step 1: Write the failing tests**

Append to `…/validation-scenario-runs/route.test.ts`. Extend the hoisted mocks and the module mock with the three repositories and `isManagerOfChallenge`:

```ts
vi.mock('@/lib/server/managerAuth', () => ({ isManagerOfChallenge: mockIsManagerOfChallenge }));
vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockChallengeFindById; },
  ContributionRepository: class { findById = mockContributionFindById; },
  UserRepository: class { findByIds = mockUserFindByIds; },
  ScenarioStepRepository: class { findByChallenge = mockStepFindByChallenge; },
  ScenarioRunRepository: class { findByChallenge = mockRunFindByChallenge; },
  StepFeedbackRepository: class { findByRuns = mockFeedbackFindByRuns; },
}));
```

Then:

```ts
describe('GET /api/challenges/[id]/validation-scenario-runs', () => {
  const APP_B = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    mockGetSessionUser.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockIsManagerOfChallenge.mockResolvedValue(false);
    mockChallengeFindById.mockResolvedValue({ uuid: CHALLENGE_ID, type: 'validation', source_challenge_id: 'code-ch-1' });
    mockStepFindByChallenge.mockResolvedValue([
      { uuid: 'step-1', position: 0, title: 'Create an account' },
      { uuid: 'step-2', position: 1, title: 'Log in' },
    ]);
    mockRunFindByChallenge.mockResolvedValue([
      { uuid: 'run-1', contribution_id: APP, validator_user_id: 'bob', completed_at: new Date('2026-09-08'), global_feedback: 'Usable end to end.' },
      { uuid: 'run-2', contribution_id: APP_B, validator_user_id: 'carol', completed_at: null, global_feedback: null },
    ]);
    mockFeedbackFindByRuns.mockResolvedValue([
      { uuid: 'fb-2', run_id: 'run-1', step_id: 'step-2', result: 'failed', comment: 'Login loops.', medical_comment: 'Not usable in consultation.' },
      { uuid: 'fb-1', run_id: 'run-1', step_id: 'step-1', result: 'passed', comment: null, medical_comment: null },
      { uuid: 'fb-3', run_id: 'run-2', step_id: 'step-1', result: 'blocked', comment: null, medical_comment: null },
    ]);
    mockContributionFindById.mockImplementation(async (id: string) => ({
      uuid: id, user_id: id === APP ? 'alice' : 'dan', live_endpoint_url: `https://${id}.example.com`,
    }));
    mockUserFindByIds.mockResolvedValue([
      { uuid: 'alice', full_name: 'Alice' }, { uuid: 'dan', full_name: 'Dan' },
      { uuid: 'bob', full_name: 'Bob', role: 'medical_pro' }, { uuid: 'carol', full_name: 'Carol', role: 'contributor' },
    ]);
  });

  it('returns every walkthrough with its step results, comments and medical opinions', async () => {
    const body = await (await getRuns()).json();

    expect(body.runs).toHaveLength(2);
    expect(body.runs[0]).toMatchObject({
      id: 'run-1', validatorName: 'Bob', isMedicalPro: true,
      submitterName: 'Alice', globalFeedback: 'Usable end to end.', answeredCount: 2,
    });
  });

  it('orders step feedbacks by scenario position, not by insertion order', async () => {
    // Le panneau rend une ligne de marques P/F/B : dans l'ordre d'insertion,
    // elle ne correspondrait pas aux étapes qu'elle prétend résumer.
    const body = await (await getRuns()).json();

    expect(body.runs[0].stepFeedbacks.map((f: any) => f.stepId)).toEqual(['step-1', 'step-2']);
  });

  it('ships the scenario so the panel can label the marks without a second request', async () => {
    const body = await (await getRuns()).json();

    expect(body.steps).toEqual([
      { id: 'step-1', position: 0, title: 'Create an account' },
      { id: 'step-2', position: 1, title: 'Log in' },
    ]);
  });

  it('reports a draft with a null completedAt and a partial answered count', async () => {
    const body = await (await getRuns()).json();

    expect(body.runs[1]).toMatchObject({ completedAt: null, answeredCount: 1 });
  });

  it('allows a manager of this challenge', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'manager-1', role: 'project_manager' });
    mockIsManagerOfChallenge.mockResolvedValue(true);

    expect((await getRuns()).status).toBe(200);
  });

  it('returns 403 for a plain contributor', async () => {
    // Contrairement à la liste des cibles, que tout contributeur doit lire,
    // cette vue expose le retour signé de tous les autres validateurs.
    mockGetSessionUser.mockResolvedValue({ id: 'bob', role: 'contributor' });

    expect((await getRuns()).status).toBe(403);
  });

  it('returns 401 for an anonymous visitor', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    expect((await getRuns()).status).toBe(401);
  });
});
```

Add the helper next to `openRun`:

```ts
function getRuns() {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/validation-scenario-runs`);
  return GET(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}
```

and extend the handler import to `import { GET, POST } from './route';`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-runs/route.test.ts"`
Expected: FAIL — `GET is not a function`.

- [ ] **Step 3: Add the `GET` handler**

Append to `…/validation-scenario-runs/route.ts`, adding the repository and auth imports at the top:

```ts
import {
  ChallengeRepository,
  ContributionRepository,
  UserRepository,
  ScenarioStepRepository,
  ScenarioRunRepository,
  StepFeedbackRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';

export const dynamic = 'force-dynamic';

const challengeRepo = new ChallengeRepository();
const contributionRepo = new ContributionRepository();
const userRepo = new UserRepository();
const stepRepo = new ScenarioStepRepository();
const runRepo = new ScenarioRunRepository();
const feedbackRepo = new StepFeedbackRepository();
```

```ts
// GET /api/challenges/[id]/validation-scenario-runs — admin/manager only.
//
// Sans quorum ni majorité, ce panneau est le seul contrôle qualité de la v1 :
// il doit donc livrer de quoi construire une vue structurée — par application,
// qui a testé, chaque résultat d'étape, les commentaires, les avis médicaux et
// le retour global — pas un dump JSON.
//
// Réservé à l'admin/manager, contrairement à la liste des cibles que chaque
// contributeur doit lire : ici on expose le retour signé de tous les autres.
export async function GET(
  _req: NextRequest,
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
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'validation') {
      return NextResponse.json({ error: 'Not a validation challenge' }, { status: 400 });
    }

    const [steps, runs] = await Promise.all([
      stepRepo.findByChallenge(challengeId),
      runRepo.findByChallenge(challengeId),
    ]);

    const feedbacks = await feedbackRepo.findByRuns(runs.map(r => r.uuid));
    const feedbacksByRun = new Map<string, typeof feedbacks>();
    for (const f of feedbacks) {
      const list = feedbacksByRun.get(f.run_id) ?? [];
      list.push(f);
      feedbacksByRun.set(f.run_id, list);
    }

    const contributionIds = [...new Set(runs.map(r => r.contribution_id))];
    const contributions = await Promise.all(contributionIds.map(id => contributionRepo.findById(id)));
    const contributionById = new Map(
      contributions.filter((c): c is NonNullable<typeof c> => !!c).map(c => [c.uuid, c])
    );

    const userIds = [...new Set([
      ...[...contributionById.values()].map(c => c.user_id),
      ...runs.map(r => r.validator_user_id),
    ])];
    const users = await userRepo.findByIds(userIds);
    const usersById = new Map(users.map(u => [u.uuid, u]));

    // L'ordre du scénario, pas l'ordre d'insertion : le panneau rend une ligne
    // de marques P/F/B, qui doit correspondre aux étapes qu'elle résume.
    const stepOrder = new Map(steps.map((s, i) => [s.uuid, i]));

    return NextResponse.json({
      steps: steps.map(s => ({ id: s.uuid, position: s.position, title: s.title })),
      runs: runs.map(run => {
        const contribution = contributionById.get(run.contribution_id);
        const submitter = contribution ? usersById.get(contribution.user_id) : undefined;
        const validator = usersById.get(run.validator_user_id);
        const runFeedbacks = (feedbacksByRun.get(run.uuid) ?? [])
          .slice()
          .sort((a, b) => (stepOrder.get(a.step_id) ?? 0) - (stepOrder.get(b.step_id) ?? 0));

        return {
          id: run.uuid,
          contributionId: run.contribution_id,
          submitterName: submitter?.full_name ?? 'Unknown',
          endpointUrl: contribution?.live_endpoint_url ?? null,
          validatorId: run.validator_user_id,
          validatorName: validator?.full_name ?? 'Unknown',
          isMedicalPro: validator?.role === 'medical_pro',
          completedAt: run.completed_at,
          globalFeedback: run.global_feedback,
          answeredCount: runFeedbacks.length,
          stepFeedbacks: runFeedbacks.map(f => ({
            stepId: f.step_id,
            result: f.result,
            comment: f.comment,
            medicalComment: f.medical_comment,
          })),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching scenario walkthroughs:', error);
    return NextResponse.json({ error: 'Failed to fetch walkthroughs' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/leaderboard-client && npx vitest run "src/app/api/challenges/[id]/validation-scenario-runs/route.test.ts"`
Expected: PASS — 14 tests (6 from Task 11, 8 here).

- [ ] **Step 5: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/validation-scenario-runs"
git commit -m "feat(validation): let a manager read every walkthrough on the challenge"
```

---

### Task 13: `ScenarioWalkthroughsPanel` — the only quality control in v1

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/scenarioResult.ts`
- Create: `apps/leaderboard-client/src/components/admin/ScenarioWalkthroughsPanel.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx` (the Walkthroughs tab left as `ValidationRunsPanel` in Task 7)

**Interfaces:**
- Consumes: `GET /api/challenges/:id/validation-scenario-runs` (Task 12).
- Produces:

```ts
export type ScenarioResult = 'passed' | 'failed' | 'blocked';
export const RESULT_META: Record<ScenarioResult, { label: string; mark: string; text: string; bg: string; border: string }>;
export function ScenarioWalkthroughsPanel({ challengeId, open }: { challengeId: string; open: boolean }): JSX.Element;
```

- [ ] **Step 1: Write the shared result vocabulary**

Create `apps/leaderboard-client/src/components/challenges/scenarioResult.ts`. Both the admin panel (Task 13) and the walkthrough screen (Task 15) paint the same three results; defining the triad twice is how the two screens end up disagreeing about what amber means.

```ts
export type ScenarioResult = 'passed' | 'failed' | 'blocked';

/** Les trois résultats d'étape, dans l'ordre où le validateur les voit. */
export const SCENARIO_RESULTS: ScenarioResult[] = ['passed', 'failed', 'blocked'];

/**
 * Le vocabulaire visuel des résultats, en tokens de l'app — pas en hex du
 * maquettage. `mark` est la lettre unique de la vue de supervision, où une
 * walkthrough se lit d'un coup d'oeil comme une ligne `PPFPBPP`.
 *
 * Vert/rouge sont ceux que le flux ML utilise déjà pour works/broken ; ambre
 * dit « bloqué », c'est-à-dire ni réussi ni raté mais impossible à tenter —
 * l'application s'est arrêtée, ou l'étape précédente l'a rendue inatteignable.
 */
export const RESULT_META: Record<ScenarioResult, {
  label: string; mark: string; text: string; bg: string; border: string;
}> = {
  passed:  { label: 'Passed',  mark: 'P', text: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30' },
  failed:  { label: 'Failed',  mark: 'F', text: 'text-red-400',   bg: 'bg-red-500/15',   border: 'border-red-500/30' },
  blocked: { label: 'Blocked', mark: 'B', text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
};
```

- [ ] **Step 2: Write the panel**

Create `apps/leaderboard-client/src/components/admin/ScenarioWalkthroughsPanel.tsx`, following `ValidationRunsPanel`'s structure (the `open`-transition fetch, grouping by application, an expandable row per run):

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Stethoscope } from 'lucide-react';
import { RESULT_META, type ScenarioResult } from '@/components/challenges/scenarioResult';

interface ScenarioStep { id: string; position: number; title: string }

interface StepFeedback {
  stepId: string;
  result: ScenarioResult;
  comment: string | null;
  medicalComment: string | null;
}

interface WalkthroughRun {
  id: string;
  contributionId: string;
  submitterName: string;
  endpointUrl: string | null;
  validatorId: string;
  validatorName: string;
  isMedicalPro: boolean;
  completedAt: string | null;
  globalFeedback: string | null;
  answeredCount: number;
  stepFeedbacks: StepFeedback[];
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/** La ligne de marques : une walkthrough entière lisible d'un coup d'oeil. */
function MarkRow({ feedbacks }: { feedbacks: StepFeedback[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {feedbacks.map(f => {
        const meta = RESULT_META[f.result];
        return (
          <span
            key={f.stepId}
            title={meta.label}
            className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${meta.bg} ${meta.text}`}
          >
            {meta.mark}
          </span>
        );
      })}
    </div>
  );
}

function RunRow({ run, steps, stepCount }: { run: WalkthroughRun; steps: Map<string, ScenarioStep>; stepCount: number }) {
  const [expanded, setExpanded] = useState(false);
  const completed = !!run.completedAt;
  const commented = run.stepFeedbacks.filter(f => f.comment || f.medicalComment);

  return (
    <div className="border-b border-white/[0.05] last:border-b-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full flex-wrap items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-medium" style={{ color: fgAt(0.8) }}>{run.validatorName}</span>
        {run.isMedicalPro && (
          <span className="rounded-full bg-brandCP/10 px-2 py-0.5 text-[10px] font-bold text-brandCP">medical_pro</span>
        )}
        <span className="text-[11px]" style={{ color: fgAt(0.3) }}>
          {completed ? new Date(run.completedAt!).toLocaleDateString() : 'not finished'}
        </span>
        <span
          className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
            completed ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          {completed ? 'Completed' : `Draft · ${run.answeredCount}/${stepCount}`}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: fgAt(0.3) }} />
      </button>

      <div className="px-4 pb-3">
        <MarkRow feedbacks={run.stepFeedbacks} />
      </div>

      {expanded && (
        <div className="space-y-3 px-4 pb-4">
          {run.globalFeedback && (
            <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{run.globalFeedback}</p>
          )}

          {commented.length === 0 ? (
            <p className="text-xs" style={{ color: fgAt(0.25) }}>No comment on any individual step.</p>
          ) : (
            <div className="space-y-2">
              {commented.map(f => {
                const step = steps.get(f.stepId);
                const meta = RESULT_META[f.result];
                const number = step ? String(step.position + 1).padStart(2, '0') : '--';
                return (
                  <div key={f.stepId} className="space-y-1.5 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <p className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono" style={{ color: fgAt(0.3) }}>{number}</span>
                      <span style={{ color: fgAt(0.6) }}>{step?.title ?? 'Deleted step'}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.text}`}>{meta.label}</span>
                    </p>
                    {f.comment && (
                      <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{f.comment}</p>
                    )}
                    {f.medicalComment && (
                      <div className="space-y-1 rounded-xl bg-brandCP/[0.06] px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brandCP">
                          <Stethoscope className="h-3 w-3" />
                          Medical opinion · step {number}
                        </p>
                        <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{f.medicalComment}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Toutes les walkthroughs du challenge, groupées par application.
 *
 * Sans quorum ni majorité, c'est le seul contrôle qualité de la v1 : il doit
 * donc se lire, pas se déchiffrer. La ligne de marques donne la forme d'une
 * walkthrough en un coup d'oeil ; le dépliage donne les mots.
 */
export function ScenarioWalkthroughsPanel({ challengeId, open }: { challengeId: string; open: boolean }) {
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [runs, setRuns] = useState<WalkthroughRun[]>([]);
  const [loading, setLoading] = useState(true);

  const wasOpen = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setLoading(true);
    fetch(`/api/challenges/${challengeId}/validation-scenario-runs`)
      .then(res => (res.ok ? res.json() : { steps: [], runs: [] }))
      .then(d => { setSteps(d.steps ?? []); setRuns(d.runs ?? []); })
      .finally(() => setLoading(false));
  }, [open, challengeId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs" style={{ color: fgAt(0.35) }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="rounded-[16px] border border-dashed border-white/[0.06] px-4 py-3 text-xs" style={{ color: fgAt(0.3) }}>
        No walkthrough yet.
      </p>
    );
  }

  const stepsById = new Map(steps.map(s => [s.id, s]));
  const byApplication = new Map<string, WalkthroughRun[]>();
  for (const run of runs) {
    const list = byApplication.get(run.contributionId) ?? [];
    list.push(run);
    byApplication.set(run.contributionId, list);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: fgAt(0.35) }}>
        No quorum in this iteration — this panel is the quality control.
      </p>

      {[...byApplication.entries()].map(([contributionId, appRuns]) => (
        <div key={contributionId} className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.02]">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
            <span className="text-sm font-semibold" style={{ color: fgAt(0.8) }}>{appRuns[0].submitterName}</span>
            {appRuns[0].endpointUrl && (
              <a
                href={appRuns[0].endpointUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="truncate font-mono text-[11px] text-brandCP/70 hover:text-brandCP"
              >
                {appRuns[0].endpointUrl}
              </a>
            )}
            <span className="ml-auto rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: fgAt(0.45) }}>
              {appRuns.length} {appRuns.length === 1 ? 'walkthrough' : 'walkthroughs'}
            </span>
          </div>
          {appRuns.map(run => (
            <RunRow key={run.id} run={run} steps={stepsById} stepCount={steps.length} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Finish the manage-view wiring left open in Task 7**

In `ChallengeManageView.tsx`, import the panel and replace the placeholder:

```tsx
import { ScenarioWalkthroughsPanel } from '@/components/admin/ScenarioWalkthroughsPanel';
```

```tsx
    {
      label: isScenarioValidation ? 'Walkthroughs' : 'Runs',
      panel: isScenarioValidation
        ? <ScenarioWalkthroughsPanel challengeId={challengeId} open />
        : <ValidationRunsPanel challengeId={challengeId} open />,
    },
```

- [ ] **Step 4: Type-check and verify by hand**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev` and open the manage view of a scenario-mode validation challenge with at least one walkthrough recorded. Expected: the **Walkthroughs** tab groups by application, the mark row reads left to right in scenario order, expanding a row shows the overall feedback and each commented step, and a medical opinion sits in its own accent block labelled with the step number. An ML-sourced challenge still shows **Runs** with `ValidationRunsPanel`, unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/scenarioResult.ts apps/leaderboard-client/src/components/admin/ScenarioWalkthroughsPanel.tsx apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx
git commit -m "feat(validation): read every walkthrough as a page, not a dump"
```

---

### Task 14: `ScenarioChallengeFlow` — the applications, and my state on each

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/ScenarioChallengeFlow.tsx`
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx:263` (mode derivation) and `:608-615` (the `isValidation` tab array)

**Interfaces:**
- Consumes: `GET /api/challenges/:id/validation-targets` (Task 4), `GET /api/challenges/:id/validation-scenario-steps` (Task 6), `source_challenge_type` from the overview payload (Task 7).
- Produces: `ScenarioChallengeFlow({ challengeId }: { challengeId: string })`. It owns the "which application am I walking" state and renders `ScenarioWalkthroughScreen` (Task 15) when one is picked.

- [ ] **Step 1: Write the flow component**

Create `apps/leaderboard-client/src/components/challenges/ScenarioChallengeFlow.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Coins, ListOrdered, Loader2, MonitorSmartphone } from 'lucide-react';
import { ScenarioWalkthroughScreen } from './ScenarioWalkthroughScreen';

interface TargetItem {
  id: string;
  contributionId: string;
  submitterUserId: string | null;
  submitterName: string;
  endpointUrl: string | null;
  walkthroughCount?: number;
  myWalkthrough?: { runId: string; completedAt: string | null } | null;
}

interface PoolState {
  pool: number;
  distributed: number;
  remaining: number;
  cpPerValidation: number;
}

interface ScenarioStep { id: string; position: number; title: string }

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
}

type TargetState = 'mine' | 'completed' | 'in_progress' | 'never_started';

function stateOf(target: TargetItem, currentUserId: string | null, myGroupContributionIds: Set<string>): TargetState {
  if (myGroupContributionIds.has(target.contributionId)) return 'mine';
  if (currentUserId && target.submitterUserId === currentUserId) return 'mine';
  if (target.myWalkthrough?.completedAt) return 'completed';
  if (target.myWalkthrough) return 'in_progress';
  return 'never_started';
}

/**
 * L'entrée du validateur en mode scénario : le pool restant, les applications
 * exposées avec mon état sur chacune, et le scénario lui-même en résumé.
 *
 * Le pool est affiché avant le travail, pas après : un pool épuisé se voit
 * avant de parcourir sept étapes, pas au moment de conclure.
 */
export function ScenarioChallengeFlow({ challengeId }: { challengeId: string }) {
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [pool, setPool] = useState<PoolState | null>(null);
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TargetItem | null>(null);

  const fetchData = useCallback(async () => {
    const [targetsRes, stepsRes] = await Promise.all([
      fetch(`/api/challenges/${challengeId}/validation-targets`),
      fetch(`/api/challenges/${challengeId}/validation-scenario-steps`),
    ]);
    if (targetsRes.ok) {
      const d = await targetsRes.json();
      setTargets(d.targets ?? []);
      setPool(d.pool ?? null);
      setCurrentUserId(d.currentUserId ?? null);
    }
    if (stepsRes.ok) {
      const d = await stepsRes.json();
      setSteps(d.steps ?? []);
    }
    setLoading(false);
  }, [challengeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (active) {
    return (
      <ScenarioWalkthroughScreen
        challengeId={challengeId}
        contributionId={active.contributionId}
        submitterName={active.submitterName}
        endpointUrl={active.endpointUrl}
        onClose={() => { setActive(null); fetchData(); }}
      />
    );
  }

  if (targets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-12 text-center">
        <MonitorSmartphone className="h-7 w-7 text-white/15" />
        <p className="text-xs text-white/25">No application exposed for validation yet</p>
      </div>
    );
  }

  // La garde serveur couvre porteur ET membres de groupe ; côté client on ne
  // connaît que le porteur, donc le bouton « Not eligible » ne s'affiche que
  // dans ce cas. Un membre de groupe verra un 403 explicite s'il insiste —
  // c'est le serveur qui décide, l'interface ne fait que devancer le cas le
  // plus courant.
  const myGroupContributionIds = new Set<string>();

  return (
    <div className="space-y-4 animate-fade-up">
      {pool && pool.pool > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-brandCP/[0.22] bg-white/[0.02] px-5 py-4">
          <div className="space-y-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight" style={{ color: fgAt(1) }}>
                {pool.remaining.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-brandCP">CP left</span>
            </div>
            <span className="text-xs" style={{ color: fgAt(0.35) }}>
              {pool.cpPerValidation} CP for each completed walkthrough, clamped to what is left.
            </span>
          </div>
          <span className="flex items-center gap-2 rounded-full bg-brandCP/10 px-3.5 py-2 text-xs font-semibold text-brandCP">
            <Coins className="h-3.5 w-3.5" />
            {steps.length} {steps.length === 1 ? 'step' : 'steps'} per application
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {targets.map(t => {
          const state = stateOf(t, currentUserId, myGroupContributionIds);
          const isMine = state === 'mine';
          const cta = state === 'completed' ? 'Review' : state === 'in_progress' ? 'Resume' : isMine ? 'Not eligible' : 'Start';
          const badge =
            state === 'completed' ? { label: `Completed · ${pool?.cpPerValidation ?? 0} CP`, cls: 'bg-green-500/15 text-green-400' }
            : state === 'in_progress' ? { label: 'In progress', cls: 'bg-amber-500/15 text-amber-400' }
            : isMine ? { label: 'Your own application', cls: 'bg-white/[0.06]' }
            : { label: 'Never started', cls: 'bg-white/[0.06]' };

          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-4 rounded-[20px] border border-white/[0.06] bg-white/[0.02] px-5 py-4"
              style={{ opacity: isMine ? 0.6 : 1 }}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brandCP/10 text-[13px] font-bold text-brandCP">
                {initialsOf(t.submitterName)}
              </div>
              <div className="min-w-0 flex-1 basis-64 space-y-1">
                <span className="block text-[15px] font-semibold" style={{ color: fgAt(0.85) }}>{t.submitterName}</span>
                {t.endpointUrl && (
                  <a
                    href={t.endpointUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate font-mono text-xs text-brandCP/70 hover:text-brandCP"
                  >
                    {t.endpointUrl}
                  </a>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`} style={badge.cls.includes('text-') ? undefined : { color: fgAt(0.45) }}>
                  {badge.label}
                </span>
                <span className="text-[11px]" style={{ color: fgAt(0.3) }}>
                  {t.walkthroughCount ?? 0} {(t.walkthroughCount ?? 0) === 1 ? 'walkthrough' : 'walkthroughs'} in total
                </span>
              </div>
              <button
                onClick={() => setActive(t)}
                disabled={isMine}
                title={isMine ? 'You cannot walk through your own application' : undefined}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-brandCP/10 px-4 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/25 disabled:hover:bg-white/[0.04]"
              >
                {cta}
                {!isMine && state !== 'completed' && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>

      {steps.length > 0 && (
        <div className="space-y-3 rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: fgAt(0.35) }}>
            <ListOrdered className="h-3.5 w-3.5" />
            The scenario
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal" style={{ color: fgAt(0.4) }}>
              {steps.length} {steps.length === 1 ? 'step' : 'steps'} · same for every application
            </span>
          </p>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-baseline gap-2.5">
                <span className="font-mono text-[11px]" style={{ color: fgAt(0.3) }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[13px]" style={{ color: fgAt(0.6) }}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

`ScenarioWalkthroughScreen` does not exist yet — **write a two-line placeholder now** so this task type-checks on its own:

```tsx
// apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx
'use client';
export function ScenarioWalkthroughScreen(_props: {
  challengeId: string; contributionId: string; submitterName: string;
  endpointUrl: string | null; onClose: () => void;
}) {
  return null;
}
```

Task 15 replaces the body.

- [ ] **Step 2: Wire the contributor page**

In `apps/leaderboard-client/src/app/challenges/[id]/page.tsx`:

```tsx
import { ScenarioChallengeFlow } from '@/components/challenges/ScenarioChallengeFlow';
```

Next to `const isValidation = challenge?.type === 'validation';` (line 263):

```ts
  // Le mode se lit sur le type du challenge source, publié par /overview.
  const isScenarioValidation = isValidation && overviewQuery.data?.source_challenge_type === 'code';
```

Adjust the name of the overview query variable to whatever that file calls it, and add `source_challenge_type: string | null` to its result type exactly as Task 7 did for the manage view.

Then the Validate tab (line 608):

```tsx
        tabs={isValidation ? [
        {
          label: isScenarioValidation ? 'Walkthrough' : 'Validate',
          panel: isScenarioValidation ? (
            <ScenarioChallengeFlow challengeId={challengeId} />
          ) : (
            <div className="space-y-4">
              <ReferenceCaseAuthorPanel challengeId={challengeId} />
              <ValidationChallengeFlow challengeId={challengeId} />
            </div>
          ),
        },
      ] : isML ? [
```

- [ ] **Step 3: Type-check and verify by hand**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev`, sign in as a contributor who is **not** on the source code challenge, and open a scenario-mode validation challenge. Expected: the pool banner, one row per exposed application with **Start**, and the scenario recap underneath. Sign in as the holder of one of the applications: that row dims to 60%, its badge reads *Your own application*, and its button reads *Not eligible* and is disabled. An ML-sourced validation challenge is untouched.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/ScenarioChallengeFlow.tsx apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx "apps/leaderboard-client/src/app/challenges/[id]/page.tsx"
git commit -m "feat(validation): show a validator which applications are waiting"
```

---

### Task 15: `ScenarioWalkthroughScreen` — the application, one step at a time

**Files:**
- Modify: `apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx` (replace the placeholder from Task 14)
- Test: `apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.test.ts`
- Create: `apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.ts`

**Interfaces:**
- Consumes: the three walkthrough routes (Task 11), `RESULT_META` / `SCENARIO_RESULTS` (Task 13).
- Produces:

```ts
// scenarioWalkthroughState.ts — pure, so the rules are testable without a DOM
export interface WalkthroughStepView {
  stepId: string; position: number; title: string; instructions: string | null;
  result: ScenarioResult | null; comment: string | null; medicalComment: string | null;
}
export function firstUnansweredIndex(steps: WalkthroughStepView[]): number;
export function finishBlocker(steps: WalkthroughStepView[], globalFeedback: string): string | null;
export function finishHint(steps: WalkthroughStepView[], globalFeedback: string, cpPerValidation: number): string;

export function ScenarioWalkthroughScreen(props: {
  challengeId: string; contributionId: string; submitterName: string;
  endpointUrl: string | null; onClose: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Write the failing test for the pure rules**

The navigation and gating rules are exactly where a walkthrough goes wrong — resuming on the wrong step, a Finish button that lies about why it is disabled. They are pure functions of the state, so test them without rendering anything.

Create `apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  firstUnansweredIndex,
  finishBlocker,
  finishHint,
  type WalkthroughStepView,
} from './scenarioWalkthroughState';

function steps(...results: Array<WalkthroughStepView['result']>): WalkthroughStepView[] {
  return results.map((result, i) => ({
    stepId: `step-${i + 1}`, position: i, title: `Step ${i + 1}`, instructions: null,
    result, comment: null, medicalComment: null,
  }));
}

describe('firstUnansweredIndex', () => {
  it('reopens a draft on the first step with no result, not on step 1', () => {
    // Reprendre au début forcerait à re-cliquer sur ce qui est déjà répondu,
    // ce qui est exactement le travail que le brouillon devait épargner.
    expect(firstUnansweredIndex(steps('passed', 'passed', null, null))).toBe(2);
  });

  it('finds a gap left by someone who went back and cleared a step', () => {
    expect(firstUnansweredIndex(steps('passed', null, 'failed'))).toBe(1);
  });

  it('lands on the last step when everything is answered, so the final screen is one click away', () => {
    expect(firstUnansweredIndex(steps('passed', 'failed', 'blocked'))).toBe(2);
  });

  it('opens a fresh walkthrough on step 1', () => {
    expect(firstUnansweredIndex(steps(null, null))).toBe(0);
  });

  it('returns 0 rather than -1 on an empty scenario', () => {
    expect(firstUnansweredIndex([])).toBe(0);
  });
});

describe('finishBlocker', () => {
  it('names the number of unanswered steps, in the singular when there is one', () => {
    expect(finishBlocker(steps('passed', null, 'failed'), 'Solid.')).toBe('1 step still has no result');
  });

  it('names them in the plural', () => {
    expect(finishBlocker(steps(null, null, 'passed'), 'Solid.')).toBe('2 steps still have no result');
  });

  it('reports unanswered steps before the missing feedback — fix the bigger gap first', () => {
    expect(finishBlocker(steps('passed', null), '')).toBe('1 step still has no result');
  });

  it('reports the missing overall feedback once every step is answered', () => {
    expect(finishBlocker(steps('passed', 'failed'), '   ')).toBe('The overall feedback is required');
  });

  it('returns null when the walkthrough is ready to finish', () => {
    expect(finishBlocker(steps('passed', 'failed'), 'Usable end to end.')).toBeNull();
  });
});

describe('finishHint', () => {
  it('says what the walkthrough pays once it is ready', () => {
    expect(finishHint(steps('passed'), 'Usable.', 200)).toBe('Pays 200 CP from the remaining pool');
  });

  it('otherwise states exactly why the button is disabled', () => {
    expect(finishHint(steps('passed', null), 'Usable.', 200)).toBe('1 step still has no result');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/leaderboard-client && npx vitest run src/components/challenges/scenarioWalkthroughState.test.ts`
Expected: FAIL — cannot resolve `./scenarioWalkthroughState`.

- [ ] **Step 3: Write the pure rules**

Create `apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.ts`:

```ts
import type { ScenarioResult } from './scenarioResult';

/** Une étape telle que l'écran de walkthrough la manipule : le scénario + ma réponse. */
export interface WalkthroughStepView {
  stepId: string;
  position: number;
  title: string;
  instructions: string | null;
  result: ScenarioResult | null;
  comment: string | null;
  medicalComment: string | null;
}

/**
 * Où ouvrir une walkthrough : sur la première étape sans résultat.
 *
 * Reprendre un brouillon à l'étape 1 obligerait à recliquer sur tout ce qui
 * est déjà répondu — exactement le travail que le brouillon devait épargner.
 * Tout répondu : on se pose sur la dernière, d'où l'écran final est à un clic.
 */
export function firstUnansweredIndex(steps: WalkthroughStepView[]): number {
  if (steps.length === 0) return 0;
  const index = steps.findIndex(s => s.result === null);
  return index === -1 ? steps.length - 1 : index;
}

/**
 * Pourquoi « Finish » est désactivé, ou null s'il ne l'est pas.
 *
 * Le bouton dit *pourquoi* : « 2 steps still have no result » plutôt qu'un
 * bouton gris muet. Les étapes manquantes passent avant le retour global —
 * c'est le trou le plus coûteux à combler, autant l'annoncer en premier.
 */
export function finishBlocker(steps: WalkthroughStepView[], globalFeedback: string): string | null {
  const missing = steps.filter(s => s.result === null).length;
  if (missing === 1) return '1 step still has no result';
  if (missing > 1) return `${missing} steps still have no result`;
  if (!globalFeedback.trim()) return 'The overall feedback is required';
  return null;
}

/** La ligne sous le bouton : soit l'obstacle, soit ce que la walkthrough rapporte. */
export function finishHint(
  steps: WalkthroughStepView[],
  globalFeedback: string,
  cpPerValidation: number
): string {
  return finishBlocker(steps, globalFeedback) ?? `Pays ${cpPerValidation} CP from the remaining pool`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd apps/leaderboard-client && npx vitest run src/components/challenges/scenarioWalkthroughState.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Write the screen**

Replace the placeholder body of `apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2, Stethoscope } from 'lucide-react';
import { RESULT_META, SCENARIO_RESULTS, type ScenarioResult } from './scenarioResult';
import {
  finishHint,
  finishBlocker,
  firstUnansweredIndex,
  type WalkthroughStepView,
} from './scenarioWalkthroughState';

interface Props {
  challengeId: string;
  contributionId: string;
  submitterName: string;
  endpointUrl: string | null;
  onClose: () => void;
}

function fgAt(opacity: number) {
  return `color-mix(in srgb, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Le parcours lui-même : l'application à gauche dans une iframe, une seule
 * étape à la fois à droite.
 *
 * Une seule étape, parce que sept étapes dépliées à côté d'une application
 * vivante veut dire défiler dans deux directions en même temps. Le validateur
 * fait une chose, le panneau montre cette chose. Ce que la liste complète
 * donnait gratuitement — savoir où on en est, et ce qu'il reste — revient par
 * la barre de progression.
 *
 * Chaque saisie émet son PUT, donc naviguer entre étapes ne perd rien, et
 * fermer l'onglet non plus.
 */
export function ScenarioWalkthroughScreen({
  challengeId, contributionId, submitterName, endpointUrl, onClose,
}: Props) {
  const [steps, setSteps] = useState<WalkthroughStepView[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [globalFeedback, setGlobalFeedback] = useState('');
  const [cpAwarded, setCpAwarded] = useState<number | null>(null);
  const [cpPerValidation, setCpPerValidation] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [missingStepIds, setMissingStepIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [runRes, targetsRes] = await Promise.all([
        fetch(`/api/challenges/${challengeId}/validation-scenario-runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contribution_id: contributionId }),
        }),
        fetch(`/api/challenges/${challengeId}/validation-targets`),
      ]);
      if (cancelled) return;

      if (!runRes.ok) {
        const d = await runRes.json().catch(() => ({}));
        setError(d.error || 'Could not open this walkthrough');
        setLoading(false);
        return;
      }
      const run = await runRes.json();
      setRunId(run.runId);
      setSteps(run.steps ?? []);
      setCompletedAt(run.completedAt ?? null);
      setGlobalFeedback(run.globalFeedback ?? '');
      // Reprendre sur la première étape sans résultat, pas sur l'étape 1.
      setCurrent(firstUnansweredIndex(run.steps ?? []));

      if (targetsRes.ok) {
        const d = await targetsRes.json();
        setCpPerValidation(d.pool?.cpPerValidation ?? 0);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [challengeId, contributionId]);

  const isReadOnly = !!completedAt;
  const step = steps[current];
  const blocker = finishBlocker(steps, globalFeedback);
  const answeredCount = steps.filter(s => s.result !== null).length;

  const saveStep = useCallback(async (patch: Partial<WalkthroughStepView>) => {
    if (!runId || !step || isReadOnly) return;
    const next = { ...step, ...patch };
    // Optimiste : la barre de progression et les boutons réagissent tout de
    // suite, le PUT confirme derrière.
    setSteps(prev => prev.map(s => (s.stepId === step.stepId ? next : s)));
    if (next.result === null) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/challenges/${challengeId}/validation-scenario-runs/${runId}/steps/${step.stepId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result: next.result,
            comment: next.comment,
            medical_comment: next.medicalComment,
          }),
        }
      );
      if (res.ok) {
        const state = await res.json();
        setSteps(state.steps ?? []);
        setMissingStepIds([]);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Could not save this step');
      }
    } catch { setError('Network error'); }
    finally { setSaving(false); }
  }, [challengeId, runId, step, isReadOnly]);

  const handleFinish = async () => {
    if (!runId || blocker) return;
    setFinishing(true);
    setError('');
    try {
      const res = await fetch(
        `/api/challenges/${challengeId}/validation-scenario-runs/${runId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ global_feedback: globalFeedback }),
        }
      );
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setCompletedAt(new Date().toISOString());
        setCpAwarded(d.cpAwarded ?? 0);
      } else {
        setError(d.error || 'Could not finish this walkthrough');
        // Le serveur nomme les étapes manquantes : on allume leurs points au
        // lieu de laisser le validateur chercher lesquelles il a sautées.
        setMissingStepIds(d.missingStepIds ?? []);
      }
    } catch { setError('Network error'); }
    finally { setFinishing(false); }
  };

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-brandCP"
        style={{ color: fgAt(0.45) }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Applications
      </button>
      <div className="min-w-0 flex-1 basis-48">
        <span className="block truncate text-[15px] font-semibold" style={{ color: fgAt(0.85) }}>{submitterName}</span>
        {endpointUrl && (
          <span className="block truncate font-mono text-xs" style={{ color: fgAt(0.35) }}>{endpointUrl}</span>
        )}
      </div>
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-bold ${
          isReadOnly ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'
        }`}
      >
        {isReadOnly
          ? `Walkthrough completed${cpAwarded !== null ? ` — ${cpAwarded} CP` : ''}`
          : 'Draft · saved as you go'}
      </span>
    </div>
  );

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl border border-white/[0.06] bg-white/5" />;
  }

  if (error && !runId) {
    return (
      <div className="space-y-4">
        {header}
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // Terminé : plus de "une étape à la fois". Quelqu'un qui se relit veut tout
  // d'un coup, et il n'y a plus d'étape courante à mettre en avant.
  if (isReadOnly) {
    return (
      <div className="space-y-4 animate-fade-up">
        {header}
        <div className="space-y-2">
          {steps.map((s, i) => {
            const meta = s.result ? RESULT_META[s.result] : null;
            return (
              <div key={s.stepId} className="space-y-2 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[11px]" style={{ color: fgAt(0.3) }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm font-medium" style={{ color: fgAt(0.8) }}>{s.title}</span>
                  {meta && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.bg} ${meta.text}`}>{meta.label}</span>
                  )}
                </div>
                {s.comment && <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.55) }}>{s.comment}</p>}
                {s.medicalComment && (
                  <div className="space-y-1 rounded-xl bg-brandCP/[0.06] px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brandCP">
                      <Stethoscope className="h-3 w-3" /> Medical opinion
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.55) }}>{s.medicalComment}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {globalFeedback && (
          <div className="space-y-1.5 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: fgAt(0.35) }}>Overall feedback</p>
            <p className="text-[13px] leading-relaxed" style={{ color: fgAt(0.6) }}>{globalFeedback}</p>
          </div>
        )}
      </div>
    );
  }

  const isLast = current === steps.length - 1;

  return (
    <div className="space-y-4 animate-fade-up">
      {header}

      {/* auto-fit plutôt qu'un breakpoint : la colonne passe dessous d'elle-même sous ~700px. */}
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <div className="space-y-2.5">
          {endpointUrl ? (
            <iframe
              src={endpointUrl}
              title={`${submitterName} — application under validation`}
              className="h-[min(620px,70vh)] w-full rounded-[20px] border border-white/10 bg-white"
            />
          ) : (
            <div className="flex h-[min(620px,70vh)] items-center justify-center rounded-[20px] border border-dashed border-white/10 px-6 text-center">
              <p className="text-xs" style={{ color: fgAt(0.3) }}>No endpoint recorded for this application.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {endpointUrl && (
              <a
                href={endpointUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs font-semibold transition-colors hover:border-white/20"
                style={{ color: fgAt(0.7) }}
              >
                <ExternalLink className="h-3.5 w-3.5 text-brandCP" /> Open in a tab
              </a>
            )}
            <span className="text-xs" style={{ color: fgAt(0.3) }}>
              The platform never calls this application — your browser does.
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: fgAt(0.35) }}>
              Step {current + 1} of {steps.length}
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: fgAt(0.5) }}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {answeredCount} / {steps.length} answered
            </span>
          </div>

          {/* La barre : où on en est, et ce qu'il reste — sans mettre un seul
              contenu d'étape à l'écran. Un clic saute à l'étape. */}
          <div className="flex gap-1.5">
            {steps.map((s, i) => {
              const meta = s.result ? RESULT_META[s.result] : null;
              const isMissing = missingStepIds.includes(s.stepId);
              return (
                <button
                  key={s.stepId}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    meta ? meta.bg.replace('/15', '/60') : isMissing ? 'bg-red-500/50' : 'bg-white/10'
                  } ${i === current ? 'ring-2 ring-brandCP/40' : ''}`}
                />
              );
            })}
          </div>

          {step && (
            <div
              className={`space-y-3 rounded-[18px] border bg-white/[0.02] px-4 py-4 ${
                step.result ? RESULT_META[step.result].border : 'border-white/[0.06]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 font-mono text-[11px]" style={{ color: fgAt(0.3) }}>
                  {String(current + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[15px] font-semibold leading-snug" style={{ color: fgAt(0.85) }}>{step.title}</p>
                  {step.instructions && (
                    <p className="text-xs leading-relaxed" style={{ color: fgAt(0.45) }}>{step.instructions}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {SCENARIO_RESULTS.map(r => {
                  const meta = RESULT_META[r];
                  const on = step.result === r;
                  return (
                    <button
                      key={r}
                      onClick={() => saveStep({ result: on ? null : r })}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                        on ? `${meta.bg} ${meta.border} ${meta.text}` : 'border-white/10 hover:border-white/20'
                      }`}
                      style={on ? undefined : { color: fgAt(0.5) }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={2}
                value={step.comment ?? ''}
                onChange={e => setSteps(prev => prev.map(s => (s.stepId === step.stepId ? { ...s, comment: e.target.value } : s)))}
                onBlur={() => saveStep({})}
                placeholder="What happened? (optional)"
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none"
                style={{ color: fgAt(0.85) }}
              />

              {/* Les deux lentilles coexistent sur la même étape : pas un
                  onglet, pas un mode. Le champ n'apparaît que pour un
                  medical_pro, et le serveur le refuse aux autres de toute façon. */}
              <MedicalCommentField
                value={step.medicalComment ?? ''}
                onChange={v => setSteps(prev => prev.map(s => (s.stepId === step.stepId ? { ...s, medicalComment: v } : s)))}
                onBlur={() => saveStep({})}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCurrent(c => Math.max(0, c - 1))}
              disabled={current === 0}
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-[13px] font-semibold transition-all hover:border-white/20 disabled:opacity-30"
              style={{ color: fgAt(0.6) }}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Previous
            </button>
            {!isLast && (
              <>
                <button
                  onClick={() => setCurrent(c => Math.min(steps.length - 1, c + 1))}
                  disabled={!step?.result}
                  className="flex items-center gap-2 rounded-full bg-brandCP/10 px-5 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/25"
                >
                  Next step <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {!step?.result && (
                  <span className="text-xs text-amber-400/80">Mark this step passed, failed or blocked to continue</span>
                )}
              </>
            )}
          </div>

          {isLast && (
            <div className="space-y-3 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold" style={{ color: fgAt(0.8) }}>Overall feedback</span>
                <span className="text-[11px] font-semibold text-red-400">Required</span>
              </div>
              <textarea
                rows={4}
                value={globalFeedback}
                onChange={e => setGlobalFeedback(e.target.value)}
                placeholder="Would you trust this application in a consultation? What worked, what did not."
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed placeholder:text-white/20 focus:border-brandCP/40 focus:outline-none"
                style={{ color: fgAt(0.85) }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleFinish}
                  disabled={!!blocker || finishing}
                  className="flex items-center gap-2 rounded-full bg-brandCP/10 px-5 py-2.5 text-[13px] font-semibold text-brandCP transition-all hover:bg-brandCP/15 disabled:cursor-not-allowed disabled:bg-white/[0.04] disabled:text-white/25"
                >
                  {finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Finish walkthrough
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">+{cpPerValidation} CP</span>
                </button>
                <span className={`text-xs ${blocker ? 'text-amber-400/80' : ''}`} style={blocker ? undefined : { color: fgAt(0.35) }}>
                  {finishHint(steps, globalFeedback, cpPerValidation)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Réservé au rôle medical_pro — la même frontière de qualification que le flux ML trace déjà. */
function MedicalCommentField({
  value, onChange, onBlur,
}: { value: string; onChange: (v: string) => void; onBlur: () => void }) {
  const [isMedicalPro, setIsMedicalPro] = useState(false);

  useEffect(() => {
    fetch('/api/contributors/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => setIsMedicalPro(d?.user?.role === 'medical_pro'))
      .catch(() => {});
  }, []);

  if (!isMedicalPro) return null;

  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-brandCP/35 bg-brandCP/[0.05] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brandCP">
        <Stethoscope className="h-3 w-3" /> Medical opinion
      </p>
      <textarea
        rows={2}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder="Clinical reading of this step (optional)"
        className="w-full resize-y rounded-lg border border-brandCP/25 bg-white/[0.03] px-2.5 py-2 text-[13px] leading-relaxed placeholder:text-white/20 focus:border-brandCP/50 focus:outline-none"
        style={{ color: fgAt(0.85) }}
      />
    </div>
  );
}
```

`useMemo` is imported but may end up unused — drop it from the import list if so; `tsc` will not flag it but leaving a dead import is sloppy.

- [ ] **Step 6: Type-check and run the full app suite**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors.

Run: `cd apps/leaderboard-client && npx vitest run`
Expected: PASS across the board.

- [ ] **Step 7: Verify the whole flow by hand**

Run: `npm run dev`. As a contributor who did not build any of the applications, on a scenario-mode validation challenge with a 7-step scenario and at least one exposed application:

1. Click **Start**. The application loads in the iframe, the panel shows step 1 of 7, the strip is all neutral.
2. **Next step** is disabled and says *"Mark this step passed, failed or blocked to continue"*.
3. Mark **Passed**, type a comment, click **Next step**. Reload the page and reopen: it resumes on step 2 with step 1's comment intact.
4. Click the first dot: it jumps back to step 1, still editable, and changing it to **Failed** sticks.
5. Answer every step but one, reach the last step, type an overall feedback, and confirm **Finish walkthrough** is disabled with *"1 step still has no result"*.
6. Click **Finish** anyway via the API (or clear the feedback): the returned `missingStepIds` lights that dot red.
7. Answer the last step and finish. Expect the read-only recap with a *"Walkthrough completed — N CP"* badge and every step on one screen.
8. Go back to the list: that application now reads **Completed · N CP** with a **Review** button.
9. As a `medical_pro`, confirm the **Medical opinion** field appears under each step's comment box; as a plain contributor, confirm it does not.
10. On the manage view, confirm the walkthrough now appears in **Walkthroughs**, and that the **Scenario** tab has turned read-only with the frozen banner.

- [ ] **Step 8: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/ScenarioWalkthroughScreen.tsx apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.ts apps/leaderboard-client/src/components/challenges/scenarioWalkthroughState.test.ts
git commit -m "feat(validation): walk an application one step at a time"
```

---

### Task 16: Documentation

**Files:**
- Modify: `docs/validation-challenges.md`
- Modify: `docs/api.md:111-130`
- Modify: `docs/database.md:79-95` (the Contributions & Evaluation table) and `:157-166` (the relationship diagram)

**Interfaces:**
- Consumes: everything built in Tasks 1-15.
- Produces: no code.

- [ ] **Step 1: Restructure `docs/validation-challenges.md` around the two modes**

Rewrite the opening so the page no longer claims a validation challenge is only ever about ML. Replace the first paragraph and the **Requires** line with:

```markdown
# Validation Challenges

`type: 'validation'` challenges let people check whether what a contributor delivered
actually works — with their own CP pool, and without ever touching the source
contribution's grade. A validation challenge is linked 1:1 to a **source challenge**,
and **the source challenge's type decides how the judging works**:

| Source challenge | Mode | What is exposed | How it is judged | Who may judge |
|---|---|---|---|---|
| `ml` | **Reference case** | an `api_packaging` submission + its deployed endpoint | the platform calls the endpoint with a ground-truth input; the reviewer records what they saw, reveals the expected output, then votes `works` / `broken`. Majority pays once quorum is reached. | `medical_pro` only |
| `code` | **Scenario walkthrough** | a `project` deliverable the team deployed + its URL | a validator walks a fixed, admin-authored scenario through the application in an iframe, marking each step `passed` / `failed` / `blocked` with a comment, then closes with a mandatory overall feedback. Every completed walkthrough pays. | any signed-in contributor (the *medical opinion* field is `medical_pro`-only) |

**The mode is derived, never stored.** There is no `validation_mode` column: every read
resolves `source_challenge_id` and looks at that challenge's `type`
(`packages/services/challenge/validation-mode.ts`). A stored column would be a second
source of truth that can drift from the first.
```

Then append a full **Scenario mode** section after the existing reference-case one, covering:

- **The scenario.** An ordered list of steps (title + optional instructions), authored at challenge configuration, shared by every exposed application — all contributors built against the same brief, so they face the same walkthrough. **Frozen the moment the first walkthrough starts**, draft or not. That freeze is what keeps walkthroughs comparable *and* what stops `validation_step_feedbacks.step_id` from ever dangling.
- **Exposing an application.** Same admin gesture and same route as ML; only the eligible contribution type changes (`project` instead of `api_packaging`). Exposing assumes the team has already deployed the application **and made it embeddable** — see below.
- **The walkthrough.** `POST /validation-scenario-runs` is idempotent: it creates the draft or returns the one you left, with the step feedbacks already recorded. `completed_at IS NULL` is a draft; there is no reservation step, so there is no abandoned-walkthrough state to clean up. Each step's `PUT` saves as you go. `POST .../complete` refuses an empty overall feedback or any unanswered step (and returns `missingStepIds` so the client can point at them), then stamps `completed_at` and writes **one** `reward_entries` row.
- **Guards.** Not your own application — checked against `contributions.user_id` **and** `contribution_members`, because `code` challenges support groups of 2-3 sharing one contribution where `user_id` is only the *holder*; ML has no groups, so this guard has no equivalent in the existing flow. Re-checked at completion, the same defense-in-depth posture as `castVerdict`. One walkthrough per (validator, application), enforced by a unique index so concurrent requests race safely. The medical comment is gated on the role, not on challenge membership.
- **Why the browser calls the application.** The exact inverse of the ML flow's rationale, and worth writing down: there is no proxy, no timeout, no size cap and nothing needs an SSRF check at walkthrough time — that guard existed to defend the *server* issuing the request. The guard at **exposure** time stays, and still buys the useful half: a `javascript:` URL can never be stored and later rendered as a link, and a typo pointing at a private address is caught while the admin is still looking at the form.
- **The iframe.** Whether embedding works is decided by `X-Frame-Options` / `CSP: frame-ancestors` from the **contributor's application code** — Django sends `SAMEORIGIN` by default, Express + helmet too, Next.js does not. Since the team deploys these applications itself, making one embeddable is a manual step of putting it online. The platform neither detects nor works around a non-embeddable application; the "open in a tab" button keeps the validator unblocked meanwhile.
- **Oversight.** `GET /api/challenges/:id/validation-scenario-runs` (admin/manager) and `ScenarioWalkthroughsPanel`. With no quorum, **this panel is the only quality control in v1.**

Then add a **Limitations (scenario mode)** block:

```markdown
- No quorum, no majority, no verdict — every completed walkthrough pays. The
  anti-gaming property the ML flow gets from majority payment is replaced by nothing
  but the oversight panel and the fact that feedback is signed and readable. The data
  model can host a quorum later: `result` per step is already a vote that simply is not
  counted.
- No effect on `evaluation_status` / `evaluation` / `globalScore` of the `project`
  contribution, and no reward for its author when the application validates well — CP
  stays entirely on the validator side, unchanged from ML.
- No automated deployment of the applications under test; deployment stays a manual
  team operation outside the platform.
- No iframe proxy stripping `X-Frame-Options`, and no detection that embedding failed.
- No per-application scenario; no editing a scenario after the first walkthrough; no
  editing a completed walkthrough.
- An application exposed late is walked with the same steps as the others —
  deliberately, otherwise walkthroughs stop being comparable.
- A draft walkthrough may sit forever. Nothing to clean up, nobody blocked.
- Un-exposing a target leaves its walkthroughs intact: they hang off the challenge and
  the contribution, never off `validation_targets`, so removing a target cannot silently
  destroy feedback that has already been paid for.
```

Finally, update the **Limitations (v1)** bullet that reads *"Only `ml` challenges' `api_packaging` submissions — no other submission type, and no path to `code` challenges yet"* — that gap is now closed, so it becomes: *"Reference-case mode still only covers `ml` challenges' `api_packaging` submissions."* And extend the **Key files** table with the eleven new files (three repositories, the three services plus `scenario-errors`/`scenario-guard`/`validatorContribution`/`validation-mode`, the two route folders, and the four components).

- [ ] **Step 2: Extend `docs/api.md`**

In the **Validation challenges** table, change the `?eligible=true` description to *"lists the source challenge's `api_packaging` (ML source) or `project` (Code source) contributions not yet exposed"*, then append:

```markdown
| `GET` | `/api/challenges/:id/validation-scenario-steps` | The scenario, in order, plus `frozen`. It is the protocol, not a secret — nothing is hidden from the validator in scenario mode. | Any signed-in user |
| `POST` | `/api/challenges/:id/validation-scenario-steps` | Append a step. 409 once any walkthrough exists. | Admin or manager |
| `PATCH` | `/api/challenges/:id/validation-scenario-steps/:stepId` | Retitle, re-instruct or reorder a step (a reorder renumbers every sibling). 409 once any walkthrough exists. | Admin or manager |
| `DELETE` | `/api/challenges/:id/validation-scenario-steps/:stepId` | Delete a step and renumber the rest. 409 once any walkthrough exists. | Admin or manager |
| `POST` | `/api/challenges/:id/validation-scenario-runs` | Open **or resume** a walkthrough on one application — idempotent, returns the full state. 403 on your own (or your group's) application. | Any signed-in user |
| `GET` | `/api/challenges/:id/validation-scenario-runs` | Every walkthrough on the challenge: per application, who walked it, each step result, the comments, the medical opinions and the overall feedback. | Admin or manager |
| `PUT` | `/api/challenges/:id/validation-scenario-runs/:runId/steps/:stepId` | Save one step: `result` (`passed`/`failed`/`blocked`), `comment`, `medical_comment`. The body is the step panel's full state. 403 on `medical_comment` from a non-`medical_pro`. | The walkthrough's owner |
| `POST` | `/api/challenges/:id/validation-scenario-runs/:runId/complete` | Close the walkthrough and pay `cp_per_validation`, clamped to the pool. 400 with `missingStepIds` while a step has no result. | The walkthrough's owner |
```

- [ ] **Step 3: Extend `docs/database.md`**

Add three rows to the schema table, next to `validation_attempts`:

```markdown
| `validation_scenario_steps` | The ordered walkthrough of a scenario-mode validation challenge (source challenge is `code`). Columns: `uuid`, `validation_challenge_id`, `position` (dense, 0-based — a reorder renumbers every sibling), `title`, `instructions`. Shared by every exposed application; frozen once any walkthrough exists. |
| `validation_scenario_runs` | One validator's pass over one application. Columns: `uuid`, `validation_challenge_id`, `contribution_id`, `validator_user_id`, `global_feedback`, `completed_at` (`NULL` = resumable draft). Unique on (challenge, contribution, validator) — that index is what makes `cp_per_validation` paid once under concurrent requests. Hangs off the challenge and the contribution, **not** off `validation_targets`, so un-exposing a target never destroys paid-for feedback. |
| `validation_step_feedbacks` | One row per (walkthrough, step), upserted as the validator moves through the scenario. Columns: `uuid`, `run_id`, `step_id`, `result` (`passed` / `failed` / `blocked`), `comment` (user experience), `medical_comment` (`medical_pro` only — alongside `comment`, never instead of it). Unique on (run, step). |
```

And extend the relationship diagram:

```
challenges ──< validation_scenario_steps
challenges ──< validation_scenario_runs >── contributions
validation_scenario_runs >── users
validation_scenario_runs ──< validation_step_feedbacks >── validation_scenario_steps
```

- [ ] **Step 4: Check the docs against the code one last time**

Run: `grep -rn "no path to .code. challenges yet" docs/`
Expected: no match — the gap the design doc opened with is closed and the sentence is gone.

Read back `docs/validation-challenges.md` end to end. Every route path, column name and file path it names must exist. In particular the **Key files** table is a map people navigate by; a stale path there costs more than a missing one.

- [ ] **Step 5: Commit**

```bash
git add docs/validation-challenges.md docs/api.md docs/database.md
git commit -m "docs(validation): describe the two modes a validation challenge can take"
```

---

## Self-review notes

Run through these before declaring the plan done — they are the places this design is most likely to be implemented subtly wrong.

**Spec coverage.** Every section of `docs/superpowers/specs/2026-09-11-code-validation-challenges-design.md` maps to a task: data model → Task 1; derived mode + creation → Tasks 2-3; `validation_targets` reuse → Task 4; scenario CRUD + freeze → Tasks 5-7; the four walkthrough guards → Tasks 8-10; the request flow → Tasks 11-12; the four UI surfaces → Tasks 7, 13, 14, 15; error handling / edge cases → Tasks 10 (pool exhausted, race), 5 (deletions), 8 (abandoned draft, late application), 9 (non-`medical_pro`); docs → Task 16. The two spec items that are deliberately *not* built, because the spec places them out of scope, are a quorum and an iframe proxy.

**Three places the mode must be derived, never inferred.** `POST /api/challenges` (Task 2), `validation-targets` (Task 4), and `assertScenarioChallenge` (Task 8). If a fourth appears, it goes through `validationModeFor`. Any `if (challenge.required_validations === null)` standing in for "scenario mode" is the bug this design exists to prevent.

**The group guard is the one genuinely new rule.** `contributions.user_id` alone is not ownership on a `code` challenge. Task 8's test *"refuses the application of a group I am a member of, even though I am not the holder"* is the one to run first if anything about eligibility looks off.

**Payment happens after the guarded update, never before.** `runRepo.complete()` is gated on `completed_at IS NULL` and returns `null` when it loses; only the winner pays. Reordering those two statements produces a double-pay that no test outside Task 10's *"pays nothing when it loses the completion race"* would catch.

**The freeze counts drafts.** `isFrozen` is `runs.length > 0`, not `runs.some(r => r.completed_at)`. A scenario that could still change while someone is mid-walkthrough would change under them.

**Colour comes from tokens.** The design file is the authority on structure and copy, not on hex. Grep the diff for `#0d9488`, `#f0fdf4`, `#0b1a15` before the final commit — none should appear.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-13-code-validation-challenges.md`. Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, with review between tasks and fast iteration.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.
