import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  challenge_repos,
  challenge_teams,
  challenges,
  repos,
  sandbox_rewards,
  sandboxes,
} from "../../database-service/db/drizzle.js";
import { toDomainChallenge, toDomainSandbox } from "../../database-service/db/mappers.js";
import {
  AppSettingsRepository,
  ContributionRepository,
  SandboxRepository,
} from "../../database-service/repositories/index.js";
import type { Challenge, ChallengeRepoRole, Sandbox } from "../../database-service/domain/entities.js";
import { buildRepoDefinitions } from "../challenge/challengeRepos.js";
import { MlRewardsService, type MlSubmissionEvent } from "../challenge/ml-rewards.service.js";
import { SandboxForbiddenError, SandboxNotFoundError, SandboxNotOpenError } from "./sandbox.service.js";
import {
  buildAuthorContributions,
  buildAuthorParticipation,
  buildPromotedChallengeDraft,
  seedMlWorkspaceMeta,
  type PromotionInput,
} from "./promotion.js";

export interface PromoteCommand {
  sandboxId: string;
  /** L'appelant. Seul un admin promeut (§1.6) — un manager n'a aucun droit ici. */
  actor: { userId: string; role: string };
  input: PromotionInput;
}

export interface PromoteResult {
  challenge: Challenge;
  sandbox: Sandbox;
}

/** Dépendances injectables, sur le motif de `SandboxServiceDeps`. */
export interface SandboxPromotionDeps {
  sandboxRepo: Pick<SandboxRepository, "findById">;
  appSettingsRepo: { get(): Promise<{ sandbox_promotion_bonus_cp: number }> };
  contributionRepo: Pick<ContributionRepository, "create">;
  /**
   * Le scoring ML, isolé pour les tests. C'est **le** chemin de scoring du
   * projet : `MlRewardsService.award`, celui qu'emprunte une soumission faite
   * depuis le challenge. La promotion ne s'en écrit pas un second.
   */
  awardMl: (event: MlSubmissionEvent) => Promise<void>;
}

/**
 * SandboxPromotionService
 * -----------------------
 * Transforme une proposition en challenge officiel. Voir docs/sandbox.md.
 *
 * Tout ce qui doit vivre ou mourir ensemble tient dans **une** transaction :
 * la bascule du sandbox, le challenge, ses repos, la participation de l'auteur
 * et le bonus de promotion. Les repositories n'acceptent pas de `tx`, donc
 * cette partie-là parle aux tables Drizzle directement — c'est le prix d'une
 * promotion qui ne peut pas rester à moitié faite.
 *
 * La reprise du travail de l'auteur (contributions + scoring) est **hors**
 * transaction, et volontairement : elle déclenche des appels agent de
 * plusieurs dizaines de secondes, qu'aucune transaction ne doit tenir ouverts.
 * Son échec ne défait pas la promotion, exactement comme les template tasks et
 * le brief du tiroir de création.
 */
export class SandboxPromotionService {
  private deps: SandboxPromotionDeps;

  constructor(deps?: Partial<SandboxPromotionDeps>) {
    this.deps = {
      sandboxRepo: new SandboxRepository(),
      appSettingsRepo: new AppSettingsRepository(),
      contributionRepo: new ContributionRepository(),
      awardMl: (event) => new MlRewardsService().award(event),
      ...deps,
    } as SandboxPromotionDeps;
  }

  async promote({ sandboxId, actor, input }: PromoteCommand): Promise<PromoteResult> {
    if (actor.role !== "admin") {
      throw new SandboxForbiddenError("only an admin can promote a sandbox");
    }

    // Lecture hors transaction, uniquement pour distinguer un identifiant
    // inconnu (404) d'une proposition déjà promue (409) : la garde en tête de
    // transaction, elle, ne sait pas faire la différence entre les deux.
    const existing = await this.deps.sandboxRepo.findById(sandboxId);
    if (!existing) throw new SandboxNotFoundError(sandboxId);

    const settings = await this.deps.appSettingsRepo.get();
    const bonus = settings?.sandbox_promotion_bonus_cp ?? 0;

    const challengeId = randomUUID();

    const { challenge, sandbox, reposByRole } = await db.transaction(async (tx) => {
      // 1. La garde, en tête. `WHERE status = 'open'` pose le verrou de ligne :
      //    une seconde promotion concurrente attend ici, puis relit `promoted`
      //    et ne ramène aucune row → exception → rollback. L'index unique
      //    partiel `(sandbox_id) WHERE rule_key = 'promotion'` de
      //    `sandbox_rewards` est la ceinture, pas la bretelle.
      //
      //    `promoted_challenge_id` n'est pas posé ici : sa FK vers `challenges`
      //    est vérifiée en fin d'instruction (NOT DEFERRABLE), et le challenge
      //    n'existe pas encore. Il est écrit juste après l'insert, dans la même
      //    transaction — la garde reste donc bien la première instruction.
      const [claimed] = await tx
        .update(sandboxes)
        .set({ status: "promoted", promoted_at: new Date(), updated_at: new Date() })
        .where(and(eq(sandboxes.uuid, sandboxId), eq(sandboxes.status, "open")))
        .returning();

      if (!claimed) {
        throw new SandboxNotOpenError("this sandbox is not open — it may already be promoted");
      }

      const claimedSandbox = toDomainSandbox(claimed);

      // 2. Le challenge. Son uuid est généré côté applicatif pour pouvoir le
      //    recoller sur le sandbox sans second aller-retour.
      const draft = buildPromotedChallengeDraft(claimedSandbox, input);
      const [challengeRow] = await tx
        .insert(challenges)
        .values({
          uuid: challengeId,
          title: draft.title,
          status: draft.status,
          type: draft.type,
          start_date: draft.start_date?.toISOString().split("T")[0] ?? null,
          end_date: draft.end_date?.toISOString().split("T")[0] ?? null,
          description: draft.description,
          roadmap: draft.roadmap,
          contribution_points_reward: draft.contribution_points_reward,
          completion: draft.completion,
          project_id: draft.project_id,
          reward_rules: draft.reward_rules ?? null,
          workspace_mode: draft.workspace_mode,
          source_challenge_id: draft.source_challenge_id,
          cp_per_validation: draft.cp_per_validation,
          required_validations: draft.required_validations,
          compute_enabled: draft.compute_enabled,
        })
        .returning();

      const [linkedSandbox] = await tx
        .update(sandboxes)
        .set({ promoted_challenge_id: challengeId })
        .where(eq(sandboxes.uuid, sandboxId))
        .returning();

      // 3. Repos et liens, avec le workspace de l'auteur déjà rempli. Les
      //    définitions viennent de `buildRepoDefinitions`, la même fonction que
      //    la route de création : un challenge promu a les mêmes étapes qu'un
      //    challenge créé à la main.
      const metaSeed = seedMlWorkspaceMeta(claimedSandbox, claimedSandbox.user_id);
      const definitions = buildRepoDefinitions({
        type: draft.type,
        title: draft.title,
        workspaceMode: draft.workspace_mode,
        apiPackagingEnabled: input.api_packaging_enabled,
      });

      const reposByRole = new Map<ChallengeRepoRole, string>();
      for (const definition of definitions) {
        const [repoRow] = await tx
          .insert(repos)
          .values({
            title: definition.title,
            type: definition.type,
            project_id: draft.project_id,
            external_repo_id: definition.external_repo_id ?? null,
          })
          .returning();

        await tx.insert(challenge_repos).values({
          challenge_id: challengeId,
          repo_id: repoRow.uuid,
          role: definition.role ?? null,
          workspace_meta: definition.role ? metaSeed[definition.role] ?? null : null,
        });

        if (definition.role) reposByRole.set(definition.role, repoRow.uuid);
      }

      // 4. L'auteur est membre de son challenge, son dépôt déjà déclaré.
      await tx.insert(challenge_teams).values(buildAuthorParticipation(claimedSandbox, challengeId));

      // 5. La trace de la promotion. Écrite **même si le bonus est nul** : la
      //    ligne est ce sur quoi s'appuie l'index unique, donc ce qui rend une
      //    seconde promotion impossible. Pas de `onConflictDoNothing` — un
      //    conflit ici doit faire tomber toute la transaction.
      await tx.insert(sandbox_rewards).values({
        sandbox_id: sandboxId,
        user_id: claimedSandbox.user_id,
        rule_key: "promotion",
        tier_stars: null,
        points: bonus,
      });

      return {
        challenge: toDomainChallenge(challengeRow),
        sandbox: toDomainSandbox(linkedSandbox ?? claimed),
        reposByRole,
      };
    });

    this.scheduleAuthorWork(sandbox, challenge, reposByRole);

    return { challenge, sandbox };
  }

  /**
   * **La reprise du travail de l'auteur**, après le commit.
   *
   * Déposer un dataset, un modèle ou du code sur un challenge est une
   * contribution créditée : l'auteur d'une proposition promue n'a donc rien à
   * re-soumettre. Les contributions sont créées, puis le scoring normal
   * (`MlRewardsService.award`) les crédite sur le pool du challenge.
   *
   * **Séquentiel, et pas en parallèle.** Chaque award calcule ce qu'il reste au
   * pool avant d'écrire ses lignes de ledger ; deux awards concurrents liraient
   * le même reste et pourraient, ensemble, dépasser le pool. Une soumission
   * depuis le challenge n'en déclenche jamais deux à la fois — la promotion est
   * le seul endroit où la question se pose.
   *
   * Fire-and-forget et non fatal : la promotion est déjà commitée, et un appel
   * agent dure des dizaines de secondes. Le statut vit sur
   * `contributions.evaluation_status`, que l'UI du challenge affiche.
   */
  private scheduleAuthorWork(
    sandbox: Sandbox,
    challenge: Challenge,
    reposByRole: Map<ChallengeRepoRole, string>,
  ): void {
    const drafts = buildAuthorContributions(sandbox, challenge.uuid);
    if (drafts.length === 0) return;

    void (async () => {
      for (const draft of drafts) {
        const repoId = reposByRole.get(draft.role);
        // Un rôle sans repo ne peut pas être scoré : `award` résout la règle
        // depuis `challenge_repos`, pas depuis la contribution.
        if (!repoId) continue;

        await this.deps.contributionRepo.create(draft.contribution);

        // Le rôle `model` n'a pas de grille (métrique Kaggle) : sa contribution
        // existe — créée par le draft `model_code`, qui partage son type — mais
        // rien ne la score tant que l'auteur n'a pas publié sa métrique.
        await this.deps.awardMl({
          challengeId: challenge.uuid,
          userId: sandbox.user_id,
          repoId,
          url: draft.url,
        });
      }
    })().catch((error) => {
      console.error(
        `[SandboxPromotionService] Reprise du travail échouée pour ${sandbox.uuid} → ${challenge.uuid}:`,
        error,
      );
    });
  }
}
