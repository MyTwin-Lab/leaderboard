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
