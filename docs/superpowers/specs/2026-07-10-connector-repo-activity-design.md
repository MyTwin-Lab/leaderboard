# Connector Repo Activity — Design Spec

**Date:** 2026-07-10
**Branch:** challenge-010-ML_integration
**Status:** Approved

---

## Overview

Add a `fetchRepoActivity()` method to the `ExternalConnector` interface and implement it in `GitHubExternalConnector` and `KaggleConnector`. Expose the data via a new API route and replace the "coming soon" placeholders in the challenge manager UI.

---

## Goals

- **GitHub (code challenges):** Display a chronological activity timeline in `TabActivity` — commits, PRs, PR reviews, branch creations.
- **Kaggle model (ML challenges):** Display versioned AUC/F1/Accuracy metrics per contributor model in `TabMLMetrics`, as a line graph.
- **Kaggle dataset (ML challenges):** Display the dataset card (existing metadata) without stats (no views/downloads/votes).

---

## Types — `packages/connectors/interfaces.ts`

### GitHub

```ts
export type GitHubEventType = 'commit' | 'pull_request' | 'pr_review' | 'branch_created';

export interface GitHubEvent {
  type: GitHubEventType;
  id: string;
  title: string;
  author: string;          // GitHub login
  date: string;            // ISO 8601
  url: string;
  metadata: {
    // commit
    sha?: string;
    additions?: number;
    deletions?: number;
    // pull_request
    prNumber?: number;
    state?: 'open' | 'closed' | 'merged';
    // pr_review
    reviewState?: 'approved' | 'changes_requested' | 'commented';
    // branch_created
    branchName?: string;
  };
}

export interface GitHubRepoActivity {
  type: 'github';
  events: GitHubEvent[];  // sorted newest to oldest
}
```

### Kaggle

```ts
export interface KaggleModelMetrics {
  auc?: number;
  f1?: number;
  accuracy?: number;
  [key: string]: number | undefined;
}

export interface KaggleModelVersion {
  versionNumber: number;
  createdAt: string;       // ISO 8601
  metrics: KaggleModelMetrics;
}

export interface KaggleRepoActivity {
  type: 'kaggle_dataset' | 'kaggle_model';
  // Dataset: existing metadata card only (title, description, tags, url)
  datasetMeta?: {
    title: string;
    description?: string;
    tags?: string[];
    url: string;
    lastUpdated?: string;
  };
  // Model: versioned metrics per model ref
  modelVersions?: Array<{
    ref: string;            // "owner/slug"
    versions: KaggleModelVersion[];
  }>;
}

export type RepoActivity = GitHubRepoActivity | KaggleRepoActivity;
```

### Interface addition

```ts
export interface ExternalConnector {
  // ... existing methods ...
  fetchRepoActivity?(): Promise<RepoActivity>;
}
```

---

## GitHub Implementation — `packages/connectors/implementation/Github.connector.ts`

Uses existing Octokit instance. Four parallel calls:

| Data | Endpoint | Notes |
|------|----------|-------|
| Commits | `repos.listCommits` | Up to 100, use existing `this.branch` |
| PRs | `pulls.list({ state: 'all' })` | Up to 100 |
| PR Reviews | `pulls.listReviews` | One call per PR, parallel via `Promise.all` |
| Branches | `git.listMatchingRefs({ ref: 'heads/' })` then cross-ref tip commit date | Use `commit.commit.author.date` of branch tip as proxy for creation date |

All events normalized to `GitHubEvent[]` and sorted by `date` descending.

**Limits:** 100 items max per category (no pagination for the activity view).

---

## Kaggle Implementation — `packages/connectors/implementation/Kaggle.connector.ts`

### `kaggle_dataset`

Single call to `/datasets/{owner}/{slug}` (already used in `fetchDatasetItem`). Map to `datasetMeta` — title, description, tags, url, lastUpdated. No stats.

### `kaggle_model`

1. `GET /models/{owner}/{slug}/instances` — list instances (framework + instanceSlug)
2. For each instance: `GET /models/{owner}/{slug}/{framework}/{instanceSlug}/versions` — list versions with `versionNumber`, `createdAt`, and `overview`/`description`
3. Parse metrics from each version's `overview` field:
   - Try `JSON.parse(overview)` first — look for `auc`, `f1`, `accuracy` keys
   - Fallback: regex patterns `"auc"\s*:\s*([0-9.]+)` / `auc:\s*([0-9.]+)`
4. Return all instances merged under one `ref` entry (`owner/slug`)

---

## API Route — `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts`

```
GET /api/challenges/[id]/repo-activity
```

**Logic:**
1. Fetch all repos for the challenge via `ChallengeRepoRepository.findByChallengeWithRepo()`
2. For each repo, create connector via `ConnectorRegistry.createConnector(repo)` — skip nulls
3. Filter connectors that implement `fetchRepoActivity`
4. Call all in parallel via `Promise.allSettled`
5. Return:

```ts
{
  activities: {
    [repo_id: string]: RepoActivity | { error: string }
  }
}
```

No auth required (admin-only page, already protected by layout middleware).

---

## UI Changes

### `TabActivity` — GitHub timeline (code challenges)

Location: `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx`

Replace the "GitHub integration coming soon" placeholder with:

- Fetch on mount: `GET /api/challenges/[id]/repo-activity`
- Find the `github` activity in the response
- Render a chronological list of `GitHubEvent[]`:
  - Icon per type: `GitCommit` (commit), `GitPullRequest` (PR), `MessageSquare` (review), `GitBranch` (branch)
  - Badge color per type: commit = white/20, PR = purple/40, review = blue/40, branch = green/40
  - Each row: icon + title + author login + relative date + link
  - Skeleton while loading, empty state if no events
- The `contributions` section above remains unchanged

### `TabMLMetrics` — Kaggle metrics (ML challenges)

Replace both placeholders ("Kaggle sync coming soon" banner and the leaderboard placeholder):

**Dataset card:** If a `kaggle_dataset` activity is present, render a simple card with title, description, tags, and a link. No stats.

**Model metrics graph:** If `kaggle_model` activity is present with versions:
- One section per `ref` (contributor model)
- Line chart with version number on X axis, score (0-1) on Y axis
- Three lines: AUC (brandCP color), F1 (green), Accuracy (blue)
- Use `recharts` or lightweight SVG path if recharts unavailable
- If a model has only one version, show a single point with metric values as text badges
- If no metrics parsed, show "No metrics found in model card"

---

## Notes

- Branch creation date is approximated via the branch tip commit date — no GitHub API for exact branch creation timestamp.
- Metric parsing from `overview` field is best-effort; gracefully returns empty `metrics: {}` if parsing fails.
- Dataset stats (views/downloads/votes) explicitly excluded per design decision.
- `recharts` availability to be verified during implementation; fallback to SVG paths if absent.
