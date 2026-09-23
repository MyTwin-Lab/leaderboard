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
  ChallengeRepository,
  SandboxRepository,
} from "../../database-service/repositories/index.js";
import { isSlugUniqueViolation } from "../../database-service/repositories/slugs.js";
import { SlugTakenError } from "../../database-service/domain/slug.js";
import type { Challenge, Sandbox } from "../../database-service/domain/entities.js";
import { buildRepoDefinitions } from "../challenge/challengeRepos.js";
import { SandboxForbiddenError, SandboxNotFoundError, SandboxNotOpenError } from "./sandbox.service.js";
import {
  buildAuthorParticipation,
  buildPromotedChallengeDraft,
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
  challengeRepo: Pick<ChallengeRepository, "isSlugTaken" | "availableSlug">;
  appSettingsRepo: { get(): Promise<{ sandbox_promotion_bonus_cp: number }> };
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
 * Ce que la promotion ne fait plus : reprendre le travail de l'auteur. Elle
 * recopiait le dépôt, le dataset et le modèle de la proposition en
 * contributions déjà scorées — trois champs qu'un sandbox ne porte plus depuis
 * qu'il est un projet. L'auteur est membre dès la promotion, et soumet depuis
 * le challenge comme tout le monde.
 */
export class SandboxPromotionService {
  private deps: SandboxPromotionDeps;

  constructor(deps?: Partial<SandboxPromotionDeps>) {
    this.deps = {
      sandboxRepo: new SandboxRepository(),
      challengeRepo: new ChallengeRepository(),
      appSettingsRepo: new AppSettingsRepository(),
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

    // Vérifié avant d'ouvrir la transaction, pour répondre 409 avec une
    // suggestion sans rien avoir écrit. L'index unique reste l'arbitre d'une
    // création concurrente du même slug : voir le catch plus bas.
    const slug = await this.resolveChallengeSlug(existing, input.slug);

    const settings = await this.deps.appSettingsRepo.get();
    const bonus = settings?.sandbox_promotion_bonus_cp ?? 0;

    const challengeId = randomUUID();

    const { challenge, sandbox } = await db.transaction(async (tx) => {
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
          cover_image_url: draft.cover_image_url,
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

      // 3. Repos et liens. Les définitions viennent de `buildRepoDefinitions`,
      //    la même fonction que la route de création : un challenge promu a les
      //    mêmes étapes qu'un challenge créé à la main. Leur `workspace_meta`
      //    part vide — la proposition ne porte ni dépôt ni artefact à recopier.
      const definitions = buildRepoDefinitions({
        type: draft.type,
        title: draft.title,
        workspaceMode: draft.workspace_mode,
        apiPackagingEnabled: input.api_packaging_enabled,
      });

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
          workspace_meta: null,
        });
      }

      // 4. L'auteur est membre de son challenge, son workspace à déclarer.
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
      };
    }).catch(async (error) => {
      // Un slug pris entre la vérification et l'insert : toute la promotion
      // est annulée, et l'admin reçoit la même réponse qu'avant l'envoi.
      if (isSlugUniqueViolation(error, ["idx_challenges_slug"])) {
        throw new SlugTakenError(slug, await this.deps.challengeRepo.availableSlug(slug));
      }
      throw error;
    });

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
}
