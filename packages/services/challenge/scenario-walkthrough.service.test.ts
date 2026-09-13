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
