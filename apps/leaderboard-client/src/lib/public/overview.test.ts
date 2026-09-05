import { describe, expect, it } from 'vitest';
import { toPublicOverview } from './overview';

// One fixture carrying every field we refuse to publish, so a mapper that
// regresses to a pass-through fails loudly rather than quietly leaking.
const RAW = {
  challenge: {
    uuid: 'c1', title: 'Alpha', description: 'desc', status: 'active',
    type: 'code', start_date: '2026-01-01', end_date: '2026-02-01',
    contribution_points_reward: 1000, project_id: 'p1',
    workspace_mode: 'provided_repo',
    roadmap: 'internal roadmap notes',
    reward_rules: { model: { metric: 'auc' } },
  },
  team: [
    { uuid: 'u1', full_name: 'Alix C', avatar_url: 'https://x/a.png', github_username: 'alix', email: 'alix@example.com', role: 'admin' },
  ],
  tasks: [
    { uuid: 't1', user_id: 'u1', status: 'done', parent_task_id: null, title: 'my private note', description: 'secret' },
  ],
  meetings: [{ uuid: 'm1', title: 'Sync', meet_link: 'https://meet.google.com/abc-defg-hij' }],
  repos: [{ repo_id: 'r1', workspace_meta: { userUrls: { u1: 'https://github.com/org/repo' } } }],
  contributions: [
    { uuid: 'k1', user_id: 'u1', type: 'project', reward: 120, submitted_at: '2026-01-15', evaluation_status: 'done', description: 'internal' },
  ],
  participants: [
    { user_id: 'u1', workspace_provider: 'github', workspace_ref: 'contrib/3-alix', workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix', workspace_status: 'ready' },
  ],
};

describe('toPublicOverview', () => {
  it('never lets a workspace field through', () => {
    const serialised = JSON.stringify(toPublicOverview(RAW as any));
    expect(serialised).not.toContain('workspace_url');
    expect(serialised).not.toContain('workspace_ref');
    expect(serialised).not.toContain('workspace_status');
    expect(serialised).not.toContain('contrib/3-alix');
  });

  it('never lets a task title or description through', () => {
    const serialised = JSON.stringify(toPublicOverview(RAW as any));
    expect(serialised).not.toContain('my private note');
    expect(serialised).not.toContain('secret');
  });

  it('drops meetings and repos entirely', () => {
    const result = toPublicOverview(RAW as any) as Record<string, unknown>;
    expect(result.meetings).toBeUndefined();
    expect(result.repos).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('meet.google.com');
  });

  it('drops challenge fields that are not part of the showcase', () => {
    const challenge = toPublicOverview(RAW as any).challenge as Record<string, unknown>;
    expect(challenge.roadmap).toBeUndefined();
    expect(challenge.reward_rules).toBeUndefined();
  });

  it('drops member email and role', () => {
    const member = toPublicOverview(RAW as any).team[0] as Record<string, unknown>;
    expect(member.email).toBeUndefined();
    expect(member.role).toBeUndefined();
  });

  it('keeps what the showcase needs', () => {
    const result = toPublicOverview(RAW as any);
    expect(result.challenge).toEqual({
      uuid: 'c1', title: 'Alpha', description: 'desc', status: 'active',
      type: 'code', start_date: '2026-01-01', end_date: '2026-02-01',
      contribution_points_reward: 1000, project_id: 'p1',
      workspace_mode: 'provided_repo',
    });
    expect(result.team).toEqual([
      { uuid: 'u1', full_name: 'Alix C', avatar_url: 'https://x/a.png', github_username: 'alix' },
    ]);
    expect(result.tasks).toEqual([
      { uuid: 't1', user_id: 'u1', status: 'done', parent_task_id: null },
    ]);
    expect(result.participants).toEqual([{ user_id: 'u1', group_owner_id: null }]);
    expect(result.contributions).toEqual([
      { uuid: 'k1', user_id: 'u1', type: 'project', reward: 120, submitted_at: '2026-01-15', evaluation_status: 'done' },
    ]);
  });

  it('survives missing collections', () => {
    const result = toPublicOverview({ challenge: RAW.challenge } as any);
    expect(result.team).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.participants).toEqual([]);
    expect(result.contributions).toEqual([]);
  });
});
