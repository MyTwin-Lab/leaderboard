# connectors

External data source connectors for the leaderboard. Provides a unified interface for fetching commits, files, metadata and messages from GitHub, Kaggle and Slack.

Used through `ConnectorRegistry` by the code and sandbox evaluations (`services/challenge/repo-evaluation.ts`), the ML rewards (`services/challenge/ml-rewards.service.ts`) and the repo activity route.

## Structure

```
connectors/
├── interfaces.ts              # ExternalConnector interface
├── registry.ts                # ConnectorRegistry — maps repo types to connectors
└── implementation/
    ├── Github.connector.ts    # GitHub connector
    ├── Kaggle.connector.ts    # Kaggle datasets and models
    └── Slack.connector.ts     # Slack channel history
```

## The `ExternalConnector` interface

All connectors implement this interface:

```typescript
interface ExternalConnector {
  name: string;
  type: ConnectorType;           // 'github' | 'kaggle_dataset' | 'kaggle_model' | 'slack' | ...
  authConfig: ConnectorAuthConfig;

  connect(): Promise<void>;
  testConnection(): Promise<boolean>;
  fetchItems(options?: FetchOptions): Promise<ExternalItem[]>;
  fetchItemContent(itemId: string): Promise<any>;
  fetchRepoActivity?(): Promise<RepoActivity>;
  disconnect?(): Promise<void>;
}
```

## Available connectors

### GitHub (`GitHubExternalConnector`)

Fetches commits and file contents from a GitHub repository branch.

**Requires:** the GitHub connection of the admin settings (OAuth token stored encrypted), or the `GITHUB_TOKEN` env var as a fallback.

```typescript
const connector = new GitHubExternalConnector({
  token,
  owner: 'MyTwin-Lab',
  repo: 'leaderboard',
  branch: 'task/007-setup-environment',
});

await connector.connect();
```

**`fetchItems(options)`** — returns commits

```typescript
const commits = await connector.fetchItems({
  since: '2024-09-01T00:00:00Z',  // ISO 8601
  until: '2024-09-30T00:00:00Z',
  author: 'github-username',       // filter by author
  maxCommits: 100,                 // default: 1000
});
// Returns: ExternalItem[] (id = commit SHA, metadata includes author, message, stats)
```

**`fetchItemContent(commitSha)`** — returns file contents for a commit

```typescript
const content = await connector.fetchItemContent(commits[0].id);
// content.modifiedFiles → files changed in this commit with decoded UTF-8 content
```

- Automatically filters to text files (`.ts`, `.js`, `.py`, `.md`, etc.)
- Skips deleted and binary files
- Optionally includes diffs (`includePatch: true`)

## ConnectorRegistry

Maps a repo type string to the appropriate connector class and resolves its credentials.

```typescript
const connector = await ConnectorRegistry.createConnector(repo, { branch: 'task/007-...' });
// Returns GitHubExternalConnector for repos with type 'github', KaggleConnector for
// 'kaggle_dataset' / 'kaggle_model', SlackConnector for 'slack', null otherwise.
```

## Adding a new connector

1. Create a class in `implementation/` that implements `ExternalConnector`
2. Add its type to `ConnectorType`
3. Register it in `ConnectorRegistry`
4. Document the required credentials here

## Environment variables

| Variable | Required for |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub connector, fallback when no OAuth connection is stored |
| `KAGGLE_USERNAME`, `KAGGLE_KEY` | Kaggle connector, fallback when no connection is stored |
| `SLACK_BOT_TOKEN` | Slack connector, dev fallback when no connection is stored |
