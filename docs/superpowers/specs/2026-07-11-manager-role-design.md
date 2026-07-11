# Manager Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-scoped "manager" role that lets designated contributors access a rich challenge management view (meetings, documents, repos, status) without admin access.

**Architecture:** A nullable `manager_id` FK on `projects` points to a user. The manager check is resolved server-side in each API route handler via a shared `isManagerOfChallenge` helper. The manager view is a copy of the existing `/admin/challenges/[id]/` page, placed at `/challenges/[id]/manage/`. The public challenges page gains a "Manage" filter tab and a click-to-popup for manager-capable challenges.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM (PostgreSQL), `drizzle-kit push`, `jose` JWT, React client components.

## Global Constraints

- `manager_id` is nullable — a project may have no manager.
- A user can be manager of multiple projects (same user UUID appears as `manager_id` on multiple project rows).
- One manager per project (not a many-to-many relation).
- Manager cannot access `/admin/` pages — all manager-specific UI lives under `/challenges/`.
- Manager can: change challenge status, create meetings, add/delete documents, create/update repos.
- Manager cannot: create challenges, delete challenges, access other admin pages, manage users.
- The `/challenges/[id]/manage` page is a literal copy of `/admin/challenges/[id]/page.tsx` — no functional differences except the auth redirect and back-button target (already correct).
- The proxy middleware runs at Edge and cannot query the DB — all manager authorization is enforced in route handlers via `isManagerOfChallenge`.
- `drizzle-kit push` (not migrate) is used to apply schema changes.

---

## Section 1 — DB & Data Layer

### Files
- Modify: `packages/database-service/db/drizzle.ts`
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/db/mappers.ts`
- Modify: `packages/database-service/domain/schemas_zod.ts`
- Modify: `packages/database-service/repositories/project.repo.ts`

### Changes

**`drizzle.ts` — projects table:** Add `manager_id` column.
```ts
manager_id: uuid("manager_id").references(() => users.uuid, { onDelete: "set null" }),
```

**`entities.ts` — Project interface:** Add optional field.
```ts
export interface Project {
  uuid: string;
  title: string;
  description?: string;
  manager_id?: string;   // FK → users.uuid, nullable
  created_at: Date;
}
```

**`mappers.ts` — toDomainProject / toDbProject:** Pass `manager_id` through in both directions (null → undefined for domain, undefined → null for DB).

**`schemas_zod.ts` — projectSchema:** Add `manager_id: z.string().uuid().optional()`.

**`project.repo.ts`:**
- `create` and `update` pass `manager_id` through (already generic enough once mapper is updated).
- Add method:
```ts
async findByManagerId(userId: string): Promise<Project[]> {
  const rows = await db.select().from(projects).where(eq(projects.manager_id, userId));
  return rows.map(toDomainProject);
}
```

---

## Section 2 — Auth Helper

### Files
- Create: `apps/leaderboard-client/src/lib/server/managerAuth.ts`

### Implementation
```ts
import "server-only";
import { repositories } from "@/lib/db";

export async function isManagerOfChallenge(userId: string, challengeId: string): Promise<boolean> {
  const challenge = await repositories.challenge.findById(challengeId);
  if (!challenge) return false;
  const project = await repositories.project.findById(challenge.project_id);
  return project?.manager_id === userId;
}
```

---

## Section 3 — API: `GET /api/contributors/me`

### Files
- Modify: `apps/leaderboard-client/src/app/api/contributors/me/route.ts`

### Change
In the `GET` handler, after resolving `session`, fetch managed project IDs and append to response:
```ts
const managedProjects = await repositories.project.findByManagerId(session.id);
return NextResponse.json({
  user: session,
  managedProjectIds: managedProjects.map(p => p.uuid),
});
```

---

## Section 4 — API: `GET /api/challenges?managed=true`

### Files
- Modify: `apps/leaderboard-client/src/app/api/challenges/route.ts`

### Change
In the `GET` handler, check for `?managed=true`. If present, read the JWT from cookies (same pattern as other routes), resolve `userId`, call `projectRepo.findByManagerId(userId)`, then return all challenges (including drafts) whose `project_id` is in the managed project UUIDs.

```ts
const managedParam = request.nextUrl.searchParams.get('managed');
if (managedParam === 'true') {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const { payload } = await jwtVerify(token, secret);
  const userId = payload.userId as string;
  const managedProjects = await repositories.project.findByManagerId(userId);
  const projectIds = new Set(managedProjects.map(p => p.uuid));
  const all = await repositories.challenge.findAll();
  return NextResponse.json(all.filter(c => projectIds.has(c.project_id)));
}
```

---

## Section 5 — API: Proxy exceptions

### Files
- Modify: `apps/leaderboard-client/src/proxy.ts`

### Change
Add a new `isManagerAccessibleRoute` exception alongside existing ones (lines ~106-120):
```ts
const isManagerAccessibleRoute =
  (pathname.match(/^\/api\/challenges\/[^/]+$/) && ['PUT', 'PATCH'].includes(method)) ||
  (pathname.startsWith('/api/repos') && ['POST', 'PUT'].includes(method)) ||
  pathname.includes('/documents');
```

Update the guard condition:
```ts
if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && payload.role !== 'admin') {
  if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isManagerAccessibleRoute) {
    return NextResponse.json({ error: 'Admin role required for this action' }, { status: 403 });
  }
}
```

Note: `/api/sync-meetings` is NOT in `protectedApiRoutes` so it is not blocked by the proxy — only the route handler needs updating.

---

## Section 6 — API Route Handler Updates

Each handler below adds an `isManagerOfChallenge` check alongside the existing `role === 'admin'` check. Pattern:
```ts
const isAdmin = session.role === 'admin';
const isManager = !isAdmin && await isManagerOfChallenge(session.userId, challengeId);
if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

### Files to modify

**`PUT /api/challenges/[id]`** (`apps/leaderboard-client/src/app/api/challenges/[id]/route.ts`):
- Add session extraction (JWT from cookie, same pattern as `ml-workspace/route.ts`).
- Add manager check before proceeding with update.
- Note: currently no auth at all on this endpoint — add it.

**`POST /api/challenges/[id]/documents`** (`apps/leaderboard-client/src/app/api/challenges/[id]/documents/route.ts`):
- Currently checks `user.role !== 'admin'` → change to also allow managers.

**`DELETE /api/challenges/[id]/documents/[docId]`** (`apps/leaderboard-client/src/app/api/challenges/[id]/documents/[docId]/route.ts`):
- Same pattern — allow admin OR manager.

**`POST /api/sync-meetings`** (`apps/leaderboard-client/src/app/api/sync-meetings/route.ts`):
- Add session extraction.
- Allow admin OR manager of the challenge referenced in the body (`challenge_id` field).

**`POST /api/repos`** (`apps/leaderboard-client/src/app/api/repos/route.ts`):
- Add session extraction.
- Allow admin OR manager: fetch `projectRepo.findById(body.project_id)` → check `project.manager_id === userId`. No separate helper needed — inline check.

**`PUT /api/repos/[id]`** (`apps/leaderboard-client/src/app/api/repos/[id]/route.ts` — if it exists):
- Same inline check: fetch the repo → get `project_id` → fetch project → check `manager_id === userId`.

---

## Section 7 — Manager View Page

### Files
- Create: `apps/leaderboard-client/src/app/challenges/[id]/manage/page.tsx`

### Implementation
Literal copy of `apps/leaderboard-client/src/app/admin/challenges/[id]/page.tsx` with these three changes:

1. **Auth redirect** — add after `useEffect` data fetch, once `challenge` is resolved:
```ts
const [isManager, setIsManager] = useState<boolean | null>(null);

useEffect(() => {
  if (!challenge) return;
  fetch('/api/contributors/me')
    .then(r => r.ok && r.json())
    .then(d => {
      if (!d) { router.replace(`/challenges/${challengeId}`); return; }
      const managed: string[] = d.managedProjectIds ?? [];
      if (!managed.includes(challenge.project_id)) {
        router.replace(`/challenges/${challengeId}`);
      } else {
        setIsManager(true);
      }
    });
}, [challenge]);

// Render null until manager check resolves
if (isManager !== true && !loading) return null;
```

2. **Back button** — already `router.push('/challenges')`, no change needed.

3. **`DocumentsDrawer isAdmin={true}`** — keep as-is (managers have full doc access).

---

## Section 8 — Challenges Page: "Manage" filter + click popup

### Files
- Modify: `apps/leaderboard-client/src/app/challenges/page.tsx`
- Modify: `apps/leaderboard-client/src/lib/server/publicPages.ts`
- Modify: `apps/leaderboard-client/src/components/public/ProjectChallengesExplorer.tsx`
- Modify: `apps/leaderboard-client/src/components/public/ChallengesFiltersBar.tsx`
- Create: `apps/leaderboard-client/src/components/challenges/ManagerRolePopup.tsx`

### `publicPages.ts`
Update `fetchProjectsWithChallenges` signature to accept `managedProjectIds`:
```ts
export async function fetchProjectsWithChallenges(
  userId?: string | null,
  isAdmin = false,
  managedProjectIds: string[] = [],
): Promise<ChallengesPageData & { managedProjectIds: string[] }>
```

Change the draft filter:
```ts
.filter(challenge =>
  isAdmin ||
  challenge.status !== 'draft' ||
  managedProjectIds.includes(challenge.project_id)  // managers see drafts for their projects
)
```

Return `managedProjectIds` in the result object.

### `challenges/page.tsx`
Fetch `managedProjectIds` from `/api/contributors/me` (server-side via `getSessionUser` + `projectRepo`):
```ts
const managedProjects = session ? await repositories.project.findByManagerId(session.id) : [];
const managedProjectIds = managedProjects.map(p => p.uuid);
const { projects, joinedChallengeIds } = await fetchProjectsWithChallenges(session?.id, isAdmin, managedProjectIds);
```

Pass `managedProjectIds` to `ProjectChallengesExplorer`.

### `ProjectChallengesExplorer.tsx`
- Accept new prop `managedProjectIds: string[]`.
- Update `StatusFilter` type: `'all' | 'active' | 'completed' | 'draft' | 'manage'`.
- When `statusFilter === 'manage'`: filter `allChallenges` to those where `challenge.projectId` is in `managedProjectIds` (all statuses including draft).
- Pass `hasManaged={managedProjectIds.length > 0}` to `ChallengesFiltersBar`.
- On `ChallengeCard` click — wrap the current direct navigation in a handler:
```ts
const handleChallengeClick = (challenge: FlatChallenge, e: React.MouseEvent) => {
  if (managedProjectIds.includes(challenge.projectId)) {
    setPopup({ x: e.clientX, y: e.clientY, challengeId: challenge.id });
  } else {
    router.push(`/challenges/${challenge.id}`);
  }
};
```
- Add `popup` state: `{ x: number; y: number; challengeId: string } | null`.
- Render `<ManagerRolePopup>` when popup is set.

### `ChallengesFiltersBar.tsx`
- Accept `hasManaged?: boolean` prop.
- Render a "Manage" filter button (same style as existing filters) only when `hasManaged === true`.

### `ManagerRolePopup.tsx` (new component)
```tsx
// Props: x, y, challengeId, onClose
// Position: fixed at { top: y, left: x }, z-index above everything
// Two buttons:
//   "Open as Contributor" → router.push(`/challenges/${challengeId}`)
//   "Open as Manager"     → router.push(`/challenges/${challengeId}/manage`)
// Dismiss: click outside (useEffect mousedown) or Escape key
```

---

## Section 9 — Admin UI: Project Manager Picker

### Files
- Modify: `apps/leaderboard-client/src/components/admin/ProjectForm.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/ProjectList.tsx`
- Modify: `apps/leaderboard-client/src/app/api/projects/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/projects/[id]/route.ts`

### `ProjectForm.tsx`
- Add `contributors` prop: `{ uuid: string; full_name: string }[]`.
- Add `managerId` state initialized from `project?.manager_id ?? ''`.
- Add a `<select>` field "Manager" with options: empty ("No manager") + contributors list.
- Include `manager_id: managerId || null` in the submitted form data.

### `ProjectList.tsx`
- Accept `users: { uuid: string; full_name: string }[]` prop (passed from parent).
- Display manager name next to each project row (look up from users by `project.manager_id`), or "—" if none.

### `admin/projects/page.tsx`
- Fetch all users: `GET /api/users` (returns all users, no role filter). Filter client-side to `role === 'contributor'`.
- Pass `contributors` to `ProjectForm` and `users` to `ProjectList`.

### `POST /api/projects` and `PUT /api/projects/[id]`
- Accept optional `manager_id` in request body.
- Validate: if provided, must be a valid UUID (Zod: `z.string().uuid().nullable().optional()`).
- Pass through to `projectRepo.create` / `projectRepo.update`.

---

## Routing & Middleware Summary

| Route | Who can access | Auth enforcement |
|---|---|---|
| `GET /challenges/[id]/manage` | Admin or manager | Page-level redirect (client-side) |
| `PUT /api/challenges/[id]` | Admin or manager | Route handler + proxy exception |
| `POST /api/sync-meetings` | Admin or manager | Route handler only (not in protectedApiRoutes) |
| `POST /api/challenges/[id]/documents` | Admin or manager | Route handler (was admin-only) |
| `DELETE /api/challenges/[id]/documents/[docId]` | Admin or manager | Route handler (was admin-only) |
| `POST /api/repos` | Admin or manager of project | Route handler + proxy exception |
| `PUT /api/repos/[id]` | Admin or manager of project | Route handler + proxy exception |
| `GET /api/challenges?managed=true` | Authenticated | Route handler reads JWT |
| `GET /api/contributors/me` | Authenticated | Existing check |
