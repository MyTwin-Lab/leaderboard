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
import type { RewardEntryDraft } from "../../database-service/repositories/index.js";
import type { Challenge } from "../../database-service/domain/entities.js";
import { assertScenarioChallenge } from "./scenario-guard.js";
import { findOrCreateValidatorContribution } from "./validatorContribution.js";
import {
  EmptyScenarioError,
  ForbiddenRunAccessError,
  GlobalFeedbackRequiredError,
  IncompleteWalkthroughError,
  MedicalCommentForbiddenError,
  RunAlreadyCompletedError,
  RunNotFoundError,
  SelfWalkthroughError,
  StepNotFoundError,
  TargetNotExposedError,
  ValidatorRoleError,
} from "./scenario-errors.js";

/** Rôles autorisés à parcourir un scénario et être payés pour — tout sauf `viewer`. */
const ELIGIBLE_VALIDATOR_ROLES = ["contributor", "medical_pro", "admin"];

/** Un champ texte vide ou blanc vaut « pas de contenu », jamais une chaîne vide en base. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

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

export interface CompleteWalkthroughResult {
  completed: true;
  /** CP réellement versés — 0 si le pool était déjà vide quand c'est arrivé à ce validateur. */
  cpAwarded: number;
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
    await this.assertValidatorRole(validatorUserId);

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
   * « Any signed-in contributor » dans la spec veut dire ce que le rôle dit :
   * contributor, medical_pro et admin peuvent parcourir un scénario ; viewer
   * — assignable, lecture seule partout ailleurs dans proxy.ts — ne peut pas.
   * Vérifié ici plutôt que dans le middleware pour que ce soit testable et
   * pour que toute route qui appelle openWalkthrough en hérite.
   */
  private async assertValidatorRole(validatorUserId: string): Promise<void> {
    const user = await this.deps.userRepo.findById(validatorUserId);
    if (!user || !ELIGIBLE_VALIDATOR_ROLES.includes(user.role)) {
      throw new ValidatorRoleError("Only a contributor, medical_pro or admin can walk through a scenario");
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
