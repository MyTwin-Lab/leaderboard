import { describe, it, expect } from 'vitest';
import { aggregateUsersByContribution, rankEntries } from './leaderboard';
import type {
  Challenge,
  Contribution,
  ContributionMember,
  User,
} from '../../../../packages/database-service/domain/entities';

const CH = 'ch-1';

const user = (uuid: string, full_name: string): User =>
  ({ uuid, role: 'contributor', full_name, created_at: new Date() });

const ALICE = user('aaa', 'Alice');
const BOB = user('bbb', 'Bob');
const CAROL = user('ccc', 'Carol');

const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  uuid: CH, title: 'Build it', status: 'active', type: 'code',
  description: '', roadmap: '', contribution_points_reward: 1000,
  completion: 0, project_id: 'p-1', ...over,
});

const contribution = (over: Partial<Contribution> = {}): Contribution => ({
  uuid: 'c-1', title: 'Project delivery', type: 'project', description: '',
  evaluation: null, tags: [], reward: 300, user_id: ALICE.uuid,
  challenge_id: CH, submitted_at: new Date('2026-01-01'), ...over,
});

const share = (contribution_id: string, user_id: string, share_cp: number): ContributionMember =>
  ({ contribution_id, user_id, share_cp });

const totalOf = (rows: ReturnType<typeof aggregateUsersByContribution>, u: User) =>
  rows.find(r => r.user.uuid === u.uuid)!.totalCP;
const countOf = (rows: ReturnType<typeof aggregateUsersByContribution>, u: User) =>
  rows.find(r => r.user.uuid === u.uuid)!.contributionsCount;

const aggregate = (
  contributions: Contribution[],
  contributionMembers?: ContributionMember[],
  users: User[] = [ALICE, BOB, CAROL]
) => aggregateUsersByContribution({
  contributions, challenges: [challenge()], users, contributionMembers,
});

describe('aggregateUsersByContribution — solo', () => {
  it('credits the whole reward to the submitter when there are no members', () => {
    const rows = aggregate([contribution({ reward: 300 })]);
    expect(totalOf(rows, ALICE)).toBe(300);
    expect(countOf(rows, ALICE)).toBe(1);
    expect(totalOf(rows, BOB)).toBe(0);
  });

  it('behaves identically whether members are omitted or empty', () => {
    // Une contribution absente de contribution_members est une contribution
    // solo : c'est ce qui laisse le comportement historique intact.
    expect(aggregate([contribution()])).toEqual(aggregate([contribution()], []));
  });

  it('still excludes discussion contributions from the count but not the CP', () => {
    const rows = aggregate([contribution({ type: 'discussion', reward: 40 })]);
    expect(totalOf(rows, ALICE)).toBe(40);
    expect(countOf(rows, ALICE)).toBe(0);
  });
});

describe('aggregateUsersByContribution — groups', () => {
  it('splits the CP by share instead of crediting the holder', () => {
    const rows = aggregate(
      [contribution({ reward: 420, user_id: ALICE.uuid })],
      [share('c-1', ALICE.uuid, 210), share('c-1', BOB.uuid, 210)],
    );
    expect(totalOf(rows, ALICE)).toBe(210);
    expect(totalOf(rows, BOB)).toBe(210);
  });

  it('counts the contribution for every member', () => {
    // Sans ça un co-membre afficherait des CP et 0 contribution.
    const rows = aggregate(
      [contribution({ reward: 420 })],
      [share('c-1', ALICE.uuid, 210), share('c-1', BOB.uuid, 210)],
    );
    expect(countOf(rows, ALICE)).toBe(1);
    expect(countOf(rows, BOB)).toBe(1);
  });

  it('never counts the group total twice', () => {
    // L'invariant qui compte : la somme distribuée reste celle du challenge.
    const rows = aggregate(
      [contribution({ reward: 420 })],
      [share('c-1', ALICE.uuid, 140), share('c-1', BOB.uuid, 140), share('c-1', CAROL.uuid, 140)],
    );
    const distributed = rows.reduce((s, r) => s + r.totalCP, 0);
    expect(distributed).toBe(420);
  });

  it('credits a member who did not submit the contribution', () => {
    const rows = aggregate(
      [contribution({ reward: 420, user_id: ALICE.uuid })],
      [share('c-1', ALICE.uuid, 210), share('c-1', BOB.uuid, 210)],
    );
    // Bob n'apparaît nulle part dans `contributions`.
    expect(totalOf(rows, BOB)).toBe(210);
  });

  it('mixes solo and group contributions on one profile', () => {
    const rows = aggregate(
      [
        contribution({ uuid: 'c-solo', reward: 100, user_id: BOB.uuid }),
        contribution({ uuid: 'c-group', reward: 420, user_id: ALICE.uuid }),
      ],
      [share('c-group', ALICE.uuid, 210), share('c-group', BOB.uuid, 210)],
    );
    expect(totalOf(rows, BOB)).toBe(310);
    expect(countOf(rows, BOB)).toBe(2);
  });

  it('ignores a share pointing at an unknown user', () => {
    // Un compte supprimé ne doit pas faire disparaître les CP des autres.
    const rows = aggregate(
      [contribution({ reward: 420 })],
      [share('c-1', ALICE.uuid, 210), share('c-1', 'ghost', 210)],
      [ALICE, BOB],
    );
    expect(totalOf(rows, ALICE)).toBe(210);
  });

  it('drops group shares that fall outside the selected project', () => {
    const rows = aggregateUsersByContribution({
      contributions: [contribution({ reward: 420 })],
      challenges: [challenge({ project_id: 'p-1' })],
      users: [ALICE, BOB],
      contributionMembers: [share('c-1', ALICE.uuid, 210), share('c-1', BOB.uuid, 210)],
      projectId: 'p-other',
    });
    expect(rows.every(r => r.totalCP === 0)).toBe(true);
  });
});

describe('rankEntries with group shares', () => {
  it('ranks a group member on their own share, not the group total', () => {
    // Alice porte 420 CP de groupe mais n'en garde que 210 : Carol, solo à
    // 300, doit passer devant.
    const rows = aggregate(
      [
        contribution({ uuid: 'c-group', reward: 420, user_id: ALICE.uuid }),
        contribution({ uuid: 'c-solo', reward: 300, user_id: CAROL.uuid }),
      ],
      [share('c-group', ALICE.uuid, 210), share('c-group', BOB.uuid, 210)],
    );
    const ranked = rankEntries(rows);
    expect(ranked[0].userId).toBe(CAROL.uuid);
    expect(ranked[0].totalCP).toBe(300);
  });
});
