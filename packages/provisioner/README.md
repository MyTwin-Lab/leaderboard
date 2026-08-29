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
    ├── github-branch.provider.ts  # GitHub branch provider
    └── scaleway-gpu.provider.ts   # Scaleway GPU instance provider
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

### Provision a personal workspace for a contributor (code challenge, `provided_repo` mode)

```typescript
import { provisionContributorWorkspace } from '../../provisioner/src/index.js';

const result = await provisionContributorWorkspace({
  challengeIndex: 15,
  username: 'alice-dupont',
  repoExternalId: 'MyTwin-Lab/leaderboard',
  repoType: 'github',
  challengeBranchRef: 'refs/heads/challenge/007-admin-experience-update', // optional base branch
});

// result:
// {
//   ref: 'refs/heads/contrib/015-alice-dupont',
//   url: 'https://github.com/MyTwin-Lab/leaderboard/tree/contrib/015-alice-dupont',
//   status: 'ready',
//   ...
// }
```

This runs once, when the contributor joins the challenge (`POST /api/challenges/:id/join`) — not per task. The branch is later protected for that contributor only (`provider.protect()`), and its owner keeps working on it directly; it isn't re-provisioned by the task board.

## Branch naming conventions

| Type | Format | Example |
|------|--------|---------|
| Challenge | `challenge/{index}-{slug}` | `challenge/007-admin-experience-update` |
| Contributor (personal, code challenge) | `contrib/{challenge-index}-{username-slug}` | `contrib/015-alice-dupont` |

Index is zero-padded to 3 digits. Titles/usernames are slugified (lowercase, hyphens).

## Where results are stored

Provisioning results are written to the database by the calling API route, not by the provisioner itself:

- **Challenge workspaces** → `challenge_repos` table (`workspace_ref`, `workspace_url`, `workspace_status`, `workspace_meta`)
- **Contributor workspaces** → `challenge_teams` table, on the participation row (`workspace_provider`, `workspace_ref`, `workspace_url`, `workspace_status`)

The `workspace_ref`/`workspace_url` on the participation row is later read by `CodeRewardsService` to locate the branch (mode `provided_repo`) or the contributor's own repo (mode `own_repo`, no provisioning involved) when running the project evaluation.

## When provisioning is triggered

| Action | API route | What is created |
|--------|-----------|-----------------|
| Link a repo to a challenge | `POST /api/challenges/:id/repos` | Challenge branch on the repo |
| Join a `provided_repo` code challenge | `POST /api/challenges/:id/join` | Personal contributor branch, protected for that contributor |

## Scaleway GPU provider

`ScalewayGpuProvider` (type `gpu_instance`) creates temporary GPU instances for the ML compute power feature (contributors on ML challenges requesting a temporary GPU notebook, approved by the challenge manager). It backs `provision`/`getStatus`/`deprovision` the same way `GitHubBranchProvider` does, with two differences:

- **Dynamic credentials, not env-var-at-boot.** Its secret key comes from the DB (`app_settings`, admin-managed, can change at runtime), not `process.env`. It is not registered once in `initializeProviders()` — instead it's constructed and re-registered on every use via `getScalewayProvider()` in `packages/services/compute/scaleway-provider.helper.ts`, so a serverless cold start (which resets the static `initialized` flag anyway) never leaves it stale.
- **`ProvisionResult.secret`.** `provision()` returns the generated one-time instance access token in this field rather than stuffing it into `meta` — callers must never log or forward it to an unauthorized role. `protect()` is not implemented for this provider (see the provider's own doc comment for why).

The higher-level approval workflow (pending/approved/rejected decisions, the 24h timer) lives outside the provisioner, in `packages/services/compute/compute-request.service.ts` — this package is only invoked for the technical leaf: create/poll/destroy the instance.

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
