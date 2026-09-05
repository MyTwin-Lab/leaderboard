import {
  AppSettingsRepository,
  ChallengeRepository,
  ContributionMemberRepository,
  ContributionRepository,
  DigestRepository,
  ProjectRepository,
  RewardEntryRepository,
  UserRepository,
} from "../../database-service/repositories/index.js";
import type {
  Challenge, Contribution, ContributionMember, Digest, DigestTriggerSource,
  Project, RewardEntry, User,
} from "../../database-service/domain/entities.js";
import { buildDigestPayload } from "./digest-payload.js";
import { digestWindow } from "./digest-schedule.js";

/** Les dépendances du service, réduites à ce qu'il appelle vraiment. */
export interface DigestServiceDeps {
  digestRepo: {
    findLatest(): Promise<Digest | null>;
    create(entry: Parameters<DigestRepository["create"]>[0]): Promise<Digest>;
  };
  appSettingsRepo: { get(): Promise<{ digest_frequency_days: number }> };
  contributionRepo: { findCreatedBetween(start: Date, end: Date): Promise<Contribution[]> };
  contributionMemberRepo: { findByContributions(ids: string[]): Promise<ContributionMember[]> };
  challengeRepo: {
    findCreatedBetween(start: Date, end: Date): Promise<Challenge[]>;
    findClosedBetween(start: Date, end: Date): Promise<Challenge[]>;
    findById(uuid: string): Promise<Challenge | null>;
  };
  userRepo: {
    findCreatedBetween(start: Date, end: Date): Promise<User[]>;
    findById(uuid: string): Promise<User | null>;
  };
  rewardEntryRepo: {
    findCreatedBetween(start: Date, end: Date): Promise<RewardEntry[]>;
    sumByChallenge(challengeId: string): Promise<number>;
  };
  projectRepo: { findById(uuid: string): Promise<Project | null> };
}

/**
 * DigestService
 * -------------
 * Fenêtre les lectures, délègue la mise en forme à `buildDigestPayload` et
 * insère. Aucun calcul métier ici : le curseur vient de la table `digests`
 * elle-même (`findLatest`), pas d'un état parallèle.
 *
 * Deux générations simultanées liraient le même curseur et produiraient deux
 * digests qui se recouvrent. C'est assumé en v1 — voir spec §13.
 */
export class DigestService {
  private deps: DigestServiceDeps;

  constructor(deps?: Partial<DigestServiceDeps>) {
    this.deps = {
      digestRepo: new DigestRepository(),
      appSettingsRepo: new AppSettingsRepository(),
      contributionRepo: new ContributionRepository(),
      contributionMemberRepo: new ContributionMemberRepository(),
      challengeRepo: new ChallengeRepository(),
      userRepo: new UserRepository(),
      rewardEntryRepo: new RewardEntryRepository(),
      projectRepo: new ProjectRepository(),
      ...deps,
    } as DigestServiceDeps;
  }

  async generate(trigger: DigestTriggerSource, now = new Date()): Promise<Digest> {
    const settings = await this.deps.appSettingsRepo.get();
    const last = await this.deps.digestRepo.findLatest();
    const { start, end } = digestWindow(
      last?.period_end ?? null,
      now,
      settings.digest_frequency_days,
    );

    // Les cinq lectures fenêtrées sont indépendantes.
    const [contributions, challengesCreated, challengesClosed, contributors, rewardEntries] =
      await Promise.all([
        this.deps.contributionRepo.findCreatedBetween(start, end),
        this.deps.challengeRepo.findCreatedBetween(start, end),
        this.deps.challengeRepo.findClosedBetween(start, end),
        this.deps.userRepo.findCreatedBetween(start, end),
        this.deps.rewardEntryRepo.findCreatedBetween(start, end),
      ]);

    // Les parts de groupe ne se chargent que pour les contributions de la
    // fenêtre : findByContributions existe pour éviter exactement ce N+1.
    const contributionMembers = await this.deps.contributionMemberRepo
      .findByContributions(contributions.map((c) => c.uuid));

    // Les lookups se résolvent depuis les ids réellement référencés, pas en
    // chargeant toute la table : la lecture doit croître avec la période, pas
    // avec l'historique.
    const userIds = new Set<string>([
      ...contributions.map((c) => c.user_id),
      ...contributionMembers.map((m) => m.user_id),
      ...rewardEntries.map((e) => e.user_id),
    ]);
    const challengeIds = new Set<string>([
      ...contributions.map((c) => c.challenge_id),
      ...rewardEntries.map((e) => e.challenge_id),
    ]);
    // Les challenges déjà chargés n'ont pas à être relus.
    const knownChallenges = new Map<string, Challenge>();
    for (const ch of [...challengesCreated, ...challengesClosed]) knownChallenges.set(ch.uuid, ch);
    for (const u of contributors) userIds.delete(u.uuid);

    const [fetchedUsers, fetchedChallenges] = await Promise.all([
      Promise.all([...userIds].map((id) => this.deps.userRepo.findById(id))),
      Promise.all(
        [...challengeIds]
          .filter((id) => !knownChallenges.has(id))
          .map((id) => this.deps.challengeRepo.findById(id)),
      ),
    ]);

    const usersById = new Map<string, User>(contributors.map((u) => [u.uuid, u]));
    for (const u of fetchedUsers) if (u) usersById.set(u.uuid, u);

    const challengesById = new Map(knownChallenges);
    for (const ch of fetchedChallenges) if (ch) challengesById.set(ch.uuid, ch);

    const projectIds = new Set(challengesCreated.map((ch) => ch.project_id).filter(Boolean));
    const projects = await Promise.all(
      [...projectIds].map((id) => this.deps.projectRepo.findById(id)),
    );
    const projectTitlesById = new Map<string, string>();
    for (const p of projects) if (p) projectTitlesById.set(p.uuid, p.title);

    // Bilan de clôture : le total distribué sur toute la vie du challenge, pas
    // sur la fenêtre — c'est ce qu'un lecteur attend en face du pool.
    const cpAwardedByChallenge = new Map<string, number>();
    await Promise.all(
      challengesClosed.map(async (ch) => {
        cpAwardedByChallenge.set(ch.uuid, await this.deps.rewardEntryRepo.sumByChallenge(ch.uuid));
      }),
    );

    const payload = buildDigestPayload({
      contributions,
      contributionMembers,
      challengesCreated,
      challengesClosed,
      contributors,
      rewardEntries,
      usersById,
      challengesById,
      projectTitlesById,
      cpAwardedByChallenge,
    });

    return this.deps.digestRepo.create({
      period_start: start,
      period_end: end,
      trigger_source: trigger,
      payload,
    });
  }
}
