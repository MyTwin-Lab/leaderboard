import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MlRewardsService } from '../../../../packages/services/challenge/ml-rewards.service';
import type { MlRewardsDeps } from '../../../../packages/services/challenge/ml-rewards.service';
import { normalizeArtifactUrl } from '../../../../packages/services/challenge/artifactUrl';
import type { MlRewardRules } from '../../../../packages/database-service/domain/mlRewardRules';
import type {
  Challenge,
  ChallengeRepo,
  ChallengeRepoRole,
  Contribution,
  RewardEntry,
} from '../../../../packages/database-service/domain/entities';

/**
 * End-to-end award flow against an in-memory database.
 *
 * The unit tests cover each piece in isolation (scoring, url normalization,
 * lineage). This exercises the assembly: role dispatch, the agent being skipped
 * on reuse, ledger writes, the `contributions.reward` cache, pool draining, and
 * — the point of the whole design — points moving between contributors.
 *
 * The fake DB mirrors the real repositories' behaviour, including the reward
 * cache being recomputed from the ledger rather than incremented.
 */

const RULES: MlRewardRules = {
  version: 1,
  dataset: { cap: 300 },
  model: { cap: 500, kaggleShare: 0.5, metric: { name: 'auc', baseline: 0 }, beatBestBonus: 50 },
  apiPackaging: { cap: 200 },
  reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
};

const REPOS: Record<ChallengeRepoRole, string> = {
  dataset: 'repo-dataset',
  model: 'repo-model',
  model_code: 'repo-model-code',
  api: 'repo-api',
};

const CONTRIB_TYPE: Record<ChallengeRepoRole, string> = {
  dataset: 'dataset',
  model: 'model',
  model_code: 'model',
  api: 'api_packaging',
};

// ─── In-memory database ───────────────────────────────────────────────────────

class FakeDb {
  challenges: Challenge[] = [];
  challengeRepos: ChallengeRepo[] = [];
  contributions: Contribution[] = [];
  entries: RewardEntry[] = [];
  private seq = 0;

  constructor(pool: number, rules: MlRewardRules | null = RULES) {
    this.challenges.push({
      uuid: 'ch-1',
      title: 'ML Challenge',
      status: 'active',
      type: 'ml',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-02-01'),
      contribution_points_reward: pool,
      completion: 0,
      project_id: 'proj-1',
      reward_rules: rules,
    });

    for (const [role, repoId] of Object.entries(REPOS)) {
      this.challengeRepos.push({
        challenge_id: 'ch-1',
        repo_id: repoId,
        role: role as ChallengeRepoRole,
      });
    }
  }

  /** Mirrors what `PATCH ml-workspace` writes before the award runs. */
  submit(userId: string, role: ChallengeRepoRole, url: string, at: string): Contribution {
    const type = CONTRIB_TYPE[role];
    const existing = this.contributions.find(c => c.user_id === userId && c.type === type);
    // Only the step's identifying artifact carries the url; the model's code
    // repo feeds the same contribution without owning its artifact.
    const artifact = role === 'model_code' ? undefined : normalizeArtifactUrl(url);

    if (existing) {
      if (artifact) existing.artifact_url = artifact;
      existing.evaluation_status = 'pending';
      return existing;
    }

    const contribution: Contribution = {
      uuid: `contrib-${++this.seq}`,
      title: `${type} submission`,
      type,
      description: url,
      reward: 0,
      user_id: userId,
      challenge_id: 'ch-1',
      artifact_url: artifact,
      evaluation_status: 'pending',
      submitted_at: new Date(at),
    };
    this.contributions.push(contribution);
    return contribution;
  }

  /**
   * Mirrors what the "pick from community" multi-select PATCH writes:
   * `workspace_meta.datasetUrls[userId]` on the dataset repo — the full set of
   * datasets a user has attached to their upcoming model build.
   */
  attachDatasets(userId: string, urls: string[]): void {
    const repo = this.challengeRepos.find(r => r.challenge_id === 'ch-1' && r.role === 'dataset')!;
    const meta = (repo.workspace_meta as Record<string, unknown>) ?? {};
    const datasetUrls = { ...(meta.datasetUrls as Record<string, string[]> ?? {}), [userId]: urls };
    repo.workspace_meta = { ...meta, datasetUrls };
  }

  rewardOf(userId: string, type: string): number {
    return this.contributions.find(c => c.user_id === userId && c.type === type)?.reward ?? 0;
  }

  totalOf(userId: string): number {
    return this.entries.filter(e => e.user_id === userId).reduce((s, e) => s + e.points, 0);
  }

  distributed(): number {
    return this.entries.reduce((s, e) => s + e.points, 0);
  }

  deps(overrides: Partial<MlRewardsDeps> = {}): Partial<MlRewardsDeps> {
    const db = this;
    return {
      challengeRepo: {
        findById: async (id: string) => db.challenges.find(c => c.uuid === id) ?? null,
        update: async (uuid: string, patch: Partial<Challenge>) => {
          const c = db.challenges.find(x => x.uuid === uuid)!;
          Object.assign(c, patch);
          return c;
        },
      },
      challengeRepoRepo: {
        findByChallengeAndRepo: async (challengeId: string, repoId: string) =>
          db.challengeRepos.find(r => r.challenge_id === challengeId && r.repo_id === repoId) ?? null,
        findByChallengeAndRole: async (challengeId: string, role: ChallengeRepoRole) =>
          db.challengeRepos.filter(r => r.challenge_id === challengeId && r.role === role),
      },
      contributionRepo: {
        findByChallenge: async (challengeId: string) =>
          db.contributions.filter(c => c.challenge_id === challengeId),
        update: async (uuid: string, patch: Partial<Contribution>) => {
          const c = db.contributions.find(x => x.uuid === uuid)!;
          Object.assign(c, patch);
          return c;
        },
      },
      rewardRepo: {
        sumByChallenge: async (challengeId: string) =>
          db.entries.filter(e => e.challenge_id === challengeId).reduce((s, e) => s + e.points, 0),

        bestMetricValue: async (challengeId: string, opts?: { excludeUserId?: string; onlyUserId?: string }) => {
          const values = db.entries
            .filter(e => e.challenge_id === challengeId && e.rule_key === 'model_metric')
            .filter(e => (opts?.excludeUserId ? e.user_id !== opts.excludeUserId : true))
            .filter(e => (opts?.onlyUserId ? e.user_id === opts.onlyUserId : true))
            .map(e => e.meta?.metricValue)
            .filter((v): v is number => typeof v === 'number');
          return values.length ? Math.max(...values) : null;
        },

        createManyAndSyncRewards: async (drafts) => {
          const inserted = drafts.map(d => ({
            ...d,
            uuid: `entry-${++db.seq}`,
            created_at: new Date(),
          })) as RewardEntry[];
          db.entries.push(...inserted);

          // Same as the real repo: recompute the cache from the ledger instead
          // of incrementing, so it can never drift from the source of truth.
          for (const id of new Set(inserted.map(e => e.contribution_id).filter(Boolean))) {
            const c = db.contributions.find(x => x.uuid === id);
            if (c) c.reward = db.entries.filter(e => e.contribution_id === id).reduce((s, e) => s + e.points, 0);
          }
          return inserted;
        },
      },
      ...overrides,
    };
  }
}

// ─── Harness ──────────────────────────────────────────────────────────────────

function harness(pool = 100_000, rules: MlRewardRules | null = RULES) {
  const db = new FakeDb(pool, rules);
  const readMetric = vi.fn(async () => 0);
  const runAgent = vi.fn(async () => 0);
  const service = new MlRewardsService(db.deps({ readMetric, runAgent }));

  /** Submits a url and awards it, the way the PATCH route chains them. */
  const submit = async (
    userId: string,
    role: ChallengeRepoRole,
    url: string,
    outcome: { agentScore?: number; metric?: number },
    at = '2026-01-10T10:00:00Z'
  ) => {
    db.submit(userId, role, url, at);
    runAgent.mockResolvedValue(outcome.agentScore ?? 0);
    readMetric.mockResolvedValue(outcome.metric ?? 0);
    await service.award({ challengeId: 'ch-1', userId, repoId: REPOS[role], url });
  };

  return { db, service, submit, readMetric, runAgent };
}

const ALICE_DATASET = 'https://www.kaggle.com/datasets/alice/tumors';
const BOB_MODEL = 'https://www.kaggle.com/models/bob/resnet';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ML rewards — single contributor', () => {
  it('awards the dataset cap in proportion to the agent score and caches it', async () => {
    const { db, submit } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 });

    expect(db.rewardOf('alice', 'dataset')).toBe(240); // 300 * 0.8
    expect(db.contributions[0].evaluation_status).toBe('done');
  });

  it('accumulates both model halves onto one contribution', async () => {
    const { db, submit } = harness();

    await submit('bob', 'model', BOB_MODEL, { metric: 1 });
    await submit('bob', 'model_code', 'https://github.com/bob/resnet', { agentScore: 0.6 });

    // 250 (metric half) + 50 (first-submitter bonus) + 150 (code half)
    expect(db.rewardOf('bob', 'model')).toBe(450);
    expect(db.contributions.filter(c => c.user_id === 'bob' && c.type === 'model')).toHaveLength(1);
  });

  it('leaves the model at half reward when no GitHub is submitted', async () => {
    const { db, submit } = harness();

    await submit('bob', 'model', BOB_MODEL, { metric: 1 });

    expect(db.rewardOf('bob', 'model')).toBe(300); // 250 + 50 bonus, no code half
  });

  it('marks the contribution failed and rethrows when the agent blows up', async () => {
    const { db, service, runAgent } = harness();
    db.submit('alice', 'dataset', ALICE_DATASET, '2026-01-10T10:00:00Z');
    runAgent.mockRejectedValue(new Error('openai exploded'));

    await expect(
      service.award({ challengeId: 'ch-1', userId: 'alice', repoId: REPOS.dataset, url: ALICE_DATASET })
    ).rejects.toThrow('openai exploded');

    expect(db.contributions[0].evaluation_status).toBe('failed');
    expect(db.rewardOf('alice', 'dataset')).toBe(0);
  });

  it('awards nothing when the challenge has no reward rules', async () => {
    const { db, submit } = harness(100_000, null);

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 1 });

    expect(db.entries).toHaveLength(0);
  });
});

describe('ML rewards — dataset reuse', () => {
  it('pays the reuser nothing and never calls the agent for the same artifact', async () => {
    const { db, submit, runAgent } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');
    runAgent.mockClear();

    // Bob pastes Alice's url — a different string, the same dataset
    await submit('bob', 'dataset', 'https://kaggle.com/datasets/Alice/Tumors/', { agentScore: 0.8 }, '2026-01-11T10:00:00Z');

    expect(runAgent).not.toHaveBeenCalled();
    expect(db.rewardOf('bob', 'dataset')).toBe(0);
    expect(db.contributions.find(c => c.user_id === 'bob')!.evaluation_status).toBe('skipped_reuse');
    expect(db.rewardOf('alice', 'dataset')).toBe(240); // untouched
  });

  it("moves a share of the reuser's model points to the dataset author", async () => {
    const { db, submit } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');
    await submit('bob', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-11T10:00:00Z');
    await submit('bob', 'model', BOB_MODEL, { metric: 1 }, '2026-01-11T11:00:00Z');

    // Bob's model: 250 metric + 50 bonus = 300 gross, 20% siphoned = 60
    expect(db.totalOf('bob')).toBe(240);
    // Alice: 240 dataset + 60 reuse
    expect(db.totalOf('alice')).toBe(300);
  });

  it("grows the author's own contribution as others reuse it", async () => {
    const { db, submit } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');
    expect(db.rewardOf('alice', 'dataset')).toBe(240);

    await submit('bob', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-11T10:00:00Z');
    await submit('bob', 'model', BOB_MODEL, { metric: 1 }, '2026-01-11T11:00:00Z');

    // The reuse credit lands on Alice's own dataset contribution — which is why
    // the leaderboard's group-by-owner aggregation stays correct untouched.
    expect(db.rewardOf('alice', 'dataset')).toBe(300);
  });

  it('stacks a cut per reuser rather than sharing one', async () => {
    const { db, submit } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');

    for (const [i, user] of ['bob', 'carol', 'dave'].entries()) {
      await submit(user, 'dataset', ALICE_DATASET, { agentScore: 0.8 }, `2026-01-1${i + 1}T10:00:00Z`);
      await submit(user, 'model', `https://www.kaggle.com/models/${user}/m`, { metric: 1 }, `2026-01-1${i + 1}T11:00:00Z`);
    }

    // Only Bob takes the lead bonus; carol and dave tie his metric at 1.0.
    // Alice: 240 + 60 (bob, incl. bonus) + 50 + 50 = 400
    expect(db.rewardOf('alice', 'dataset')).toBe(400);
  });

  it('never pays a contributor for reusing their own dataset', async () => {
    const { db, submit } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');
    await submit('alice', 'model', 'https://www.kaggle.com/models/alice/m', { metric: 1 }, '2026-01-11T10:00:00Z');

    expect(db.entries.some(e => e.rule_key === 'reuse_dataset')).toBe(false);
    expect(db.totalOf('alice')).toBe(540); // 240 + 250 + 50
  });
});

describe('ML rewards — the lead bonus', () => {
  it('pays the contributor who takes the lead', async () => {
    const { db, submit } = harness();

    await submit('alice', 'model', 'https://www.kaggle.com/models/alice/m', { metric: 0.7 });
    await submit('bob', 'model', BOB_MODEL, { metric: 0.9 });

    expect(db.entries.filter(e => e.rule_key === 'beat_best').map(e => e.user_id)).toEqual(['alice', 'bob']);
  });

  it('cannot be farmed by improving on your own score', async () => {
    const { db, submit } = harness();

    await submit('bob', 'model', BOB_MODEL, { metric: 0.5 });
    await submit('bob', 'model', BOB_MODEL, { metric: 0.6 });
    await submit('bob', 'model', BOB_MODEL, { metric: 0.7 });

    // Only the first submission took a lead; the rest are self-improvement.
    expect(db.entries.filter(e => e.rule_key === 'beat_best')).toHaveLength(1);
  });

  it('pays again when a lost lead is taken back', async () => {
    const { db, submit } = harness();

    await submit('bob', 'model', BOB_MODEL, { metric: 0.8 });
    await submit('alice', 'model', 'https://www.kaggle.com/models/alice/m', { metric: 0.9 });
    await submit('bob', 'model', BOB_MODEL, { metric: 0.95 });

    expect(db.entries.filter(e => e.rule_key === 'beat_best' && e.user_id === 'bob')).toHaveLength(2);
  });
});

describe('ML rewards — the pool', () => {
  it('clamps an award to what is left', async () => {
    const { db, submit } = harness(100);

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 1 });

    expect(db.rewardOf('alice', 'dataset')).toBe(100); // capped from 300
    expect(db.distributed()).toBe(100);
  });

  it('pays nothing once drained, and still records the evaluation', async () => {
    const { db, submit } = harness(300);

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 1 });
    await submit('bob', 'model', BOB_MODEL, { metric: 1 });

    expect(db.rewardOf('bob', 'model')).toBe(0);
    expect(db.contributions.find(c => c.user_id === 'bob')!.evaluation_status).toBe('done');
  });

  it('keeps the pool accounting exact — reuse rows cancel out', async () => {
    const pool = 100_000;
    const { db, submit } = harness(pool);

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');
    await submit('bob', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-11T10:00:00Z');
    await submit('bob', 'model', BOB_MODEL, { metric: 1 }, '2026-01-11T11:00:00Z');
    await submit('bob', 'model_code', 'https://github.com/bob/resnet', { agentScore: 1 }, '2026-01-11T12:00:00Z');

    // 240 dataset + 250 metric + 50 bonus + 250 code — the ±60 reuse rows net to 0
    expect(db.distributed()).toBe(790);
    expect(db.totalOf('alice') + db.totalOf('bob')).toBe(790);
  });
});

describe('ML rewards — multi-dataset attribution (community picks)', () => {
  it("splits a model award across every attached dataset, weighted 1/N, and keeps the builder's own slice", async () => {
    const { db, submit } = harness();

    // Alice and Dave each publish their own dataset.
    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T09:00:00Z');
    const daveDataset = 'https://www.kaggle.com/datasets/dave/weather';
    await submit('dave', 'dataset', daveDataset, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');

    // Carol publishes her own dataset too, then checks Alice's and Dave's as
    // additional community picks — the "3 datasets, 1 of mine + 2 from the
    // community" scenario.
    const carolDataset = 'https://www.kaggle.com/datasets/carol/climate';
    await submit('carol', 'dataset', carolDataset, { agentScore: 0.8 }, '2026-01-10T11:00:00Z');
    db.attachDatasets('carol', [carolDataset, ALICE_DATASET, daveDataset]);

    await submit('carol', 'model', 'https://www.kaggle.com/models/carol/m', { metric: 1 }, '2026-01-11T10:00:00Z');

    // Carol's model: 250 metric + 50 first-submitter bonus = 300 gross.
    // Each external third deducts 20% of its own slice: round(250/3*0.2)=17
    // on the metric award, round(50/3*0.2)=3 on the bonus — 20 per author.
    expect(db.rewardOf('alice', 'dataset')).toBe(260); // 240 own + 20 from Carol
    expect(db.rewardOf('dave', 'dataset')).toBe(260);  // 240 own + 20 from Carol
    expect(db.rewardOf('carol', 'model')).toBe(260);   // 300 gross - 20 - 20
    expect(db.rewardOf('carol', 'dataset')).toBe(240); // her own share, untouched — she authored it

    // Redistribution, not minting.
    expect(db.totalOf('alice') + db.totalOf('dave') + db.totalOf('carol')).toBe(db.distributed());
  });

  it('checking a community dataset does not itself trigger an award or touch the dataset step', async () => {
    const { db, submit, runAgent } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T09:00:00Z');
    runAgent.mockClear();

    db.attachDatasets('bob', [ALICE_DATASET]);

    expect(runAgent).not.toHaveBeenCalled();
    expect(db.entries).toHaveLength(1); // only Alice's own dataset award exists
    expect(db.contributions.find(c => c.user_id === 'bob')).toBeUndefined();
  });

  it('unchecking a dataset stops it from being credited on the next model submission', async () => {
    const { db, submit } = harness();

    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.8 }, '2026-01-10T09:00:00Z');
    const bobDataset = 'https://www.kaggle.com/datasets/bob/own';
    await submit('bob', 'dataset', bobDataset, { agentScore: 0.8 }, '2026-01-10T10:00:00Z');

    // Attach, then uncheck Alice's before submitting the model.
    db.attachDatasets('bob', [bobDataset, ALICE_DATASET]);
    db.attachDatasets('bob', [bobDataset]);

    await submit('bob', 'model', BOB_MODEL, { metric: 1 }, '2026-01-11T10:00:00Z');

    expect(db.entries.some(e => e.rule_key === 'reuse_dataset')).toBe(false);
    expect(db.rewardOf('bob', 'model')).toBe(300); // full gross, nothing shared
    expect(db.rewardOf('alice', 'dataset')).toBe(240); // untouched
  });
});

describe('ML rewards — full scenario', () => {
  it('reconciles every account in a three-contributor challenge', async () => {
    const { db, submit } = harness();

    // Alice builds the dataset everyone will train on
    await submit('alice', 'dataset', ALICE_DATASET, { agentScore: 0.9 }, '2026-01-10T09:00:00Z');
    await submit('alice', 'model', 'https://www.kaggle.com/models/alice/m', { metric: 0.7 }, '2026-01-10T10:00:00Z');

    // Bob reuses her dataset and beats her metric
    await submit('bob', 'dataset', ALICE_DATASET, { agentScore: 0.9 }, '2026-01-11T09:00:00Z');
    await submit('bob', 'model', BOB_MODEL, { metric: 0.9 }, '2026-01-11T10:00:00Z');
    await submit('bob', 'model_code', 'https://github.com/bob/resnet', { agentScore: 0.8 }, '2026-01-11T11:00:00Z');
    await submit('bob', 'api', 'https://github.com/bob/api', { agentScore: 0.7 }, '2026-01-11T12:00:00Z');

    // Carol reuses Alice's dataset AND Bob's model, and does not take the lead
    await submit('carol', 'dataset', ALICE_DATASET, { agentScore: 0.9 }, '2026-01-12T09:00:00Z');
    await submit('carol', 'model', BOB_MODEL, { metric: 0.85 }, '2026-01-12T10:00:00Z');

    // Alice's dataset earns 270, then keeps growing on its own: every model
    // award her dataset made possible pays her 20% — including Bob's code half
    // and his lead bonus, which are model awards too.
    //   270 + 45 (Bob metric) + 10 (Bob bonus) + 40 (Bob code) + 43 (Carol metric)
    expect(db.rewardOf('alice', 'dataset')).toBe(408);
    expect(db.rewardOf('alice', 'model')).toBe(225); // 175 metric + 50 for leading first
    expect(db.totalOf('alice')).toBe(633);

    // Bob owes Alice 20% of every model award, and collects 20% of Carol's.
    //   225 − 45 + 50 − 10 + 200 − 40 + 43 (from Carol)
    expect(db.rewardOf('bob', 'model')).toBe(423);
    expect(db.rewardOf('bob', 'dataset')).toBe(0);      // reused Alice's
    expect(db.rewardOf('bob', 'api_packaging')).toBe(140); // API is not a model award — untouched by reuse
    expect(db.totalOf('bob')).toBe(563);

    // Carol reused two artifacts, so 40% of her model points are siphoned, and
    // her 0.85 never took the lead off Bob's 0.9.
    expect(db.rewardOf('carol', 'model')).toBe(127); // 213 − 43 − 43
    expect(db.rewardOf('carol', 'dataset')).toBe(0);
    expect(db.entries.some(e => e.user_id === 'carol' && e.rule_key === 'beat_best')).toBe(false);

    // Nothing is created or lost: every account sums to what the pool paid out
    const everyone = ['alice', 'bob', 'carol'].reduce((s, u) => s + db.totalOf(u), 0);
    expect(everyone).toBe(db.distributed());
    expect(db.distributed()).toBe(1323);

    // And every reuse pair nets to zero — redistribution, never minting
    const reuseRows = db.entries.filter(e => e.rule_key.startsWith('reuse_'));
    expect(reuseRows.reduce((s, e) => s + e.points, 0)).toBe(0);
    expect(reuseRows.length % 2).toBe(0);
  });
});
