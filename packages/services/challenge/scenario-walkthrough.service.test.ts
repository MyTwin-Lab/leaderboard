import { describe, it, expect, vi } from "vitest";

import { ScenarioWalkthroughService } from "./scenario-walkthrough.service.js";
import type { ScenarioWalkthroughDeps } from "./scenario-walkthrough.service.js";
import {
  ScenarioModeError,
  EmptyScenarioError,
  SelfWalkthroughError,
  TargetNotExposedError,
  MedicalCommentForbiddenError,
  RunNotFoundError,
  ForbiddenRunAccessError,
  RunAlreadyCompletedError,
  StepNotFoundError,
  IncompleteWalkthroughError,
  GlobalFeedbackRequiredError,
  ValidatorRoleError,
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

  it("lets a contributor open a walkthrough", async () => {
    const { deps } = makeDeps({ validatorRole: "contributor" });

    await expect(open(deps)).resolves.toMatchObject({ runId: "run-new" });
  });

  it("lets a medical_pro open a walkthrough", async () => {
    const { deps } = makeDeps({ validatorRole: "medical_pro" });

    await expect(open(deps)).resolves.toMatchObject({ runId: "run-new" });
  });

  it("lets an admin open a walkthrough", async () => {
    const { deps } = makeDeps({ validatorRole: "admin" });

    await expect(open(deps)).resolves.toMatchObject({ runId: "run-new" });
  });

  it("refuses a viewer — read-only everywhere else, and CP paid to one can't be recovered", async () => {
    const { deps, runsCreated } = makeDeps({ validatorRole: "viewer" });

    await expect(open(deps)).rejects.toThrow(ValidatorRoleError);
    expect(runsCreated).toEqual([]);
  });
});

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

  it("re-checks the role guard at completion, not only at opening — a contributor demoted to viewer mid-draft is refused and paid nothing", async () => {
    // Même défense en profondeur que la garde de non-propriété juste
    // au-dessus : un rôle peut changer entre l'ouverture d'un brouillon et sa
    // clôture. Le point n'est pas seulement que ça lève, mais que personne
    // n'est payé pour autant — d'où l'assertion sur rewardBatches, pas
    // seulement sur l'erreur.
    const { deps, rewardBatches, completed } = makeDeps({
      existingRun: DRAFT, feedbacks: bothAnswered(), validatorRole: "viewer",
    });

    await expect(complete(deps)).rejects.toThrow(ValidatorRoleError);
    expect(rewardBatches).toEqual([]);
    expect(completed).toEqual([]);
  });
});
