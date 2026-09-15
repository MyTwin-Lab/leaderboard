import {
  SandboxRepository,
  SandboxRewardRepository,
  SandboxStarRepository,
} from "../../database-service/repositories/index.js";
import type { SandboxDraft, SandboxPatch } from "../../database-service/repositories/sandbox.repo.js";
import type { Sandbox } from "../../database-service/domain/entities.js";
import { legacyColumnsFromProposalFields } from "../../database-service/domain/legacyProposalFields.js";
import type { ProposableDeclaration } from "../../registry/platform.js";
import {
  InvalidProposalError,
  SandboxFlowUnavailableError,
  installedProposable,
  parseProposalFields,
  proposalFieldsOf,
} from "./proposal.js";
import { readSandboxSettings, type SandboxEconomySettings } from "./settings.js";
import { tiersToPay } from "./starTiers.js";
import { planAnonAttach } from "./starAttach.js";
import { ipHashRetentionCutoff, isRateLimited, rateLimitWindowStart } from "./starPolicy.js";

/** Le sandbox visé n'existe pas. → 404 */
export class SandboxNotFoundError extends Error {}
/** L'appelant n'est ni l'auteur, ni (pour l'archivage) un admin. → 403 */
export class SandboxForbiddenError extends Error {}
/** L'auteur a tenté de starer son propre sandbox. → 403 */
export class SelfStarError extends Error {}
/** Le sandbox n'est plus `open` : ni édition, ni nouvelle star. → 409 */
export class SandboxNotOpenError extends Error {}
/** Plafond horaire des stars anonymes atteint pour cette IP hachée. → 429 */
export class StarRateLimitedError extends Error {}
/** Les règles de reward d'une promotion ne se lisent pas avec le flow du challenge. → 400 */
export class InvalidRewardRulesError extends Error {}

/**
 * Qui star. Deux formes exclusives, jamais mélangées : une star faite en étant
 * connecté s'écrit toujours sous `user_id`, jamais sous `anon_id`, donc aucune
 * ligne anonyme ne peut se créer pendant une session.
 */
export type StarIdentity =
  | { kind: "account"; userId: string }
  | { kind: "anonymous"; anonId: string };

/**
 * Ce que l'API renvoie après un `PUT`/`DELETE /star`.
 *
 * `paidTierThresholds` est lu dans `sandbox_rewards` et **pas déduit** de
 * `starCount` : le rattachement d'une identité anonyme peut faire passer le
 * compteur sous un seuil déjà payé, et un palier n'est jamais repris.
 */
export interface StarState {
  starCount: number;
  myStar: boolean;
  paidTierThresholds: number[];
}

/** Dépendances injectables, sur le motif de `CodeRewardsDeps`. */
export interface SandboxServiceDeps {
  sandboxRepo: Pick<SandboxRepository, "findById" | "create" | "update" | "archive">;
  starRepo: Pick<
    SandboxStarRepository,
    | "upsertUserStar"
    | "upsertAnonStar"
    | "softRemove"
    | "findActiveForUser"
    | "findActiveForAnon"
    | "countActive"
    | "countCreatedByIpSince"
    | "attachAnonToUser"
    | "purgeIpHashesOlderThan"
  >;
  rewardRepo: Pick<SandboxRewardRepository, "paidTierThresholdsBySandboxIds" | "insertTierIfAbsent">;
  /** Réduit à ce que le service lit : les paliers réglés dans le module sandbox. */
  settings: () => Promise<Pick<SandboxEconomySettings, "star_tiers">>;
  /** La déclaration `proposable` d'un flow — le registre installé, par défaut. */
  proposable: (flowKey: string) => ProposableDeclaration | undefined;
  /** Injectable pour que les fenêtres de débit et de purge soient testables. */
  now: () => Date;
}

/** Une création : ce que tout sandbox partage, et les champs bruts de la proposition. */
export interface SandboxCreateCommand
  extends Omit<SandboxDraft, "repo_url" | "model_url" | "dataset_urls" | "proposal_fields"> {
  fields: Record<string, unknown>;
}

/** Une édition : les champs communs, et les champs de proposition à fusionner aux actuels. */
export interface SandboxEditCommand
  extends Omit<SandboxPatch, "repo_url" | "model_url" | "dataset_urls" | "proposal_fields"> {
  fields?: Record<string, unknown>;
}

/**
 * SandboxService
 * --------------
 * Cycle de vie d'une proposition et économie de ses stars. Voir docs/sandbox.md.
 *
 * Ce que ce service ne fait pas, volontairement : aucun contrôle de rôle à la
 * création (§1.6 — c'est la route qui connaît le rôle de l'appelant), aucune
 * connaissance des champs d'une proposition (le flow les valide, voir
 * `proposable`), et aucune écriture dans `reward_entries` ni dans
 * `contributions` — le ledger sandbox est séparé, par construction.
 */
export class SandboxService {
  private deps: SandboxServiceDeps;

  constructor(deps?: Partial<SandboxServiceDeps>) {
    this.deps = {
      sandboxRepo: new SandboxRepository(),
      starRepo: new SandboxStarRepository(),
      rewardRepo: new SandboxRewardRepository(),
      settings: () => readSandboxSettings(),
      proposable: installedProposable,
      now: () => new Date(),
      ...deps,
    } as SandboxServiceDeps;
  }

  /**
   * Création. `type` est la clé d'un flow installé qui accepte des propositions,
   * et ses champs passent le schéma de ce flow. `type` est figé ici et
   * n'apparaît dans aucun chemin d'édition : il a déterminé les champs saisis
   * et l'évaluation.
   */
  async create({ fields: rawFields, ...draft }: SandboxCreateCommand): Promise<Sandbox> {
    const proposable = this.deps.proposable(draft.type);
    if (!proposable) {
      throw new InvalidProposalError(`"${draft.type}" does not accept proposals`, {
        formErrors: [],
        fieldErrors: { type: [`"${draft.type}" does not accept proposals`] },
      });
    }

    const fields = parseProposalFields(proposable, rawFields);
    return this.deps.sandboxRepo.create({
      ...draft,
      // Les anciennes colonnes, en miroir jusqu'au lot L7.
      ...legacyColumnsFromProposalFields(fields),
      proposal_fields: fields,
    });
  }

  /**
   * Édition par l'auteur seul, et seulement tant que le sandbox est `open`.
   *
   * Un sandbox promu a donné naissance à un challenge qui vit sa vie : éditer
   * la proposition après coup réécrirait l'histoire sans rien changer au
   * challenge. Un archivé est sorti. `SandboxEditCommand` ne porte pas `type` :
   * son immuabilité est portée par le typage, pas par un test à l'exécution.
   *
   * Des champs de proposition édités sont fusionnés aux actuels puis validés
   * **en entier** par le flow : l'état qui résulte de l'édition doit rester une
   * proposition valable. Un flow retiré laisse éditer le reste, pas les champs.
   */
  async update(sandboxId: string, actorId: string, { fields: rawFields, ...patch }: SandboxEditCommand): Promise<Sandbox> {
    const sandbox = await this.requireSandbox(sandboxId);
    if (sandbox.user_id !== actorId) {
      throw new SandboxForbiddenError("only the author can edit this sandbox");
    }
    if (sandbox.status !== "open") {
      throw new SandboxNotOpenError(`sandbox is ${sandbox.status}`);
    }

    let write: SandboxPatch = patch;
    if (rawFields && Object.keys(rawFields).length > 0) {
      const proposable = this.deps.proposable(sandbox.type);
      if (!proposable) {
        throw new SandboxFlowUnavailableError(`flow "${sandbox.type}" no longer accepts proposals`);
      }
      const fields = parseProposalFields(proposable, { ...proposalFieldsOf(sandbox), ...rawFields });
      write = { ...patch, ...legacyColumnsFromProposalFields(fields), proposal_fields: fields };
    }

    const updated = await this.deps.sandboxRepo.update(sandboxId, write);
    if (!updated) throw new SandboxNotFoundError(sandboxId);
    return updated;
  }

  /**
   * Archivage : l'auteur pour le sien, l'admin pour n'importe lequel (§1.6).
   * Un manager n'a aucun droit particulier — un sandbox n'a pas de projet.
   *
   * Sans garde de statut : archiver un sandbox déjà promu est un geste d'admin
   * légitime, le challenge issu de la promotion continue de vivre.
   */
  async archive(sandboxId: string, actor: { userId: string; isAdmin: boolean }): Promise<Sandbox> {
    const sandbox = await this.requireSandbox(sandboxId);
    if (!actor.isAdmin && sandbox.user_id !== actor.userId) {
      throw new SandboxForbiddenError("only the author or an admin can archive this sandbox");
    }

    const archived = await this.deps.sandboxRepo.archive(sandboxId);
    if (!archived) throw new SandboxNotFoundError(sandboxId);
    return archived;
  }

  /**
   * Star, dans cet ordre : auteur refusé, sandbox non `open` refusé, débit
   * anonyme, upsert, purge opportuniste, puis paiement des paliers franchis.
   *
   * L'ordre n'est pas cosmétique : les refus précèdent toute écriture, et le
   * comptage des paliers suit l'upsert pour que la star qui vient d'être posée
   * soit dans le compteur.
   */
  async star(
    sandboxId: string,
    identity: StarIdentity,
    ipHash: string | null = null
  ): Promise<StarState> {
    const sandbox = await this.requireSandbox(sandboxId);

    if (identity.kind === "account" && sandbox.user_id === identity.userId) {
      throw new SelfStarError("the author cannot star their own sandbox");
    }
    if (sandbox.status !== "open") {
      throw new SandboxNotOpenError(`sandbox is ${sandbox.status}`);
    }

    // Débit sur les seules stars anonymes : un compte est déjà borné à une
    // star par sandbox par l'index unique, le plafonner en plus n'ajouterait
    // rien et gênerait un utilisateur légitime derrière une IP partagée.
    if (identity.kind === "anonymous" && ipHash) {
      const since = rateLimitWindowStart(this.deps.now());
      const recent = await this.deps.starRepo.countCreatedByIpSince(ipHash, since);
      if (isRateLimited(recent)) {
        throw new StarRateLimitedError(
          "too many anonymous stars from this address - sign in to continue"
        );
      }
    }

    if (identity.kind === "account") {
      await this.deps.starRepo.upsertUserStar({
        sandbox_id: sandboxId,
        user_id: identity.userId,
        ip_hash: ipHash,
      });
    } else {
      await this.deps.starRepo.upsertAnonStar({
        sandbox_id: sandboxId,
        anon_id: identity.anonId,
        ip_hash: ipHash,
      });
    }

    await this.purgeExpiredIpHashes();

    const { starCount, paidTierThresholds } = await this.payCrossedTiers(sandbox);
    return { starCount, myStar: true, paidTierThresholds };
  }

  /**
   * Unstar : soft-delete, et **rien n'est repris**. Le palier déjà payé reste
   * payé, et la ligne reste en base — sans elle, une vague star/unstar ne
   * laisserait aucune trace d'audit et le débit, qui compte sur `created_at`,
   * ne verrait plus rien.
   *
   * Aucune garde de statut : retirer sa propre star d'un sandbox promu ou
   * archivé reste permis, c'est un geste qui ne peut que faire baisser un
   * compteur. Idempotent — dé-starer deux fois n'est pas une erreur.
   */
  async unstar(sandboxId: string, identity: StarIdentity): Promise<StarState> {
    const sandbox = await this.requireSandbox(sandboxId);

    const existing =
      identity.kind === "account"
        ? await this.deps.starRepo.findActiveForUser(sandboxId, identity.userId)
        : await this.deps.starRepo.findActiveForAnon(sandboxId, identity.anonId);

    if (existing) await this.deps.starRepo.softRemove(existing.uuid);

    const [starCount, paidMap] = await Promise.all([
      this.deps.starRepo.countActive(sandboxId),
      this.deps.rewardRepo.paidTierThresholdsBySandboxIds([sandbox.uuid]),
    ]);
    return {
      starCount,
      myStar: false,
      paidTierThresholds: paidMap.get(sandbox.uuid) ?? [],
    };
  }

  /**
   * Rattache à un compte les stars laissées par son identité anonyme.
   *
   * Appelée au retour du callback de connexion, sous `try/catch` : un échec de
   * rattachement ne doit jamais casser une connexion, et la connexion suivante
   * rejoue sans effet.
   */
  async attachAnonStars(
    anonId: string,
    userId: string
  ): Promise<{ deleted: number; attached: number }> {
    return this.deps.starRepo.attachAnonToUser(anonId, userId, planAnonAttach);
  }

  /**
   * Paie tous les paliers franchis et non encore payés, et renvoie le compteur
   * ainsi que la liste à jour des seuils payés.
   *
   * `insertTierIfAbsent` renvoie `null` quand le palier avait déjà été payé —
   * c'est la garantie d'idempotence face à deux stars concurrentes qui
   * franchissent le même seuil : chacune compte après son propre insert, donc
   * les deux peuvent voir le seuil atteint, et l'index unique partiel n'en
   * laisse écrire qu'une. Un `null` ne veut donc pas dire « non payé » : le
   * seuil rejoint la liste renvoyée dans les deux cas.
   */
  private async payCrossedTiers(
    sandbox: Sandbox
  ): Promise<{ starCount: number; paidTierThresholds: number[] }> {
    const [starCount, settings, paidMap] = await Promise.all([
      this.deps.starRepo.countActive(sandbox.uuid),
      this.deps.settings(),
      this.deps.rewardRepo.paidTierThresholdsBySandboxIds([sandbox.uuid]),
    ]);

    const alreadyPaid = paidMap.get(sandbox.uuid) ?? [];
    const due = tiersToPay(starCount, settings.star_tiers ?? [], alreadyPaid);

    for (const tier of due) {
      await this.deps.rewardRepo.insertTierIfAbsent({
        sandbox_id: sandbox.uuid,
        // L'auteur au moment du paiement, dénormalisé : le leaderboard lit les
        // CP sans jointure, et le ledger garde la trace de qui a été payé.
        user_id: sandbox.user_id,
        tier_stars: tier.stars,
        points: tier.cp,
      });
    }

    const paidTierThresholds = [
      ...new Set([...alreadyPaid, ...due.map((tier) => tier.stars)]),
    ].sort((a, b) => a - b);

    return { starCount, paidTierThresholds };
  }

  /**
   * Purge RGPD des hachés d'IP, opportuniste à chaque écriture de star plutôt
   * que par un cron — le volume est faible et un cron de plus serait un
   * composant de plus à surveiller.
   *
   * Non fatale : c'est de l'entretien, il n'a aucune raison de faire échouer la
   * star que le visiteur vient de poser.
   */
  private async purgeExpiredIpHashes(): Promise<void> {
    try {
      await this.deps.starRepo.purgeIpHashesOlderThan(ipHashRetentionCutoff(this.deps.now()));
    } catch (error) {
      console.warn("[sandbox] ip hash purge failed", error);
    }
  }

  private async requireSandbox(sandboxId: string): Promise<Sandbox> {
    const sandbox = await this.deps.sandboxRepo.findById(sandboxId);
    if (!sandbox) throw new SandboxNotFoundError(sandboxId);
    return sandbox;
  }
}
