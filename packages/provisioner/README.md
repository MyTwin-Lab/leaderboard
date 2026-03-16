# provisioner

Creates workspaces (GitHub branches) for challenges and tasks. Uses a Registry + Provider pattern so new platform types can be added without changing the calling code.

## Structure

```
provisioner/src/
├── index.ts                       # Main entry point + exports
├── types.ts                       # WorkspaceProvider interface + shared types
├── registry.ts                    # ProvisionerRegistry
├── utils.ts                       # Branch name generation (slugify, zero-padding)
├── errors.ts                      # Typed error classes
└── providers/
    └── github-branch.provider.ts  # GitHub branch provider
```

## Usage

### Provision a workspace for a challenge

```typescript
import { provisionChallengeWorkspace } from '../../provisioner/src/index.js';

const result = await provisionChallengeWorkspace({
  challengeIndex: 7,
  challengeTitle: 'Admin Experience Update',
  repoExternalId: 'MyTwin-Lab/leaderboard',
  repoType: 'github',
});

// result:
// {
//   provider: 'GitHub Branch',
//   workspaceType: 'git_branch',
//   ref: 'refs/heads/challenge/007-admin-experience-update',
//   url: 'https://github.com/MyTwin-Lab/leaderboard/tree/challenge/007-admin-experience-update',
//   status: 'ready',
//   meta: { baseBranch: 'main', sha: '...', createdAt: '...' }
// }
```

### Provision a workspace for a task

```typescript
import { provisionTaskWorkspace } from '../../provisioner/src/index.js';

const result = await provisionTaskWorkspace({
  challengeIndex: 7,
  taskTitle: 'Setup Environment',
  repoExternalId: 'MyTwin-Lab/leaderboard',
  repoType: 'github',
  challengeBranchRef: 'refs/heads/challenge/007-admin-experience-update', // optional base branch
});

// result:
// {
//   ref: 'refs/heads/task/007-setup-environment',
//   url: 'https://github.com/MyTwin-Lab/leaderboard/tree/task/007-setup-environment',
//   status: 'ready',
//   ...
// }
```

## Branch naming conventions

| Type | Format | Example |
|------|--------|---------|
| Challenge | `challenge/{index}-{slug}` | `challenge/007-admin-experience-update` |
| Task | `task/{challenge-index}-{slug}` | `task/007-setup-environment` |

Index is zero-padded to 3 digits. Titles are slugified (lowercase, hyphens).

## Where results are stored

Provisioning results are written to the database by the calling API route, not by the provisioner itself:

- **Challenge workspaces** → `challenge_repos` table (`workspace_ref`, `workspace_url`, `workspace_status`, `workspace_meta`)
- **Task workspaces** → `task_workspaces` table (same fields)

The `workspace_ref` (e.g. `refs/heads/task/007-setup-environment`) is later read by `TaskContextService` to locate the branch when running evaluation.

## When provisioning is triggered

| Action | API route | What is created |
|--------|-----------|-----------------|
| Link a repo to a challenge | `POST /api/challenges/:id/repos` | Challenge branch on the repo |
| Assign a contributor to a task | `POST /api/tasks/:id/assign` | Task branch based on the challenge branch |

## Error types

| Error | Cause |
|-------|-------|
| `ProviderNotFoundError` | No provider registered for the given `repoType` |
| `MissingConfigurationError` | Required env var (e.g. `GITHUB_TOKEN`) is missing |
| `ProviderAuthenticationError` | Token is invalid or lacks required scopes |
| `ParentResourceNotFoundError` | The repo or parent branch doesn't exist |
| `WorkspaceAlreadyExistsError` | Branch already exists — not blocking, returns `ready` |

## Adding a new provider

1. Create a class in `src/providers/` implementing `WorkspaceProvider`:

```typescript
export class HuggingFaceProvider implements WorkspaceProvider {
  readonly type = 'huggingface';
  readonly name = 'HuggingFace';

  async provision(request: ProvisionRequest): Promise<ProvisionResult> {
    // create the HuggingFace space/dataset
  }

  async getStatus(parentRef: string, ref: string): Promise<WorkspaceStatus> {
    // check if it already exists
  }
}
```

2. Register it in `src/index.ts`:

```typescript
if (process.env.HUGGINGFACE_TOKEN) {
  ProvisionerRegistry.register(new HuggingFaceProvider());
}
```

3. Add a type mapping in `src/utils.ts` if needed.

## Environment variables

| Variable | Required for |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub branch provider (needs `repo` scope) |
