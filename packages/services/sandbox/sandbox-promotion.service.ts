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
import { ChallengeRepository, SandboxRepository } from "../../database-service/repositories/index.js";
import { isSlugUniqueViolation } from "../../database-service/repositories/slugs.js";
import { SlugTakenError } from "../../database-service/domain/slug.js";
import type { Challenge, Sandbox } from "../../database-service/domain/entities.js";
import type { ProposableDeclaration } from "../../registry/platform.js";
import { creationRepos } from "../../capabilities/challenge-hooks.js";
import {
  InvalidRewardRulesError,
  SandboxForbiddenError,
  SandboxNotFoundError,
  SandboxNotOpenError,
} from "./sandbox.service.js";
import { SandboxFlowUnavailableError, installedProposable, proposalFieldsOf } from "./proposal.js";
import { readSandboxSettings, type SandboxEconomySettings } from "./settings.js";
import { parseFlowRules, prepareFlowConfig } from "../../capabilities/flow-config.js";
import { legacyChallengeColumns } from "../../database-service/domain/legacyFlowConfig.js";
import { buildAuthorParticipation, buildPromotedChallengeDraft, type PromotionInput } from "./promotion.js";

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
  challengeRepo: Pick<ChallengeRepository, "isSlugTaken" | "availableSlug">;
  /** Réduit à ce que le service lit : le bonus réglé dans le module sandbox. */
  settings: () => Promise<Pick<SandboxEconomySettings, "promotion_bonus_cp">>;
  /** La déclaration `proposable` d'un flow — le registre installé, par défaut. */
  proposable: (flowKey: string) => ProposableDeclaration | undefined;
}

/**
 * SandboxPromotionService
 * -----------------------
 * Transforme une proposition en challenge officiel. Voir docs/sandbox.md.
 *
 * Le challenge naît dans le flow de la proposition, et c'est ce flow qui dit ce
 * qu'il devient (`proposable.promote`) : sa configuration, le `workspace_meta`
 * de ses repos, la reprise du travail déjà déposé. Un sandbox dont le flow
 * n'est plus installé ou n'accepte plus de propositions n'est pas promu.
 *
 * Tout ce qui doit vivre ou mourir ensemble tient dans **une** transaction :
 * la bascule du sandbox, le challenge, ses repos, la participation de l'auteur
 * et le bonus de promotion. Les repositories n'acceptent pas de `tx`, donc
 * cette partie-là parle aux tables Drizzle directement — c'est le prix d'une
 * promotion qui ne peut pas rester à moitié faite.
 *
 * La reprise du travail de l'auteur est **hors** transaction, et volontairement :
 * elle peut déclencher des appels agent de plusieurs dizaines de secondes,
 * qu'aucune transaction ne doit tenir ouverts. Son échec ne défait pas la
 * promotion, exactement comme les template tasks et le brief du tiroir de création.
 */
export class SandboxPromotionService {
  private deps: SandboxPromotionDeps;

  constructor(deps?: Partial<SandboxPromotionDeps>) {
    this.deps = {
      sandboxRepo: new SandboxRepository(),
      challengeRepo: new ChallengeRepository(),
      settings: () => readSandboxSettings(),
      proposable: installedProposable,
      ...deps,
    } as SandboxPromotionDeps;
  }

  async promote({ sandboxId, actor, input: rawInput }: PromoteCommand): Promise<PromoteResult> {
    if (actor.role !== "admin") {
      throw new SandboxForbiddenError("only an admin can promote a sandbox");
    }

    // Lecture hors transaction, uniquement pour distinguer un identifiant
    // inconnu (404) d'une proposition déjà promue (409) : la garde en tête de
    // transaction, elle, ne sait pas faire la différence entre les deux.
    const existing = await this.deps.sandboxRepo.findById(sandboxId);
    if (!existing) throw new SandboxNotFoundError(sandboxId);

    // Refusé avant toute écriture : sans son flow, rien ne dit ce que la
    // proposition deviendrait, ni même si un challenge de ce type peut exister.
    const proposable = this.deps.proposable(existing.type);
    if (!proposable) {
      throw new SandboxFlowUnavailableError(
        `flow "${existing.type}" is not installed or no longer accepts proposals — this sandbox cannot be promoted`,
      );
    }

    // Mêmes règles qu'à la création d'un challenge, lues par le flow du
    // challenge à naître : des règles illisibles seraient stockées telles
    // quelles et le scoring ne trouverait rien.
    const rewardRules = parseFlowRules(existing.type, rawInput.reward_rules);
    if (!rewardRules.ok) throw new InvalidRewardRulesError("Invalid reward_rules");
    const input: PromotionInput = { ...rawInput, reward_rules: rewardRules.rules };

    // Vérifié avant d'ouvrir la transaction, pour répondre 409 avec une
    // suggestion sans rien avoir écrit. L'index unique reste l'arbitre d'une
    // création concurrente du même slug : voir le catch plus bas.
    const slug = await this.resolveChallengeSlug(existing, input.slug);

    const settings = await this.deps.settings();
    const bonus = settings?.promotion_bonus_cp ?? 0;

    const challengeId = randomUUID();

    const { challenge, sandbox, repoIdsByRole } = await db.transaction(async (tx) => {
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
      const fields = proposalFieldsOf(claimedSandbox);

      // 2. Le challenge. Son uuid est généré côté applicatif pour pouvoir le
      //    recoller sur le sandbox sans second aller-retour.
      const draft = buildPromotedChallengeDraft(
        claimedSandbox,
        input,
        proposable.promote?.flowConfig?.({
          compute_enabled: input.compute_enabled,
          api_packaging_enabled: input.api_packaging_enabled,
        }) ?? {},
      );
      // Validée par le flow, écrite dans sa version courante. L'insert est brut
      // (transaction) : les colonnes historiques sont posées en miroir ici,
      // comme le fait le repository (jusqu'au lot L7).
      const flowConfig = prepareFlowConfig(draft.type, draft.flow_config);
      const [challengeRow] = await tx
        .insert(challenges)
        .values({
          uuid: challengeId,
          title: draft.title,
          slug,
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
          source_challenge_id: draft.source_challenge_id,
          ...flowConfig,
          ...legacyChallengeColumns(flowConfig.flow_config),
        })
        .returning();

      const [linkedSandbox] = await tx
        .update(sandboxes)
        .set({ promoted_challenge_id: challengeId })
        .where(eq(sandboxes.uuid, sandboxId))
        .returning();

      // 3. Repos et liens, avec le workspace de l'auteur déjà rempli. Les
      //    définitions viennent du hook `onCreate` du flow, que lit aussi
      //    la route de création : un challenge promu a les mêmes étapes qu'un
      //    challenge créé à la main.
      const metaSeed = proposable.promote?.workspaceMeta?.(fields, claimedSandbox.user_id) ?? {};
      const definitions = creationRepos(toDomainChallenge(challengeRow), {
        api_packaging_enabled: input.api_packaging_enabled,
      });

      const repoIdsByRole: Record<string, string> = {};
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

        if (definition.role) repoIdsByRole[definition.role] = repoRow.uuid;
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
        repoIdsByRole,
      };
    }).catch(async (error) => {
      // Un slug pris entre la vérification et l'insert : toute la promotion
      // est annulée, et l'admin reçoit la même réponse qu'avant l'envoi.
      if (isSlugUniqueViolation(error, ["idx_challenges_slug"])) {
        throw new SlugTakenError(slug, await this.deps.challengeRepo.availableSlug(slug));
      }
      throw error;
    });

    this.scheduleAfterPromote(proposable, sandbox, challenge, repoIdsByRole);

    return { challenge, sandbox };
  }

  /**
   * Le slug du challenge promu. Demandé : il doit être libre. Absent : celui de
   * la proposition — challenges et sandboxes ont des espaces de noms séparés,
   * donc `/sandbox/mykine` devient `/challenges/mykine` s'il n'est pas déjà pris.
   */
  private async resolveChallengeSlug(sandbox: Sandbox, requested: string | null | undefined): Promise<string> {
    if (!requested) return this.deps.challengeRepo.availableSlug(sandbox.slug);
    if (await this.deps.challengeRepo.isSlugTaken(requested)) {
      throw new SlugTakenError(requested, await this.deps.challengeRepo.availableSlug(requested));
    }
    return requested;
  }

  /**
   * **La reprise du travail de l'auteur**, après le commit : ce que le flow
   * déclare (`proposable.promote.afterPromote`), les contributions et leur
   * scoring d'une proposition ML par exemple.
   *
   * Fire-and-forget et non fatal : la promotion est déjà commitée, et un appel
   * agent dure des dizaines de secondes.
   */
  private scheduleAfterPromote(
    proposable: ProposableDeclaration,
    sandbox: Sandbox,
    challenge: Challenge,
    repoIdsByRole: Record<string, string>,
  ): void {
    const afterPromote = proposable.promote?.afterPromote;
    if (!afterPromote) return;

    void Promise.resolve()
      .then(() =>
        afterPromote({
          challengeId: challenge.uuid,
          authorId: sandbox.user_id,
          fields: proposalFieldsOf(sandbox),
          repoIdsByRole,
        }),
      )
      .catch((error) => {
        console.error(
          `[SandboxPromotionService] Reprise du travail échouée pour ${sandbox.uuid} → ${challenge.uuid}:`,
          error,
        );
      });
  }
}
