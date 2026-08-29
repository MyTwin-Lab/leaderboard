import { describe, expect, it } from 'vitest';
import { toPublicRepoActivity } from './repoActivity';

const RAW = {
  'repo-1': {
    type: 'github',
    events: [
      {
        type: 'commit', id: 'e1', title: 'feat: scoring', author: 'alix',
        date: '2026-03-12T10:00:00Z', url: 'https://github.com/org/repo/commit/abc',
        metadata: { sha: 'abc1234', additions: 10, deletions: 2, branchName: 'contrib/3-alix' },
      },
      {
        type: 'pull_request', id: 'e2', title: 'Fix race', author: 'marie',
        date: '2026-03-10T10:00:00Z', url: 'https://github.com/org/repo/pull/42',
        metadata: { prNumber: 42, state: 'merged', branchName: 'contrib/5-marie' },
      },
      {
        type: 'branch_created', id: 'e3', title: 'contrib/7-karim', author: 'karim',
        date: '2026-03-09T10:00:00Z', url: 'https://github.com/org/repo/tree/contrib/7-karim',
        metadata: { branchName: 'contrib/7-karim' },
      },
    ],
  },
  'repo-2': { error: 'ECONNREFUSED connecting to internal-runner.local:8443 with token ghp_xxx' },
  'repo-3': {
    type: 'kaggle_model',
    modelVersions: [{ ref: 'org/model', versions: [{ versionNumber: 1, createdAt: '2026-03-01', metrics: { auc: 0.9 } }] }],
  },
};

describe('toPublicRepoActivity', () => {
  it('never publishes a contributor branch name', () => {
    const serialised = JSON.stringify(toPublicRepoActivity(RAW));
    expect(serialised).not.toContain('contrib/3-alix');
    expect(serialised).not.toContain('contrib/5-marie');
    expect(serialised).not.toContain('contrib/7-karim');
    expect(serialised).not.toContain('branchName');
  });

  it('drops branch_created events, which exist only to name a branch', () => {
    const events = toPublicRepoActivity(RAW)['repo-1'].events;
    expect(events.map((e: any) => e.type)).toEqual(['commit', 'pull_request']);
  });

  it('replaces a connector error with a fixed string', () => {
    expect(toPublicRepoActivity(RAW)['repo-2']).toEqual({ error: 'unavailable' });
    expect(JSON.stringify(toPublicRepoActivity(RAW))).not.toContain('ghp_xxx');
    expect(JSON.stringify(toPublicRepoActivity(RAW))).not.toContain('internal-runner.local');
  });

  it('keeps the commit and pull-request detail the activity feed renders', () => {
    const events = toPublicRepoActivity(RAW)['repo-1'].events;
    expect(events[0]).toEqual({
      type: 'commit', id: 'e1', title: 'feat: scoring', author: 'alix',
      date: '2026-03-12T10:00:00Z', url: 'https://github.com/org/repo/commit/abc',
      metadata: { sha: 'abc1234', additions: 10, deletions: 2 },
    });
    expect(events[1].metadata).toEqual({ prNumber: 42, state: 'merged' });
  });

  it('passes Kaggle activity through — it describes public artifacts', () => {
    expect(toPublicRepoActivity(RAW)['repo-3']).toEqual(RAW['repo-3']);
  });

  it('survives a null activities map', () => {
    expect(toPublicRepoActivity(null as any)).toEqual({});
  });
});
