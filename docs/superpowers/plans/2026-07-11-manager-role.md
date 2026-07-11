# Manager Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-scoped manager role that lets designated contributors access a rich challenge management view (meetings, documents, repos, status) without needing the admin role.

**Architecture:** A nullable `manager_id` FK on the `projects` table points to a user. A shared `isManagerOfChallenge` server helper resolves manager status per API call. The manager view is a copy of `/admin/challenges/[id]/page.tsx` placed at `/challenges/[id]/manage/page.tsx` with a client-side auth redirect. The public challenges page gains a "Manage" filter tab and a click popup for managed challenges.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (PostgreSQL), `drizzle-kit push`, `jose` JWT, React client components, Tailwind CSS.

## Global Constraints

- `manager_id` is nullable — a project may have no manager.
- One manager per project; a user can be manager of multiple projects.
- Manager cannot access `/admin/` pages.
- Manager can: change challenge status, create meetings, add/delete documents, create repos.
- The proxy runs at Edge (no DB access) — all manager authorization is in route handlers via `isManagerOfChallenge`.
- Auth helpers from `@/lib/auth`: use `verifyRequestToken(request)` for Request-based routes, `getSessionUser()` for cookie-based server routes.
- `drizzle-kit push` (not migrate) applies schema changes — run `npm run db:push` from the workspace root after Task 1.
- All new files live under `apps/leaderboard-client/src/` unless otherwise noted.
- Use `@/` path alias for imports within the Next.js app (`src/` root).

---

### Task 1: DB schema + data layer

**Files:**
- Modify: `packages/database-service/db/drizzle.ts`
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/db/mappers.ts`
- Modify: `packages/database-service/domain/schemas_zod.ts`
- Modify: `packages/database-service/repositories/project.repo.ts`

**Interfaces:**
- Produces: `Project.manager_id?: string`, `ProjectRepository.findByManagerId(userId: string): Promise<Project[]>`

- [ ] **Step 1: Read the files you will modify**

Read each file before editing:
- `packages/database-service/db/drizzle.ts` — find the `projects` table definition
- `packages/database-service/domain/entities.ts` — find the `Project` interface
- `packages/database-service/db/mappers.ts` — find `toDomainProject` and `toDbProject`
- `packages/database-service/domain/schemas_zod.ts` — find `projectSchema`
- `packages/database-service/repositories/project.repo.ts` — read entire file

- [ ] **Step 2: Add `manager_id` column to the projects table in `drizzle.ts`**

Find the `projects` table definition (it looks like `export const projects = pgTable("projects", { ... })`). Add `manager_id` as the last column inside the object, before the closing `})`:

```ts
manager_id: uuid("manager_id").references(() => users.uuid, { onDelete: "set null" }),
```

The full table should now include: `uuid`, `title`, `description`, `created_at`, `manager_id`.

> **Important:** `users` must be defined before `projects` in the file for this forward reference to work. Verify the order — if not, move the `projects` table definition after `users`.

- [ ] **Step 3: Update `Project` interface in `entities.ts`**

Find `export interface Project` and add the optional field:

```ts
export interface Project {
  uuid: string;
  title: string;
  description?: string;
  manager_id?: string;   // FK → users.uuid, nullable
  created_at: Date;
}
```

- [ ] **Step 4: Update mappers in `mappers.ts`**

In `toDomainProject`, add the `manager_id` mapping:
```ts
manager_id: row.manager_id ?? undefined,
```

In `toDbProject`, add the `manager_id` mapping:
```ts
manager_id: entity.manager_id ?? null,
```

- [ ] **Step 5: Update `projectSchema` in `schemas_zod.ts`**

Find `projectSchema` and add the optional field:
```ts
manager_id: z.string().uuid().nullable().optional(),
```

- [ ] **Step 6: Update `project.repo.ts` — support `manager_id` in `update` and add `findByManagerId`**

In the `update` method, after the existing `if (validated.description !== undefined)` block, add:
```ts
if (validated.manager_id !== undefined) dbData.manager_id = validated.manager_id; // null clears, string sets
```

Add the new method at the end of the class (before the closing `}`):
```ts
async findByManagerId(userId: string): Promise<Project[]> {
  const rows = await db.select().from(projects).where(eq(projects.manager_id, userId));
  return rows.map(toDomainProject);
}
```

- [ ] **Step 7: Apply schema change to DB**

Run from the workspace root:
```bash
npm run db:push
```

Expected output: Drizzle prints the ALTER TABLE statement for `projects` adding the `manager_id` column, then `All changes applied`.

- [ ] **Step 8: Verify the column exists**

Open a DB client (psql or any GUI) and run:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'manager_id';
```

Expected: one row — `manager_id | uuid | YES`.

- [ ] **Step 9: Commit**

```bash
git add packages/database-service/db/drizzle.ts packages/database-service/domain/entities.ts packages/database-service/db/mappers.ts packages/database-service/domain/schemas_zod.ts packages/database-service/repositories/project.repo.ts
git commit -m "feat: add manager_id to projects — DB schema, entity, mapper, repo"
```

---

### Task 2: `isManagerOfChallenge` helper + update `/api/contributors/me`

**Files:**
- Create: `apps/leaderboard-client/src/lib/server/managerAuth.ts`
- Modify: `apps/leaderboard-client/src/app/api/contributors/me/route.ts`

**Interfaces:**
- Consumes: `repositories.challenge.findById`, `repositories.project.findById` (from `@/lib/db`), `Project.manager_id` (Task 1)
- Produces: `isManagerOfChallenge(userId: string, challengeId: string): Promise<boolean>`, `GET /api/contributors/me` returns `{ user, managedProjectIds: string[] }`

- [ ] **Step 1: Read `apps/leaderboard-client/src/app/api/contributors/me/route.ts`**

Confirm it uses `getSessionUser()` and currently returns `{ user: session }`.

- [ ] **Step 2: Create `managerAuth.ts`**

Create `apps/leaderboard-client/src/lib/server/managerAuth.ts` with this exact content:

```ts
import "server-only";
import { repositories } from "@/lib/db";

export async function isManagerOfChallenge(
  userId: string,
  challengeId: string
): Promise<boolean> {
  const challenge = await repositories.challenge.findById(challengeId);
  if (!challenge) return false;
  const project = await repositories.project.findById(challenge.project_id);
  return project?.manager_id === userId;
}
```

- [ ] **Step 3: Update `GET /api/contributors/me`**

Replace the `GET` handler in `apps/leaderboard-client/src/app/api/contributors/me/route.ts`. Add `ProjectRepository` import and fetch managed projects:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { UserRepository, ProjectRepository } from "../../../../../../../packages/database-service/repositories";

const userRepo = new UserRepository();
const projectRepo = new ProjectRepository();

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const managedProjects = await projectRepo.findByManagerId(session.id);
  return NextResponse.json({
    user: session,
    managedProjectIds: managedProjects.map(p => p.uuid),
  });
}
```

Keep the existing `PATCH` handler unchanged below this.

- [ ] **Step 4: Test manually**

Start the dev server. Log in as a contributor. Open the browser console and run:
```js
fetch('/api/contributors/me').then(r => r.json()).then(console.log)
```

Expected: `{ user: { id: "...", role: "contributor", ... }, managedProjectIds: [] }` (empty array since no projects have this user as manager yet).

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/lib/server/managerAuth.ts apps/leaderboard-client/src/app/api/contributors/me/route.ts
git commit -m "feat: add isManagerOfChallenge helper and managedProjectIds to /api/contributors/me"
```

---

### Task 3: `GET /api/challenges?managed=true`

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/route.ts`

**Interfaces:**
- Consumes: `ProjectRepository.findByManagerId` (Task 1), `ChallengeRepository.findAll`
- Produces: `GET /api/challenges?managed=true` → `Challenge[]` (including drafts, filtered to managed projects)

- [ ] **Step 1: Read `apps/leaderboard-client/src/app/api/challenges/route.ts`**

Confirm the current `GET` handler calls `challengeRepo.findAll()` with no filtering.

- [ ] **Step 2: Add the `?managed=true` branch to the `GET` handler**

At the top of the `GET` handler (after `try {`), insert this block before the existing `findAll()` call:

```ts
export async function GET(request: NextRequest) {
  try {
    const managedParam = request.nextUrl.searchParams.get('managed');
    if (managedParam === 'true') {
      const token = request.cookies.get('access_token')?.value;
      if (!token) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      const { jwtVerify } = await import('jose');
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      let payload: any;
      try {
        const result = await jwtVerify(token, secret);
        payload = result.payload;
      } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      const userId = payload.userId as string;
      const managedProjects = await projectRepo.findByManagerId(userId);
      const projectIds = new Set(managedProjects.map((p: any) => p.uuid));
      const all = await challengeRepo.findAll();
      return NextResponse.json(all.filter(c => projectIds.has(c.project_id)));
    }

    // existing code:
    const challenges = await challengeRepo.findAll();
    return NextResponse.json(challenges);
  // ...
```

Also add `ProjectRepository` import and `projectRepo` instance at the top of the file:
```ts
import { ProjectRepository } from '../../../../../../packages/database-service/repositories';
const projectRepo = new ProjectRepository();
```

Note: The `GET` function signature must change from `export async function GET()` to `export async function GET(request: NextRequest)` to accept the request parameter.

- [ ] **Step 3: Test manually**

Log in as a contributor who is NOT a manager. Run:
```js
fetch('/api/challenges?managed=true').then(r => r.json()).then(console.log)
```
Expected: `[]` (no managed projects).

Then in DB, set `manager_id` of any project to this user's UUID:
```sql
UPDATE projects SET manager_id = '<your-user-uuid>' WHERE uuid = '<any-project-uuid>';
```

Run the fetch again — expect the challenges for that project to appear, including any drafts.

Reset: `UPDATE projects SET manager_id = NULL WHERE uuid = '<project-uuid>';`

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/route.ts
git commit -m "feat: add ?managed=true filter to GET /api/challenges"
```

---

### Task 4: Proxy exceptions for manager-accessible routes

**Files:**
- Modify: `apps/leaderboard-client/src/proxy.ts`

**Interfaces:**
- Consumes: existing `isTaskSelfServiceRoute`, `isMLContributorRoute`, `isChallengeJoinRoute` variables
- Produces: `isManagerAccessibleRoute` exception that passes through the proxy; actual authorization stays in route handlers

- [ ] **Step 1: Read `apps/leaderboard-client/src/proxy.ts`**

Find the block around line 106-126 that defines `isTaskSelfServiceRoute`, `isMLContributorRoute`, `isChallengeJoinRoute`, and the `if (['POST', 'PUT', ...])` guard.

- [ ] **Step 2: Add `isManagerAccessibleRoute` alongside the other exceptions**

After the `isChallengeJoinRoute` declaration, add:

```ts
// Routes accessible to managers (authorization enforced in route handlers)
const isManagerAccessibleRoute =
  (pathname.match(/^\/api\/challenges\/[^/]+$/) !== null && ['PUT', 'PATCH'].includes(method)) ||
  (pathname.startsWith('/api/repos') && ['POST', 'PUT'].includes(method)) ||
  pathname.includes('/documents');
```

Update the guard condition to include `!isManagerAccessibleRoute`:

```ts
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && payload.role !== 'admin') {
  if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isManagerAccessibleRoute) {
    return NextResponse.json(
      { error: 'Admin role required for this action' },
      { status: 403 }
    );
  }
}
```

- [ ] **Step 3: Test proxy passes the routes through**

Start dev server. Log in as contributor. Attempt `PUT /api/challenges/<any-uuid>` with `{ "status": "active" }`:
```js
fetch('/api/challenges/<uuid>', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status:'active'}) }).then(r => console.log(r.status))
```

Expected: `403` (from route handler, NOT from proxy — the proxy now lets it through but the route handler will reject non-managers). Before this change it would have been `403` from the proxy message "Admin role required for this action" — after, the 403 message changes to "Forbidden" (route handler wording added in Task 5).

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/proxy.ts
git commit -m "feat: add proxy exceptions for manager-accessible routes"
```

---

### Task 5: Route handler authorization updates

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/documents/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/documents/[docId]/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/sync-meetings/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/repos/route.ts`

**Interfaces:**
- Consumes: `isManagerOfChallenge` (Task 2), `verifyRequestToken`, `getSessionUser` from `@/lib/auth`, `ProjectRepository.findById` (Task 1)

- [ ] **Step 1: Update `PUT /api/challenges/[id]/route.ts` — add auth + manager check**

The current `PUT` handler has no authentication at all. Replace it entirely:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';
import { isManagerOfChallenge } from '@/lib/server/managerAuth';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();

const updateChallengeSchema = z.object({
  title: z.string().min(1).optional(),
  status: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
  roadmap: z.string().optional(),
  contribution_points_reward: z.number().int().nonnegative().optional(),
  project_id: z.string().uuid().optional(),
});

// GET /api/challenges/[id] - Récupérer un challenge
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const challenge = await challengeRepo.findById(id);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    return NextResponse.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 });
  }
}

// PUT /api/challenges/[id] - Mettre à jour un challenge (admin or manager)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { id } = await params;
    if (payload.role !== 'admin') {
      const isManager = await isManagerOfChallenge(payload.userId, id);
      if (!isManager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const body = await request.json();
    const validated = updateChallengeSchema.parse(body);
    const updateData: any = { ...validated };
    if (validated.start_date) updateData.start_date = new Date(validated.start_date);
    if (validated.end_date) updateData.end_date = new Date(validated.end_date);
    const challenge = await challengeRepo.update(id, updateData);
    return NextResponse.json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error updating challenge:', error);
    return NextResponse.json({ error: 'Failed to update challenge' }, { status: 500 });
  }
}

// DELETE /api/challenges/[id] - Supprimer un challenge (admin only — no change)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await challengeRepo.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    return NextResponse.json({ error: 'Failed to delete challenge' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update `POST /api/challenges/[id]/documents/route.ts` — allow managers**

In the `POST` handler, change the existing auth check from:
```ts
if (!user || user.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

To:
```ts
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
if (user.role !== 'admin') {
  const { isManagerOfChallenge } = await import('@/lib/server/managerAuth');
  const isManager = await isManagerOfChallenge(user.id, id);
  if (!isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

Note: `id` comes from `const { id } = await params;` which is already in the handler. Move the `await params` call to before this check.

The complete updated `POST` handler:

```ts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    if (user.role !== 'admin') {
      const { isManagerOfChallenge } = await import('@/lib/server/managerAuth');
      const isManager = await isManagerOfChallenge(user.id, id);
      if (!isManager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const body = await req.json();
    const { filename, content } = body as { filename?: string; content?: string };
    if (!filename || typeof filename !== 'string' || !filename.endsWith('.md')) {
      return NextResponse.json({ error: 'Only .md files are allowed' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (content.length > 500_000) {
      return NextResponse.json({ error: 'File too large (max 500KB)' }, { status: 400 });
    }
    const doc = await docRepo.create({
      challenge_id: id,
      filename,
      content,
      uploaded_by: user.id,
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('Error creating document:', err);
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Update `DELETE /api/challenges/[id]/documents/[docId]/route.ts` — allow managers**

Same pattern. Change:
```ts
if (!user || user.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

To:
```ts
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const { id } = await params; // move this up, before auth check
if (user.role !== 'admin') {
  const { isManagerOfChallenge } = await import('@/lib/server/managerAuth');
  const isManager = await isManagerOfChallenge(user.id, id);
  if (!isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

The complete updated handler (replace the full file content):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ChallengeDocumentRepository } from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const docRepo = new ChallengeDocumentRepository();

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id, docId } = await params;
    if (user.role !== 'admin') {
      const { isManagerOfChallenge } = await import('@/lib/server/managerAuth');
      const isManager = await isManagerOfChallenge(user.id, id);
      if (!isManager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    const doc = await docRepo.findById(docId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (doc.challenge_id !== id) {
      return NextResponse.json({ error: 'Document does not belong to this challenge' }, { status: 400 });
    }
    await docRepo.delete(docId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error deleting document:', err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Update `POST /api/sync-meetings/route.ts` — allow managers**

The current `POST` uses `verifyAdmin(request)`. Replace with a manager-aware check:

```ts
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[SyncMeetings][POST] Raw body:', body);
    const parsed = createMeetingSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[SyncMeetings][POST] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const validated = parsed.data;

    // Admin or manager of the challenge's project
    if (payload.role !== 'admin') {
      const { isManagerOfChallenge } = await import('@/lib/server/managerAuth');
      const isManager = await isManagerOfChallenge(payload.userId, validated.challenge_id);
      if (!isManager) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const syncMeetingService = new SyncMeetingService();
    const meeting = await syncMeetingService.createMeeting({
      title: validated.title,
      description: validated.description,
      challenge_id: validated.challenge_id,
      start_time: new Date(validated.start_time),
      end_time: new Date(validated.end_time),
      meet_link: validated.meet_link,
      created_by: payload.userId,
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('[SyncMeetings] POST error:', error);
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 });
  }
}
```

Also update the import: `verifyAdmin` is no longer used — replace it with `verifyRequestToken`:
```ts
import { verifyRequestToken } from '@/lib/auth';
```

- [ ] **Step 5: Update `POST /api/repos/route.ts` — add auth + manager check**

The current `POST` has no auth. Add auth and a project-manager check:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { RepoRepository, ProjectRepository } from '../../../../../../packages/database-service/repositories';
import { verifyRequestToken } from '@/lib/auth';
import { z } from 'zod';

const repoRepo = new RepoRepository();
const projectRepo = new ProjectRepository();

const createRepoSchema = z.object({
  title: z.string().min(1),
  type: z.string(),
  external_repo_id: z.string().optional(),
  project_id: z.string().uuid(),
});

// GET /api/repos - Liste tous les repos
export async function GET() {
  try {
    const repos = await repoRepo.findAll();
    return NextResponse.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error);
    return NextResponse.json({ error: 'Failed to fetch repos' }, { status: 500 });
  }
}

// POST /api/repos - Créer un nouveau repo (admin or project manager)
export async function POST(request: NextRequest) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createRepoSchema.parse(body);

    if (payload.role !== 'admin') {
      const project = await projectRepo.findById(validated.project_id);
      if (project?.manager_id !== payload.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const repo = await repoRepo.create(validated);
    return NextResponse.json(repo, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating repo:', error);
    return NextResponse.json({ error: 'Failed to create repo' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Test all route handlers**

For each handler, test with a contributor account (no manager assignment yet — all should return 403) and with an admin account (all should succeed):

```js
// As contributor — should get 403 "Forbidden" for challenge that exists
fetch('/api/challenges/<challenge-uuid>', {
  method: 'PUT',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({status:'active'})
}).then(r => r.json()).then(console.log)
// Expected: { error: 'Forbidden' }
```

- [ ] **Step 7: Commit**

```bash
git add apps/leaderboard-client/src/app/api/challenges/[id]/route.ts apps/leaderboard-client/src/app/api/challenges/[id]/documents/route.ts "apps/leaderboard-client/src/app/api/challenges/[id]/documents/[docId]/route.ts" apps/leaderboard-client/src/app/api/sync-meetings/route.ts apps/leaderboard-client/src/app/api/repos/route.ts
git commit -m "feat: add manager authorization to challenge, documents, meetings, repos API routes"
```

---

### Task 6: Manager view page

**Files:**
- Create: `apps/leaderboard-client/src/app/challenges/[id]/manage/page.tsx`

**Interfaces:**
- Consumes: `GET /api/contributors/me` → `managedProjectIds` (Task 2), `GET /api/challenges/[id]` → `challenge.project_id`
- Produces: `/challenges/[id]/manage` route accessible to authenticated managers

- [ ] **Step 1: Read the source file to copy**

Read `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx` in full.

- [ ] **Step 2: Create the manager view page**

Create `apps/leaderboard-client/src/app/challenges/[id]/manage/page.tsx` as a literal copy of the admin page, then apply these three targeted changes:

**Change 1:** Rename the exported default function from `ChallengeManagerPage` to avoid name conflict — rename it to `ManagerViewPage`:
```ts
export default function ManagerViewPage() {
```

**Change 2:** Add a manager auth check. In the component body, after the existing state declarations, add a new `useEffect` that checks manager status once the challenge is loaded:

```ts
// Add this state at the top with the others:
const [authChecked, setAuthChecked] = useState(false);

// Add this useEffect after the existing useEffect({ if (challengeId) fetchAll() }):
useEffect(() => {
  if (!challenge) return;
  fetch('/api/contributors/me')
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d) { router.replace(`/challenges/${challengeId}`); return; }
      const managed: string[] = d.managedProjectIds ?? [];
      if (!managed.includes(challenge.project_id)) {
        router.replace(`/challenges/${challengeId}`);
      } else {
        setAuthChecked(true);
      }
    })
    .catch(() => router.replace(`/challenges/${challengeId}`));
}, [challenge]);
```

**Change 3:** Add a guard so the page renders nothing until the auth check passes (prevents flash of content):

In the return statement, before the existing `if (loading) return <Skeleton />;`, add:
```ts
if (!authChecked && !loading) return null;
```

Actually place it right after the `if (!challenge)` check:
```ts
if (loading) return <Skeleton />;
if (!challenge) return (
  <div className="flex items-center justify-center py-32 text-sm text-white/40">Challenge not found.</div>
);
if (!authChecked) return null;
```

Everything else in the file remains identical to the admin version.

- [ ] **Step 3: Verify the route is accessible**

Start dev server. Log in as contributor. Navigate to `/challenges/<any-challenge-id>/manage`. Expected: redirected to `/challenges/<id>` (not a manager yet).

Then in DB, set a project's `manager_id` to this user's UUID. Navigate again to `/challenges/<challenge-id>/manage` (where the challenge belongs to that project). Expected: the full manager page renders.

- [ ] **Step 4: Commit**

```bash
git add "apps/leaderboard-client/src/app/challenges/[id]/manage/page.tsx"
git commit -m "feat: add manager view page at /challenges/[id]/manage"
```

---

### Task 7: Challenges page — Manage filter + click popup

**Files:**
- Modify: `apps/leaderboard-client/src/lib/server/publicPages.ts`
- Modify: `apps/leaderboard-client/src/app/challenges/page.tsx`
- Modify: `apps/leaderboard-client/src/components/public/ChallengeCard.tsx`
- Modify: `apps/leaderboard-client/src/components/public/ProjectChallengesExplorer.tsx`
- Modify: `apps/leaderboard-client/src/components/public/ChallengesFiltersBar.tsx`
- Create: `apps/leaderboard-client/src/components/challenges/ManagerRolePopup.tsx`

**Interfaces:**
- Consumes: `GET /api/contributors/me` → `managedProjectIds` (Task 2), `Project.manager_id` (Task 1)
- Produces: "Manage" filter tab visible when user manages ≥1 project; click popup on managed challenge cards

- [ ] **Step 1: Read all files you will modify**

Read each file:
- `apps/leaderboard-client/src/lib/server/publicPages.ts`
- `apps/leaderboard-client/src/app/challenges/page.tsx`
- `apps/leaderboard-client/src/components/public/ChallengeCard.tsx`
- `apps/leaderboard-client/src/components/public/ProjectChallengesExplorer.tsx`
- `apps/leaderboard-client/src/components/public/ChallengesFiltersBar.tsx`

- [ ] **Step 2: Update `publicPages.ts` — include drafts for managed projects**

Update the `fetchProjectsWithChallenges` signature and the draft filter:

```ts
export async function fetchProjectsWithChallenges(
  userId?: string | null,
  isAdmin = false,
  managedProjectIds: string[] = [],
): Promise<ChallengesPageData> {
```

Change the draft filter line from:
```ts
.filter((challenge) => isAdmin || challenge.status !== 'draft')
```
To:
```ts
.filter((challenge) =>
  isAdmin ||
  challenge.status !== 'draft' ||
  managedProjectIds.includes(challenge.project_id)
)
```

- [ ] **Step 3: Update `challenges/page.tsx` — fetch managed projects server-side**

Add `repositories` import and `managedProjectIds` fetch. The full updated file:

```ts
import { ProjectChallengesExplorer } from "@/components/public/ProjectChallengesExplorer";
import { fetchProjectsWithChallenges } from "@/lib/server/publicPages";
import { getSessionUser } from "@/lib/auth";
import { repositories } from "@/lib/db";

export const metadata = {
  title: "Challenges publics",
  description: "Découvrez les projets en cours et les challenges ouverts du Lab",
};

export default async function PublicChallengesPage() {
  const session = await getSessionUser();
  const isAdmin = session?.role === 'admin';
  const managedProjectIds = session?.id
    ? (await repositories.project.findByManagerId(session.id)).map(p => p.uuid)
    : [];
  const { projects, joinedChallengeIds } = await fetchProjectsWithChallenges(
    session?.id,
    isAdmin,
    managedProjectIds,
  );

  return (
    <div className="space-y-6">
      <ProjectChallengesExplorer
        projects={projects}
        joinedChallengeIds={joinedChallengeIds}
        isAdmin={isAdmin}
        managedProjectIds={managedProjectIds}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update `ChallengeCard.tsx` — add optional `onCustomClick` prop**

Read the current file to understand its internal navigation. Add an optional prop `onCustomClick?: (e: React.MouseEvent) => void`. When this prop is provided, use it instead of the default navigation.

Find where the card handles its click (likely a wrapping element with `onClick` or a `useRouter` call). Add the prop to the interface:

```ts
interface ChallengeCardProps {
  // ... existing props ...
  onCustomClick?: (e: React.MouseEvent) => void;
}
```

In the click handler of the card's root element, change:
```ts
onClick={() => router.push(`/challenges/${challengeId}`)}
```
To:
```ts
onClick={(e) => onCustomClick ? onCustomClick(e) : router.push(`/challenges/${challengeId}`)}
```

If the card uses a `<Link>` component instead, wrap it with an intercepting `<div onClick>` only when `onCustomClick` is provided, or replace `<Link>` with a `<div>` + `onClick` when the prop is present.

- [ ] **Step 5: Create `ManagerRolePopup.tsx`**

Create `apps/leaderboard-client/src/components/challenges/ManagerRolePopup.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Shield } from 'lucide-react';

interface ManagerRolePopupProps {
  x: number;
  y: number;
  challengeId: string;
  onClose: () => void;
}

export function ManagerRolePopup({ x, y, challengeId, onClose }: ManagerRolePopupProps) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const navigate = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: y, left: x, zIndex: 9999 }}
      className="w-52 rounded-xl border border-white/10 bg-[#0d1117] p-1.5 shadow-2xl shadow-black/60"
    >
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
        Open as…
      </p>
      <button
        onClick={() => navigate(`/challenges/${challengeId}`)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
      >
        <User className="h-3.5 w-3.5 shrink-0 text-white/30" />
        Contributor
      </button>
      <button
        onClick={() => navigate(`/challenges/${challengeId}/manage`)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-brandCP/[0.08] hover:text-brandCP"
      >
        <Shield className="h-3.5 w-3.5 shrink-0 text-brandCP/60" />
        Manager
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Update `ProjectChallengesExplorer.tsx` — add Manage filter + popup**

Key changes:

**a) Add `managedProjectIds` prop:**
```ts
interface ProjectChallengesExplorerProps {
  projects: ProjectWithChallenges[];
  joinedChallengeIds: string[];
  isAdmin?: boolean;
  managedProjectIds?: string[];
}
```

**b) Update `StatusFilter` type:**
```ts
type StatusFilter = 'all' | 'active' | 'completed' | 'draft' | 'manage';
```

**c) Add popup state:**
```ts
const [popup, setPopup] = useState<{ x: number; y: number; challengeId: string } | null>(null);
```

**d) Update `filteredChallenges` to handle `'manage'` filter:**
```ts
const filteredChallenges = useMemo(() => {
  return allChallenges.filter((challenge) => {
    const matchesSearch =
      searchTerm === "" ||
      challenge.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      challenge.projectName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject =
      selectedProjectId === "all" || challenge.projectId === selectedProjectId;
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "manage"
        ? (managedProjectIds ?? []).includes(challenge.projectId)
        : challenge.status === statusFilter;
    return matchesSearch && matchesProject && matchesStatus;
  });
}, [allChallenges, searchTerm, selectedProjectId, statusFilter, managedProjectIds]);
```

**e) Add click handler for managed challenges:**
```ts
const handleChallengeClick = (challenge: FlatChallenge, e: React.MouseEvent) => {
  if ((managedProjectIds ?? []).includes(challenge.projectId)) {
    setPopup({ x: e.clientX, y: e.clientY, challengeId: challenge.id });
  }
  // If not managed, ChallengeCard handles navigation internally (no onCustomClick passed)
};
```

**f) Update the `ChallengesFiltersBar` call to pass `hasManaged`:**
```tsx
<ChallengesFiltersBar
  projects={projectOptions}
  onSearchChange={setSearchTerm}
  onProjectChange={setSelectedProjectId}
  onStatusChange={setStatusFilter}
  isAdmin={isAdmin}
  hasManaged={(managedProjectIds ?? []).length > 0}
  rightSlot={...}
/>
```

**g) Update `ChallengeCard` instances to use the click handler for managed challenges:**
```tsx
<ChallengeCard
  key={challenge.id}
  // ... existing props ...
  onCustomClick={(managedProjectIds ?? []).includes(challenge.projectId)
    ? (e) => handleChallengeClick(challenge, e)
    : undefined
  }
/>
```

**h) Add `ManagerRolePopup` rendering (outside the card grid, at the bottom of the component's return):**
```tsx
import { ManagerRolePopup } from '@/components/challenges/ManagerRolePopup';

// At end of return statement, after the cards grid:
{popup && (
  <ManagerRolePopup
    x={popup.x}
    y={popup.y}
    challengeId={popup.challengeId}
    onClose={() => setPopup(null)}
  />
)}
```

- [ ] **Step 7: Update `ChallengesFiltersBar.tsx` — add Manage button**

Read the current file. Find the status filter buttons (All, Active, Completed, Draft). Add `hasManaged?: boolean` to the props interface. Render the "Manage" button only when `hasManaged` is true, using the same style as the other status buttons:

```tsx
{hasManaged && (
  <button
    onClick={() => onStatusChange('manage')}
    className={/* same className pattern as other status buttons */}
  >
    Manage
  </button>
)}
```

Match the exact className of the existing filter buttons, toggling active state when `currentStatus === 'manage'`.

- [ ] **Step 8: Test the full flow**

1. Log in as contributor. Go to `/challenges/`. Confirm no "Manage" tab appears.
2. In DB: `UPDATE projects SET manager_id = '<contributor-uuid>' WHERE uuid = '<project-uuid>';`
3. Reload `/challenges/`. Confirm "Manage" tab now appears.
4. Click "Manage" tab — confirm only challenges from that project show (including drafts).
5. Click one of those challenge cards — confirm the popup appears with "Contributor" and "Manager" options.
6. Click "Manager" — confirm navigation to `/challenges/<id>/manage` with the full manager UI.
7. Click "Contributor" — confirm navigation to `/challenges/<id>` with the regular contributor UI.

- [ ] **Step 9: Commit**

```bash
git add apps/leaderboard-client/src/lib/server/publicPages.ts apps/leaderboard-client/src/app/challenges/page.tsx apps/leaderboard-client/src/components/public/ChallengeCard.tsx apps/leaderboard-client/src/components/public/ProjectChallengesExplorer.tsx apps/leaderboard-client/src/components/public/ChallengesFiltersBar.tsx apps/leaderboard-client/src/components/challenges/ManagerRolePopup.tsx
git commit -m "feat: add Manage filter tab and manager role popup to challenges page"
```

---

### Task 8: Admin UI — project manager assignment

**Files:**
- Modify: `apps/leaderboard-client/src/components/admin/ProjectForm.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/ProjectList.tsx`
- Modify: `apps/leaderboard-client/src/app/admin/projects/page.tsx`
- Modify: `apps/leaderboard-client/src/app/api/projects/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/projects/[id]/route.ts`

**Interfaces:**
- Consumes: `GET /api/users` → all users (filter client-side to `role === 'contributor'`), `Project.manager_id` (Task 1)
- Produces: Admin can assign a manager to a project; manager name shown in project list

- [ ] **Step 1: Read all files you will modify**

Read each file:
- `apps/leaderboard-client/src/components/admin/ProjectForm.tsx`
- `apps/leaderboard-client/src/components/admin/ProjectList.tsx`
- `apps/leaderboard-client/src/app/admin/projects/page.tsx`
- `apps/leaderboard-client/src/app/api/projects/route.ts`
- `apps/leaderboard-client/src/app/api/projects/[id]/route.ts`

- [ ] **Step 2: Update `api/projects/route.ts` — accept `manager_id` on POST**

In the Zod schema for project creation, add:
```ts
manager_id: z.string().uuid().nullable().optional(),
```

In the `create` call, pass `manager_id`:
```ts
const project = await projectRepo.create({
  title: validated.title,
  description: validated.description,
  manager_id: validated.manager_id ?? undefined,
});
```

- [ ] **Step 3: Update `api/projects/[id]/route.ts` — accept `manager_id` on PUT**

Read the file. In the update Zod schema, add:
```ts
manager_id: z.string().uuid().nullable().optional(),
```

In the `update` call, pass `manager_id`:
```ts
const project = await projectRepo.update(id, {
  title: validated.title,
  description: validated.description,
  manager_id: validated.manager_id === null ? undefined : validated.manager_id,
});
```

Wait — the repo's `update` method checks `if ('manager_id' in validated)` to allow setting null. So pass:
```ts
const updates: any = {};
if (validated.title) updates.title = validated.title;
if (validated.description !== undefined) updates.description = validated.description;
if (validated.manager_id !== undefined) updates.manager_id = validated.manager_id; // null clears, string sets
```

- [ ] **Step 4: Update `ProjectForm.tsx` — add manager picker**

The full updated component:

```tsx
'use client';

import { useState } from 'react';
import { FormField, FormFooter, inputClass } from '@/components/ui/FormField';
import { InitialsAvatar } from '@/components/ui/InitialsAvatar';
import type { Project } from '../../../../../packages/database-service/domain/entities';

interface Contributor {
  uuid: string;
  full_name: string;
  avatar_url?: string;
}

interface ProjectFormProps {
  project?: Project;
  contributors: Contributor[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ProjectForm({ project, contributors, onSubmit, onCancel }: ProjectFormProps) {
  const [formData, setFormData] = useState({
    title: project?.title ?? '',
    description: project?.description ?? '',
    manager_id: project?.manager_id ?? '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      manager_id: formData.manager_id || null,
    });
  };

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({ ...p, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <FormField label="Title" required>
        <input
          type="text"
          required
          value={formData.title}
          onChange={set('title')}
          className={inputClass}
          placeholder="My awesome project"
          autoFocus
        />
      </FormField>

      <FormField label="Description">
        <textarea
          rows={4}
          value={formData.description}
          onChange={set('description')}
          className={inputClass}
          placeholder="What is this project about?"
        />
      </FormField>

      <FormField label="Manager">
        <select
          value={formData.manager_id}
          onChange={set('manager_id')}
          className={inputClass}
        >
          <option value="">— No manager —</option>
          {contributors.map(c => (
            <option key={c.uuid} value={c.uuid}>{c.full_name}</option>
          ))}
        </select>
      </FormField>

      <FormFooter
        onCancel={onCancel}
        submitLabel={project ? 'Update Project' : 'Create Project'}
      />
    </form>
  );
}
```

- [ ] **Step 5: Update `ProjectList.tsx` — show manager name**

Read the file. Find where each project row is rendered. Add `users` prop to receive all users:

```ts
interface ProjectListProps {
  projects: Project[];
  users: { uuid: string; full_name: string }[];
  onEdit: (p: Project) => void;
  onDelete: (id: string) => void;
}
```

In the row rendering, add manager display after the project title:
```tsx
const manager = users.find(u => u.uuid === project.manager_id);
// In the row JSX:
<span className="text-xs text-white/30">
  {manager ? `Manager: ${manager.full_name}` : '—'}
</span>
```

- [ ] **Step 6: Update `admin/projects/page.tsx` — fetch contributors + pass to components**

Read the current file. Add a `contributors` state and fetch on mount:

```ts
const [contributors, setContributors] = useState<{ uuid: string; full_name: string }[]>([]);

useEffect(() => {
  fetchProjects();
  fetch('/api/users')
    .then(r => r.json())
    .then((users: any[]) => setContributors(users.filter(u => u.role === 'contributor')));
}, []);
```

Pass `contributors` to `ProjectForm` and `users` to `ProjectList`:
```tsx
<ProjectForm
  project={editingProject}
  contributors={contributors}
  onSubmit={editingProject ? handleUpdate : handleCreate}
  onCancel={...}
/>
// ...
<ProjectList
  projects={projects}
  users={contributors}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

- [ ] **Step 7: Test the full admin flow**

1. Log in as admin. Go to `/admin/projects`.
2. Create a new project — the Manager dropdown should show contributors.
3. Select a contributor as manager and save.
4. The project list should show "Manager: Contributor Name" next to the project.
5. Edit the project — the manager dropdown should be pre-selected.
6. Log out, log in as that contributor.
7. Go to `/challenges/` — confirm "Manage" tab appears and shows that project's challenges.
8. Click a challenge card — confirm the popup appears.
9. Click "Manager" — confirm the full manager view renders with meetings, docs, status picker.
10. Change the challenge status — confirm it saves (no 403).
11. Create a meeting — confirm it works.
12. Upload a `.md` document — confirm it works.

- [ ] **Step 8: Commit**

```bash
git add apps/leaderboard-client/src/components/admin/ProjectForm.tsx apps/leaderboard-client/src/components/admin/ProjectList.tsx apps/leaderboard-client/src/app/admin/projects/page.tsx apps/leaderboard-client/src/app/api/projects/route.ts "apps/leaderboard-client/src/app/api/projects/[id]/route.ts"
git commit -m "feat: add manager picker to admin project form and list"
```
