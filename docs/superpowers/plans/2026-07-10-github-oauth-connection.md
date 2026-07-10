# GitHub OAuth Connection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an admin to connect their GitHub org account via OAuth App, storing an encrypted token in `app_settings` so all connectors use it instead of the static `.env` `GITHUB_TOKEN`.

**Architecture:** DB columns on `app_settings` singleton hold the encrypted token + org metadata. A `packages/config/githubToken.ts` module handles AES-256-GCM encrypt/decrypt and DB-first token resolution with `.env` fallback. Four Next.js API routes implement the OAuth flow. `ConnectorRegistry.createConnector()` becomes async to call `getGithubToken()`. A `GitHubConnectionCard` client component in the Appearance tab lets admins connect/disconnect.

**Tech Stack:** Next.js 14 App Router, Drizzle ORM, native Node.js `crypto`, `fetch` (built-in), Vitest

## Global Constraints

- No new npm dependencies — only Node.js built-in `crypto` and existing `fetch`
- Token must never appear in API responses or logs; only masked `ghp_****...****` form in UI
- CSRF state cookie: name `gh_oauth_state`, httpOnly, maxAge 600s (10 min), SameSite=lax
- AES-256-GCM: 12-byte random IV, 16-byte auth tag appended to ciphertext, both base64/hex encoded
- Org validation: only `state === "active"` AND `role === "admin" OR "owner"` — any other account rejected
- `ConnectorRegistry.createConnector()` signature changes to `async` — all callers must `await` it
- All new API routes use `verifyAdmin(request)` from `@/lib/auth`
- Drizzle migration: run `npx drizzle-kit push` after schema changes (not a code step, just a shell step)
- GitHub OAuth API endpoint for memberships: `GET https://api.github.com/user/memberships/orgs?state=active`

---

### Task 1: DB Schema + Entity + Mapper

**Files:**
- Modify: `packages/database-service/db/drizzle.ts` (add 5 columns to `app_settings` table)
- Modify: `packages/database-service/domain/entities.ts` (extend `AppSettings` interface)
- Modify: `packages/database-service/db/mappers.ts` (update `toDomainAppSettings`)

**Interfaces:**
- Produces: `AppSettings` entity gains `github_org`, `github_connected_at`, `github_connected_by`, `github_is_connected`; DB row has `github_token_enc` and `github_token_iv` (not in entity — sensitive)

- [ ] **Step 1: Add columns to `app_settings` in `packages/database-service/db/drizzle.ts`**

  Find the `app_settings` table definition (currently ends at `updated_by`). Add 5 columns immediately after `updated_by`:

  ```ts
  // --- APP SETTINGS (singleton) ---
  export const app_settings = pgTable("app_settings", {
    id: integer("id").primaryKey().default(1),
    theme_key: varchar("theme_key", { length: 64 }).notNull().default("default"),
    primary_color: varchar("primary_color", { length: 7 }),
    background_color: varchar("background_color", { length: 7 }),
    theme_mode: varchar("theme_mode", { length: 10 }).notNull().default("dark"),
    updated_at: timestamp("updated_at").defaultNow(),
    updated_by: uuid("updated_by").references(() => users.uuid),
    // GitHub OAuth connection
    github_token_enc: text("github_token_enc"),
    github_token_iv: varchar("github_token_iv", { length: 64 }),
    github_org: varchar("github_org", { length: 255 }),
    github_connected_at: timestamp("github_connected_at"),
    github_connected_by: uuid("github_connected_by").references(() => users.uuid),
  });
  ```

- [ ] **Step 2: Run `drizzle-kit push` to apply migration**

  ```bash
  cd C:\Users\alixc\Desktop\LEADER\leaderboard_new\leaderboard
  npx drizzle-kit push
  ```

  Expected: "Changes applied" or "No changes" if already applied. Accept any prompts to truncate/alter.

- [ ] **Step 3: Update `AppSettings` interface in `packages/database-service/domain/entities.ts`**

  Find the `AppSettings` interface (currently has `theme_key`, `primary_color`, `background_color`, `theme_mode`, `updated_at`). Add the new fields:

  ```ts
  // --- APP SETTINGS ---
  export interface AppSettings {
    theme_key: string;
    primary_color?: string | null;
    background_color?: string | null;
    theme_mode: string;
    updated_at?: Date;
    github_org?: string | null;
    github_connected_at?: Date | null;
    github_connected_by?: string | null;
    github_is_connected: boolean; // derived: !!github_token_enc in DB
  }
  ```

- [ ] **Step 4: Update `toDomainAppSettings` in `packages/database-service/db/mappers.ts`**

  Find `toDomainAppSettings` (currently at ~line 592). Replace it:

  ```ts
  export function toDomainAppSettings(row: InferSelectModel<typeof app_settings>): AppSettings {
    return {
      theme_key: row.theme_key,
      primary_color: row.primary_color ?? null,
      background_color: row.background_color ?? null,
      theme_mode: row.theme_mode ?? "dark",
      updated_at: row.updated_at ?? undefined,
      github_org: row.github_org ?? null,
      github_connected_at: row.github_connected_at ?? null,
      github_connected_by: row.github_connected_by ?? null,
      github_is_connected: !!row.github_token_enc,
    };
  }
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: 0 errors related to the files touched above.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/database-service/db/drizzle.ts packages/database-service/domain/entities.ts packages/database-service/db/mappers.ts
  git commit -m "feat(db): add GitHub OAuth columns to app_settings"
  ```

---

### Task 2: Config + Encryption Module

**Files:**
- Modify: `packages/config/index.ts` (add 4 new optional env vars to zod schema + config object)
- Create: `packages/config/githubToken.ts` (AES-256-GCM encrypt/decrypt + `getGithubToken()`)
- Create: `apps/leaderboard-client/src/test/githubToken.test.ts`

**Interfaces:**
- Consumes: `packages/database-service/repositories/index.ts` (dynamic import to avoid circular dep)
- Produces:
  - `encryptToken(token: string): { enc: string; iv: string }`
  - `decryptToken(enc: string, ivHex: string): string`
  - `getGithubToken(): Promise<string | null>` — DB-first, falls back to `config.github.token`

- [ ] **Step 1: Write failing test for encryption round-trip**

  Create `apps/leaderboard-client/src/test/githubToken.test.ts`:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  // Must set env before importing the module
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex

  import { encryptToken, decryptToken } from '../../../../packages/config/githubToken.js';

  describe('githubToken encryption', () => {
    it('round-trips a token correctly', () => {
      const original = 'ghp_testtoken123456';
      const { enc, iv } = encryptToken(original);
      expect(enc).toBeTruthy();
      expect(iv).toHaveLength(24); // 12 bytes = 24 hex chars
      const decrypted = decryptToken(enc, iv);
      expect(decrypted).toBe(original);
    });

    it('produces different ciphertext each call (random IV)', () => {
      const token = 'ghp_testtoken123456';
      const first = encryptToken(token);
      const second = encryptToken(token);
      expect(first.enc).not.toBe(second.enc);
      expect(first.iv).not.toBe(second.iv);
    });

    it('throws on wrong key (corrupted ciphertext)', () => {
      const { enc, iv } = encryptToken('ghp_test');
      expect(() => decryptToken(enc + 'corrupt', iv)).toThrow();
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  cd apps/leaderboard-client && npx vitest run src/test/githubToken.test.ts 2>&1 | tail -20
  ```

  Expected: FAIL — `encryptToken` does not exist yet.

- [ ] **Step 3: Add 4 new optional env vars to `packages/config/index.ts`**

  In the `envSchema` zod object, add after `CRON_SECRET`:

  ```ts
  // GitHub OAuth App
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_OAUTH_REDIRECT_URI: z.string().optional(),
  GITHUB_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  ```

  In the `envInput` object, add:

  ```ts
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_OAUTH_REDIRECT_URI: process.env.GITHUB_OAUTH_REDIRECT_URI,
  GITHUB_TOKEN_ENCRYPTION_KEY: process.env.GITHUB_TOKEN_ENCRYPTION_KEY,
  ```

  In the `config` export object, add a `githubOAuth` section:

  ```ts
  githubOAuth: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    redirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
    encryptionKey: env.GITHUB_TOKEN_ENCRYPTION_KEY,
  },
  ```

- [ ] **Step 4: Create `packages/config/githubToken.ts`**

  ```ts
  import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
  import { config } from './index.js';

  function getKey(): Buffer {
    const hexKey = process.env.GITHUB_TOKEN_ENCRYPTION_KEY ?? config.githubOAuth.encryptionKey ?? '';
    if (!hexKey || hexKey.length !== 64) {
      throw new Error('[githubToken] GITHUB_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    }
    return Buffer.from(hexKey, 'hex');
  }

  export function encryptToken(token: string): { enc: string; iv: string } {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      enc: Buffer.concat([encrypted, tag]).toString('base64'),
      iv: iv.toString('hex'),
    };
  }

  export function decryptToken(enc: string, ivHex: string): string {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(enc, 'base64');
    const tag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(0, data.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  export async function getGithubToken(): Promise<string | null> {
    try {
      const { AppSettingsRepository } = await import('../database-service/repositories/index.js');
      const repo = new AppSettingsRepository();
      // Read raw row directly to access sensitive columns not exposed in AppSettings entity
      const { db, app_settings } = await import('../database-service/db/drizzle.js');
      const { eq } = await import('drizzle-orm');
      const [row] = await db.select().from(app_settings).where(eq(app_settings.id, 1));
      if (row?.github_token_enc && row?.github_token_iv) {
        return decryptToken(row.github_token_enc, row.github_token_iv);
      }
    } catch {
      // DB unavailable or no token stored — fall through to .env
    }
    return config.github.token ?? null;
  }
  ```

  > Note: `getGithubToken()` bypasses the `AppSettings` entity (which deliberately omits the raw encrypted fields) and queries the DB row directly to access `github_token_enc` + `github_token_iv`.

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  cd apps/leaderboard-client && npx vitest run src/test/githubToken.test.ts 2>&1 | tail -20
  ```

  Expected: 3 tests passing.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/config/index.ts packages/config/githubToken.ts apps/leaderboard-client/src/test/githubToken.test.ts
  git commit -m "feat(config): add GitHub OAuth config + AES-256-GCM token encryption"
  ```

---

### Task 3: AppSettings Repository Methods

**Files:**
- Modify: `packages/database-service/repositories/appSettings.repo.ts`

**Interfaces:**
- Consumes: `app_settings` table (Drizzle), `AppSettings` entity, `toDomainAppSettings` mapper
- Produces:
  - `AppSettingsRepository.updateGithubConnection(data: { github_token_enc: string; github_token_iv: string; github_org: string; github_connected_by: string }): Promise<void>`
  - `AppSettingsRepository.clearGithubConnection(): Promise<void>`
  - `AppSettingsRepository.getRaw(): Promise<{ github_token_enc: string | null; github_token_iv: string | null } & AppSettings>` — not needed; `getGithubToken()` queries the DB directly

- [ ] **Step 1: Add `updateGithubConnection` and `clearGithubConnection` to `appSettings.repo.ts`**

  Add two new methods to the `AppSettingsRepository` class (after the existing `update` method):

  ```ts
  async updateGithubConnection(data: {
    github_token_enc: string;
    github_token_iv: string;
    github_org: string;
    github_connected_by: string;
  }): Promise<void> {
    const set = {
      github_token_enc: data.github_token_enc,
      github_token_iv: data.github_token_iv,
      github_org: data.github_org,
      github_connected_at: new Date(),
      github_connected_by: data.github_connected_by,
      updated_at: new Date(),
    };
    await db
      .insert(app_settings)
      .values({ id: 1, theme_key: "default", theme_mode: "dark", ...set })
      .onConflictDoUpdate({ target: app_settings.id, set });
  }

  async clearGithubConnection(): Promise<void> {
    const set = {
      github_token_enc: null,
      github_token_iv: null,
      github_org: null,
      github_connected_at: null,
      github_connected_by: null,
      updated_at: new Date(),
    };
    await db
      .update(app_settings)
      .set(set)
      .where(eq(app_settings.id, 1));
  }
  ```

  Note: `eq` is already imported in the file from `drizzle-orm`. Check the existing imports and add if missing.

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/database-service/repositories/appSettings.repo.ts
  git commit -m "feat(db): add updateGithubConnection + clearGithubConnection to AppSettingsRepository"
  ```

---

### Task 4: GitHub OAuth API Routes

**Files:**
- Create: `apps/leaderboard-client/src/app/api/github-oauth/authorize/route.ts`
- Create: `apps/leaderboard-client/src/app/api/github-oauth/callback/route.ts`
- Create: `apps/leaderboard-client/src/app/api/github-oauth/connection/route.ts`
- Create: `apps/leaderboard-client/src/app/api/github-oauth/status/route.ts`
- Create: `apps/leaderboard-client/src/test/github-oauth-routes.test.ts`

**Interfaces:**
- Consumes: `verifyAdmin` from `@/lib/auth`, `AppSettingsRepository` from DB, `encryptToken` from `packages/config/githubToken.ts`, `config.githubOAuth.*`
- Produces:
  - `GET /api/github-oauth/authorize` → 302 redirect to GitHub
  - `GET /api/github-oauth/callback?code=&state=` → 302 redirect (success or error)
  - `DELETE /api/github-oauth/connection` → `{ ok: true }`
  - `GET /api/github-oauth/status` → `{ connected: boolean; org: string | null; connected_at: string | null }`

- [ ] **Step 1: Write failing tests**

  Create `apps/leaderboard-client/src/test/github-oauth-routes.test.ts`:

  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { NextRequest } from 'next/server';

  vi.mock('@/lib/auth', () => ({
    verifyAdmin: vi.fn(),
  }));

  vi.mock('../../../../packages/database-service/repositories', () => ({
    AppSettingsRepository: class {
      async get() {
        return {
          github_is_connected: true,
          github_org: 'MyTwin-Lab',
          github_connected_at: new Date('2026-07-10T00:00:00Z'),
          github_connected_by: null,
          theme_key: 'default',
          theme_mode: 'dark',
        };
      }
      async clearGithubConnection() {}
    },
  }));

  vi.mock('../../../../packages/config', () => ({
    config: {
      githubOAuth: {
        clientId: 'Iv1.test',
        clientSecret: 'secret',
        redirectUri: 'http://localhost:3000/api/github-oauth/callback',
        encryptionKey: null,
      },
      github: { token: null },
    },
  }));

  import { GET as authorizeGET } from '../app/api/github-oauth/authorize/route';
  import { GET as statusGET } from '../app/api/github-oauth/status/route';
  import { DELETE as connectionDELETE } from '../app/api/github-oauth/connection/route';
  import { verifyAdmin } from '@/lib/auth';

  const mockVerifyAdmin = verifyAdmin as ReturnType<typeof vi.fn>;

  describe('GET /api/github-oauth/authorize', () => {
    it('returns 401 when not admin', async () => {
      mockVerifyAdmin.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/github-oauth/authorize');
      const res = await authorizeGET(req);
      expect(res.status).toBe(401);
    });

    it('redirects to GitHub when admin', async () => {
      mockVerifyAdmin.mockResolvedValueOnce({ userId: 'u1', role: 'admin', email: 'a@b.com' });
      const req = new NextRequest('http://localhost/api/github-oauth/authorize');
      const res = await authorizeGET(req);
      expect(res.status).toBe(302);
      const location = res.headers.get('location') ?? '';
      expect(location).toContain('github.com/login/oauth/authorize');
      expect(location).toContain('client_id=Iv1.test');
      expect(res.headers.get('set-cookie')).toContain('gh_oauth_state');
    });
  });

  describe('GET /api/github-oauth/status', () => {
    it('returns 401 when not admin', async () => {
      mockVerifyAdmin.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/github-oauth/status');
      const res = await statusGET(req);
      expect(res.status).toBe(401);
    });

    it('returns connected status', async () => {
      mockVerifyAdmin.mockResolvedValueOnce({ userId: 'u1', role: 'admin', email: 'a@b.com' });
      const req = new NextRequest('http://localhost/api/github-oauth/status');
      const res = await statusGET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.connected).toBe(true);
      expect(body.org).toBe('MyTwin-Lab');
      expect(body.token).toBeUndefined(); // token must never be returned
    });
  });

  describe('DELETE /api/github-oauth/connection', () => {
    it('returns 401 when not admin', async () => {
      mockVerifyAdmin.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/github-oauth/connection', { method: 'DELETE' });
      const res = await connectionDELETE(req);
      expect(res.status).toBe(401);
    });

    it('returns ok:true when admin', async () => {
      mockVerifyAdmin.mockResolvedValueOnce({ userId: 'u1', role: 'admin', email: 'a@b.com' });
      const req = new NextRequest('http://localhost/api/github-oauth/connection', { method: 'DELETE' });
      const res = await connectionDELETE(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  cd apps/leaderboard-client && npx vitest run src/test/github-oauth-routes.test.ts 2>&1 | tail -20
  ```

  Expected: FAIL — route files do not exist yet.

- [ ] **Step 3: Create `authorize/route.ts`**

  Create `apps/leaderboard-client/src/app/api/github-oauth/authorize/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { randomBytes } from 'crypto';
  import { verifyAdmin } from '@/lib/auth';
  import { config } from '../../../../../../../packages/config/index.js';

  export async function GET(request: NextRequest) {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    const clientId = config.githubOAuth.clientId;
    const redirectUri = config.githubOAuth.redirectUri;
    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 });
    }

    const state = randomBytes(16).toString('hex');
    const githubUrl = new URL('https://github.com/login/oauth/authorize');
    githubUrl.searchParams.set('client_id', clientId);
    githubUrl.searchParams.set('redirect_uri', redirectUri);
    githubUrl.searchParams.set('scope', 'repo read:org');
    githubUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(githubUrl.toString());
    response.cookies.set('gh_oauth_state', state, {
      httpOnly: true,
      maxAge: 600,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  }
  ```

- [ ] **Step 4: Create `callback/route.ts`**

  Create `apps/leaderboard-client/src/app/api/github-oauth/callback/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { encryptToken } from '../../../../../../../packages/config/githubToken.js';
  import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';
  import { verifyRequestToken } from '@/lib/auth';
  import { config } from '../../../../../../../packages/config/index.js';

  const appSettingsRepo = new AppSettingsRepository();
  const ERROR_BASE = '/contributors/me';

  export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    // Verify CSRF state
    const storedState = request.cookies.get('gh_oauth_state')?.value;
    if (!storedState || state !== storedState) {
      return NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=csrf`, request.url));
    }

    // Exchange code for token
    let accessToken: string;
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.githubOAuth.clientId,
          client_secret: config.githubOAuth.clientSecret,
          code,
          redirect_uri: config.githubOAuth.redirectUri,
        }),
      });
      const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
      if (!tokenData.access_token) throw new Error('no access_token');
      accessToken = tokenData.access_token;
    } catch {
      const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=exchange_failed`, request.url));
      res.cookies.delete('gh_oauth_state');
      return res;
    }

    // Verify org admin/owner membership
    let orgSlug: string;
    try {
      const membershipsRes = await fetch('https://api.github.com/user/memberships/orgs?state=active', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
      });
      const memberships = await membershipsRes.json() as Array<{
        state: string;
        role: string;
        organization: { login: string };
      }>;
      const adminOrgs = memberships
        .filter(m => m.state === 'active' && (m.role === 'admin' || m.role === 'owner'))
        .map(m => m.organization.login)
        .sort();
      if (adminOrgs.length === 0) {
        const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=no_org_admin`, request.url));
        res.cookies.delete('gh_oauth_state');
        return res;
      }
      orgSlug = adminOrgs[0];
    } catch {
      const res = NextResponse.redirect(new URL(`${ERROR_BASE}?github_error=exchange_failed`, request.url));
      res.cookies.delete('gh_oauth_state');
      return res;
    }

    // Get current admin user ID from their session token
    const payload = await verifyRequestToken(request);
    const connectedBy = payload?.userId ?? '';

    // Encrypt and persist
    const { enc, iv } = encryptToken(accessToken);
    await appSettingsRepo.updateGithubConnection({
      github_token_enc: enc,
      github_token_iv: iv,
      github_org: orgSlug,
      github_connected_by: connectedBy,
    });

    const res = NextResponse.redirect(new URL(ERROR_BASE, request.url));
    res.cookies.delete('gh_oauth_state');
    return res;
  }
  ```

- [ ] **Step 5: Create `connection/route.ts`**

  Create `apps/leaderboard-client/src/app/api/github-oauth/connection/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { verifyAdmin } from '@/lib/auth';
  import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

  const appSettingsRepo = new AppSettingsRepository();

  export async function DELETE(request: NextRequest) {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }
    await appSettingsRepo.clearGithubConnection();
    return NextResponse.json({ ok: true });
  }
  ```

- [ ] **Step 6: Create `status/route.ts`**

  Create `apps/leaderboard-client/src/app/api/github-oauth/status/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from 'next/server';
  import { verifyAdmin } from '@/lib/auth';
  import { AppSettingsRepository } from '../../../../../../../packages/database-service/repositories/index.js';

  const appSettingsRepo = new AppSettingsRepository();

  export async function GET(request: NextRequest) {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }
    const settings = await appSettingsRepo.get();
    return NextResponse.json({
      connected: settings.github_is_connected,
      org: settings.github_org ?? null,
      connected_at: settings.github_connected_at?.toISOString() ?? null,
    });
  }
  ```

- [ ] **Step 7: Run tests to verify they pass**

  ```bash
  cd apps/leaderboard-client && npx vitest run src/test/github-oauth-routes.test.ts 2>&1 | tail -30
  ```

  Expected: 6 tests passing (2 authorize + 2 status + 2 connection).

- [ ] **Step 8: Commit**

  ```bash
  git add apps/leaderboard-client/src/app/api/github-oauth apps/leaderboard-client/src/test/github-oauth-routes.test.ts
  git commit -m "feat(api): add GitHub OAuth authorize, callback, connection, status routes"
  ```

---

### Task 5: ConnectorRegistry Async + Update Callers

**Files:**
- Modify: `packages/connectors/registry.ts` (make `createConnector` async, use `getGithubToken()`)
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts` (add `await`)
- Modify: `packages/services/task_evaluation/task-evaluation.service.ts` (add `await`)
- Modify: `packages/services/webhook.service.ts` (add `await`)
- Modify: `packages/services/challenge/challenge-context.service.ts` (`.map` → `Promise.all`)
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.test.ts` (already exists, must still pass)

**Interfaces:**
- Consumes: `getGithubToken()` from `packages/config/githubToken.ts`
- Produces: `static async createConnector(repo: Repo, options?: { branch?: string }): Promise<ExternalConnector | null>`

- [ ] **Step 1: Update `packages/connectors/registry.ts`**

  Replace the import and method signature. Add import at the top:

  ```ts
  import { getGithubToken } from '../config/githubToken.js';
  ```

  Change the method from:

  ```ts
  static createConnector(repo: Repo, options?: { branch?: string }): ExternalConnector | null {
    switch (repo.type) {
      case 'github':
        // ...
        return new this.GitHubConnectorClass({
          token: config.github.token || "",
          // ...
        });
  ```

  To:

  ```ts
  static async createConnector(repo: Repo, options?: { branch?: string }): Promise<ExternalConnector | null> {
    switch (repo.type) {
      case 'github':
        if (!repo.external_repo_id) {
          console.error(`[ConnectorRegistry] Missing external_repo_id for GitHub repo: ${repo.title}`);
          return null;
        }
        const [owner, repoName] = repo.external_repo_id.split('/');
        if (!owner || !repoName) {
          console.error(`[ConnectorRegistry] Invalid external_repo_id format for repo: ${repo.title}. Expected "owner/repo", got "${repo.external_repo_id}"`);
          return null;
        }
        const token = await getGithubToken();
        if (!token) {
          console.error('[ConnectorRegistry] No GitHub token available (DB or .env)');
          return null;
        }
        return new this.GitHubConnectorClass({
          token,
          owner,
          repo: repoName,
          branch: options?.branch,
        });

      case 'kaggle_dataset':
      case 'kaggle_model':
        // keep exactly as before (no change)
        if (!repo.external_repo_id) {
          console.error(`[ConnectorRegistry] Missing external_repo_id for Kaggle repo: ${repo.title}`);
          return null;
        }
        return new this.KaggleConnectorClass({
          username: config.kaggle.username || "",
          apiKey: config.kaggle.apiKey || "",
          ref: repo.external_repo_id,
          subtype: repo.type as 'kaggle_dataset' | 'kaggle_model',
        });

      case 'slack':
        console.warn(`[ConnectorRegistry] Type '${repo.type}' not yet implemented for repo: ${repo.title}`);
        return null;

      case 'google_drive':
        return null;

      default:
        console.warn(`[ConnectorRegistry] Unknown repo type '${repo.type}' for repo: ${repo.title}`);
        return null;
    }
  }
  ```

  Remove the `config` import for `github.token` if it's only used there; keep `config` for `kaggle`.

- [ ] **Step 2: Update `apps/leaderboard-client/src/app/api/challenges/[id]/repo-activity/route.ts`**

  Find line 27:
  ```ts
  const connector = ConnectorRegistry.createConnector(repoForConnector as any);
  ```
  Change to:
  ```ts
  const connector = await ConnectorRegistry.createConnector(repoForConnector as any);
  ```

- [ ] **Step 3: Update `packages/services/task_evaluation/task-evaluation.service.ts`**

  Find line 225 (inside an async method):
  ```ts
  const connector = ConnectorRegistry.createConnector(workspace.repo, { branch: workspace.branch });
  ```
  Change to:
  ```ts
  const connector = await ConnectorRegistry.createConnector(workspace.repo, { branch: workspace.branch });
  ```

- [ ] **Step 4: Update `packages/services/webhook.service.ts`**

  Find line 235 (inside an async method):
  ```ts
  const connector = ConnectorRegistry.createConnector(targetRepo);
  ```
  Change to:
  ```ts
  const connector = await ConnectorRegistry.createConnector(targetRepo);
  ```

- [ ] **Step 5: Update `packages/services/challenge/challenge-context.service.ts`**

  Find lines 89–91 (inside async `initializeConnectors` method):
  ```ts
  const connectors = codeRepos
    .map(repo => ConnectorRegistry.createConnector(repo))
    .filter((c): c is ExternalConnector => c !== null);
  ```
  Change to:
  ```ts
  const connectors = (await Promise.all(codeRepos.map(repo => ConnectorRegistry.createConnector(repo))))
    .filter((c): c is ExternalConnector => c !== null);
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -30
  ```

  Expected: 0 errors.

- [ ] **Step 7: Run existing repo-activity tests**

  ```bash
  cd apps/leaderboard-client && npx vitest run src/app/api/challenges/\\[id\\]/repo-activity/route.test.ts 2>&1 | tail -20
  ```

  Expected: 2 tests passing. (The mock in the test file stubs `createConnector` as a sync function — it still works because the mock returns a resolved value synchronously and the test `await`s the route handler.)

- [ ] **Step 8: Commit**

  ```bash
  git add packages/connectors/registry.ts \
    apps/leaderboard-client/src/app/api/challenges/\\[id\\]/repo-activity/route.ts \
    packages/services/task_evaluation/task-evaluation.service.ts \
    packages/services/webhook.service.ts \
    packages/services/challenge/challenge-context.service.ts
  git commit -m "feat(connectors): make createConnector async, resolve token from DB or .env"
  ```

---

### Task 6: GitHubConnectionCard UI Component

**Files:**
- Create: `apps/leaderboard-client/src/components/contributor/GitHubConnectionCard.tsx`

**Interfaces:**
- Consumes: `GET /api/github-oauth/status`, `DELETE /api/github-oauth/connection`, `GET /api/github-oauth/authorize` (redirect)
- Props: `initialError?: string | null` (from `?github_error=` query param, passed by parent page)

- [ ] **Step 1: Create `GitHubConnectionCard.tsx`**

  Create `apps/leaderboard-client/src/components/contributor/GitHubConnectionCard.tsx`:

  ```tsx
  'use client';

  import { useState, useEffect } from 'react';

  interface GithubStatus {
    connected: boolean;
    org: string | null;
    connected_at: string | null;
  }

  interface Props {
    initialError?: string | null;
  }

  const ERROR_MESSAGES: Record<string, string> = {
    no_org_admin:
      'The connected GitHub account has no organization where you are an admin or owner. An organization account is required.',
    csrf: 'Connection attempt expired or was tampered with. Please try again.',
    exchange_failed: 'Failed to obtain GitHub token. Please try again.',
  };

  function maskToken(token: string): string {
    if (token.length <= 8) return '****';
    return `${token.slice(0, 4)}****...****${token.slice(-4)}`;
  }

  export function GitHubConnectionCard({ initialError }: Props) {
    const [status, setStatus] = useState<GithubStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);
    const [error, setError] = useState<string | null>(
      initialError ? (ERROR_MESSAGES[initialError] ?? initialError) : null
    );

    useEffect(() => {
      fetch('/api/github-oauth/status')
        .then(r => r.json())
        .then((data: GithubStatus) => setStatus(data))
        .catch(() => setStatus({ connected: false, org: null, connected_at: null }))
        .finally(() => setLoading(false));
    }, []);

    async function handleDisconnect() {
      setDisconnecting(true);
      try {
        const res = await fetch('/api/github-oauth/connection', { method: 'DELETE' });
        if (res.ok) {
          setStatus({ connected: false, org: null, connected_at: null });
          setError(null);
        }
      } finally {
        setDisconnecting(false);
      }
    }

    function handleConnect() {
      window.location.href = '/api/github-oauth/authorize';
    }

    const connectedAt = status?.connected_at
      ? new Date(status.connected_at).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        })
      : null;

    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--foreground)]">GitHub Integration</h3>
          {!loading && status?.connected && (
            <span className="text-xs font-medium text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Connected
            </span>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {loading ? (
          <div className="h-16 rounded-lg bg-[var(--muted)]/30 animate-pulse" />
        ) : status?.connected ? (
          <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
            <div className="flex justify-between">
              <span>Organization</span>
              <span className="text-[var(--foreground)] font-medium">{status.org}</span>
            </div>
            {connectedAt && (
              <div className="flex justify-between">
                <span>Connected</span>
                <span>{connectedAt}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Connect a GitHub org admin account to enable repository operations (branches, commits, PRs).
          </p>
        )}

        <div className="flex justify-end">
          {status?.connected ? (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-sm px-3 py-1.5 rounded-lg border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="text-sm px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity"
            >
              Connect GitHub Account
            </button>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: 0 errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/leaderboard-client/src/components/contributor/GitHubConnectionCard.tsx
  git commit -m "feat(ui): add GitHubConnectionCard component for admin Appearance tab"
  ```

---

### Task 7: Wire Card into Appearance Tab

**Files:**
- Modify: `apps/leaderboard-client/src/app/contributors/me/page.tsx`

**Interfaces:**
- Consumes: `GitHubConnectionCard` (new component), `searchParams` prop (Next.js page prop)
- `searchParams.github_error` → passed as `initialError` to `GitHubConnectionCard`

- [ ] **Step 1: Update `contributors/me/page.tsx`**

  The page is currently a server component without `searchParams`. Make these changes:

  **Add the import** at the top with the other contributor imports:
  ```ts
  import { GitHubConnectionCard } from '@/components/contributor/GitHubConnectionCard';
  ```

  **Add `searchParams` to the function signature** (Next.js 14 App Router pattern):
  ```ts
  export default async function ContributorSelfPage({
    searchParams,
  }: {
    searchParams?: Promise<{ github_error?: string }>;
  }) {
  ```

  **Resolve searchParams** at the top of the function body (after the existing `redirect` checks):
  ```ts
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const githubError = resolvedSearchParams.github_error ?? null;
  ```

  **Update the Appearance tab panel** (inside the `if (session.role === "admin")` block). The Appearance panel currently renders only `<ThemeSettings .../>`. Wrap both in a `space-y-6` div:

  ```tsx
  tabs.push({
    label: "Appearance",
    panel: (
      <div className="mx-auto max-w-lg py-2 space-y-6">
        <ThemeSettings
          currentTheme={themeKey}
          currentPrimaryColor={settings.primary_color ?? null}
          currentBackgroundColor={settings.background_color ?? null}
          currentThemeMode={settings.theme_mode}
        />
        <GitHubConnectionCard initialError={githubError} />
      </div>
    ),
  });
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd apps/leaderboard-client && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

  ```bash
  cd apps/leaderboard-client && npx vitest run 2>&1 | tail -30
  ```

  Expected: all tests pass (no regressions).

- [ ] **Step 4: Commit**

  ```bash
  git add apps/leaderboard-client/src/app/contributors/me/page.tsx
  git commit -m "feat(ui): wire GitHubConnectionCard into admin Appearance tab"
  ```

---

### Task 8: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add GitHub OAuth section to `.env.example`**

  Find the line `GITHUB_TOKEN=XXX` and add a new section after it:

  ```bash
  GITHUB_TOKEN=XXX

  # GitHub OAuth App — connect an org admin account via UI
  # Register at: https://github.com/settings/developers → OAuth Apps
  # Callback URL: http://localhost:3000/api/github-oauth/callback
  GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
  GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
  # AES-256 key for token encryption — generate: openssl rand -hex 32
  GITHUB_TOKEN_ENCRYPTION_KEY=<64 hex chars>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add .env.example
  git commit -m "docs: add GitHub OAuth env vars to .env.example"
  ```

---

## Manual Testing Checklist

After all tasks are complete, verify the feature end-to-end:

1. Generate a real `GITHUB_TOKEN_ENCRYPTION_KEY`: `openssl rand -hex 32` and add to `.env`
2. Register a GitHub OAuth App at github.com/settings/developers with callback `http://localhost:3000/api/github-oauth/callback`
3. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_OAUTH_REDIRECT_URI` to `.env`
4. Restart the dev server: `npm run dev`
5. Log in as an admin, go to `/contributors/me`, click "Appearance" tab
6. Verify "GitHub Integration" card is visible
7. Click "Connect GitHub Account" → should redirect to GitHub OAuth page
8. Authorize → should redirect back to `/contributors/me` with card showing org name and "Connected" badge
9. Click "Disconnect" → card reverts to disconnected state
10. Test error: use a personal GitHub account (no org) → should show `no_org_admin` error message
11. Verify repo-activity API still works: `GET /api/challenges/<id>/repo-activity` returns GitHub events using the DB token
