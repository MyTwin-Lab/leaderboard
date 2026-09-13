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
