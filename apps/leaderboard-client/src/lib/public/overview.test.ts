import { describe, expect, it } from 'vitest';
import { toPublicOverview, toSignedInOverview } from './overview';

// One fixture carrying every field we refuse to publish, so a mapper that
// regresses to a pass-through fails loudly rather than quietly leaking.
const RAW = {
  challenge: {
    uuid: 'c1', title: 'Alpha', slug: 'alpha', description: 'desc', status: 'active',
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
      uuid: 'c1', title: 'Alpha', slug: 'alpha', description: 'desc', status: 'active',
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

describe('toSignedInOverview', () => {
  // RAW, vu par un autre contributeur connecté, qui ne participe pas : le
  // board, la branche, l'évaluation et les comptes de u1 ne le regardent pas.
  const RAW_WITH_ACCOUNTS = {
    ...RAW,
    team: [{ ...RAW.team[0], google_user_id: 'g-123' }],
    meetings: [{ ...RAW.meetings[0], calendar_event_id: 'cal-1', conference_id: 'conf-1', conference_record_id: 'rec-1', created_by: 'u1' }],
    contributions: [{ ...RAW.contributions[0], evaluation: { globalScore: 87, comment: 'AI feedback for u1' } }],
  };
  const stranger = { userId: 'u9', role: 'contributor', workspaceOwnerId: 'u9', isMember: false, privileged: false };

  it('never lets an account, workspace metadata or another contributor task through', () => {
    const serialised = JSON.stringify(toSignedInOverview(RAW_WITH_ACCOUNTS as any, stranger));
    expect(serialised).not.toContain('alix@example.com');
    expect(serialised).not.toContain('google_user_id');
    expect(serialised).not.toContain('g-123');
    expect(serialised).not.toContain('workspace_meta');
    expect(serialised).not.toContain('my private note');
    expect(serialised).not.toContain('secret');
  });

  it('hides workspaces, meeting links and evaluations from a non-member', () => {
    const result = toSignedInOverview(RAW_WITH_ACCOUNTS as any, stranger);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain('contrib/3-alix');
    expect(serialised).not.toContain('meet.google.com');
    expect(serialised).not.toContain('cal-1');
    expect(serialised).not.toContain('conf-1');
    expect(serialised).not.toContain('rec-1');
    expect(serialised).not.toContain('AI feedback');
    expect(result.contributions[0].evaluation).toBeNull();
    expect(result.team).toEqual([
      { uuid: 'u1', full_name: 'Alix C', avatar_url: 'https://x/a.png', github_username: 'alix' },
    ]);
    expect(result.repos).toEqual([{ repo_id: 'r1', role: null, repo_type: undefined, repo_title: undefined }]);
  });

  it('gives a member their own board, workspace, evaluation and meeting link', () => {
    const result = toSignedInOverview(RAW_WITH_ACCOUNTS as any, {
      userId: 'u1', role: 'contributor', workspaceOwnerId: 'u1', isMember: true, privileged: false,
    });
    expect(result.tasks[0]).toMatchObject({ title: 'my private note' });
    expect(result.participants[0]).toMatchObject({ workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix' });
    expect(result.contributions[0].evaluation).toEqual({ globalScore: 87, comment: 'AI feedback for u1' });
    expect(result.meetings[0]).toMatchObject({ meet_link: 'https://meet.google.com/abc-defg-hij' });
    expect(result.meetings[0].calendar_event_id).toBeUndefined();
  });

  it('gives a group co-member the owner board, workspace and evaluation', () => {
    const result = toSignedInOverview(RAW_WITH_ACCOUNTS as any, {
      userId: 'u2', role: 'contributor', workspaceOwnerId: 'u1', isMember: true, privileged: false,
    });
    expect(result.tasks[0]).toMatchObject({ title: 'my private note' });
    expect(result.participants[0]).toMatchObject({ workspace_ref: 'contrib/3-alix' });
    expect(result.contributions[0].evaluation).toEqual({ globalScore: 87, comment: 'AI feedback for u1' });
  });

  it('keeps tasks, participants and meetings whole for a privileged viewer, never the accounts', () => {
    const result = toSignedInOverview(RAW_WITH_ACCOUNTS as any, {
      userId: 'm1', role: 'contributor', workspaceOwnerId: 'm1', isMember: false, privileged: true,
    });
    expect(result.tasks[0]).toEqual(RAW.tasks[0]);
    expect(result.participants[0]).toEqual(RAW.participants[0]);
    expect(result.meetings[0]).toEqual(RAW_WITH_ACCOUNTS.meetings[0]);
    // Manager sans être admin : l'évaluation reste à l'auteur.
    expect(result.contributions[0].evaluation).toBeNull();
    expect(JSON.stringify(result)).not.toContain('alix@example.com');
    expect(JSON.stringify(result)).not.toContain('workspace_meta');
  });

  it('shows every evaluation to an admin', () => {
    const result = toSignedInOverview(RAW_WITH_ACCOUNTS as any, {
      userId: 'a1', role: 'admin', workspaceOwnerId: 'a1', isMember: false, privileged: true,
    });
    expect(result.contributions[0].evaluation).toEqual({ globalScore: 87, comment: 'AI feedback for u1' });
  });
});
