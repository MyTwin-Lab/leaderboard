# Connector Repo Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `fetchRepoActivity()` to GitHub and Kaggle connectors, expose it via a new API route, and replace the "coming soon" placeholders in the challenge manager with a live GitHub event timeline and Kaggle metric graphs.

**Architecture:** A new optional method `fetchRepoActivity()` is added to the `ExternalConnector` interface and implemented in each connector. A new Next.js route aggregates results across all repos for a challenge and returns them in a discriminated union by type. The UI reads this endpoint and renders a timeline (GitHub) or metric chart (Kaggle) with an SVG line graph — no charting library added.

**Tech Stack:** TypeScript, Octokit (GitHub REST), Kaggle API v1 (fetch), Next.js App Router, React 19, Tailwind CSS v4, Lucide React, Vitest.

## Global Constraints

- Kaggle base URL: `https://www.kaggle.com/api/v1`
- GitHub: use existing `this.octokit` Octokit instance — do NOT create a new one
- No new npm dependencies — SVG for charting, existing lucide-react for icons
- Max 100 items per category for GitHub activity (no pagination)
- Metric parsing from Kaggle `overview` field is best-effort — return `{}` on failure, never throw
- Test files in `apps/leaderboard-client`: pattern `src/**/*.test.{ts,tsx}`, run with `cd apps/leaderboard-client && npx vitest run`
- All connector code lives in `packages/connectors/`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/connectors/interfaces.ts` | Add `GitHubEvent`, `GitHubRepoActivity`, `KaggleModelVersion`, `KaggleRepoActivity`, `RepoActivity` types + `fetchRepoActivity?()` on interface |
| Modify | `packages/connectors/implementation/Github.connector.ts` | Implement `fetchRepoActivity()` — fetch commits, PRs, reviews, branches via Octokit |
| Modify | `packages/connectors/implementation/Kaggle.connector.ts` | Implement `fetchRepoActivity()` — dataset card metadata + model versions with parsed metrics |
| Create | `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts` | GET endpoint aggregating `fetchRepoActivity()` across all challenge repos |
| Modify | `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx` | Replace GitHub placeholder in `TabActivity` + Kaggle placeholders in `TabMLMetrics` |
| Create | `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.test.ts` | Unit tests for the route (mocked repository + connectors) |

---

## Task 1: Add types and interface method

**Files:**
- Modify: `packages/connectors/interfaces.ts`

**Interfaces:**
- Produces: `GitHubEventType`, `GitHubEvent`, `GitHubRepoActivity`, `KaggleModelMetrics`, `KaggleModelVersion`, `KaggleRepoActivity`, `RepoActivity`, and `ExternalConnector.fetchRepoActivity?()`

- [ ] **Step 1: Read current interfaces.ts**

Open `packages/connectors/interfaces.ts` and read it fully before editing.

- [ ] **Step 2: Add all new types and the optional method**

Replace the content of `packages/connectors/interfaces.ts` with:

```ts
export type ConnectorType = 'github' | 'google_drive' | 'kaggle_dataset' | 'kaggle_model' | 'slack' | string;

export interface ConnectorAuthConfig {
  apiKey?: string;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  [key: string]: any;
}

export interface ExternalItem {
  id: string;
  name: string;
  type: string; // 'file', 'commit', 'message', ...
  url?: string;
  metadata?: Record<string, any>;
}

// ─── Repo Activity types ──────────────────────────────────────────────────────

export type GitHubEventType = 'commit' | 'pull_request' | 'pr_review' | 'branch_created';

export interface GitHubEvent {
  type: GitHubEventType;
  id: string;
  title: string;
  author: string;       // GitHub login
  date: string;         // ISO 8601
  url: string;
  metadata: {
    sha?: string;
    additions?: number;
    deletions?: number;
    prNumber?: number;
    state?: 'open' | 'closed' | 'merged';
    reviewState?: 'approved' | 'changes_requested' | 'commented';
    branchName?: string;
  };
}

export interface GitHubRepoActivity {
  type: 'github';
  events: GitHubEvent[]; // sorted newest to oldest
}

export interface KaggleModelMetrics {
  auc?: number;
  f1?: number;
  accuracy?: number;
  [key: string]: number | undefined;
}

export interface KaggleModelVersion {
  versionNumber: number;
  createdAt: string; // ISO 8601
  metrics: KaggleModelMetrics;
}

export interface KaggleRepoActivity {
  type: 'kaggle_dataset' | 'kaggle_model';
  datasetMeta?: {
    title: string;
    description?: string;
    tags?: string[];
    url: string;
    lastUpdated?: string;
  };
  modelVersions?: Array<{
    ref: string; // "owner/slug"
    versions: KaggleModelVersion[];
  }>;
}

export type RepoActivity = GitHubRepoActivity | KaggleRepoActivity;

// ─── Connector interface ──────────────────────────────────────────────────────

export interface ExternalConnector {
  /** Nom humain lisible */
  name: string;

  /** Type de connecteur */
  type: ConnectorType;

  /** Configuration d'authentification */
  authConfig: ConnectorAuthConfig;

  /** Initialise la connexion (OAuth ou clé API) */
  connect(): Promise<void>;

  /** Vérifie la validité et disponibilité du connecteur */
  testConnection(): Promise<boolean>;

  /** Récupère une liste d'éléments (fichiers, commits, messages, modèles, etc.) */
  fetchItems(options?: Record<string, any>): Promise<ExternalItem[]>;

  /** Récupère le contenu détaillé d'un élément */
  fetchItemContent(itemId: string): Promise<any>;

  /** Récupère l'activité du repo (commits, PRs, reviews, branches / métriques Kaggle) */
  fetchRepoActivity?(): Promise<RepoActivity>;

  /** Nettoyage éventuel */
  disconnect?(): Promise<void>;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/connectors && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 4: Commit**

```bash
git add packages/connectors/interfaces.ts
git commit -m "feat(connectors): add RepoActivity types and fetchRepoActivity interface method"
```

---

## Task 2: Implement fetchRepoActivity() in GitHub connector

**Files:**
- Modify: `packages/connectors/implementation/Github.connector.ts`

**Interfaces:**
- Consumes: `GitHubEvent`, `GitHubRepoActivity`, `RepoActivity` from `../interfaces.js`
- Produces: `GitHubExternalConnector.fetchRepoActivity(): Promise<GitHubRepoActivity>`

- [ ] **Step 1: Read the full Github.connector.ts**

Open `packages/connectors/implementation/Github.connector.ts` and read it fully.

- [ ] **Step 2: Add the fetchRepoActivity() method**

Add the following method to the `GitHubExternalConnector` class, after the existing `disconnect()` method:

```ts
/**
 * Fetches a chronological activity timeline for the repo:
 * commits, pull requests, PR reviews, and branches.
 * Returns up to 100 items per category, sorted newest first.
 */
async fetchRepoActivity(): Promise<import('../interfaces.js').GitHubRepoActivity> {
  const [commitsResp, prsResp, branchesResp] = await Promise.all([
    this.octokit.rest.repos.listCommits({
      owner: this.owner,
      repo: this.repo,
      sha: this.branch,
      per_page: 100,
    }).catch(() => ({ data: [] as any[] })),

    this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'all',
      per_page: 100,
    }).catch(() => ({ data: [] as any[] })),

    this.octokit.rest.git.listMatchingRefs({
      owner: this.owner,
      repo: this.repo,
      ref: 'heads/',
    }).catch(() => ({ data: [] as any[] })),
  ]);

  const events: import('../interfaces.js').GitHubEvent[] = [];

  // ── Commits ──────────────────────────────────────────────────────────────
  for (const c of commitsResp.data) {
    events.push({
      type: 'commit',
      id: c.sha,
      title: c.commit.message.split('\n')[0],
      author: c.author?.login ?? c.commit.author?.name ?? 'unknown',
      date: c.commit.author?.date ?? new Date(0).toISOString(),
      url: c.html_url,
      metadata: {
        sha: c.sha,
        additions: c.stats?.additions,
        deletions: c.stats?.deletions,
      },
    });
  }

  // ── Pull requests ─────────────────────────────────────────────────────────
  const reviewsPerPR = await Promise.all(
    prsResp.data.map((pr: any) =>
      this.octokit.rest.pulls.listReviews({
        owner: this.owner,
        repo: this.repo,
        pull_number: pr.number,
      }).catch(() => ({ data: [] as any[] }))
    )
  );

  for (const pr of prsResp.data) {
    const isMerged = !!pr.merged_at;
    const state: 'open' | 'closed' | 'merged' = isMerged ? 'merged' : pr.state as 'open' | 'closed';

    events.push({
      type: 'pull_request',
      id: `pr-${pr.number}`,
      title: pr.title,
      author: pr.user?.login ?? 'unknown',
      date: pr.created_at,
      url: pr.html_url,
      metadata: {
        prNumber: pr.number,
        state,
      },
    });
  }

  // ── PR Reviews ────────────────────────────────────────────────────────────
  for (let i = 0; i < prsResp.data.length; i++) {
    const pr = prsResp.data[i];
    for (const review of reviewsPerPR[i].data) {
      if (!review.submitted_at) continue;
      const rawState = review.state?.toLowerCase();
      const reviewState: 'approved' | 'changes_requested' | 'commented' =
        rawState === 'approved' ? 'approved'
        : rawState === 'changes_requested' ? 'changes_requested'
        : 'commented';

      events.push({
        type: 'pr_review',
        id: `review-${review.id}`,
        title: `Review on #${pr.number}: ${pr.title}`,
        author: review.user?.login ?? 'unknown',
        date: review.submitted_at,
        url: review.html_url ?? pr.html_url,
        metadata: {
          prNumber: pr.number,
          reviewState,
        },
      });
    }
  }

  // ── Branches ──────────────────────────────────────────────────────────────
  // Fetch tip commit date for each branch to approximate creation time
  const branchTipDates = await Promise.all(
    branchesResp.data.map(async (ref: any) => {
      try {
        const sha = ref.object.sha;
        const { data: commit } = await this.octokit.rest.repos.getCommit({
          owner: this.owner,
          repo: this.repo,
          ref: sha,
        });
        return commit.commit.author?.date ?? new Date(0).toISOString();
      } catch {
        return new Date(0).toISOString();
      }
    })
  );

  for (let i = 0; i < branchesResp.data.length; i++) {
    const ref = branchesResp.data[i];
    const branchName = ref.ref.replace('refs/heads/', '');
    events.push({
      type: 'branch_created',
      id: `branch-${branchName}`,
      title: branchName,
      author: 'unknown',
      date: branchTipDates[i],
      url: `https://github.com/${this.owner}/${this.repo}/tree/${branchName}`,
      metadata: { branchName },
    });
  }

  // ── Sort newest first ─────────────────────────────────────────────────────
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { type: 'github', events };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd packages/connectors && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to this file.

- [ ] **Step 4: Commit**

```bash
git add packages/connectors/implementation/Github.connector.ts
git commit -m "feat(connectors): implement fetchRepoActivity for GitHub connector"
```

---

## Task 3: Implement fetchRepoActivity() in Kaggle connector

**Files:**
- Modify: `packages/connectors/implementation/Kaggle.connector.ts`
- Create: `apps/leaderboard-client/src/test/connectors/parseKaggleMetrics.test.ts`

**Interfaces:**
- Consumes: `KaggleRepoActivity`, `KaggleModelMetrics`, `KaggleModelVersion` from `../interfaces.js`
- Produces: `KaggleConnector.fetchRepoActivity(): Promise<KaggleRepoActivity>`, `parseMetrics(overview: string): KaggleModelMetrics` (exported for testing)

- [ ] **Step 1: Read the full Kaggle.connector.ts**

Open `packages/connectors/implementation/Kaggle.connector.ts` and read it fully.

- [ ] **Step 2: Export the metric parsing function**

Add the following standalone exported function at the top of `Kaggle.connector.ts`, after the imports:

```ts
/**
 * Best-effort metric extraction from a Kaggle model version's overview/description field.
 * Tries JSON.parse first, then falls back to regex.
 * Never throws — returns {} on any failure.
 */
export function parseMetrics(overview: string): import('../interfaces.js').KaggleModelMetrics {
  if (!overview) return {};

  // Attempt 1: the whole field is JSON
  try {
    const parsed = JSON.parse(overview);
    if (typeof parsed === 'object' && parsed !== null) {
      const result: import('../interfaces.js').KaggleModelMetrics = {};
      for (const key of ['auc', 'f1', 'accuracy'] as const) {
        const val = parsed[key];
        if (typeof val === 'number' && isFinite(val)) result[key] = val;
      }
      if (Object.keys(result).length > 0) return result;
    }
  } catch {
    // not JSON
  }

  // Attempt 2: embedded JSON block { ... } inside markdown
  const jsonMatch = overview.match(/\{[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        const result: import('../interfaces.js').KaggleModelMetrics = {};
        for (const key of ['auc', 'f1', 'accuracy'] as const) {
          const val = parsed[key];
          if (typeof val === 'number' && isFinite(val)) result[key] = val;
        }
        if (Object.keys(result).length > 0) return result;
      }
    } catch {
      // not a valid JSON block
    }
  }

  // Attempt 3: key: value regex patterns (e.g. "auc: 0.92" or `"auc": 0.92`)
  const result: import('../interfaces.js').KaggleModelMetrics = {};
  for (const key of ['auc', 'f1', 'accuracy'] as const) {
    const match = overview.match(new RegExp(`["']?${key}["']?\\s*:\\s*([0-9]*\\.?[0-9]+)`, 'i'));
    if (match) {
      const val = parseFloat(match[1]);
      if (isFinite(val)) result[key] = val;
    }
  }
  return result;
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/leaderboard-client/src/test/connectors/parseKaggleMetrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseMetrics } from '../../../../../packages/connectors/implementation/Kaggle.connector.js';

describe('parseMetrics', () => {
  it('returns empty object for empty string', () => {
    expect(parseMetrics('')).toEqual({});
  });

  it('parses full JSON overview', () => {
    const overview = JSON.stringify({ auc: 0.91, f1: 0.87, accuracy: 0.89 });
    expect(parseMetrics(overview)).toEqual({ auc: 0.91, f1: 0.87, accuracy: 0.89 });
  });

  it('parses embedded JSON block inside markdown', () => {
    const overview = '## Results\n```json\n{"auc": 0.95, "f1": 0.90}\n```';
    const result = parseMetrics(overview);
    expect(result.auc).toBe(0.95);
    expect(result.f1).toBe(0.90);
  });

  it('parses colon-separated key:value patterns', () => {
    const overview = 'Model metrics:\nauc: 0.92\nf1: 0.85\naccuracy: 0.88';
    expect(parseMetrics(overview)).toEqual({ auc: 0.92, f1: 0.85, accuracy: 0.88 });
  });

  it('returns empty object when no metrics found', () => {
    expect(parseMetrics('This model does classification tasks.')).toEqual({});
  });

  it('ignores non-finite values', () => {
    const overview = '{"auc": null, "f1": 0.80}';
    const result = parseMetrics(overview);
    expect(result.auc).toBeUndefined();
    expect(result.f1).toBe(0.80);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd apps/leaderboard-client && npx vitest run src/test/connectors/parseKaggleMetrics.test.ts
```

Expected: FAIL — `parseMetrics` not yet exported.

- [ ] **Step 5: Add fetchRepoActivity() to KaggleConnector**

Add the following method to the `KaggleConnector` class, after the existing `disconnect()` method:

```ts
async fetchRepoActivity(): Promise<import('../interfaces.js').KaggleRepoActivity> {
  if (this.subtype === 'kaggle_dataset') {
    return this.fetchDatasetActivity();
  }
  return this.fetchModelActivity();
}

private async fetchDatasetActivity(): Promise<import('../interfaces.js').KaggleRepoActivity> {
  const metadata = await this.kaggleFetch(`/datasets/${this.owner}/${this.slug}`);

  return {
    type: 'kaggle_dataset',
    datasetMeta: {
      title: metadata.title || this.slug,
      description: metadata.description,
      tags: Array.isArray(metadata.tags) ? metadata.tags.map((t: any) => t.name ?? t) : [],
      url: `https://www.kaggle.com/datasets/${this.owner}/${this.slug}`,
      lastUpdated: metadata.lastUpdated,
    },
  };
}

private async fetchModelActivity(): Promise<import('../interfaces.js').KaggleRepoActivity> {
  // 1. List model instances (one per framework)
  let instances: any[] = [];
  try {
    const resp = await this.kaggleFetch(`/models/${this.owner}/${this.slug}/instances`);
    instances = Array.isArray(resp) ? resp : (resp.instances ?? []);
  } catch {
    return { type: 'kaggle_model', modelVersions: [] };
  }

  // 2. For each instance, fetch versions
  const versionsPerInstance = await Promise.all(
    instances.map(async (inst: any) => {
      const framework = inst.framework ?? inst.modelFramework ?? 'unknown';
      const instanceSlug = inst.overview ?? inst.instanceSlug ?? inst.slug ?? 'default';
      try {
        const resp = await this.kaggleFetch(
          `/models/${this.owner}/${this.slug}/${framework}/${instanceSlug}/versions`
        );
        const raw: any[] = Array.isArray(resp) ? resp : (resp.versions ?? []);
        return raw.map((v: any): import('../interfaces.js').KaggleModelVersion => ({
          versionNumber: v.versionNumber ?? v.version ?? 0,
          createdAt: v.createdAt ?? v.publishTime ?? new Date(0).toISOString(),
          metrics: parseMetrics(v.overview ?? v.description ?? ''),
        }));
      } catch {
        return [];
      }
    })
  );

  // 3. Flatten all versions under one ref
  const allVersions = versionsPerInstance.flat().sort(
    (a, b) => a.versionNumber - b.versionNumber
  );

  return {
    type: 'kaggle_model',
    modelVersions: [
      { ref: `${this.owner}/${this.slug}`, versions: allVersions },
    ],
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/leaderboard-client && npx vitest run src/test/connectors/parseKaggleMetrics.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 7: Verify TypeScript**

```bash
cd packages/connectors && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add packages/connectors/implementation/Kaggle.connector.ts apps/leaderboard-client/src/test/connectors/parseKaggleMetrics.test.ts
git commit -m "feat(connectors): implement fetchRepoActivity for Kaggle connector with metric parsing"
```

---

## Task 4: Create the repo-activity API route

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.test.ts`

**Interfaces:**
- Consumes:
  - `ChallengeRepoRepository` from `packages/database-service/repositories`
  - `ConnectorRegistry` from `packages/connectors/registry.js`
  - `RepoActivity` from `packages/connectors/interfaces.js`
- Produces: `GET /api/challenges/[id]/repo-activity` → `{ activities: Record<string, RepoActivity | { error: string }> }`

- [ ] **Step 1: Read an existing similar route for patterns**

Read `apps/leaderboard-client/src/app/api/challenges/[id]/repos/route.ts` to understand import paths and response patterns.

- [ ] **Step 2: Write the failing test**

Create `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock the repository
vi.mock('../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeRepoRepository: vi.fn().mockImplementation(() => ({
    findByChallengeWithRepo: vi.fn().mockResolvedValue([
      {
        repo_id: 'repo-1',
        repo_type: 'github',
        external_repo_id: 'owner/repo',
        title: 'Test Repo',
        type: 'github',
      },
    ]),
  })),
}));

// Mock the connector registry
vi.mock('../../../../../../../../packages/connectors/registry.js', () => ({
  ConnectorRegistry: {
    createConnector: vi.fn().mockReturnValue({
      fetchRepoActivity: vi.fn().mockResolvedValue({
        type: 'github',
        events: [
          {
            type: 'commit',
            id: 'abc123',
            title: 'Initial commit',
            author: 'alice',
            date: '2026-01-01T00:00:00Z',
            url: 'https://github.com/owner/repo/commit/abc123',
            metadata: {},
          },
        ],
      }),
    }),
  },
}));

describe('GET /api/challenges/[id]/repo-activity', () => {
  it('returns activities keyed by repo_id', async () => {
    const req = new NextRequest('http://localhost/api/challenges/challenge-1/repo-activity');
    const res = await GET(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities).toBeDefined();
    expect(body.activities['repo-1']).toBeDefined();
    expect(body.activities['repo-1'].type).toBe('github');
  });

  it('returns error entry when connector has no fetchRepoActivity', async () => {
    const { ConnectorRegistry } = await import('../../../../../../../../packages/connectors/registry.js');
    (ConnectorRegistry.createConnector as any).mockReturnValueOnce({
      // no fetchRepoActivity method
    });

    const req = new NextRequest('http://localhost/api/challenges/challenge-1/repo-activity');
    const res = await GET(req, { params: Promise.resolve({ id: 'challenge-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities['repo-1'].error).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd apps/leaderboard-client && npx vitest run src/app/api/challenges/\\[id\\]/repo-activity/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create the route**

Create `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepoRepository } from '../../../../../../../../packages/database-service/repositories';
import { ConnectorRegistry } from '../../../../../../../../packages/connectors/registry.js';
import type { RepoActivity } from '../../../../../../../../packages/connectors/interfaces.js';

const challengeRepoRepo = new ChallengeRepoRepository();

// GET /api/challenges/[id]/repo-activity
// Returns fetchRepoActivity() results for all repos in the challenge, keyed by repo_id.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);

    const results = await Promise.allSettled(
      repos.map(async (repo) => {
        const connector = ConnectorRegistry.createConnector(repo as any);
        if (!connector || typeof connector.fetchRepoActivity !== 'function') {
          return { repo_id: repo.repo_id, result: { error: 'No activity method available' } };
        }
        try {
          const activity: RepoActivity = await connector.fetchRepoActivity!();
          return { repo_id: repo.repo_id, result: activity };
        } catch (err: any) {
          return { repo_id: repo.repo_id, result: { error: err?.message ?? 'Unknown error' } };
        }
      })
    );

    const activities: Record<string, RepoActivity | { error: string }> = {};
    for (const settled of results) {
      if (settled.status === 'fulfilled') {
        activities[settled.value.repo_id] = settled.value.result;
      }
    }

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching repo activity:', error);
    return NextResponse.json({ error: 'Failed to fetch repo activity' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/leaderboard-client && npx vitest run src/app/api/challenges/\\[id\\]/repo-activity/route.test.ts
```

Expected: all 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/\\[id\\]/repo-activity/route.ts apps/leaderboard-client/src/app/api/challenges/\\[id\\]/repo-activity/route.test.ts
git commit -m "feat(api): add GET /api/challenges/[id]/repo-activity route"
```

---

## Task 5: Update TabActivity — GitHub event timeline

**Files:**
- Modify: `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/challenges/[id]/repo-activity` → `{ activities: Record<string, RepoActivity | { error: string }> }`
- Consumes types: `GitHubEvent`, `GitHubEventType` (imported inline via `as` cast — no import needed, data comes from API JSON)

- [ ] **Step 1: Read the full page.tsx**

Open `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx` and read it fully.

- [ ] **Step 2: Add GitHubActivity state and fetch to the page**

In `ChallengeManagerPage`, add:

1. A new state variable after the existing `mlData` state:

```ts
const [repoActivity, setRepoActivity] = useState<Record<string, any> | null>(null);
```

2. In `fetchAll()`, add a new entry to the `Promise.allSettled` array:

```ts
fetch(`/api/challenges/${challengeId}/repo-activity`)
  .then(r => r.ok && r.json())
  .then(d => d?.activities && setRepoActivity(d.activities)),
```

- [ ] **Step 3: Add relative date helper**

Add this helper function near the top of the file, after `fmtTime`:

```ts
function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmt(iso, { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 4: Add GitHub event config**

Add this constant near the `KANBAN_COLS` constant:

```ts
const GITHUB_EVENT_CONFIG = {
  commit:         { label: 'Commit',        badge: 'bg-white/15 text-white/50' },
  pull_request:   { label: 'Pull Request',  badge: 'bg-purple-500/20 text-purple-300' },
  pr_review:      { label: 'Review',        badge: 'bg-blue-500/20 text-blue-300' },
  branch_created: { label: 'Branch',        badge: 'bg-green-500/20 text-green-300' },
} as const;
```

- [ ] **Step 5: Replace the GitHub placeholder in TabActivity**

Locate the `TabActivity` function. Its props currently are `{ contributions, meetings, team }`. Update to also accept `repoActivity`:

```ts
function TabActivity({ contributions, meetings, team, repoActivity }: {
  contributions: Contribution[]; meetings: Meeting[]; team: TeamMember[];
  repoActivity: Record<string, any> | null;
}) {
```

Replace the entire "GitHub Activity" placeholder section (the dashed border div with "GitHub integration coming soon") with:

```tsx
{/* GitHub Activity */}
<div className="space-y-3">
  {sectionHeader(<GitBranch className="h-3.5 w-3.5" />, 'GitHub Activity')}
  {repoActivity === null ? (
    <div className="space-y-1.5">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.03]" />
      ))}
    </div>
  ) : (() => {
    const githubEntry = Object.values(repoActivity).find((a: any) => a?.type === 'github');
    const events: any[] = githubEntry?.events ?? [];

    if (events.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] px-5 py-10 text-center space-y-2">
          <div className="flex items-center justify-center gap-3 text-white/20">
            <GitBranch className="h-5 w-5" />
            <GitPullRequest className="h-5 w-5" />
          </div>
          <p className="text-sm text-white/25">No GitHub activity found</p>
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        {events.slice(0, 50).map((event: any, i: number) => {
          const config = GITHUB_EVENT_CONFIG[event.type as keyof typeof GITHUB_EVENT_CONFIG]
            ?? { label: event.type, badge: 'bg-white/10 text-white/40' };
          const Icon =
            event.type === 'pull_request' ? GitPullRequest
            : event.type === 'pr_review'  ? MessageSquare
            : event.type === 'branch_created' ? GitBranch
            : GitCommit;

          return (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 animate-fade-up hover:bg-white/[0.04] transition-colors"
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/80">{event.title}</p>
                <p className="text-[11px] text-white/30">
                  {event.author} · {relativeDate(event.date)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.badge}`}>
                {config.label}
              </span>
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  })()}
</div>
```

- [ ] **Step 6: Add missing Lucide imports**

In the import line at the top of the file, ensure `GitCommit` and `MessageSquare` are imported alongside the existing icons:

```ts
import {
  ArrowLeft, Users, Trophy, CalendarDays, Code2, BrainCircuit,
  CheckCircle2, Circle, Clock3, BarChart2, Activity,
  Medal, Video, ExternalLink, GitBranch, GitPullRequest,
  GitCommit, MessageSquare,
  Database, Package, Cpu, FlaskConical, ChevronDown, Loader2, Plus,
} from 'lucide-react';
```

- [ ] **Step 7: Pass repoActivity to TabActivity in the tabs config**

Locate where `TabActivity` is used in the `tabs` array (non-ML branch) and update:

```ts
{
  label: 'Activity',
  panel: <TabActivity contributions={contributions} meetings={meetings} team={team} repoActivity={repoActivity} />,
},
```

- [ ] **Step 8: Verify build compiles**

```bash
cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add apps/leaderboard-client/src/app/admin/challenges/\\[id\\]/page.tsx
git commit -m "feat(ui): replace GitHub activity placeholder with live event timeline"
```

---

## Task 6: Update TabMLMetrics — Kaggle dataset card + model metrics graph

**Files:**
- Modify: `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx`

**Interfaces:**
- Consumes: `repoActivity` state (same as Task 5), `KaggleRepoActivity` shape from API JSON

- [ ] **Step 1: Update TabMLMetrics signature to accept repoActivity**

Locate the `TabMLMetrics` function. Currently it takes no props. Update it:

```ts
function TabMLMetrics({ repoActivity }: { repoActivity: Record<string, any> | null }) {
```

- [ ] **Step 2: Add the SVG line chart helper**

Add this component inside the file, before `TabMLMetrics`:

```tsx
function MetricsLineChart({ versions }: {
  versions: Array<{ versionNumber: number; metrics: { auc?: number; f1?: number; accuracy?: number } }>
}) {
  const W = 320, H = 140, PAD = { top: 12, right: 16, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const xs = versions.map(v => v.versionNumber);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xRange = maxX - minX || 1;

  const toSVGX = (x: number) => PAD.left + ((x - minX) / xRange) * innerW;
  const toSVGY = (y: number) => PAD.top + (1 - y) * innerH; // y in [0,1]

  const LINES = [
    { key: 'auc' as const,      color: 'var(--color-brandCP, #6366f1)', label: 'AUC' },
    { key: 'f1' as const,       color: '#22c55e',                        label: 'F1' },
    { key: 'accuracy' as const, color: '#3b82f6',                        label: 'Accuracy' },
  ];

  const toPath = (key: 'auc' | 'f1' | 'accuracy') => {
    const pts = versions.filter(v => v.metrics[key] !== undefined);
    if (pts.length === 0) return '';
    return pts.map((v, i) => {
      const x = toSVGX(v.versionNumber);
      const y = toSVGY(v.metrics[key]!);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  // Y axis ticks at 0, 0.25, 0.5, 0.75, 1.0
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="text-white/20">
        {/* Y grid lines */}
        {yTicks.map(t => (
          <g key={t}>
            <line
              x1={PAD.left} y1={toSVGY(t)}
              x2={PAD.left + innerW} y2={toSVGY(t)}
              stroke="currentColor" strokeWidth={0.5} strokeDasharray="2 3"
            />
            <text x={PAD.left - 4} y={toSVGY(t) + 4} textAnchor="end"
              fontSize={8} fill="currentColor">
              {t.toFixed(2)}
            </text>
          </g>
        ))}

        {/* X axis version labels */}
        {versions.map(v => (
          <text key={v.versionNumber}
            x={toSVGX(v.versionNumber)} y={H - 8}
            textAnchor="middle" fontSize={8} fill="currentColor">
            v{v.versionNumber}
          </text>
        ))}

        {/* Lines */}
        {LINES.map(({ key, color }) => {
          const d = toPath(key);
          if (!d) return null;
          return (
            <path key={key} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
          );
        })}

        {/* Dots */}
        {LINES.map(({ key, color }) =>
          versions
            .filter(v => v.metrics[key] !== undefined)
            .map(v => (
              <circle
                key={`${key}-${v.versionNumber}`}
                cx={toSVGX(v.versionNumber)} cy={toSVGY(v.metrics[key]!)}
                r={3} fill={color}
              />
            ))
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex gap-4">
        {LINES.map(({ key, color, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite TabMLMetrics body**

Replace the entire body of `TabMLMetrics` with:

```tsx
function TabMLMetrics({ repoActivity }: { repoActivity: Record<string, any> | null }) {
  if (repoActivity === null) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />)}
      </div>
    );
  }

  const datasetEntry = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_dataset');
  const modelEntry   = Object.values(repoActivity).find((a: any) => a?.type === 'kaggle_model');

  return (
    <div className="space-y-8">

      {/* Dataset card */}
      {datasetEntry?.datasetMeta && (() => {
        const meta = datasetEntry.datasetMeta;
        return (
          <div className="space-y-3">
            {sectionHeader(<Database className="h-3.5 w-3.5" />, 'Dataset')}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">{meta.title}</p>
                {meta.url && (
                  <a href={meta.url} target="_blank" rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-xs text-brandCP hover:underline">
                    Kaggle <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {meta.description && (
                <p className="text-xs text-white/40 line-clamp-3">{meta.description}</p>
              )}
              {meta.tags && meta.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {meta.tags.slice(0, 8).map((tag: string) => (
                    <span key={tag}
                      className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/40">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {meta.lastUpdated && (
                <p className="text-[11px] text-white/25">Updated {fmt(meta.lastUpdated, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Model metrics */}
      {modelEntry && (() => {
        const modelVersions: Array<{ ref: string; versions: any[] }> = modelEntry.modelVersions ?? [];

        return (
          <div className="space-y-6">
            {sectionHeader(<Cpu className="h-3.5 w-3.5" />, 'Model Metrics')}
            {modelVersions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
                <p className="text-sm text-white/20">No model versions found</p>
              </div>
            ) : (
              modelVersions.map(({ ref, versions }) => {
                const hasMetrics = versions.some(v =>
                  v.metrics.auc !== undefined || v.metrics.f1 !== undefined || v.metrics.accuracy !== undefined
                );

                return (
                  <div key={ref} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white/70">{ref}</p>
                      <span className="text-[10px] text-white/25">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                    </div>

                    {!hasMetrics ? (
                      <p className="text-xs text-white/25">No metrics found in model card</p>
                    ) : versions.length === 1 ? (
                      // Single version: show badges
                      <div className="flex flex-wrap gap-3">
                        {(['auc', 'f1', 'accuracy'] as const).map(key => {
                          const val = versions[0].metrics[key];
                          if (val === undefined) return null;
                          return (
                            <div key={key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-center">
                              <p className="text-[10px] uppercase tracking-widest text-white/30">{key.toUpperCase()}</p>
                              <p className="text-lg font-bold text-white">{val.toFixed(3)}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Multiple versions: line chart
                      <MetricsLineChart versions={versions} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })()}

      {/* Empty state if no Kaggle data */}
      {!datasetEntry && !modelEntry && (
        <div className="rounded-xl border border-dashed border-white/[0.05] py-12 text-center">
          <p className="text-sm text-white/20">No Kaggle data available for this challenge</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pass repoActivity to TabMLMetrics in tabs config**

Find where `TabMLMetrics` is rendered in the `tabs` array (ML branch) and update:

```ts
{
  label: 'Metrics',
  panel: <TabMLMetrics repoActivity={repoActivity} />,
},
```

- [ ] **Step 5: Verify build compiles**

```bash
cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Run all tests**

```bash
cd apps/leaderboard-client && npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/leaderboard-client/src/app/admin/challenges/\\[id\\]/page.tsx
git commit -m "feat(ui): replace Kaggle placeholders with dataset card and model metrics graph"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|------------------|-----------|
| Add `fetchRepoActivity?()` to `ExternalConnector` | Task 1 |
| GitHub: commits, PRs, PR reviews, branch_created | Task 2 |
| GitHub: chronological timeline, newest first | Task 2 (sort step) |
| Kaggle dataset: card without stats | Task 3 + Task 6 |
| Kaggle model: versioned AUC/F1/accuracy per model | Task 3 |
| Metric parsing from overview field (JSON + regex) | Task 3 |
| API route: `GET /api/challenges/[id]/repo-activity` | Task 4 |
| API: `Promise.allSettled`, error per repo | Task 4 |
| UI: GitHub timeline with icons + badges | Task 5 |
| UI: relative dates | Task 5 (`relativeDate` helper) |
| UI: Kaggle dataset card | Task 6 |
| UI: model metrics SVG line chart | Task 6 (`MetricsLineChart`) |
| UI: single-version fallback to badges | Task 6 |
| UI: skeleton while loading | Task 5 + Task 6 |

No gaps found.

**Type consistency check:**
- `GitHubEvent.metadata.reviewState` defined in Task 1 as `'approved' | 'changes_requested' | 'commented'` — used correctly in Task 2.
- `KaggleModelVersion.metrics` typed as `KaggleModelMetrics` — used correctly in Task 3 `parseMetrics`.
- `repoActivity` state is `Record<string, any> | null` — passed consistently in Tasks 5 and 6.
- `MetricsLineChart` props use `{ auc?: number; f1?: number; accuracy?: number }` — matches `KaggleModelMetrics`.

No inconsistencies.
