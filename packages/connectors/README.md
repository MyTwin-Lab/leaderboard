# connectors

External data source connectors for the leaderboard. Provides a unified interface for fetching commits and files from GitHub and Google Drive.

Used by `packages/services/task_evaluation` (via `ConnectorsOrchestrator`) to fetch commits from task workspace branches during evaluation.

## Structure

```
connectors/
├── interfaces.ts              # ExternalConnector interface
├── registry.ts                # ConnectorRegistry — maps repo types to connectors
├── connectors.orchestrator.ts # ConnectorsOrchestrator — multi-connector coordination
└── implementation/
    ├── github/                # GitHub connector
    └── google-drive/          # Google Drive connector
```

## The `ExternalConnector` interface

All connectors implement this interface:

```typescript
interface ExternalConnector {
  name: string;
  type: ConnectorType;           // 'github' | 'google_drive' | ...
  authConfig: ConnectorAuthConfig;

  connect(): Promise<void>;
  testConnection(): Promise<boolean>;
  fetchItems(options?: FetchOptions): Promise<ExternalItem[]>;
  fetchItemContent(itemId: string): Promise<any>;
  disconnect?(): Promise<void>;
}
```

## Available connectors

### GitHub (`GitHubExternalConnector`)

Fetches commits and file contents from a GitHub repository branch.

**Requires:** `GITHUB_TOKEN` env var

```typescript
const connector = new GitHubExternalConnector({
  token: process.env.GITHUB_TOKEN,
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

---

### Google Drive (`GoogleDriveConnector`)

Lists and downloads files from a Google Drive folder via OAuth2.

**Requires:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

```typescript
const connector = new GoogleDriveConnector({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
});

await connector.connect();
```

**`fetchItems(options)`** — lists files

```typescript
const files = await connector.fetchItems({
  folderId: process.env.GOOGLE_FOLDER_ID,
  mimeType: 'application/pdf',   // optional MIME filter
  pageSize: 50,                  // default: 100
  orderBy: 'modifiedTime desc',
});
```

**`fetchItemContent(fileId)`** — downloads file content

- Google Docs/Sheets/Slides → exported as plain text automatically
- Text files → returned as UTF-8 string
- Binary files → returned as Buffer
- Folders → returns metadata only

## ConnectorRegistry

Maps a repo type string to the appropriate connector class. Used by `TaskEvaluationService` to instantiate the right connector per workspace.

```typescript
const connector = ConnectorRegistry.createConnector(repo, { branch: 'task/007-...' });
// Returns GitHubExternalConnector for repos with type 'github', etc.
```

## ConnectorsOrchestrator

Coordinates multiple connectors in parallel (a task can have workspaces across multiple repos).

```typescript
const orchestrator = new ConnectorsOrchestrator(connectors, repos);

await orchestrator.connectAll();
const allItems = await orchestrator.fetchAllItems({ maxCommits: 100 });
const connector = orchestrator.getConnectorForItem(commitSha);
await orchestrator.disconnectAll();
```

## Adding a new connector

1. Create a class in `implementation/` that implements `ExternalConnector`
2. Add its type to `ConnectorType`
3. Register it in `ConnectorRegistry`
4. Document the required env vars here

## Environment variables

| Variable | Required for |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub connector |
| `GOOGLE_CLIENT_ID` | Google Drive connector |
| `GOOGLE_CLIENT_SECRET` | Google Drive connector |
| `GOOGLE_REFRESH_TOKEN` | Google Drive connector |
