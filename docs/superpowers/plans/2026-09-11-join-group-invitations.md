# Join Flow and Group Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-button join with a single modal that carries a contributor search, a removable selection list, and one button whose meaning follows the list — plus the in-app notification that delivers the group's invite link.

**Architecture:** Nothing is written until the contributor clicks once. The selection is built client-side; the group and its token are created by the existing `POST /join {mode:'group'}` on that single click, and notifications are written afterwards from the token it returns. A notification carries a link and nothing more — there is no pending state and no acceptance, so every existing barrier stays exactly where it is.

**Tech Stack:** Next.js 16 (App Router), React 19, TanStack Query, Drizzle ORM on Postgres, Zod, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-11-join-group-invitations-design.md`

## Global Constraints

- `GROUP_MAX_SIZE = 3` (`packages/services/challenge/groupPolicy.ts`). The caller occupies one seat, so **selection is capped at 2**. Never hardcode 2 or 3 — import the constant and subtract.
- `groupPolicy.ts` is the **pure** half and is the only group module a client component may import. `group.ts` instantiates a repository, hence a Postgres client, which must never reach a browser bundle.
- A route file's relative import depth to `packages/` varies with its nesting. Count the `../` against a sibling route before copying an import line.
- Repository writes go through `packages/database-service/repositories/`; route handlers never touch `db` directly.
- Every new API route must be reachable through `apps/leaderboard-client/src/proxy.ts` — both its matcher and, for non-admin writes, its exception list. A route that works in a test and 403s in the browser is the failure mode.
- Tests are Vitest, colocated as `*.test.ts` next to the file under test. Run with `npm test`.
- User-facing copy is **English**. Code comments follow the surrounding file, which is **French** in `packages/` and mixed in `apps/`.
- Never expose `users.email` or `users.google_user_id` through a contributor-facing route. Build responses field by field.

---

## Deviation from the spec, decided here

The spec proposes the dedupe index as an **expression index** on
`(payload->>'groupToken')`. This plan uses a plain `dedupe_key` column instead.

Reason: `drizzle-kit push` compares the live schema against the Drizzle
definition. An index Drizzle cannot express is an index `push` does not know
about, and it will try to drop it on the next run. A plain column keeps the
uniqueness expressible in both the SQL migration and the Drizzle schema, which
is what every other partial unique index in this codebase does
(`sandbox_stars`, `sandbox_rewards`).

Behaviour is identical: `dedupe_key` holds the group token for a
`group_invite`, and is `NULL` for any future notification type that does not
need deduplication.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `drizzle/0021_notifications.sql` | migration |
| `packages/database-service/repositories/notification.repo.ts` | all `notifications` reads and writes |
| `apps/leaderboard-client/src/app/api/notifications/route.ts` | `GET` list, `PATCH` mark-all-read |
| `apps/leaderboard-client/src/app/api/notifications/[id]/route.ts` | `PATCH` mark one read |
| `apps/leaderboard-client/src/app/api/challenges/[id]/group/invite/route.ts` | writes one `group_invite` |
| `apps/leaderboard-client/src/app/api/contributors/search/route.ts` | narrow contributor search |
| `apps/leaderboard-client/src/lib/joinGate.ts` | pure: header gate + button mode/label |
| `apps/leaderboard-client/src/lib/joinGate.test.ts` | its tests |
| `apps/leaderboard-client/src/components/challenges/JoinModal.tsx` | the modal |
| `apps/leaderboard-client/src/components/contributor/NotificationsTab.tsx` | profile tab |

**Modified:**

| Path | Change |
|---|---|
| `packages/database-service/db/drizzle.ts` | `notifications` table |
| `packages/database-service/domain/entities.ts` | `Notification` entity |
| `packages/database-service/db/mappers.ts` | `toDomainNotification` |
| `packages/database-service/repositories/index.ts` | export |
| `scripts/db-apply-schema.ts` | same DDL, `IF NOT EXISTS` |
| `apps/leaderboard-client/src/proxy.ts` | matcher + two write exceptions |
| `apps/leaderboard-client/src/app/challenges/[id]/page.tsx` | header button, modal wiring |
| `apps/leaderboard-client/src/components/challenges/ChallengeBrief.tsx` | two buttons → one |
| `apps/leaderboard-client/src/app/contributors/me/page.tsx` | Notifications tab |
| `docs/challenge-groups.md`, `docs/api.md`, `docs/auth.md`, `docs/database.md` | keep docs true |

---

### Task 1: Notifications table, entity, mapper, repository

**Files:**
- Create: `drizzle/0021_notifications.sql`
- Create: `packages/database-service/repositories/notification.repo.ts`
- Create: `packages/database-service/repositories/notification.repo.test.ts`
- Modify: `packages/database-service/db/drizzle.ts` (append after `sandbox_rewards`)
- Modify: `packages/database-service/domain/entities.ts`
- Modify: `packages/database-service/db/mappers.ts`
- Modify: `packages/database-service/repositories/index.ts`
- Modify: `scripts/db-apply-schema.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `NotificationRepository` with
  `findByUser(userId: string): Promise<Notification[]>`,
  `countUnread(userId: string): Promise<number>`,
  `insertIfAbsent(draft: NotificationDraft): Promise<Notification | null>`,
  `markRead(uuid: string, userId: string): Promise<boolean>`,
  `markAllRead(userId: string): Promise<number>`.
  Entity `Notification { uuid, user_id, type, payload, dedupe_key, read_at, created_at }`.

- [ ] **Step 1: Write the migration**

Create `drizzle/0021_notifications.sql`:

```sql
-- Notifications in-app. Voir docs/superpowers/specs/2026-09-11-join-group-invitations-design.md
--
-- `type` est une chaîne et non un enum : un second type de notification ne
-- doit pas demander de migration.
--
-- `payload` est dénormalisé volontairement. Une notification est la trace de
-- ce qui était vrai au moment de l'envoi ; la re-joindre à un challenge
-- renommé depuis réécrirait l'histoire, et ajouterait une jointure à une
-- liste lue à chaque affichage du profil.
--
-- `dedupe_key` porte l'idempotence : pour un `group_invite` c'est le jeton du
-- groupe, de sorte qu'inviter deux fois la même personne n'empile pas deux
-- lignes. NULL pour un type qui n'en a pas besoin.
CREATE TABLE IF NOT EXISTS "notifications" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(200),
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_users_uuid_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("uuid")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_notifications_user_created"
  ON "notifications" USING btree ("user_id", "created_at" DESC);
--> statement-breakpoint

-- Le compteur de non-lues ne lit que cette partie de la table.
CREATE INDEX IF NOT EXISTS "idx_notifications_unread"
  ON "notifications" USING btree ("user_id")
  WHERE "read_at" IS NULL;
--> statement-breakpoint

-- Partiel parce que `dedupe_key` est NULL pour un type sans déduplication, et
-- que Postgres considère deux NULL comme distincts : un index global ne
-- contraindrait donc rien.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_notifications_dedupe"
  ON "notifications" USING btree ("user_id", "type", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
```

- [ ] **Step 2: Add the Drizzle table**

In `packages/database-service/db/drizzle.ts`, append after the `sandbox_rewards` block:

```ts
// --- NOTIFICATIONS ---
// Notifications in-app. Voir docs/challenge-groups.md.
//
// Le premier et seul type est `group_invite` : il porte le jeton d'invitation
// d'un groupe. Il n'y a **pas** d'état en attente et pas d'acceptation — la
// notification transporte un lien, et le lien reste l'invitation. Toutes les
// barrières restent là où elles étaient, dans GET /group/:token et POST /join.
export const notifications = pgTable("notifications", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }).notNull(),
  // Chaîne et non enum : un second type ne doit pas demander de migration.
  type: varchar("type", { length: 40 }).notNull(),
  // Dénormalisé : une notification est la trace de ce qui était vrai à
  // l'envoi. La re-joindre à un challenge renommé depuis réécrirait l'histoire.
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  // Idempotence : le jeton du groupe pour un `group_invite`, NULL sinon.
  dedupe_key: varchar("dedupe_key", { length: 200 }),
  read_at: timestamp("read_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index("idx_notifications_user_created").on(table.user_id, table.created_at),
  unreadIdx: index("idx_notifications_unread")
    .on(table.user_id)
    .where(sql`read_at IS NULL`),
  // Partiel : `dedupe_key` est NULL pour un type sans déduplication, et deux
  // NULL sont distincts pour Postgres.
  dedupeIdx: uniqueIndex("idx_notifications_dedupe")
    .on(table.user_id, table.type, table.dedupe_key)
    .where(sql`dedupe_key IS NOT NULL`),
}));
```

- [ ] **Step 3: Add the entity**

In `packages/database-service/domain/entities.ts`, next to the other simple entities:

```ts
/** Le seul type aujourd'hui. Voir docs/challenge-groups.md. */
export type NotificationType = 'group_invite';

/** Ce que porte un `group_invite` — dénormalisé, cf. le commentaire du schéma. */
export interface GroupInviteNotificationPayload {
  challengeId: string;
  challengeTitle: string;
  groupToken: string;
  fromUserId: string;
  fromName: string;
}

export interface Notification {
  uuid: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
  read_at: Date | null;
  created_at: Date;
}
```

- [ ] **Step 4: Add the mapper**

In `packages/database-service/db/mappers.ts`, following `toDomainSandboxReward`:

```ts
type DbNotification = InferSelectModel<typeof notifications>;

export function toDomainNotification(row: DbNotification): Notification {
  return {
    uuid: row.uuid,
    user_id: row.user_id,
    type: row.type as NotificationType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    dedupe_key: row.dedupe_key ?? null,
    read_at: row.read_at ?? null,
    created_at: row.created_at,
  };
}
```

Add `notifications` to the existing `import { ... } from "./drizzle.js"` list and
`Notification`, `NotificationType` to the entities import.

- [ ] **Step 5: Write the failing repository test**

Create `packages/database-service/repositories/notification.repo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGroupInviteDraft } from './notification.repo';

describe('buildGroupInviteDraft', () => {
  it('puts the group token in dedupe_key so two invites cannot stack', () => {
    const draft = buildGroupInviteDraft({
      recipientId: 'user-2',
      challengeId: 'challenge-1',
      challengeTitle: 'Collaboration Patterns',
      groupToken: 'group-abc',
      fromUserId: 'user-1',
      fromName: 'Camille Daverio',
    });

    expect(draft.user_id).toBe('user-2');
    expect(draft.type).toBe('group_invite');
    expect(draft.dedupe_key).toBe('group-abc');
  });

  it('denormalises the challenge title and the inviter name into the payload', () => {
    const draft = buildGroupInviteDraft({
      recipientId: 'user-2',
      challengeId: 'challenge-1',
      challengeTitle: 'Collaboration Patterns',
      groupToken: 'group-abc',
      fromUserId: 'user-1',
      fromName: 'Camille Daverio',
    });

    expect(draft.payload).toEqual({
      challengeId: 'challenge-1',
      challengeTitle: 'Collaboration Patterns',
      groupToken: 'group-abc',
      fromUserId: 'user-1',
      fromName: 'Camille Daverio',
    });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- notification.repo`
Expected: FAIL — `buildGroupInviteDraft` is not exported from a file that does not exist.

- [ ] **Step 7: Write the repository**

Create `packages/database-service/repositories/notification.repo.ts`:

```ts
import { db, notifications } from "../db/drizzle";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { toDomainNotification } from "../db/mappers";
import type { Notification, NotificationType } from "../domain/entities";

/** Une notification à écrire. `dedupe_key` NULL = pas de déduplication. */
export interface NotificationDraft {
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
}

/**
 * Le brouillon d'une invitation de groupe — pur, sans I/O, donc testable seul.
 *
 * `dedupe_key` porte le jeton du groupe : c'est ce qui fait qu'inviter deux
 * fois la même personne dans le même groupe n'écrit qu'une ligne.
 */
export function buildGroupInviteDraft(input: {
  recipientId: string;
  challengeId: string;
  challengeTitle: string;
  groupToken: string;
  fromUserId: string;
  fromName: string;
}): NotificationDraft {
  return {
    user_id: input.recipientId,
    type: "group_invite",
    payload: {
      challengeId: input.challengeId,
      challengeTitle: input.challengeTitle,
      groupToken: input.groupToken,
      fromUserId: input.fromUserId,
      fromName: input.fromName,
    },
    dedupe_key: input.groupToken,
  };
}

/** Plafond de lecture. Pas de pagination : voir la spec. */
export const NOTIFICATIONS_PAGE_SIZE = 50;

export class NotificationRepository {
  async findByUser(userId: string): Promise<Notification[]> {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, userId))
      .orderBy(desc(notifications.created_at))
      .limit(NOTIFICATIONS_PAGE_SIZE);
    return rows.map(toDomainNotification);
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)));
    return row?.value ?? 0;
  }

  /**
   * Écrit la notification, sauf si elle existe déjà. Renvoie `null` dans ce cas.
   *
   * `ON CONFLICT DO NOTHING` sur l'index unique partiel : deux clics
   * concurrents sur le même contributeur produisent exactement une ligne. Le
   * `where` passé ici est le prédicat de l'index, sans lequel Postgres ne sait
   * pas quel index arbitre le conflit.
   */
  async insertIfAbsent(draft: NotificationDraft): Promise<Notification | null> {
    const [inserted] = await db
      .insert(notifications)
      .values(draft)
      .onConflictDoNothing({
        target: [notifications.user_id, notifications.type, notifications.dedupe_key],
        where: sql`dedupe_key IS NOT NULL`,
      })
      .returning();
    return inserted ? toDomainNotification(inserted) : null;
  }

  /**
   * `userId` est dans le WHERE et non vérifié par l'appelant : la propriété
   * de la ligne est une garde, et une garde qui vit dans la requête ne peut
   * pas être oubliée par un second appelant.
   */
  async markRead(uuid: string, userId: string): Promise<boolean> {
    const updated = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(and(eq(notifications.uuid, uuid), eq(notifications.user_id, userId), isNull(notifications.read_at)))
      .returning({ uuid: notifications.uuid });
    return updated.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await db
      .update(notifications)
      .set({ read_at: new Date() })
      .where(and(eq(notifications.user_id, userId), isNull(notifications.read_at)))
      .returning({ uuid: notifications.uuid });
    return updated.length;
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- notification.repo`
Expected: PASS, 2 tests.

- [ ] **Step 9: Export the repository**

In `packages/database-service/repositories/index.ts`, after the sandbox exports:

```ts
export { NotificationRepository, buildGroupInviteDraft, NOTIFICATIONS_PAGE_SIZE } from "./notification.repo.js";
export type { NotificationDraft } from "./notification.repo.js";
```

- [ ] **Step 10: Add the DDL to the deploy script**

In `scripts/db-apply-schema.ts`, append to the `STATEMENTS` array:

```ts
  // notifications — voir drizzle/0021_notifications.sql. `drizzle-kit push` ne
  // peut pas tourner au déploiement (prompt interactif sans TTY), donc la même
  // DDL vit ici en IF NOT EXISTS.
  {
    label: "notifications table",
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      uuid uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      user_id uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
      type varchar(40) NOT NULL,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      dedupe_key varchar(200),
      read_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: "idx_notifications_user_created",
    sql: `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC)`,
  },
  {
    label: "idx_notifications_unread",
    sql: `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL`,
  },
  {
    label: "idx_notifications_dedupe",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications (user_id, type, dedupe_key) WHERE dedupe_key IS NOT NULL`,
  },
```

- [ ] **Step 11: Apply the schema locally and verify**

Run: `npx drizzle-kit push --force && npm run db:apply-schema`
Then verify the table exists:

```bash
npx tsx -e "
import { db } from './packages/database-service/db/drizzle.js';
import { sql } from 'drizzle-orm';
const r = await db.execute(sql\`SELECT indexname FROM pg_indexes WHERE tablename='notifications' ORDER BY indexname\`);
console.log(r.rows.map(x => x.indexname));
process.exit(0);
"
```

Expected: the four index names, including `idx_notifications_dedupe`.

- [ ] **Step 12: Commit**

```bash
git add drizzle/0021_notifications.sql packages/database-service scripts/db-apply-schema.ts
git commit -m "feat(notifications): table, entity, repository"
```

---

### Task 2: Notifications API routes

**Files:**
- Create: `apps/leaderboard-client/src/app/api/notifications/route.ts`
- Create: `apps/leaderboard-client/src/app/api/notifications/route.test.ts`
- Create: `apps/leaderboard-client/src/app/api/notifications/[id]/route.ts`
- Modify: `apps/leaderboard-client/src/proxy.ts`

**Interfaces:**
- Consumes: `NotificationRepository` from Task 1.
- Produces: `GET /api/notifications` → `{ notifications: NotificationView[], unread: number }` where
  `NotificationView = { uuid, type, payload, read: boolean, created_at: string | null }`.
  `PATCH /api/notifications` → `{ updated: number }`.
  `PATCH /api/notifications/:id` → `{ ok: true }` or 404.

- [ ] **Step 1: Write the failing route test**

Create `apps/leaderboard-client/src/app/api/notifications/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockFindByUser, mockCountUnread, mockMarkAllRead } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByUser: vi.fn(),
  mockCountUnread: vi.fn(),
  mockMarkAllRead: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../packages/database-service/repositories', () => ({
  NotificationRepository: class {
    findByUser = mockFindByUser;
    countUnread = mockCountUnread;
    markAllRead = mockMarkAllRead;
  },
}));

import { GET, PATCH } from './route';

function get() {
  return GET(new NextRequest('http://localhost/api/notifications'));
}
function patchAll() {
  return PATCH(new NextRequest('http://localhost/api/notifications', { method: 'PATCH' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockCountUnread.mockResolvedValue(0);
  mockFindByUser.mockResolvedValue([]);
});

describe('GET /api/notifications', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
  });

  it('reads only the caller rows', async () => {
    await get();
    expect(mockFindByUser).toHaveBeenCalledWith('user-1');
  });

  it('returns the rows with a read flag and the unread count', async () => {
    mockFindByUser.mockResolvedValue([
      { uuid: 'n-1', type: 'group_invite', payload: { challengeTitle: 'X' }, read_at: null, created_at: new Date('2026-09-01T10:00:00Z') },
      { uuid: 'n-2', type: 'group_invite', payload: {}, read_at: new Date('2026-09-02T10:00:00Z'), created_at: new Date('2026-09-02T09:00:00Z') },
    ]);
    mockCountUnread.mockResolvedValue(1);

    const res = await get();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unread).toBe(1);
    expect(body.notifications).toEqual([
      { uuid: 'n-1', type: 'group_invite', payload: { challengeTitle: 'X' }, read: false, created_at: '2026-09-01T10:00:00.000Z' },
      { uuid: 'n-2', type: 'group_invite', payload: {}, read: true, created_at: '2026-09-02T09:00:00.000Z' },
    ]);
  });
});

describe('PATCH /api/notifications', () => {
  it('marks the caller rows read and reports how many', async () => {
    mockMarkAllRead.mockResolvedValue(3);
    const res = await patchAll();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 3 });
    expect(mockMarkAllRead).toHaveBeenCalledWith('user-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- api/notifications`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the list route**

Create `apps/leaderboard-client/src/app/api/notifications/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { NotificationRepository } from '../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const notificationRepo = new NotificationRepository();

/**
 * La forme servie au client. Construite champ par champ, comme
 * `lib/public/sandbox.ts` : une colonne ajoutée plus tard à `notifications`
 * reste privée tant que personne ne l'a écrite ici. `dedupe_key` en
 * particulier n'a aucune raison de sortir — c'est de la plomberie d'unicité.
 */
interface NotificationView {
  uuid: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string | null;
}

function toView(row: {
  uuid: string; type: string; payload: Record<string, unknown>;
  read_at: Date | null; created_at: Date;
}): NotificationView {
  return {
    uuid: row.uuid,
    type: row.type,
    payload: row.payload ?? {},
    // Un booléen plutôt que la date : le client n'affiche jamais *quand* une
    // notification a été lue, seulement si elle l'est.
    read: row.read_at !== null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

// GET /api/notifications — les siennes, les plus récentes d'abord.
export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [rows, unread] = await Promise.all([
      notificationRepo.findByUser(user.id),
      notificationRepo.countUnread(user.id),
    ]);

    return NextResponse.json({ notifications: rows.map(toView), unread });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// PATCH /api/notifications — tout marquer lu.
export async function PATCH(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const updated = await notificationRepo.markAllRead(user.id);
    return NextResponse.json({ updated });
  } catch (err) {
    console.error('Error marking notifications read:', err);
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- api/notifications`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the single-row route**

Create `apps/leaderboard-client/src/app/api/notifications/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { NotificationRepository } from '../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const notificationRepo = new NotificationRepository();

// PATCH /api/notifications/[id] — marquer une notification lue.
//
// La propriété de la ligne est portée par le WHERE du repository, pas par un
// test ici : une garde dans la requête ne peut pas être oubliée. Un 404 couvre
// donc aussi bien « n'existe pas » que « n'est pas à vous », ce qui est voulu —
// répondre 403 confirmerait l'existence d'une ligne qui ne regarde pas
// l'appelant.
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const ok = await notificationRepo.markRead(id, user.id);
    // Déjà lue ou inexistante : idempotent, l'UI n'a rien de différent à faire.
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error marking notification read:', err);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Wire the proxy matcher and the write exception**

In `apps/leaderboard-client/src/proxy.ts`:

Add to `config.matcher`, after `'/api/contributors/:path*'`:

```ts
    '/api/notifications/:path*',
```

Add beside `isContributorSelfRoute`:

```ts
      // Ses propres notifications : lire et marquer lu. La propriété est
      // vérifiée dans le handler (le userId est dans le WHERE).
      const isNotificationSelfRoute =
        pathname.startsWith('/api/notifications') && method === 'PATCH';
```

Add `!isNotificationSelfRoute` to the guard condition:

```ts
        if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isChallengeSelfServiceRoute && !isManagerAccessibleRoute && !isContributorSelfRoute && !isMedicalProValidationRoute && !isNotificationSelfRoute) {
```

> **Why the matcher and not self-authentication.** `/api/sandboxes/**` sits
> outside the matcher because its writes are open to anonymous visitors.
> Notifications are the opposite: always authenticated. Staying inside the
> matcher buys the silent token refresh, and a notifications panel read on a
> long-open profile page is exactly where an expiring session bites.

- [ ] **Step 7: Verify end to end against the running app**

Run the dev server, then:

```bash
curl -s -o /dev/null -w "anon GET -> %{http_code}\n" http://localhost:3000/api/notifications
```

Expected: `401`.

- [ ] **Step 8: Commit**

```bash
git add apps/leaderboard-client/src/app/api/notifications apps/leaderboard-client/src/proxy.ts
git commit -m "feat(notifications): list, mark-read routes and proxy wiring"
```

---

### Task 3: Group invite route

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/group/invite/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/group/invite/route.test.ts`
- Modify: `apps/leaderboard-client/src/proxy.ts`

**Interfaces:**
- Consumes: `NotificationRepository`, `buildGroupInviteDraft` (Task 1);
  `ChallengeTeamRepository.findByChallengeAndUser`, `ChallengeRepository.findById`,
  `UserRepository.findById` (existing).
- Produces: `POST /api/challenges/:id/group/invite` with body `{ userId: string }` → `{ sent: true }`.

- [ ] **Step 1: Write the failing test**

Create `apps/leaderboard-client/src/app/api/challenges/[id]/group/invite/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetSessionUser, mockFindByChallengeAndUser, mockFindChallengeById,
  mockFindUserById, mockInsertIfAbsent,
} = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockFindByChallengeAndUser: vi.fn(),
  mockFindChallengeById: vi.fn(),
  mockFindUserById: vi.fn(),
  mockInsertIfAbsent: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../../../../packages/database-service/repositories', () => ({
  ChallengeTeamRepository: class { findByChallengeAndUser = mockFindByChallengeAndUser; },
  ChallengeRepository: class { findById = mockFindChallengeById; },
  UserRepository: class { findById = mockFindUserById; },
  NotificationRepository: class { insertIfAbsent = mockInsertIfAbsent; },
  buildGroupInviteDraft: (input: Record<string, unknown>) => ({
    user_id: input.recipientId, type: 'group_invite',
    payload: input, dedupe_key: input.groupToken,
  }),
}));

import { POST } from './route';

const CHALLENGE_ID = 'challenge-1';

function invite(body: unknown) {
  const req = new NextRequest(`http://localhost/api/challenges/${CHALLENGE_ID}/group/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ id: CHALLENGE_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockFindChallengeById.mockResolvedValue({ uuid: CHALLENGE_ID, title: 'Collaboration Patterns', status: 'active' });
  mockFindUserById.mockImplementation(async (id: string) =>
    id === 'user-1' ? { uuid: 'user-1', full_name: 'Camille Daverio' } : { uuid: id, full_name: 'Patricia Novi' });
  mockInsertIfAbsent.mockResolvedValue({ uuid: 'n-1' });
  // Par défaut l'appelant est bien dans le groupe qu'il invite.
  mockFindByChallengeAndUser.mockImplementation(async (_c: string, u: string) =>
    u === 'user-1' ? { user_id: 'user-1', group_id: 'group-abc' } : null);
});

describe('POST /api/challenges/[id]/group/invite', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await invite({ userId: 'user-2' })).status).toBe(401);
  });

  it('refuses a caller who is not on the challenge', async () => {
    mockFindByChallengeAndUser.mockResolvedValue(null);
    const res = await invite({ userId: 'user-2' });
    expect(res.status).toBe(403);
    expect(mockInsertIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses a caller who joined solo — they have no group to invite into', async () => {
    mockFindByChallengeAndUser.mockImplementation(async (_c: string, u: string) =>
      u === 'user-1' ? { user_id: 'user-1', group_id: null } : null);
    const res = await invite({ userId: 'user-2' });
    expect(res.status).toBe(403);
    expect(mockInsertIfAbsent).not.toHaveBeenCalled();
  });

  it('refuses inviting yourself', async () => {
    expect((await invite({ userId: 'user-1' })).status).toBe(400);
  });

  it('refuses an unknown recipient', async () => {
    mockFindUserById.mockImplementation(async (id: string) =>
      id === 'user-1' ? { uuid: 'user-1', full_name: 'Camille Daverio' } : null);
    expect((await invite({ userId: 'ghost' })).status).toBe(404);
  });

  it('refuses when the challenge is closed', async () => {
    mockFindChallengeById.mockResolvedValue({ uuid: CHALLENGE_ID, title: 'X', status: 'completed' });
    expect((await invite({ userId: 'user-2' })).status).toBe(403);
  });

  it('writes the invite with the caller group token', async () => {
    const res = await invite({ userId: 'user-2' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ sent: true });
    expect(mockInsertIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-2',
      type: 'group_invite',
      dedupe_key: 'group-abc',
    }));
  });

  it('reports success when the invite already existed', async () => {
    mockInsertIfAbsent.mockResolvedValue(null);
    const res = await invite({ userId: 'user-2' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ sent: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- group/invite`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the route**

Create `apps/leaderboard-client/src/app/api/challenges/[id]/group/invite/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
  NotificationRepository,
  UserRepository,
  buildGroupInviteDraft,
} from '../../../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const notificationRepo = new NotificationRepository();
const userRepo = new UserRepository();

const inviteBodySchema = z.object({ userId: z.string().uuid() });

/**
 * POST /api/challenges/[id]/group/invite — déposer une invitation de groupe
 * dans les notifications d'un contributeur.
 *
 * **La garde qui compte.** C'est désormais le serveur qui distribue un jeton de
 * groupe, là où auparavant un humain le copiait d'une modale. On vérifie donc
 * que la row `challenge_teams` de l'appelant porte bien un `group_id` : sans
 * ce test, n'importe quel compte connecté pourrait diffuser le jeton de
 * n'importe quel groupe, et l'invisibilité des groupes — « un groupe n'est
 * joignable que par son lien » — disparaîtrait.
 *
 * Le destinataire, lui, n'est pas contrôlé au-delà de son existence : inviter
 * quelqu'un qui a déjà rejoint est une notification gâchée, pas une faille, et
 * l'écran de barrière sur lequel il atterrit le lui dira (`already_member`).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: challengeId } = await params;

    const parsed = inviteBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'A contributor id is required' }, { status: 400 });
    }
    const recipientId = parsed.data.userId;

    if (recipientId === user.id) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.status === 'completed' || challenge.status === 'archived') {
      return NextResponse.json({ error: 'This challenge is closed' }, { status: 403 });
    }

    // La garde : l'appelant doit être sur ce challenge *et* dans un groupe.
    const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, user.id);
    if (!participation?.group_id) {
      return NextResponse.json(
        { error: 'Only a member of a group on this challenge can invite' },
        { status: 403 }
      );
    }

    const [recipient, inviter] = await Promise.all([
      userRepo.findById(recipientId),
      userRepo.findById(user.id),
    ]);
    if (!recipient) return NextResponse.json({ error: 'Contributor not found' }, { status: 404 });

    // `null` = la notification existait déjà. Du point de vue de l'expéditeur
    // la personne est invitée dans les deux cas, donc même réponse.
    await notificationRepo.insertIfAbsent(
      buildGroupInviteDraft({
        recipientId,
        challengeId,
        challengeTitle: challenge.title,
        groupToken: participation.group_id,
        fromUserId: user.id,
        fromName: inviter?.full_name ?? 'A contributor',
      })
    );

    return NextResponse.json({ sent: true }, { status: 201 });
  } catch (err) {
    console.error('Error sending group invite:', err);
    return NextResponse.json({ error: 'Failed to send the invitation' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- group/invite`
Expected: PASS, 8 tests.

- [ ] **Step 5: Add the proxy write exception**

In `apps/leaderboard-client/src/proxy.ts`, beside `isChallengeJoinRoute`:

```ts
      // Inviter un contributeur dans son groupe. L'appartenance au groupe est
      // vérifiée dans le handler — sans cette exception, le garde-fou
      // « admin only » ci-dessous bloquerait la fonctionnalité pour tout
      // contributeur, qui est pourtant son seul utilisateur.
      const isGroupInviteRoute = pathname.endsWith('/group/invite');
```

Add `!isGroupInviteRoute` to the guard condition, which now reads:

```ts
        if (!isTaskSelfServiceRoute && !isMLContributorRoute && !isChallengeJoinRoute && !isChallengeSelfServiceRoute && !isManagerAccessibleRoute && !isContributorSelfRoute && !isMedicalProValidationRoute && !isNotificationSelfRoute && !isGroupInviteRoute) {
```

- [ ] **Step 6: Commit**

```bash
git add "apps/leaderboard-client/src/app/api/challenges/[id]/group/invite" apps/leaderboard-client/src/proxy.ts
git commit -m "feat(groups): invite a contributor into your group by notification"
```

---

### Task 4: Contributor search route

**Files:**
- Create: `apps/leaderboard-client/src/app/api/contributors/search/route.ts`
- Create: `apps/leaderboard-client/src/app/api/contributors/search/route.test.ts`
- Modify: `packages/database-service/repositories/user.repo.ts`

**Interfaces:**
- Consumes: `ChallengeTeamRepository.findByChallenge` (existing).
- Produces: `GET /api/contributors/search?q=<term>&challenge=<id>` →
  `{ results: Array<{ uuid: string; full_name: string; avatar_url: string | null; blocked_reason: 'already_member' | null }> }`.
  `UserRepository.searchByName(term: string, limit: number): Promise<User[]>`.

- [ ] **Step 1: Add the repository method**

In `packages/database-service/repositories/user.repo.ts`, add (and extend the
`drizzle-orm` import with `ilike` and `and`, and the `../db/drizzle` import if
needed):

```ts
  /**
   * Recherche par nom, pour le sélecteur de coéquipiers.
   *
   * `ilike` et non une recherche plein texte : la table tient dans quelques
   * centaines de lignes, et un index GIN serait de l'infrastructure pour un
   * problème qui n'existe pas encore.
   */
  async searchByName(term: string, limit = 10): Promise<User[]> {
    const rows = await db
      .select()
      .from(users)
      .where(ilike(users.full_name, `%${term}%`))
      .orderBy(users.full_name)
      .limit(limit);
    return rows.map(toDomainUser);
  }
```

- [ ] **Step 2: Write the failing route test**

Create `apps/leaderboard-client/src/app/api/contributors/search/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetSessionUser, mockSearchByName, mockFindByChallenge } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
  mockSearchByName: vi.fn(),
  mockFindByChallenge: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUser: mockGetSessionUser }));

vi.mock('../../../../../../../packages/database-service/repositories', () => ({
  UserRepository: class { searchByName = mockSearchByName; },
  ChallengeTeamRepository: class { findByChallenge = mockFindByChallenge; },
}));

import { GET } from './route';

function search(qs: string) {
  return GET(new NextRequest(`http://localhost/api/contributors/search${qs}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', role: 'contributor' });
  mockFindByChallenge.mockResolvedValue([]);
  mockSearchByName.mockResolvedValue([]);
});

describe('GET /api/contributors/search', () => {
  it('refuses an anonymous caller', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await search('?q=cam')).status).toBe(401);
  });

  it('returns nothing for a term under two characters, without querying', async () => {
    const res = await search('?q=c');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [] });
    expect(mockSearchByName).not.toHaveBeenCalled();
  });

  it('never leaks email or google_user_id', async () => {
    mockSearchByName.mockResolvedValue([
      { uuid: 'user-2', full_name: 'Camille Daverio', avatar_url: null, email: 'c@example.com', google_user_id: 'g-1', github_username: 'Inarinokaze' },
    ]);

    const body = await (await search('?q=cam')).json();

    expect(body.results).toEqual([
      { uuid: 'user-2', full_name: 'Camille Daverio', avatar_url: null, blocked_reason: null },
    ]);
  });

  it('excludes the caller from their own results', async () => {
    mockSearchByName.mockResolvedValue([
      { uuid: 'user-1', full_name: 'Camille Daverio', avatar_url: null },
      { uuid: 'user-2', full_name: 'Camille Dupont', avatar_url: null },
    ]);

    const body = await (await search('?q=cam')).json();

    expect(body.results.map((r: { uuid: string }) => r.uuid)).toEqual(['user-2']);
  });

  it('marks a contributor already on the challenge rather than hiding them', async () => {
    mockSearchByName.mockResolvedValue([{ uuid: 'user-2', full_name: 'Patricia Novi', avatar_url: null }]);
    mockFindByChallenge.mockResolvedValue([{ user_id: 'user-2' }]);

    const body = await (await search('?q=pat&challenge=challenge-1')).json();

    expect(body.results).toEqual([
      { uuid: 'user-2', full_name: 'Patricia Novi', avatar_url: null, blocked_reason: 'already_member' },
    ]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- contributors/search`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 4: Write the route**

Create `apps/leaderboard-client/src/app/api/contributors/search/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeTeamRepository,
  UserRepository,
} from '../../../../../../../packages/database-service/repositories';
import { getSessionUser } from '@/lib/auth';

const userRepo = new UserRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

/** En dessous, la recherche renverrait un dixième de la table pour rien. */
const MIN_TERM_LENGTH = 2;
const MAX_RESULTS = 10;

/**
 * Trois champs, et pas un de plus.
 *
 * `GET /api/users` renvoie `findAll()` — les rows entières, **email et
 * `google_user_id` compris**. Y brancher un sélecteur distribuerait l'adresse
 * de chacun à tout compte connecté. Cette route suit le motif de
 * `lib/public/sandbox.ts` : elle est construite champ par champ, donc une
 * colonne ajoutée plus tard à `users` reste privée par défaut.
 */
interface ContributorSearchResult {
  uuid: string;
  full_name: string;
  avatar_url: string | null;
  /** `already_member` = déjà sur ce challenge. Affiché, pas masqué. */
  blocked_reason: 'already_member' | null;
}

// GET /api/contributors/search?q=&challenge=
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const term = (request.nextUrl.searchParams.get('q') ?? '').trim();
    if (term.length < MIN_TERM_LENGTH) return NextResponse.json({ results: [] });

    const challengeId = request.nextUrl.searchParams.get('challenge');

    // On demande une page de plus que nécessaire : l'appelant est retiré juste
    // après, et sans cette marge une recherche qui le ramène rendrait 9 lignes.
    const [found, participants] = await Promise.all([
      userRepo.searchByName(term, MAX_RESULTS + 1),
      challengeId ? challengeTeamRepo.findByChallenge(challengeId) : Promise.resolve([]),
    ]);

    const memberIds = new Set(participants.map((p) => p.user_id));

    const results: ContributorSearchResult[] = found
      .filter((u) => u.uuid !== user.id)
      .slice(0, MAX_RESULTS)
      .map((u) => ({
        uuid: u.uuid,
        full_name: u.full_name,
        avatar_url: u.avatar_url ?? null,
        // Montré et désactivé plutôt que filtré : la question que se pose
        // l'utilisateur est « où est Christyl ? », pas « pourquoi ma recherche
        // ne marche pas ».
        blocked_reason: memberIds.has(u.uuid) ? 'already_member' : null,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Error searching contributors:', err);
    return NextResponse.json({ error: 'Failed to search contributors' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- contributors/search`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/leaderboard-client/src/app/api/contributors/search packages/database-service/repositories/user.repo.ts
git commit -m "feat(contributors): narrow search route for the group picker"
```

---

### Task 5: Join gate and button mode — pure logic

**Files:**
- Create: `apps/leaderboard-client/src/lib/joinGate.ts`
- Create: `apps/leaderboard-client/src/lib/joinGate.test.ts`

**Interfaces:**
- Consumes: `GROUP_MAX_SIZE` from `packages/services/challenge/groupPolicy`.
- Produces:
  `MAX_INVITEES: number`;
  `showJoinInHeader({ isMember, challengeType, challengeStatus }): boolean`;
  `joinAction(selectedCount: number): { mode: 'solo' | 'group'; label: string }`;
  `canSelectMore(selectedCount: number): boolean`.

> Pure and separate from the modal so the rules can be tested without React,
> and so the header and the brief cannot drift apart. It sits beside
> `challengeBrief.ts`, which holds the sibling gate.

- [ ] **Step 1: Write the failing test**

Create `apps/leaderboard-client/src/lib/joinGate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { showJoinInHeader, joinAction, canSelectMore, MAX_INVITEES } from './joinGate';

describe('showJoinInHeader', () => {
  const open = { isMember: false, challengeType: 'code', challengeStatus: 'active' };

  it('shows Join to a non-member on an open code challenge', () => {
    expect(showJoinInHeader(open)).toBe(true);
  });

  it('shows Join on an ml challenge too', () => {
    expect(showJoinInHeader({ ...open, challengeType: 'ml' })).toBe(true);
  });

  it('shows Join to an anonymous visitor — the page is public and the button signs them in', () => {
    // Volontairement : la condition ne connaît pas isAnonymous. Le composant
    // route un anonyme vers /signin au lieu d'ouvrir la modale.
    expect(showJoinInHeader(open)).toBe(true);
  });

  it('hides Join once the visitor is a member', () => {
    expect(showJoinInHeader({ ...open, isMember: true })).toBe(false);
  });

  it('hides Join on a validation challenge', () => {
    expect(showJoinInHeader({ ...open, challengeType: 'validation' })).toBe(false);
  });

  it('hides Join on a completed or archived challenge', () => {
    expect(showJoinInHeader({ ...open, challengeStatus: 'completed' })).toBe(false);
    expect(showJoinInHeader({ ...open, challengeStatus: 'archived' })).toBe(false);
  });

  it('hides Join when the type is missing', () => {
    expect(showJoinInHeader({ ...open, challengeType: null })).toBe(false);
  });
});

describe('joinAction', () => {
  it('is a solo join while nobody is selected', () => {
    expect(joinAction(0)).toEqual({ mode: 'solo', label: 'Join' });
  });

  it('becomes a group join as soon as one person is selected', () => {
    expect(joinAction(1)).toEqual({ mode: 'group', label: 'Join as a group' });
    expect(joinAction(2)).toEqual({ mode: 'group', label: 'Join as a group' });
  });
});

describe('canSelectMore', () => {
  it('leaves room for MAX_INVITEES people', () => {
    expect(MAX_INVITEES).toBe(2);
    expect(canSelectMore(0)).toBe(true);
    expect(canSelectMore(1)).toBe(true);
  });

  it('stops at the cap', () => {
    expect(canSelectMore(2)).toBe(false);
    expect(canSelectMore(3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- joinGate`
Expected: FAIL — cannot resolve `./joinGate`.

- [ ] **Step 3: Write the module**

Create `apps/leaderboard-client/src/lib/joinGate.ts`:

```ts
import { BRIEF_GATED_TYPES } from './challengeBrief';
import { GROUP_MAX_SIZE } from '../../../../packages/services/challenge/groupPolicy';

/**
 * Règles du parcours « rejoindre » — pures, sans React.
 *
 * Elles vivent à côté de `challengeBrief.ts`, qui porte la porte jumelle :
 * les deux décident de ce qu'un non-membre voit, et les séparer davantage les
 * ferait diverger.
 *
 * `groupPolicy` est la moitié pure du module de groupes, la seule qu'un
 * composant client puisse importer : `group.ts` instancie un repository, donc
 * un client Postgres, qui n'a rien à faire dans un bundle navigateur.
 */

/** Combien de personnes on peut inviter : le groupe moins sa propre place. */
export const MAX_INVITEES = GROUP_MAX_SIZE - 1;

/** Un challenge fermé refuse le join côté serveur — on n'offre pas le bouton. */
function isOpen(status: string | null | undefined): boolean {
  return status !== 'completed' && status !== 'archived';
}

/**
 * Le bouton `Join` remplace-t-il `Docs` dans l'en-tête ?
 *
 * C'est `shouldShowBrief` moins deux choses. Moins la présence d'un brief,
 * parce qu'un challenge qui n'en a pas a quand même besoin d'un chemin pour
 * être rejoint. Et moins l'exclusion des anonymes : la page challenge est
 * publique, donc un visiteur qui peut tout lire mérite qu'on lui dise comment
 * participer. C'est le composant qui l'envoie vers `/signin` plutôt que
 * d'ouvrir la modale — et c'est ainsi qu'aucun chemin ne permet plus à un
 * non-connecté de déclencher une requête de join.
 */
export function showJoinInHeader({
  isMember, challengeType, challengeStatus,
}: {
  isMember: boolean;
  challengeType: string | null | undefined;
  challengeStatus: string | null | undefined;
}): boolean {
  if (isMember) return false;
  if (!isOpen(challengeStatus)) return false;
  return BRIEF_GATED_TYPES.includes(challengeType ?? '');
}

/** Ce que fait le bouton unique, en fonction de la liste préparée. */
export function joinAction(selectedCount: number): { mode: 'solo' | 'group'; label: string } {
  return selectedCount === 0
    ? { mode: 'solo', label: 'Join' }
    : { mode: 'group', label: 'Join as a group' };
}

/** Reste-t-il de la place dans la sélection ? */
export function canSelectMore(selectedCount: number): boolean {
  return selectedCount < MAX_INVITEES;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- joinGate`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/leaderboard-client/src/lib/joinGate.ts apps/leaderboard-client/src/lib/joinGate.test.ts
git commit -m "feat(join): pure rules for the header gate and the single join button"
```

---

### Task 6: The JoinModal component

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/JoinModal.tsx`

**Interfaces:**
- Consumes: `joinAction`, `canSelectMore`, `MAX_INVITEES` (Task 5);
  `GET /api/contributors/search` (Task 4); `POST /group/invite` (Task 3);
  `useJoinChallenge` (existing, unchanged).
- Produces: `<JoinModal challengeId challengeType onClose onJoined />`.

> No test in this task. The modal is visual state; its rules are already tested
> in Task 5 and its calls in Tasks 3–4. Verification here is manual, in Task 7.

- [ ] **Step 1: Write the component**

Create `apps/leaderboard-client/src/components/challenges/JoinModal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Search, UserPlus, Users, X } from 'lucide-react';
import { useJoinChallenge } from '@/lib/useJoinChallenge';
import { canSelectMore, joinAction, MAX_INVITEES } from '@/lib/joinGate';

interface SearchResult {
  uuid: string;
  full_name: string;
  avatar_url: string | null;
  blocked_reason: 'already_member' | null;
}

/**
 * Rejoindre un challenge, en une seule décision.
 *
 * Rien n'est écrit tant que le bouton n'est pas cliqué : la sélection se
 * construit côté client, et le groupe — donc son jeton — n'est créé qu'au clic.
 * C'est ce qui évite de copier un board et de provisionner une branche juste
 * pour afficher un lien que personne n'utilisera peut-être.
 *
 * Un groupe d'une personne se comporte exactement comme un solo (multiplicateur
 * 1, workspace à soi), mais garde la porte ouverte — ce qu'une participation
 * solo ne fait jamais. Inviter est donc strictement plus sûr que partir seul,
 * et la copie de cet écran ne doit pas laisser croire le contraire.
 */
export function JoinModal({
  challengeId, challengeType, onClose, onJoined,
}: {
  challengeId: string;
  challengeType: string;
  onClose: () => void;
  onJoined: () => Promise<void> | void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const [copied, setCopied] = useState(false);

  const { join, joining, error } = useJoinChallenge(challengeId, onJoined);
  const action = joinAction(selected.length);

  // Recherche débattue : une frappe ne doit pas produire une requête.
  useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/contributors/search?q=${encodeURIComponent(term.trim())}&challenge=${challengeId}`
        );
        const data = res.ok ? await res.json() : { results: [] };
        if (!cancelled) setResults(data.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, challengeId]);

  const add = (person: SearchResult) => {
    if (!canSelectMore(selected.length)) return;
    if (selected.some(s => s.uuid === person.uuid)) return;
    setSelected(prev => [...prev, person]);
    setTerm('');
  };

  const remove = (uuid: string) => setSelected(prev => prev.filter(s => s.uuid !== uuid));

  const submit = async () => {
    const result = await join(action.mode === 'group' ? { mode: 'group' } : {});
    if (!result) return; // `error` est déjà posé par le hook

    if (action.mode === 'solo') { onClose(); return; }

    const token = result.groupId;
    if (!token) { onClose(); return; }

    // Les invitations sont envoyées après coup et ne sont pas fatales : le join
    // est déjà commité. Même traitement que les template tasks et le brief du
    // tiroir de création.
    const outcomes = await Promise.all(selected.map(async person => {
      try {
        const res = await fetch(`/api/challenges/${challengeId}/group/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: person.uuid }),
        });
        return res.ok;
      } catch {
        return false;
      }
    }));
    setSentCount(outcomes.filter(Boolean).length);
    setInviteUrl(`${window.location.origin}/challenges/${challengeId}?group=${token}`);
  };

  const copy = async () => {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); } catch { /* lien sélectionnable à la main */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="animate-pop-in relative w-full max-w-lg rounded-[20px] border border-white/10 bg-background p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white/60">
          <X className="h-4 w-4" />
        </button>

        {inviteUrl ? (
          // ── Confirmation : le lien reste utile pour qui n'a pas de compte ──
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">You&apos;re in</h2>
            <p className="text-xs leading-relaxed text-white/45">
              {sentCount === selected.length
                ? `${sentCount} invitation${sentCount > 1 ? 's' : ''} sent.`
                : `${sentCount} of ${selected.length} invitations sent — share the link with the others.`}
              {' '}They can also join with this link:
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/60">{inviteUrl}</code>
              <button onClick={copy} className="shrink-0 text-white/40 hover:text-brandCP">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-full bg-brandCP px-6 py-3 text-sm font-semibold"
              style={{ color: '#fff' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Join this challenge</h2>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <input
                value={term}
                onChange={e => setTerm(e.target.value)}
                disabled={!canSelectMore(selected.length)}
                placeholder={canSelectMore(selected.length)
                  ? 'Search contributors to team up with…'
                  : `You can invite up to ${MAX_INVITEES} people`}
                className="w-full bg-transparent text-sm outline-none placeholder:text-white/25"
                style={{ color: 'var(--foreground)' }}
              />
              {searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/30" />}
            </div>

            {results.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {results.map(person => {
                  const alreadyPicked = selected.some(s => s.uuid === person.uuid);
                  const blocked = !!person.blocked_reason || alreadyPicked;
                  return (
                    <button
                      key={person.uuid}
                      onClick={() => add(person)}
                      disabled={blocked}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span className="truncate text-sm text-white/80">{person.full_name}</span>
                      {blocked && (
                        <span className="shrink-0 text-[11px] text-white/30">
                          {alreadyPicked ? 'added' : 'already joined'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map(person => (
                  <span
                    key={person.uuid}
                    className="flex items-center gap-1.5 rounded-full bg-brandCP/12 px-3 py-1 text-xs text-brandCP"
                  >
                    {person.full_name}
                    <button onClick={() => remove(person.uuid)} aria-label={`Remove ${person.full_name}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <p className="text-xs leading-relaxed text-white/45">
                {action.mode === 'group'
                  ? `You and ${selected.length} other${selected.length > 1 ? 's' : ''} — one board, one branch, one contribution, split between you.`
                  : challengeType === 'ml'
                    ? 'You can submit your dataset and model on your own.'
                    : 'Joining copies the template tasks onto your board and provisions your branch.'}
              </p>
              <p className="text-[11px] text-white/25">
                You cannot switch between solo and group afterwards.
              </p>
            </div>

            <button
              onClick={submit}
              disabled={joining}
              style={{ color: '#fff' }}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brandCP px-6 py-3 text-sm font-semibold transition-all duration-200 hover:bg-brandCP/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {joining
                ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#fff' }} />
                : action.mode === 'group'
                  ? <Users className="h-4 w-4" style={{ color: '#fff' }} />
                  : <UserPlus className="h-4 w-4" style={{ color: '#fff' }} />}
              {action.label}
            </button>

            {error && <p className="text-center text-xs text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no error mentioning `JoinModal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/leaderboard-client/src/components/challenges/JoinModal.tsx
git commit -m "feat(join): single modal with contributor picker and one button"
```

---

### Task 7: Wire the modal into the challenge page

**Files:**
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeBrief.tsx`

**Interfaces:**
- Consumes: `JoinModal` (Task 6), `showJoinInHeader` (Task 5).
- Produces: nothing downstream.

- [ ] **Step 1: Replace the Docs button in the header**

In `page.tsx`, add the imports:

```tsx
import { JoinModal } from '@/components/challenges/JoinModal';
import { showJoinInHeader } from '@/lib/joinGate';
```

Add the state, beside `docsDrawerOpen`:

```tsx
const [joinModalOpen, setJoinModalOpen] = useState(false);
```

Add the derived flag, beside `showBrief`:

```tsx
// `Join` prend la place de `Docs` tant que le visiteur n'a pas rejoint.
// La condition ignore `isAnonymous` volontairement : la page est publique, et
// le bouton renvoie alors vers la connexion plutôt que d'ouvrir la modale.
const joinInHeader = showJoinInHeader({
  isMember,
  challengeType: challenge?.type,
  challengeStatus: challenge?.status,
});
```

Replace the `Docs` button (`page.tsx:414-422`) with:

```tsx
            {joinInHeader ? (
              isAnonymous ? (
                // Aucun chemin ne doit permettre à un non-connecté de lancer
                // une requête de join : on l'envoie se connecter.
                <a
                  href={`/signin?from=/challenges/${challengeId}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-brandCP px-4 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  style={{ color: '#fff' }}
                >
                  <UserPlus className="h-3.5 w-3.5" style={{ color: '#fff' }} />
                  Join
                </a>
              ) : (
                <button
                  onClick={() => setJoinModalOpen(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-brandCP px-4 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                  style={{ color: '#fff' }}
                >
                  <UserPlus className="h-3.5 w-3.5" style={{ color: '#fff' }} />
                  Join
                </button>
              )
            ) : (
              <button
                onClick={() => setDocsDrawerOpen(true)}
                title="Documents"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-brandCP/30 hover:bg-brandCP/[0.07] hover:text-brandCP/70 hover:shadow-[0_4px_16px_rgba(10,247,193,0.1)] active:translate-y-0"
              >
                <FileText className="h-3.5 w-3.5" />
                Docs
              </button>
            )}
```

Add `UserPlus` to the `lucide-react` import on line 9.

- [ ] **Step 2: Render the modal**

Beside `<GroupInviteModal ... />` near the end of the file:

```tsx
      {joinModalOpen && challenge && (
        <JoinModal
          challengeId={challengeId}
          challengeType={challenge.type ?? 'code'}
          onClose={() => setJoinModalOpen(false)}
          onJoined={reloadBoard}
        />
      )}
```

`reloadBoard` is the existing silent refresh declared at `page.tsx:262` — it
invalidates `['challenge-overview', challengeId]`, which is what flips
`isMember` and swaps the brief for the workspace without a page reload. It is
already what the page passes to its own `useJoinChallenge`.

> **Two instances of `useJoinChallenge` now coexist, and that is correct.**
> The page keeps its own (`page.tsx:269`) because the `invite` branch of
> `ChallengeBrief` still needs `acceptInvite`, `joining` and `joinError`. The
> modal instantiates its own for the solo/group path. They are independent
> flows with independent pending states — do not "tidy" them into one.

- [ ] **Step 3: Collapse the brief to one button**

In `ChallengeBrief.tsx`, replace the non-invite branch (the `<>` holding two
`JoinButton`s and the two captions) with a single button that opens the modal.
Change the props: drop `onJoin` and `onJoinGroup`, add `onOpenJoin: () => void`.

```tsx
          <>
            <JoinButton onClick={onOpenJoin} joining={joining} />
            <p className="text-center text-xs text-white/35">
              {JOIN_CAPTIONS[challengeType] ?? 'Joining adds you to this challenge.'}
            </p>
          </>
```

Delete the `You cannot switch between the two afterwards.` paragraph — it now
lives in the modal, where the decision is actually made. Leaving it in both
places would be two sources for one rule.

The `invite` branch is **unchanged**: someone arriving through a link has one
action, and it is not this modal.

In `page.tsx`, update the call site: `onOpenJoin={() => setJoinModalOpen(true)}`,
removing `onJoin` and `onJoinGroup`.

- [ ] **Step 4: Verify it compiles**

Run: `cd apps/leaderboard-client && npx tsc --noEmit`
Expected: no errors. If `createGroup` is now unused in `page.tsx`, delete it.

- [ ] **Step 5: Verify manually**

With the dev server running and the seeded database:

1. Sign out. Open a code challenge → the header shows `Join`; clicking it lands
   on the Google sign-in, **not** a `Network error`.
2. Sign in as a contributor who has not joined. Header shows `Join` → the modal
   opens on the search.
3. Search a contributor already on the challenge → shown, disabled,
   `already joined`.
4. Add two → the search input disables and the button reads `Join as a group`.
5. Remove one with its `✕` → the button still reads `Join as a group`.
6. Remove the last → the button reads `Join`.
7. Click with two selected → the confirmation shows the link and
   `2 invitations sent`. Header now shows `Docs` again.
8. Sign in as an invitee → `/contributors/me?tab=notifications` after Task 8.

- [ ] **Step 6: Commit**

```bash
git add "apps/leaderboard-client/src/app/challenges/[id]/page.tsx" apps/leaderboard-client/src/components/challenges/ChallengeBrief.tsx
git commit -m "feat(join): header Join button and single-decision brief"
```

---

### Task 8: Notifications tab on the profile

**Files:**
- Create: `apps/leaderboard-client/src/components/contributor/NotificationsTab.tsx`
- Modify: `apps/leaderboard-client/src/app/contributors/me/page.tsx`

**Interfaces:**
- Consumes: `GET /api/notifications`, `PATCH /api/notifications/:id` (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Write the component**

Create `apps/leaderboard-client/src/components/contributor/NotificationsTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Users } from 'lucide-react';

interface NotificationView {
  uuid: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string | null;
}

/**
 * Les notifications du contributeur.
 *
 * Une notification `group_invite` transporte un lien, et rien d'autre : il n'y
 * a ni acceptation ni refus. Cliquer mène à `/challenges/:id?group=<token>`,
 * c'est-à-dire au parcours d'invitation existant, avec ses gardes.
 *
 * Rien n'est écrit ici pour la péremption : une invitation devenue caduque
 * atterrit sur l'écran de barrière que `GET /group/:token` produit déjà, avec
 * ses quatre motifs. La notification n'a pas besoin de savoir que le groupe
 * s'est rempli — la page vers laquelle elle pointe, si.
 */
export function NotificationsTab() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notifications')
      .then(r => (r.ok ? r.json() : { notifications: [] }))
      .then(data => { if (!cancelled) setItems(data.notifications ?? []); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const open = async (item: NotificationView) => {
    const challengeId = String(item.payload.challengeId ?? '');
    const token = String(item.payload.groupToken ?? '');
    if (!challengeId || !token) return;
    // Marquage non bloquant : la navigation compte plus que la pastille.
    fetch(`/api/notifications/${item.uuid}`, { method: 'PATCH' }).catch(() => {});
    router.push(`/challenges/${challengeId}?group=${token}`);
  };

  if (loading) {
    return <p className="py-8 text-center text-xs text-white/30">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-10 text-center">
        <Bell className="h-5 w-5 text-white/20" />
        <p className="text-sm text-white/40">Nothing here yet.</p>
        <p className="text-xs text-white/25">
          Group invitations from other contributors will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2 py-2">
      {items.map(item => (
        <button
          key={item.uuid}
          onClick={() => open(item)}
          className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
            item.read
              ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
              : 'border-brandCP/20 bg-brandCP/[0.04] hover:bg-brandCP/[0.07]'
          }`}
        >
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-brandCP/70" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/85">
              <span className="font-semibold">{String(item.payload.fromName ?? 'A contributor')}</span>
              {' invited you to their group on '}
              <span className="font-semibold">{String(item.payload.challengeTitle ?? 'a challenge')}</span>
            </p>
            {item.created_at && (
              <p className="mt-0.5 text-[11px] text-white/25">
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
          {!item.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brandCP" />}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the tab**

In `apps/leaderboard-client/src/app/contributors/me/page.tsx`, add the import and
push the tab after `Contributions` (before the role-conditional pushes, so it is
visible to every role):

```tsx
import { NotificationsTab } from "@/components/contributor/NotificationsTab";
```

```tsx
    {
      label: "Notifications",
      panel: <NotificationsTab />,
    },
```

`ContributorTabs` already resolves `?tab=` case-insensitively against the label,
so `/contributors/me?tab=notifications` deep-links with no extra work.

- [ ] **Step 3: Verify manually**

1. As the inviter, invite a contributor through the modal.
2. Sign in as that contributor, open `/contributors/me?tab=notifications`.
3. The row is unread (accented border + dot) and names the inviter and challenge.
4. Click → lands on the challenge with the group invite screen.
5. Go back to the tab → the row is now read.
6. Invite the same person again from the same group → still **one** row.

- [ ] **Step 4: Commit**

```bash
git add apps/leaderboard-client/src/components/contributor/NotificationsTab.tsx apps/leaderboard-client/src/app/contributors/me/page.tsx
git commit -m "feat(notifications): profile tab listing group invitations"
```

---

### Task 9: Documentation

**Files:**
- Modify: `docs/challenge-groups.md`
- Modify: `docs/api.md`
- Modify: `docs/auth.md`
- Modify: `docs/database.md`

> This task is not optional housekeeping. `docs/challenge-groups.md` currently
> asserts things this change makes false; leaving it is worse than never having
> written it.

- [ ] **Step 1: Correct the two claims this change overturns**

In `docs/challenge-groups.md`, under *Forming a group*, replace

> There is no invitation record, no pending state, no notification: **the link
> is the invitation**.

with a paragraph saying: there is now an invitation **record** — a
`group_invite` notification — but still **no pending state and no acceptance**.
The notification carries the link, and the link remains the invitation. Every
barrier stays in `GET /group/:token` and `POST /join`. What changed is delivery,
not semantics.

In *Also rejected*, remove the `A contributor picker` line and add to the
*Forming a group* section that the picker is a **search**, not a list — which is
what answers the original objection that "the list can get long" — and that
contributors already on the challenge are shown disabled with their reason
rather than hidden.

Leave `A public list of open groups` in the rejected list. It is still rejected
and still true: you can invite someone you name, and you can be invited, but you
cannot browse.

- [ ] **Step 2: Update the flow diagram**

Replace the `Join as a group` block under *Forming a group* with:

```
Join (single button, label follows the selection)
   → 0 selected   POST /join {}                    solo
   → 1–2 selected POST /join { mode: 'group' }     creates group_id, copies the
                                                    board, provisions the branch,
                                                    returns the token
                  POST /group/invite × N           one notification each
                  → confirmation shows the link
```

- [ ] **Step 3: Document the routes**

In `docs/api.md`, add:

| Route | Method | Who |
|---|---|---|
| `/api/contributors/search?q=&challenge=` | GET | any signed-in user — three fields only, never email |
| `/api/challenges/:id/group/invite` | POST | a member of that group on that challenge |
| `/api/notifications` | GET, PATCH | the owner |
| `/api/notifications/:id` | PATCH | the owner |

- [ ] **Step 4: Document the proxy entries**

In `docs/auth.md`, add `/api/notifications/**` to the matcher list and add two
rows to the write-exceptions table: *Group invite* (`POST` on any path ending in
`/group/invite`) and *Own notifications* (`PATCH` under `/api/notifications`).

- [ ] **Step 5: Document the table**

In `docs/database.md`, add `notifications` with its columns and a line on why
`payload` is denormalised and what `dedupe_key` carries.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs: group invitations by notification"
```

---

## Final verification

- [ ] `npm test` — the whole suite passes, not only the new files.
- [ ] `cd apps/leaderboard-client && npx tsc --noEmit` — clean.
- [ ] `cd apps/leaderboard-client && npm run build` — succeeds.
- [ ] Walk Task 7 Step 5 and Task 8 Step 3 end to end once more on a fresh
      `npm run db:seed:force && npm run db:seed && npm run db:seed:sandbox`.
- [ ] Confirm the signed-out header `Join` reaches Google sign-in — the parked
      bug from the spec, closed by construction rather than by error handling.
