# Public Challenge Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an anonymous visitor open a challenge and see a read-only overview of the work done on it, instead of being redirected to sign-in.

**Architecture:** Two regex allowlists in `proxy.ts` open exactly one page and three API routes. Those routes read the session with the existing `verifyRequestToken()`; with no session they refuse `draft`/`archived` challenges with a 404 and pass their payload through pure allowlist mappers. The read-only React pieces already exist inside `ChallengeManageView` and are extracted into shared components used by both the admin view and the public page.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript, vitest (environment `node`), react-query, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-29-public-challenge-overview-design.md`

## Global Constraints

- Tests run from the app directory, not the repo root: `npm test --prefix apps/leaderboard-client -- run <path>`. The repo root has its own vitest config without the `@` alias; running from the root makes `@/lib/...` imports fail.
- The app's vitest environment is `node`. There is no jsdom and no testing-library. **Do not write component render tests** and do not add those dependencies.
- Four tests fail on `main` before this work starts, in `src/app/api/leaderboard/route.test.ts` (3) and `src/app/api/challenges/[id]/repo-activity/route.test.ts` (1). They are pre-existing and unrelated. Do not fix them; do not treat them as regressions.
- `src/proxy.ts` runs in the Edge runtime. Any module it imports must be Edge-safe: no `server-only`, no `node:` builtins, no database access.
- Statuses hidden from anonymous visitors are exactly `draft` and `archived`. This must match `fetchProjectsWithChallenges` (`src/lib/server/publicPages.ts:97-101`).
- Commit on `main`, no co-author trailer.

---

## File Structure

**Created:**

- `src/lib/routeVisibility.ts` — the two regex allowlists plus their matchers. Edge-safe, imported by `proxy.ts`. Pure, no I/O.
- `src/lib/routeVisibility.test.ts`
- `src/lib/public/challengeVisibility.ts` — `isPubliclyVisible(status)`. One rule, one place, shared by the three opened routes.
- `src/lib/public/challengeVisibility.test.ts`
- `src/lib/public/overview.ts` — `toPublicOverview(data)`. Pure allowlist mapper.
- `src/lib/public/overview.test.ts`
- `src/lib/public/repoActivity.ts` — `toPublicRepoActivity(activities)`. Pure allowlist mapper.
- `src/lib/public/repoActivity.test.ts`
- `src/components/challenges/shared/ParticipantsProgress.tsx` — moved out of `ChallengeManageView`.
- `src/components/challenges/shared/ChallengeActivity.tsx` — the two `TabActivity` implementations, converged.

**Modified:**

- `src/proxy.ts` — consult the allowlists before the protected lists.
- `src/app/api/challenges/[id]/overview/route.ts` — session, status guard, mapper.
- `src/app/api/challenges/[id]/repo-activity/route.ts` — session, status guard, mapper.
- `src/app/api/challenges/[id]/ml-rewards/route.ts` — session, status guard.
- `src/components/challenges/ChallengeManageView.tsx` — import the two extracted components, delete the local copies.
- `src/app/challenges/[id]/page.tsx` — anonymous mode.

---

### Task 1: Route allowlists

**Files:**
- Create: `apps/leaderboard-client/src/lib/routeVisibility.ts`
- Test: `apps/leaderboard-client/src/lib/routeVisibility.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPublicPage(pathname: string): boolean` and `isPublicApiRoute(pathname: string): boolean`. Task 2 does not use them; Task 5's `proxy.ts` change does.

- [ ] **Step 1: Write the failing test**

```ts
// apps/leaderboard-client/src/lib/routeVisibility.test.ts
import { describe, expect, it } from 'vitest';
import { isPublicPage, isPublicApiRoute } from './routeVisibility';

// proxy.ts gates by prefix, and the prefix `/challenges/` covers both the
// detail page and its `/manage` sub-page. These allowlists are what lets the
// first through while the second stays admin-only, so the manage cases below
// are the point of the whole module.
describe('isPublicPage', () => {
  it('opens the challenge detail page', () => {
    expect(isPublicPage('/challenges/abc-123')).toBe(true);
  });

  it('tolerates a trailing slash', () => {
    expect(isPublicPage('/challenges/abc-123/')).toBe(true);
  });

  it('keeps the manage sub-page closed', () => {
    expect(isPublicPage('/challenges/abc-123/manage')).toBe(false);
  });

  it('does not open the challenges list to the rule', () => {
    expect(isPublicPage('/challenges')).toBe(false);
  });

  it('keeps unrelated pages closed', () => {
    expect(isPublicPage('/admin')).toBe(false);
    expect(isPublicPage('/contributors/me')).toBe(false);
  });
});

describe('isPublicApiRoute', () => {
  it('opens exactly the three read routes', () => {
    expect(isPublicApiRoute('/api/challenges/abc/overview')).toBe(true);
    expect(isPublicApiRoute('/api/challenges/abc/repo-activity')).toBe(true);
    expect(isPublicApiRoute('/api/challenges/abc/ml-rewards')).toBe(true);
  });

  it('keeps every mutating or sensitive sibling closed', () => {
    for (const route of [
      '/api/challenges/abc/join',
      '/api/challenges/abc/close',
      '/api/challenges/abc/sync',
      '/api/challenges/abc/workspace',
      '/api/challenges/abc/project-evaluation',
      '/api/challenges/abc/validation-runs',
      '/api/challenges/abc/compute-requests',
      '/api/challenges/abc/documents',
      '/api/challenges/abc/team',
      '/api/challenges/abc/repos',
    ]) {
      expect(isPublicApiRoute(route)).toBe(false);
    }
  });

  it('does not open a deeper path that merely starts with an open one', () => {
    expect(isPublicApiRoute('/api/challenges/abc/overview/secret')).toBe(false);
  });

  it('keeps the challenges collection route closed', () => {
    expect(isPublicApiRoute('/api/challenges')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/routeVisibility.test.ts`
Expected: FAIL — `Cannot find module './routeVisibility'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/leaderboard-client/src/lib/routeVisibility.ts

/**
 * Exceptions to the prefix gates in proxy.ts.
 *
 * proxy.ts matches with startsWith(), which cannot express "the challenge
 * detail page but not its /manage sub-page" — `/challenges/` covers both.
 * These patterns are anchored at both ends so a single extra path segment is
 * enough to fall back under the protected prefix.
 *
 * Edge-safe on purpose: proxy.ts runs in the Edge runtime, so this module
 * stays pure regex with no imports.
 */
const PUBLIC_PAGES = [/^\/challenges\/[^/]+\/?$/];

const PUBLIC_API_ROUTES = [
  /^\/api\/challenges\/[^/]+\/overview$/,
  /^\/api\/challenges\/[^/]+\/repo-activity$/,
  /^\/api\/challenges\/[^/]+\/ml-rewards$/,
];

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.some((pattern) => pattern.test(pathname));
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((pattern) => pattern.test(pathname));
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/routeVisibility.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/lib/routeVisibility.ts apps/leaderboard-client/src/lib/routeVisibility.test.ts
git commit -m "feat(auth): allowlist the public challenge page and its three read routes"
```

---

### Task 2: Status guard

**Files:**
- Create: `apps/leaderboard-client/src/lib/public/challengeVisibility.ts`
- Test: `apps/leaderboard-client/src/lib/public/challengeVisibility.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPubliclyVisible(status: string | null | undefined): boolean`. Task 5 calls it in all three routes.

- [ ] **Step 1: Write the failing test**

```ts
// apps/leaderboard-client/src/lib/public/challengeVisibility.test.ts
import { describe, expect, it } from 'vitest';
import { isPubliclyVisible } from './challengeVisibility';

// The list page (fetchProjectsWithChallenges, lib/server/publicPages.ts:97-101)
// already hides draft and archived from non-admins. If this function ever
// disagrees with it, a challenge is either listed but unreachable, or
// reachable but unlisted.
describe('isPubliclyVisible', () => {
  it('publishes an active challenge', () => {
    expect(isPubliclyVisible('active')).toBe(true);
  });

  it('publishes a completed challenge', () => {
    expect(isPubliclyVisible('completed')).toBe(true);
  });

  it('hides a draft', () => {
    expect(isPubliclyVisible('draft')).toBe(false);
  });

  it('hides an archived challenge', () => {
    expect(isPubliclyVisible('archived')).toBe(false);
  });

  it('hides a status it does not recognise', () => {
    // A status added later is private until someone decides otherwise.
    expect(isPubliclyVisible('paused')).toBe(false);
  });

  it('hides a missing status', () => {
    expect(isPubliclyVisible(null)).toBe(false);
    expect(isPubliclyVisible(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/challengeVisibility.test.ts`
Expected: FAIL — `Cannot find module './challengeVisibility'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/leaderboard-client/src/lib/public/challengeVisibility.ts

/**
 * Which challenge statuses an anonymous visitor may reach.
 *
 * Deliberately an allowlist rather than `!== 'draft' && !== 'archived'`: a
 * status added to the product later is private until someone puts it here.
 * Must stay in step with fetchProjectsWithChallenges()
 * (lib/server/publicPages.ts:97-101), which decides what the list shows.
 */
const PUBLIC_STATUSES = new Set(['active', 'completed']);

export function isPubliclyVisible(status: string | null | undefined): boolean {
  return !!status && PUBLIC_STATUSES.has(status);
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/challengeVisibility.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/lib/public/challengeVisibility.ts apps/leaderboard-client/src/lib/public/challengeVisibility.test.ts
git commit -m "feat(auth): allowlist the challenge statuses an anonymous visitor may reach"
```

---

### Task 3: `toPublicOverview()`

**Files:**
- Create: `apps/leaderboard-client/src/lib/public/overview.ts`
- Test: `apps/leaderboard-client/src/lib/public/overview.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toPublicOverview(data: RawOverview): PublicOverview`, where the raw input is the object `/api/challenges/[id]/overview` builds today — `{ challenge, team, tasks, meetings, repos, contributions, participants }`. Task 5 calls it. Task 6's `ParticipantsProgress` reads `team`, `tasks`, `participants`, `contributions` from its output.

- [ ] **Step 1: Write the failing test**

```ts
// apps/leaderboard-client/src/lib/public/overview.test.ts
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
    expect(result.participants).toEqual([{ user_id: 'u1' }]);
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/overview.test.ts`
Expected: FAIL — `Cannot find module './overview'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/leaderboard-client/src/lib/public/overview.ts

/**
 * Reduces the overview payload to what an anonymous visitor may see.
 *
 * Built field by field on purpose. A denylist that deleted the sensitive keys
 * would publish, by default, every column a repository starts returning later;
 * here a new field is private until someone writes it into this file.
 *
 * Task titles are excluded: personal boards carry contributors' own wording.
 * "{done}/{total} tasks" needs only `status` and `user_id`.
 *
 * Meetings and repos are dropped wholesale — a meeting carries a joinable
 * link, and a repo row carries workspace metadata.
 */
export interface PublicOverview {
  challenge: {
    uuid: string; title: string; description: string | null; status: string;
    type: string; start_date: string | null; end_date: string | null;
    contribution_points_reward: number; project_id: string;
    workspace_mode: string | null;
  };
  team: Array<{ uuid: string; full_name: string; avatar_url: string | null; github_username: string | null }>;
  tasks: Array<{ uuid: string; user_id: string | null; status: string; parent_task_id: string | null }>;
  participants: Array<{ user_id: string }>;
  contributions: Array<{
    uuid: string; user_id: string; type: string; reward: number;
    submitted_at: string; evaluation_status: string | null;
  }>;
}

export function toPublicOverview(data: any): PublicOverview {
  const c = data?.challenge ?? {};

  return {
    challenge: {
      uuid: c.uuid,
      title: c.title,
      description: c.description ?? null,
      status: c.status,
      type: c.type,
      start_date: c.start_date ?? null,
      end_date: c.end_date ?? null,
      contribution_points_reward: c.contribution_points_reward ?? 0,
      project_id: c.project_id,
      workspace_mode: c.workspace_mode ?? null,
    },
    team: (data?.team ?? []).map((m: any) => ({
      uuid: m.uuid,
      full_name: m.full_name,
      avatar_url: m.avatar_url ?? null,
      github_username: m.github_username ?? null,
    })),
    tasks: (data?.tasks ?? []).map((t: any) => ({
      uuid: t.uuid,
      user_id: t.user_id ?? null,
      status: t.status,
      parent_task_id: t.parent_task_id ?? null,
    })),
    participants: (data?.participants ?? []).map((p: any) => ({ user_id: p.user_id })),
    contributions: (data?.contributions ?? []).map((k: any) => ({
      uuid: k.uuid,
      user_id: k.user_id,
      type: k.type,
      reward: k.reward ?? 0,
      submitted_at: k.submitted_at,
      evaluation_status: k.evaluation_status ?? null,
    })),
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/overview.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/lib/public/overview.ts apps/leaderboard-client/src/lib/public/overview.test.ts
git commit -m "feat(auth): allowlist mapper for the anonymous challenge overview payload"
```

---

### Task 4: `toPublicRepoActivity()`

**Files:**
- Create: `apps/leaderboard-client/src/lib/public/repoActivity.ts`
- Test: `apps/leaderboard-client/src/lib/public/repoActivity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `toPublicRepoActivity(activities: Record<string, any>): Record<string, any>`, taking and returning the `activities` map that `/api/challenges/[id]/repo-activity` sends today. Task 5 calls it.

**Background the implementer needs:** `packages/connectors/interfaces.ts:22-75` defines the shapes. A `GitHubEvent` has `type` (`commit` | `pull_request` | `pr_review` | `branch_created`), `id`, `title`, `author`, `date`, `url`, and a typed `metadata` of `sha`, `additions`, `deletions`, `prNumber`, `state`, `reviewState`, `branchName`. The provisioner creates one branch per contributor named `contrib/<index>-<username>`, which is why `branchName` and the `branch_created` event type both go.

- [ ] **Step 1: Write the failing test**

```ts
// apps/leaderboard-client/src/lib/public/repoActivity.test.ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/repoActivity.test.ts`
Expected: FAIL — `Cannot find module './repoActivity'`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/leaderboard-client/src/lib/public/repoActivity.ts

/**
 * Reduces repo activity to what an anonymous visitor may see.
 *
 * Two things must not go out. `metadata.branchName` names the
 * `contrib/<index>-<username>` branch the provisioner creates per contributor,
 * and a `branch_created` event exists only to announce such a branch — the
 * field and the event type both go. Connector failures are reported as a fixed
 * string, because a connector's own error text can name internal hosts or
 * carry a token.
 *
 * Kaggle activity describes public Kaggle artifacts and passes through.
 */
const PUBLIC_EVENT_TYPES = new Set(['commit', 'pull_request', 'pr_review']);

function toPublicEvent(event: any) {
  return {
    type: event.type,
    id: event.id,
    title: event.title,
    author: event.author,
    date: event.date,
    url: event.url,
    metadata: {
      ...(event.metadata?.sha !== undefined && { sha: event.metadata.sha }),
      ...(event.metadata?.additions !== undefined && { additions: event.metadata.additions }),
      ...(event.metadata?.deletions !== undefined && { deletions: event.metadata.deletions }),
      ...(event.metadata?.prNumber !== undefined && { prNumber: event.metadata.prNumber }),
      ...(event.metadata?.state !== undefined && { state: event.metadata.state }),
      ...(event.metadata?.reviewState !== undefined && { reviewState: event.metadata.reviewState }),
    },
  };
}

export function toPublicRepoActivity(activities: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {};

  for (const [repoId, activity] of Object.entries(activities ?? {})) {
    if (!activity || typeof activity !== 'object') continue;

    if ('error' in activity) {
      out[repoId] = { error: 'unavailable' };
      continue;
    }

    if (activity.type === 'github') {
      out[repoId] = {
        type: 'github',
        events: (activity.events ?? [])
          .filter((e: any) => PUBLIC_EVENT_TYPES.has(e?.type))
          .map(toPublicEvent),
      };
      continue;
    }

    out[repoId] = activity;
  }

  return out;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/repoActivity.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the failing test for the ml-rewards mapper**

`/api/challenges/[id]/ml-rewards` looks harmless but is not: it returns
`breakdown: [{ userId, points }]` — CP per person — and `rules`, the reward
configuration itself (`ml-rewards/route.ts:70-81`). The page reads neither:
`mlRewardsQuery` types its result as `{ metric, bestValue }`
(`challenges/[id]/page.tsx:176-179`).

```ts
// apps/leaderboard-client/src/lib/public/mlRewards.test.ts
import { describe, expect, it } from 'vitest';
import { toPublicMlRewards } from './mlRewards';

const RAW = {
  pool: 1000,
  distributed: 420,
  remaining: 580,
  rules: { model: { metric: { name: 'auc', baseline: 0.5, blockThreshold: 0.95 } } },
  metric: { name: 'auc', baseline: 0.5, points: [0.91, 0.88] },
  bestValue: 0.91,
  thresholdReached: false,
  breakdown: [{ userId: 'u1', points: 260 }, { userId: 'u2', points: 160 }],
};

describe('toPublicMlRewards', () => {
  it('drops the per-user breakdown', () => {
    const result = toPublicMlRewards(RAW) as Record<string, unknown>;
    expect(result.breakdown).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('u1');
  });

  it('drops the reward rules configuration', () => {
    const result = toPublicMlRewards(RAW) as Record<string, unknown>;
    expect(result.rules).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('blockThreshold');
  });

  it('keeps exactly what the hero reads', () => {
    expect(toPublicMlRewards(RAW)).toEqual({
      metric: { name: 'auc', baseline: 0.5, points: [0.91, 0.88] },
      bestValue: 0.91,
    });
  });

  it('survives a challenge with no metric', () => {
    expect(toPublicMlRewards({ metric: null, bestValue: null } as any)).toEqual({
      metric: null,
      bestValue: null,
    });
  });
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/mlRewards.test.ts`
Expected: FAIL — `Cannot find module './mlRewards'`.

- [ ] **Step 7: Write the implementation**

```ts
// apps/leaderboard-client/src/lib/public/mlRewards.ts

/**
 * Reduces the ml-rewards payload to what an anonymous visitor may see.
 *
 * The route returns a per-user CP breakdown and the reward rules themselves.
 * The challenge page reads neither — mlRewardsQuery types its result as
 * `{ metric, bestValue }` — so nothing else goes out.
 */
export interface PublicMlRewards {
  metric: { name: string; baseline: number; points: number[] } | null;
  bestValue: number | null;
}

export function toPublicMlRewards(data: any): PublicMlRewards {
  return {
    metric: data?.metric ?? null,
    bestValue: data?.bestValue ?? null,
  };
}
```

- [ ] **Step 8: Run it and confirm it passes**

Run: `npm test --prefix apps/leaderboard-client -- run src/lib/public/mlRewards.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/leaderboard-client/src/lib/public/repoActivity.ts apps/leaderboard-client/src/lib/public/repoActivity.test.ts apps/leaderboard-client/src/lib/public/mlRewards.ts apps/leaderboard-client/src/lib/public/mlRewards.test.ts
git commit -m "feat(auth): allowlist mappers for anonymous repo activity and ML rewards"
```

---

### Task 5: Open the routes

**Files:**
- Modify: `apps/leaderboard-client/src/proxy.ts:127-138`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/ml-rewards/route.ts`
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.test.ts` (create)

**Interfaces:**
- Consumes: `isPublicPage`, `isPublicApiRoute` (Task 1); `isPubliclyVisible` (Task 2); `toPublicOverview` (Task 3); `toPublicRepoActivity` (Task 4); `verifyRequestToken(request)` from `@/lib/auth` (already exists, `lib/auth.ts:105`, returns a payload or `null`).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindById = vi.fn();
const mockVerifyRequestToken = vi.fn();

vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepository: class { findById = mockFindById; },
  ChallengeTeamRepository: class { findTeamMembers = async () => []; findByChallenge = async () => [
    { user_id: 'u1', workspace_url: 'https://github.com/org/repo/tree/contrib/3-alix', workspace_status: 'ready' },
  ]; },
  TaskRepository: class { findByChallenge = async () => []; },
  ChallengeRepoRepository: class { findByChallengeWithRepo = async () => []; },
  ContributionRepository: class { findByChallenge = async () => []; },
}));

vi.mock('../../../../../../../../packages/services/sync-meeting/sync-meeting.service.js', () => ({
  SyncMeetingService: class { getMeetingsByChallengeId = async () => []; },
}));

vi.mock('@/lib/auth', () => ({ verifyRequestToken: mockVerifyRequestToken }));

import { GET } from './route';

function get() {
  const req = new NextRequest('http://localhost/api/challenges/c1/overview', {
    headers: { host: 'localhost:3000' },
  });
  return GET(req, { params: Promise.resolve({ id: 'c1' }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/challenges/[id]/overview', () => {
  it('maps the payload for an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('workspace_url');
    expect(JSON.stringify(body)).not.toContain('contrib/3-alix');
    expect(body.participants).toEqual([{ user_id: 'u1' }]);
  });

  it('leaves the payload whole for a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'active', type: 'code' });

    const body = await (await get()).json();

    expect(body.participants[0].workspace_url).toBe('https://github.com/org/repo/tree/contrib/3-alix');
    expect(body.meetings).toBeDefined();
  });

  it('hides a draft challenge from an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'draft', type: 'code' });

    expect((await get()).status).toBe(404);
  });

  it('hides an archived challenge from an anonymous visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue(null);
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'archived', type: 'code' });

    expect((await get()).status).toBe(404);
  });

  it('still serves a draft to a signed-in visitor', async () => {
    mockVerifyRequestToken.mockResolvedValue({ userId: 'u9', role: 'contributor' });
    mockFindById.mockResolvedValue({ uuid: 'c1', title: 'A', status: 'draft', type: 'code' });

    expect((await get()).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --prefix apps/leaderboard-client -- run "src/app/api/challenges/[id]/overview"`
Expected: FAIL — the anonymous case returns the full payload, so the `workspace_url` assertion fails; the draft cases return 200 instead of 404.

- [ ] **Step 3: Change `proxy.ts`**

At the top of the file, next to the other route lists:

```ts
import { isPublicPage, isPublicApiRoute } from '@/lib/routeVisibility';
```

Then in `proxy()`, replace lines 129-131:

```ts
  const matchedProtectedPage = protectedPages.find((route) => pathname.startsWith(route.prefix));
  const isProtectedApiRoute = protectedApiRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
```

with:

```ts
  // Allowlists win over the prefix gates: /challenges/<id> and its three read
  // routes are public, while /challenges/<id>/manage and every other
  // /api/challenges/* sibling stay behind the prefixes below.
  const matchedProtectedPage = isPublicPage(pathname)
    ? undefined
    : protectedPages.find((route) => pathname.startsWith(route.prefix));
  const isProtectedApiRoute = !isPublicApiRoute(pathname)
    && protectedApiRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
```

- [ ] **Step 4: Change the overview route**

In `overview/route.ts`, add the imports:

```ts
import { verifyRequestToken } from '@/lib/auth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { toPublicOverview } from '@/lib/public/overview';
```

Replace the body between `const challenge = await challengeRepo.findById(id);` and the `return`:

```ts
    const challenge = await challengeRepo.findById(id);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // 404 and not 401: an anonymous visitor must not be able to tell an
    // unpublished challenge from one that does not exist.
    const session = await verifyRequestToken(request);
    if (!session && !isPubliclyVisible(challenge.status)) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const [team, tasks, meetings, repos, contributions, participants] = await Promise.all([
      challengeTeamRepo.findTeamMembers(id),
      taskRepo.findByChallenge(id),
      new SyncMeetingService().getMeetingsByChallengeId(id),
      challengeRepoRepo.findByChallengeWithRepo(id),
      contributionRepo.findByChallenge(id),
      challengeTeamRepo.findByChallenge(id),
    ]);

    const payload = { challenge, team, tasks, meetings, repos, contributions, participants };
    return NextResponse.json(session ? payload : toPublicOverview(payload));
```

- [ ] **Step 5: Change the repo-activity route**

In `repo-activity/route.ts`, add:

```ts
import { verifyRequestToken } from '@/lib/auth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { toPublicRepoActivity } from '@/lib/public/repoActivity';
import { ChallengeRepository } from '../../../../../../../../packages/database-service/repositories';
```

and next to `const challengeRepoRepo = ...`:

```ts
const challengeRepo = new ChallengeRepository();
```

Right after `const { id: challengeId } = await params;`:

```ts
    const session = await verifyRequestToken(request);
    if (!session) {
      const challenge = await challengeRepo.findById(challengeId);
      if (!challenge || !isPubliclyVisible(challenge.status)) {
        return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
      }
    }
```

and change the final return:

```ts
    return NextResponse.json({ activities: session ? activities : toPublicRepoActivity(activities) });
```

- [ ] **Step 6: Change the ml-rewards route**

Note the signature at `ml-rewards/route.ts:16`: the parameter is `_request`, unused. Rename it to `request` so the session can be read.

Add the imports:

```ts
import { verifyRequestToken } from '@/lib/auth';
import { isPubliclyVisible } from '@/lib/public/challengeVisibility';
import { toPublicMlRewards } from '@/lib/public/mlRewards';
```

This route already loads the challenge at line 22, so the guard slots in straight after the existing not-found check (lines 23-25):

```ts
    const session = await verifyRequestToken(request);
    if (!session && !isPubliclyVisible(challenge.status)) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
```

Then wrap the final return (lines 70-81). Keep the existing object, assign it, and map it:

```ts
    const payload = {
      pool,
      distributed,
      remaining: Math.max(0, pool - distributed),
      rules: mlRules ?? null,
      metric,
      bestValue,
      thresholdReached,
      breakdown: [...byUser.entries()]
        .map(([userId, points]) => ({ userId, points }))
        .sort((a, b) => b.points - a.points),
    };

    return NextResponse.json(session ? payload : toPublicMlRewards(payload));
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npm test --prefix apps/leaderboard-client -- run "src/app/api/challenges/[id]/overview" src/lib/routeVisibility.test.ts src/lib/public`
Expected: PASS, all suites.

Then the whole app suite: `npm test --prefix apps/leaderboard-client -- run`
Expected: only the four pre-existing failures listed in Global Constraints.

- [ ] **Step 8: Commit**

```bash
git add apps/leaderboard-client/src/proxy.ts "apps/leaderboard-client/src/app/api/challenges/[id]/overview" "apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity" "apps/leaderboard-client/src/app/api/challenges/[id]/ml-rewards"
git commit -m "feat(challenges): serve the challenge overview to anonymous visitors"
```

---

### Task 6: Extract `ParticipantsProgress`

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/shared/ParticipantsProgress.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx:349-389` (delete `TabParticipants`, import the new component) and its call site
- Test: none — see Global Constraints

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<ParticipantsProgress team tasks participants contributions showWorkspaceStatus />`. Task 8 renders it. `showWorkspaceStatus` defaults to `false`.

- [ ] **Step 1: Create the component**

Move the body of `TabParticipants` (`ChallengeManageView.tsx:351-389`) verbatim into the new file, with the two changes below and nothing else. Add `'use client';` at the top and import `InitialsAvatar` from `@/components/ui/InitialsAvatar` and `Loader2` from `lucide-react`.

The two changes:

```tsx
export function ParticipantsProgress({
  team, tasks, participants, contributions, showWorkspaceStatus = false,
}: {
  team: TeamMember[];
  tasks: Array<{ uuid: string; user_id?: string | null; status: string; parent_task_id?: string }>;
  participants: Array<{ user_id: string; workspace_status?: string | null }>;
  contributions: Array<{ user_id: string; type: string; reward: number; evaluation_status?: string }>;
  /** Manage view only. The public payload never carries the field, and this
   *  keeps the component correct even if that ever changed. */
  showWorkspaceStatus?: boolean;
}) {
```

and, in the sub-line:

```tsx
              {total === 0 ? 'No tasks yet' : `${done}/${total} tasks done`}
              {showWorkspaceStatus && participation?.workspace_status
                ? ` · workspace ${participation.workspace_status}`
                : ''}
```

Declare `TeamMember` locally in the new file as `{ id: string; fullName: string; githubUsername?: string; avatarUrl?: string }` — the same shape `ChallengeManageView.tsx:45` uses.

- [ ] **Step 2: Update `ChallengeManageView`**

Delete `TabParticipants` (lines 349-389) and add:

```ts
import { ParticipantsProgress } from '@/components/challenges/shared/ParticipantsProgress';
```

At its call site, replace `<TabParticipants ... />` with the same props plus `showWorkspaceStatus`:

```tsx
<ParticipantsProgress
  team={team}
  tasks={tasks}
  participants={participants}
  contributions={contributions}
  showWorkspaceStatus
/>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/leaderboard-client/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Run the app suite**

Run: `npm test --prefix apps/leaderboard-client -- run`
Expected: only the four pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/shared/ParticipantsProgress.tsx apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx
git commit -m "refactor(challenges): extract ParticipantsProgress from the manage view"
```

---

### Task 7: Converge `ChallengeActivity`

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/shared/ChallengeActivity.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx:391-508` (delete the local `TabActivity`, import the shared one)
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx:515-630` (delete the local `TabActivity`, import the shared one)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<ChallengeActivity contributions team repoActivity isML />`. Task 8 renders it.

**Why the manage version wins:** it takes `contributions`, `team`, `repoActivity` and `isML`, and attributes events to contributors. The page's version (`page.tsx:517`) takes only `repoActivity` and cannot. Converging on the richer signature gives the public page attribution it does not have today; converging the other way would lose it in the manage view.

- [ ] **Step 1: Create the component**

Move the body of `TabActivity` from `ChallengeManageView.tsx:393-508` verbatim into the new file, rename the function to `ChallengeActivity`, export it, and add `'use client';` at the top. Move `GITHUB_EVENT_CONFIG` (`ChallengeManageView.tsx:291-296`) with it — that constant exists only for this component.

Do not guess the remaining imports. Run:

`npx tsc --noEmit -p apps/leaderboard-client/tsconfig.json`

Every "Cannot find name 'X'" it reports in the new file is an identifier to import; find each one in `ChallengeManageView.tsx`'s import block (lines 1-30) and copy that import across. Repeat until tsc is clean on the new file. Then delete any import left unused in `ChallengeManageView.tsx`.

- [ ] **Step 2: Update both call sites**

In `ChallengeManageView.tsx`, delete lines 391-508 and import:

```ts
import { ChallengeActivity } from '@/components/challenges/shared/ChallengeActivity';
```

Replace `<TabActivity ... />` with `<ChallengeActivity ... />`, same props.

In `challenges/[id]/page.tsx`, delete the local `TabActivity` (lines 515-630) and the now-unused `GitBranch` / `GitPullRequest` imports if nothing else uses them, then import the shared component. At its call site (line 440), the props grow:

```tsx
{
  label: 'Activity',
  panel: (
    <ChallengeActivity
      contributions={contributions}
      team={team}
      repoActivity={repoActivity}
      isML={isML}
    />
  ),
},
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p apps/leaderboard-client/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 4: Run the app suite**

Run: `npm test --prefix apps/leaderboard-client -- run`
Expected: only the four pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/shared/ChallengeActivity.tsx apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx "apps/leaderboard-client/src/app/challenges/[id]/page.tsx"
git commit -m "refactor(challenges): converge the two TabActivity implementations"
```

---

### Task 8: Anonymous mode on the challenge page

**Files:**
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx:121-131` (the `meQuery` and the onboarding effect), `:226` (the loading gate), `:392-442` (the tabs)

**Interfaces:**
- Consumes: `ParticipantsProgress` (Task 6), `ChallengeActivity` (Task 7).
- Produces: nothing.

**The trap:** `fetchJson` throws on any non-2xx (`lib/fetchJson.ts:6`), and `/api/contributors/me` answers 401 to an anonymous visitor. Left alone, react-query retries three times while `meQuery.isLoading` stays true, and line 226 holds the page on its skeleton for several seconds before rendering.

- [ ] **Step 1: Make `meQuery` tolerate anonymity**

```tsx
  // 401 here means "not signed in", which is a normal state for this page, not
  // a failure worth retrying. Without retry:false the page sits on its
  // skeleton while react-query burns three attempts.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => fetchJson('/api/contributors/me'),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const isAnonymous = meQuery.isError;
```

- [ ] **Step 2: Skip onboarding tracking when anonymous**

Replace the effect at lines 121-123:

```tsx
  useEffect(() => {
    // trackOnboardingStep posts to a protected route — pointless without a session.
    if (challengeId && !isAnonymous) trackOnboardingStep('clicked_challenge');
  }, [challengeId, isAnonymous]);
```

- [ ] **Step 3: Stop the loading gate from waiting on a query that failed**

At line 226:

```tsx
  const loading = overviewQuery.isLoading || modulesQuery.isLoading
    || (meQuery.isLoading && !meQuery.isError);
```

- [ ] **Step 4: Render the read-only tabs when anonymous**

Replace the `tabs={...}` expression (lines 403-442) so the anonymous branch comes first, before the validation / ML / code branches:

```tsx
tabs={isAnonymous ? [
  {
    label: 'Participants',
    panel: (
      <ParticipantsProgress
        team={team}
        tasks={tasks}
        participants={participants}
        contributions={contributions}
      />
    ),
  },
  {
    label: 'Activity',
    panel: (
      <ChallengeActivity
        contributions={contributions}
        team={team}
        repoActivity={repoActivity}
        isML={isML}
      />
    ),
  },
] : isValidation ? [
```

Leave the three existing branches exactly as they are.

- [ ] **Step 5: Add the sign-in call to action**

Immediately after the closing `/>` of `<ContributorTabs ... />` (line 442):

```tsx
      {isAnonymous && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-8 text-center">
          <p className="text-sm text-white/60">
            Sign in to join this challenge and start your own board.
          </p>
          <a
            href={`/signin?from=/challenges/${challengeId}`}
            className="inline-flex items-center justify-center rounded-xl bg-brandCP/20 px-6 py-3 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40"
          >
            Continue with Google
          </a>
        </div>
      )}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p apps/leaderboard-client/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 7: Run the app suite**

Run: `npm test --prefix apps/leaderboard-client -- run`
Expected: only the four pre-existing failures.

- [ ] **Step 8: Verify by hand**

This is the one part no test in this repo can cover. Signed out, open `/challenges/<id>` for an `active` challenge: the hero renders, the two read-only tabs render, the call to action links to `/signin`. Then check that `/challenges/<id>/manage` still redirects, and that a `draft` challenge shows "Challenge not found".

- [ ] **Step 9: Commit**

```bash
git add "apps/leaderboard-client/src/app/challenges/[id]/page.tsx"
git commit -m "feat(challenges): read-only challenge page for anonymous visitors"
```

---

## Notes for the implementer

`fetchTrendingChallenges` (`src/lib/server/publicPages.ts:137-205`) is dead production code — only its own test file and two comments reference it. It is unrelated to this plan. Do not fix it, do not delete it, and do not let it confuse you with `fetchHomeOverview` in `src/lib/server/home.ts`, which is the live one.
