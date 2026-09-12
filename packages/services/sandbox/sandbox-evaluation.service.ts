import { SandboxRepository } from "../../database-service/repositories/index.js";
import type { Sandbox } from "../../database-service/domain/entities.js";
import { evaluateGithubRepo, parseGithubRepoUrl } from "../challenge/repo-evaluation.js";

/**
 * SandboxEvaluationService
 * ------------------------
 * L'évaluation **formative** d'une proposition : l'auteur lance l'agent sur son
 * repo et lit une note sur 10, pour savoir où il en est. Voir docs/sandbox.md.
 *
 * Ce que ce service n'écrit **jamais** — et c'est ce qui le distingue de
 * `CodeRewardsService`, dont il partage pourtant le cœur d'exécution : aucune
 * ligne dans `reward_entries`, `sandbox_rewards` ni `contributions`. Un
 * sandbox ne rapporte des CP que par ses stars et sa promotion ; l'évaluation
 * est un miroir, pas une monnaie. Le service n'a donc aucun repository de
 * reward dans ses dépendances : l'absence est structurelle, pas une omission.
 */

/**
 * **Les deux types de sandbox sont évalués avec la grille `code`** (§1.3 du plan).
 *
 * Ce n'est pas un raccourci : la table des rôles de `ml-rewards.service.ts`
 * associe `model_code → code` et `model → null`, le rôle modèle se scorant sur
 * une métrique Kaggle et non sur une grille. La grille `model` n'évalue donc
 * jamais de code, et un sandbox n'a que du code à snapshoter. Ce qui distingue
 * un sandbox `ml`, c'est le contexte textuel passé à l'agent — voir
 * `buildEvaluationContext`.
 */
export const SANDBOX_EVALUATION_GRID = "code";

export type CannotEvaluateSandboxReason =
  | "not_found"
  | "not_author"
  | "invalid_repo"
  | "already_running";

export interface SandboxEvaluationEvent {
  sandboxId: string;
  userId: string;
}

/** Dépendances injectables, sur le motif de `SandboxServiceDeps`. */
export interface SandboxEvaluationDeps {
  sandboxRepo: Pick<SandboxRepository, "findById" | "setEvaluationStatus" | "storeEvaluation">;
  /** Isole l'accès réseau (GitHub + OpenAI) — remplacé par une doublure en test. */
  evaluateRepo: typeof evaluateGithubRepo;
}

/**
 * Le contexte textuel donné à l'agent.
 *
 * Un sandbox n'a pas de tâches ni de brief : ce texte est tout ce que l'agent
 * saura de l'intention de l'auteur. Les URLs de datasets et de modèle y sont
 * injectées quand elles existent — c'est là, et **pas dans le choix de la
 * grille**, que se joue la différence entre un sandbox `code` et un `ml`.
 *
 * Un sandbox `ml` sans artefact ne produit aucune ligne `Model artifact:` :
 * `model_url` est nullable par construction (§1.2), démarrer sans modèle est
 * un état normal.
 */
export function buildEvaluationContext(
  sandbox: Pick<Sandbox, "context" | "goals" | "why" | "model_url" | "dataset_urls">,
): string {
  const blocks: string[] = [];

  const context = sandbox.context?.trim();
  if (context) blocks.push(context);

  // Les buts en premier après le contexte : ce sont eux que l'agent doit
  // confronter au dépôt. Sans eux il note un repo dans l'absolu, alors que
  // toute la proposition tient dans l'écart entre ce que l'auteur voulait
  // construire et ce qui est là.
  const goals = (sandbox.goals ?? []).map((g) => g.trim()).filter(Boolean);
  if (goals.length > 0) {
    blocks.push(`What the author set out to build:\n${goals.map((g) => `- ${g}`).join("\n")}`);
  }

  const why = sandbox.why?.trim();
  if (why) blocks.push(`Why it matters: ${why}`);

  if (sandbox.model_url) blocks.push(`Model artifact: ${sandbox.model_url}`);

  const datasets = (sandbox.dataset_urls ?? []).filter(Boolean);
  if (datasets.length > 0) blocks.push(`Datasets: ${datasets.join(", ")}`);

  return blocks.join("\n\n");
}

export class SandboxEvaluationService {
  private deps: SandboxEvaluationDeps;

  constructor(deps?: Partial<SandboxEvaluationDeps>) {
    this.deps = {
      sandboxRepo: new SandboxRepository(),
      evaluateRepo: evaluateGithubRepo,
      ...deps,
    };
  }

  /**
   * Préconditions du bouton « Run » — partagées entre la route et l'UI, avec
   * une raison affichable, comme `CodeRewardsService.canEvaluate`.
   *
   * Aucune garde sur `status` : relancer l'agent sur un sandbox promu ou
   * archivé ne coûte rien à personne et n'écrit que sur la proposition
   * elle-même. Seul l'auteur peut le faire (§1.6), et le résultat n'est visible
   * que de lui et des admins.
   */
  async canEvaluate(
    sandboxId: string,
    userId: string,
  ): Promise<{ ok: boolean; reason?: CannotEvaluateSandboxReason }> {
    const sandbox = await this.deps.sandboxRepo.findById(sandboxId);
    if (!sandbox) return { ok: false, reason: "not_found" };
    if (sandbox.user_id !== userId) return { ok: false, reason: "not_author" };
    if (!parseGithubRepoUrl(sandbox.repo_url)) return { ok: false, reason: "invalid_repo" };
    if (isInFlight(sandbox.evaluation_status)) return { ok: false, reason: "already_running" };
    return { ok: true };
  }

  /** Fire-and-forget : l'appel agent dure des dizaines de secondes, le statut vit sur le sandbox. */
  scheduleEvaluation(event: SandboxEvaluationEvent): void {
    this.evaluate(event).catch((error) => {
      console.error(
        `[SandboxEvaluationService] Evaluation failed for ${event.userId} on ${event.sandboxId}:`,
        error,
      );
    });
  }

  async evaluate(event: SandboxEvaluationEvent): Promise<void> {
    const { sandboxId, userId } = event;

    const sandbox = await this.deps.sandboxRepo.findById(sandboxId);
    if (!sandbox) return;
    // Re-vérifié ici et pas seulement dans `canEvaluate` : `scheduleEvaluation`
    // est appelable depuis n'importe où, la règle ne doit pas dépendre de la route.
    if (sandbox.user_id !== userId) return;

    const target = parseGithubRepoUrl(sandbox.repo_url);
    if (!target) {
      console.warn(`[SandboxEvaluationService] Unparseable repo URL on ${sandboxId}: ${sandbox.repo_url}`);
      return;
    }

    // Relecture du statut juste avant la bascule, et non seulement dans
    // `canEvaluate` — c'est la fenêtre que deux `POST /evaluation` concurrents
    // traverseraient tous les deux. La garde `expectedFrom` la referme pour de
    // bon : le passage à `running` est un compare-and-set, un seul des deux
    // appels obtient `true`.
    const fresh = await this.deps.sandboxRepo.findById(sandboxId);
    if (!fresh) return;
    if (isInFlight(fresh.evaluation_status)) {
      console.log(`[SandboxEvaluationService] Evaluation already running on ${sandboxId} — skipping`);
      return;
    }
    const claimed = await this.deps.sandboxRepo.setEvaluationStatus(sandboxId, "running", {
      expectedFrom: fresh.evaluation_status ?? null,
    });
    if (!claimed) {
      console.log(`[SandboxEvaluationService] Another run took ${sandboxId} — skipping`);
      return;
    }

    try {
      const { evaluation } = await this.deps.evaluateRepo({
        slug: target.slug,
        branch: target.branch,
        gridSlug: SANDBOX_EVALUATION_GRID,
        subject: {
          title: sandbox.title,
          type: "code",
          description: buildEvaluationContext(sandbox),
          // Le sandbox tient la place du challenge : il n'y en a pas, et
          // l'agent n'a besoin que d'un identifiant de rattachement.
          challengeId: sandbox.uuid,
          userId: sandbox.user_id,
        },
        hasPriorEvaluation: !!sandbox.evaluation,
      });

      // `storeEvaluation` pose `evaluated_at` en même temps que le statut :
      // c'est la date du score affiché, pas celle du lancement.
      await this.deps.sandboxRepo.storeEvaluation(sandboxId, evaluation, "done");
    } catch (error) {
      await this.deps.sandboxRepo.setEvaluationStatus(sandboxId, "failed");
      throw error;
    }
  }
}

/** `pending` comme `running` : un run est en vol, l'UI poll et le bouton est bloqué. */
function isInFlight(status: Sandbox["evaluation_status"]): boolean {
  return status === "pending" || status === "running";
}
