# database-service

PostgreSQL data layer for the leaderboard. Provides the Drizzle schema, typed domain entities, and repositories for all database operations.

This is the only package that talks to the database directly. Everything else goes through these repositories.

## Structure

```
database-service/
├── db/
│   ├── drizzle.ts          # Schema definitions (source of truth) + DB client
│   └── mappers.ts          # DB rows ↔ domain entity conversions
├── domain/
│   ├── entities.ts         # TypeScript domain types
│   └── schemas_zod.ts      # Zod validation schemas
└── repositories/
    ├── project.repo.ts
    ├── repo.repo.ts
    ├── challenge.repo.ts
    ├── challengeRepos.repo.ts
    ├── challengeTeam.repo.ts
    ├── user.repo.ts
    ├── contribution.repo.ts
    ├── task.repo.ts
    ├── taskAssignee.repo.ts
    ├── taskWorkspace.repo.ts
    ├── evaluationGrids.repo.ts
    ├── evaluationRuns.repo.ts
    ├── evaluationRunContributions.repo.ts
    ├── syncMeeting.repo.ts
    ├── meetingParticipant.repo.ts
    ├── meetingAnalysis.repo.ts
    ├── onboardingProgress.repo.ts
    ├── refresh-token.repo.ts
    └── index.ts             # Re-exports all repositories
```

## Domain entities

Key TypeScript types (defined in `domain/entities.ts`):

```typescript
interface User {
  uuid: string;
  full_name: string;
  email: string;
  google_user_id?: string;
  github_username?: string;
  role: 'admin' | 'contributor';
  avatar_url?: string;
  created_at: Date;
}

interface Project {
  uuid: string;
  title: string;
  description?: string;
  created_at: Date;
}

interface Challenge {
  uuid: string;
  index: number;
  title: string;
  description?: string;
  status: string;
  start_date: Date;
  end_date: Date;
  contribution_points_reward: number;
  project_id: string;
}

interface Task {
  uuid: string;
  title: string;
  description?: string;
  type: string;            // 'code' | 'model' | 'dataset' | 'docs'
  status: string;          // 'todo' | 'in_progress' | 'done'
  challenge_id: string;
}

interface Contribution {
  uuid: string;
  title: string;
  type: string;
  description?: string;
  evaluation?: Record<string, unknown>; // JSON: { scores, globalScore }
  tags?: string[];
  reward: number;
  user_id: string;
  challenge_id: string;
  task_id?: string;
  submitted_at?: Date;
}
```

## Repositories

All repositories are exported from `repositories/index.ts` and follow a standard CRUD pattern:

```typescript
class ExampleRepository {
  async findAll(): Promise<Entity[]>
  async findById(uuid: string): Promise<Entity | null>
  async create(data: CreateInput): Promise<Entity>
  async update(uuid: string, data: Partial<Entity>): Promise<Entity>
  async delete(uuid: string): Promise<void>
}
```

### Notable specialized methods

**`UserRepository`**
```typescript
findByEmail(email: string): Promise<User | null>
findByGoogleUserId(googleUserId: string): Promise<User | null>
findByGithubUsername(username: string): Promise<User | null>
```

**`ContributionRepository`**
```typescript
findByChallenge(challengeId: string): Promise<Contribution[]>
findByUser(userId: string): Promise<Contribution[]>
findByTaskAndUser(taskId: string, userId: string): Promise<Contribution | null>
// findByTaskAndUser is used by TaskEvaluationService for upsert logic
```

**`TaskRepository`**
```typescript
findByChallenge(challengeId: string): Promise<Task[]>
findAssignees(taskId: string): Promise<User[]>
```

**`TaskWorkspaceRepository`**
```typescript
findByTask(taskId: string): Promise<TaskWorkspace[]>
// Returns workspace branches used by TaskEvaluationService
```

**`EvaluationGridsRepository`**
```typescript
findActive(type: string): Promise<EvaluationGrid | null>
// Used by DatabaseGridProvider to override built-in grids
```

**`OnboardingProgressRepository`**
```typescript
initForUser(userId: string): Promise<void>
// Called automatically when a new user registers via Google OAuth
```

**`RefreshTokenRepository`**
```typescript
create(data): Promise<void>
deleteByHash(hash: string): Promise<void>
deleteAllByUserId(userId: string): Promise<void>
```

## Usage

```typescript
import {
  UserRepository,
  TaskRepository,
  ContributionRepository,
} from '../../database-service/repositories/index.js';

const userRepo = new UserRepository();
const taskRepo = new TaskRepository();
const contributionRepo = new ContributionRepository();

const user = await userRepo.findByGoogleUserId('google-id-123');
const tasks = await taskRepo.findByChallenge(challengeId);
const existing = await contributionRepo.findByTaskAndUser(taskId, userId);
```

## Mappers

`db/mappers.ts` converts between raw Drizzle DB rows and typed domain entities. Always use mappers rather than consuming raw DB rows directly — they handle `null` vs `undefined` normalization and date conversion.

## Environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mytwin_leaderboard
```

The DB client is initialized once in `db/drizzle.ts` and reused across all repositories.
