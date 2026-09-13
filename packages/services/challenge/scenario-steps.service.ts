import {
  ChallengeRepository,
  ScenarioStepRepository,
  ScenarioRunRepository,
} from "../../database-service/repositories/index.js";
import type { ValidationScenarioStep } from "../../database-service/domain/entities.js";
import { assertScenarioChallenge } from "./scenario-guard.js";
import { ScenarioFrozenError, StepNotFoundError } from "./scenario-errors.js";

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
    await assertScenarioChallenge(this.deps.challengeRepo, validationChallengeId);
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
    await assertScenarioChallenge(this.deps.challengeRepo, input.validationChallengeId);
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
    await assertScenarioChallenge(this.deps.challengeRepo, input.validationChallengeId);
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
    await assertScenarioChallenge(this.deps.challengeRepo, input.validationChallengeId);
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

  private async assertNotFrozen(validationChallengeId: string): Promise<void> {
    if (await this.isFrozen(validationChallengeId)) {
      throw new ScenarioFrozenError(
        "A walkthrough has already started on this challenge - the scenario is frozen"
      );
    }
  }
}
