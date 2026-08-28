# Code Challenge Personal Boards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer les challenges `code` : chaque contributeur fait le challenge en entier avec un kanban personnel (tâches purement organisationnelles), et l'évaluation IA porte sur son projet global, récompensée en live via le ledger `reward_entries` (part fixe + cap × note/10, delta itératif).

**Architecture:** On étend les tables existantes : `tasks` gagne un `user_id` (NULL = tâche template admin) et un statut stocké 3 états ; `challenge_teams` devient la participation (workspace perso : branche provisionnée ou URL de repo) ; les récompenses passent par une fonction pure `computeCodeAward` + un `CodeRewardsService` calqué sur `MlRewardsService`. `task_assignees`, `task_workspaces`, la répartition au close (`RewardsService`/`computeRewards`) et l'évaluation par tâche disparaissent.

**Tech Stack:** Next.js 16 App Router (routes handlers), Drizzle ORM + PostgreSQL (`drizzle-kit push`, pas de fichiers de migration), zod, Vitest, React Query, dnd-kit, OpenAI agent evaluator existant.

**Spec:** `docs/superpowers/specs/2026-08-28-code-challenge-personal-boards-design.md`

## Global Constraints

- Pas de données réelles : aucune migration de données, on modifie le schéma (`npx drizzle-kit push --force`) et on reseed la démo.
- Le schéma DB vit dans `packages/database-service/db/drizzle.ts` ; entités dans `domain/entities.ts` ; zod dans `domain/schemas_zod.ts` ; mappers dans `db/mappers.ts` ; un repo par table dans `repositories/*.repo.ts` (exportés par `repositories/index.ts`).
- Les routes app importent les packages par chemin relatif profond (ex. `'../../../../../../../../packages/database-service/repositories'`) — compter les niveaux depuis le fichier réel.
- Auth dans les routes : cookie `access_token`, `jwtVerify` avec `process.env.JWT_SECRET`, payload `{ userId, role }` (copier le helper `getSession` de `api/challenges/[id]/ml-workspace/route.ts:43-53`).
- Tests : Vitest, co-localisés (`*.test.ts`). Lancer un fichier : `npx vitest run <chemin>`. Suite complète : `npm test`.
- Services : dépendances injectables via un objet `Deps` avec `Pick<Repo, '...'>` (pattern `MlRewardsDeps` de `ml-rewards.service.ts:54-67`).
- Ledger : `reward_entries` est append-only ; l'agrégat `contributions.reward` est synchronisé par le trigger DB `trg_sync_contribution_reward` — ne jamais écrire `contributions.reward` à la main.
- Types de challenge : `'code' | 'ml' | 'validation'` (varchar). Les flux ML et validation ne doivent pas changer de comportement.
- Nouveaux `rule_key` : `code_fixed`, `code_quality`. Nouveau type de contribution : `project` (une par `(challenge, user)`).
- `challenges.workspace_mode` : `'provided_repo' | 'own_repo'`, pertinent uniquement pour `type='code'`, défaut `'provided_repo'`.
- Statuts de tâche stockés : `'todo' | 'in_progress' | 'done'`. Les notions `solo`/`concurrent` disparaissent entièrement.
- Commits fréquents, un par tâche minimum, messages `feat(...)`/`refactor(...)`/`test(...)` comme l'historique.

---

### Task 1: Règles de reward code (`codeRewardRules.ts`)

**Files:**
- Create: `packages/database-service/domain/codeRewardRules.ts`
- Test: `packages/database-service/domain/codeRewardRules.test.ts`

**Interfaces:**
- Consumes: rien (module feuille).
- Produces: `codeRewardRulesSchema` (zod), `type CodeRewardRules = { version: 1; delivery: { fixed: number; cap: number } }`, `parseCodeRewardRules(raw: unknown): CodeRewardRules | null`, `DEFAULT_CODE_REWARD_RULES: CodeRewardRules`. Les tâches 2, 5, 6 et 12 importent ces noms exacts.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// packages/database-service/domain/codeRewardRules.test.ts
import { describe, it, expect } from "vitest";
import {
  parseCodeRewardRules,
  DEFAULT_CODE_REWARD_RULES,
  codeRewardRulesSchema,
} from "./codeRewardRules.js";

describe("parseCodeRewardRules", () => {
  it("parses valid v1 rules", () => {
    const rules = { version: 1, delivery: { fixed: 50, cap: 150 } };
    expect(parseCodeRewardRules(rules)).toEqual(rules);
  });

  it("returns null for null/undefined", () => {
    expect(parseCodeRewardRules(null)).toBeNull();
    expect(parseCodeRewardRules(undefined)).toBeNull();
  });

  it("returns null for ML-shaped rules", () => {
    // Des règles ML valides ne doivent pas passer pour des règles code.
    expect(
      parseCodeRewardRules({
        version: 1,
        dataset: { cap: 300 },
        model: { cap: 500, kaggleShare: 0.5, metric: { name: "auc", baseline: 0.5 }, beatBestBonus: 50 },
        apiPackaging: { cap: 200 },
        reuse: { datasetShare: 0.2, modelShare: 0.2, minKeepShare: 0.5 },
      })
    ).toBeNull();
  });

  it("rejects negative amounts", () => {
    expect(parseCodeRewardRules({ version: 1, delivery: { fixed: -1, cap: 100 } })).toBeNull();
  });

  it("has a valid default", () => {
    expect(codeRewardRulesSchema.safeParse(DEFAULT_CODE_REWARD_RULES).success).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npx vitest run packages/database-service/domain/codeRewardRules.test.ts`
Expected: FAIL — module `./codeRewardRules.js` introuvable.

- [ ] **Step 3: Implémenter**

```ts
// packages/database-service/domain/codeRewardRules.ts
import { z } from "zod";

/**
 * Règles de reward d'un challenge code (boards personnels).
 *
 * Même contrat que mlRewardRules.ts : stockées en JSON dans
 * `challenges.reward_rules`, versionnées, parsées en safeParse pour qu'un
 * challenge aux règles invalides s'affiche au lieu de planter.
 *
 * Points d'un run d'évaluation = fixed (livrable recevable) + cap × note/10.
 * Le delta itératif est calculé ailleurs (evaluator/code-reward.ts).
 */
export const codeRewardRulesV1Schema = z.object({
  version: z.literal(1),
  delivery: z.object({
    /** Part acquise dès qu'une évaluation aboutit, quelle que soit la note. */
    fixed: z.number().int().nonnegative(),
    /** Part variable maximale, modulée par la note agent /10. */
    cap: z.number().int().nonnegative(),
  }),
});

export type CodeRewardRules = z.infer<typeof codeRewardRulesV1Schema>;

/** Union des versions supportées — un seul membre aujourd'hui. */
export const codeRewardRulesSchema = codeRewardRulesV1Schema;

export function parseCodeRewardRules(raw: unknown): CodeRewardRules | null {
  if (!raw) return null;
  const result = codeRewardRulesSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const DEFAULT_CODE_REWARD_RULES: CodeRewardRules = {
  version: 1,
  delivery: { fixed: 25, cap: 75 },
};
```

- [ ] **Step 4: Vérifier le passage**

Run: `npx vitest run packages/database-service/domain/codeRewardRules.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/database-service/domain/codeRewardRules.ts packages/database-service/domain/codeRewardRules.test.ts
git commit -m "feat(rewards): code reward rules schema (fixed + cap)"
```

---

### Task 2: Fonction pure `computeCodeAward`

**Files:**
- Create: `packages/evaluator/code-reward.ts`
- Modify: `packages/database-service/domain/entities.ts:119-128` (RewardRuleKey)
- Modify: `packages/database-service/domain/schemas_zod.ts:95-105` (rewardRuleKeySchema)
- Test: `packages/evaluator/code-reward.test.ts`

**Interfaces:**
- Consumes: `CodeRewardRules` (Task 1), `RewardEntryDraft` (existant, `packages/evaluator/ml-reward.ts:19-27`), `RewardRuleKey`/`RewardEntryMeta` (entities).
- Produces: `computeCodeAward(input: CodeAwardInput): RewardEntryDraft[]` avec
  `interface CodeAwardInput { rules: CodeRewardRules; challengeId: string; userId: string; contributionId: string; score: number /* 0..10 */; alreadyAwarded: { code_fixed: number; code_quality: number }; remainingPool: number; }`.
  Task 5 (`CodeRewardsService`) consomme exactement cette signature.

- [ ] **Step 1: Étendre `RewardRuleKey`**

Dans `packages/database-service/domain/entities.ts`, ajouter deux membres à l'union `RewardRuleKey` (après `'validation'`) :

```ts
  | 'validation'
  | 'code_fixed'
  | 'code_quality';
```

Dans `packages/database-service/domain/schemas_zod.ts`, ajouter les deux valeurs à `rewardRuleKeySchema` :

```ts
export const rewardRuleKeySchema = z.enum([
  'dataset',
  'model_metric',
  'model_code',
  'beat_best',
  'api_packaging',
  'reuse_dataset',
  'reuse_model',
  'slack_signal',
  'validation',
  'code_fixed',
  'code_quality',
]);
```

- [ ] **Step 2: Écrire le test qui échoue**

```ts
// packages/evaluator/code-reward.test.ts
import { describe, it, expect } from "vitest";
import { computeCodeAward, type CodeAwardInput } from "./code-reward.js";

const RULES = { version: 1 as const, delivery: { fixed: 50, cap: 150 } };

function makeInput(over: Partial<CodeAwardInput> = {}): CodeAwardInput {
  return {
    rules: RULES,
    challengeId: "ch-1",
    userId: "alice",
    contributionId: "contrib-1",
    score: 8,
    alreadyAwarded: { code_fixed: 0, code_quality: 0 },
    remainingPool: 1000,
    ...over,
  };
}

describe("computeCodeAward", () => {
  it("first successful run pays fixed + cap × score/10", () => {
    const drafts = computeCodeAward(makeInput());
    expect(drafts).toHaveLength(2);
    const fixed = drafts.find(d => d.rule_key === "code_fixed")!;
    const quality = drafts.find(d => d.rule_key === "code_quality")!;
    expect(fixed.points).toBe(50);
    expect(quality.points).toBe(120); // 150 × 8/10
    expect(quality.meta?.agentScore).toBe(8);
    expect(quality.meta?.rawPoints).toBe(120);
  });

  it("re-run with a better score pays only the quality delta", () => {
    const drafts = computeCodeAward(makeInput({
      score: 9,
      alreadyAwarded: { code_fixed: 50, code_quality: 120 },
    }));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rule_key).toBe("code_quality");
    expect(drafts[0].points).toBe(15); // 135 − 120
  });

  it("re-run with a worse score pays nothing and never claws back", () => {
    const drafts = computeCodeAward(makeInput({
      score: 5,
      alreadyAwarded: { code_fixed: 50, code_quality: 120 },
    }));
    expect(drafts).toHaveLength(0);
  });

  it("clamps to the remaining pool, fixed first", () => {
    const drafts = computeCodeAward(makeInput({ remainingPool: 60 }));
    const fixed = drafts.find(d => d.rule_key === "code_fixed")!;
    const quality = drafts.find(d => d.rule_key === "code_quality")!;
    expect(fixed.points).toBe(50);
    expect(quality.points).toBe(10);
    expect(quality.meta?.clampedTo).toBe(10);
  });

  it("empty pool produces no rows at all", () => {
    expect(computeCodeAward(makeInput({ remainingPool: 0 }))).toHaveLength(0);
  });

  it("clamps score into [0, 10]", () => {
    const drafts = computeCodeAward(makeInput({ score: 14 }));
    expect(drafts.find(d => d.rule_key === "code_quality")!.points).toBe(150);
    const low = computeCodeAward(makeInput({ score: -2 }));
    expect(low.find(d => d.rule_key === "code_quality")).toBeUndefined();
  });

  it("zero-score run still pays the fixed part once", () => {
    const drafts = computeCodeAward(makeInput({ score: 0 }));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].rule_key).toBe("code_fixed");
  });
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `npx vitest run packages/evaluator/code-reward.test.ts`
Expected: FAIL — `./code-reward.js` introuvable.

- [ ] **Step 4: Implémenter**

```ts
// packages/evaluator/code-reward.ts
import type { CodeRewardRules } from "../database-service/domain/codeRewardRules.js";
import type { RewardRuleKey } from "../database-service/domain/entities.js";
import type { RewardEntryDraft } from "./ml-reward.js";

/**
 * Reward des challenges code (boards personnels).
 *
 * Comme ml-reward.ts : fonction pure, lignes de ledger immuables, montants
 * absolus clampés au pool restant. La spécificité code est le delta itératif :
 * chaque run recalcule les points bruts par règle et ne verse que
 * `max(0, brut − déjà versé)`. Une note qui baisse ne produit rien et rien
 * n'est jamais repris. Le fixe tombe au premier run réussi puis son delta
 * vaut 0 pour toujours — aucune logique "première fois" nécessaire.
 */
export interface CodeAwardInput {
  rules: CodeRewardRules;
  challengeId: string;
  userId: string;
  contributionId: string;
  /** Note agent ramenée sur 0..10. */
  score: number;
  /** Σ des lignes déjà au ledger pour (challenge, user), par règle. */
  alreadyAwarded: { code_fixed: number; code_quality: number };
  /** CP encore disponibles sur le challenge. Les deltas sont clampés dessus. */
  remainingPool: number;
}

export function computeCodeAward(input: CodeAwardInput): RewardEntryDraft[] {
  const score = Math.min(10, Math.max(0, input.score));
  let pool = Math.max(0, input.remainingPool);
  const drafts: RewardEntryDraft[] = [];

  const gross: Array<{ rule_key: RewardRuleKey; raw: number; already: number }> = [
    { rule_key: "code_fixed", raw: input.rules.delivery.fixed, already: input.alreadyAwarded.code_fixed },
    { rule_key: "code_quality", raw: Math.round((input.rules.delivery.cap * score) / 10), already: input.alreadyAwarded.code_quality },
  ];

  for (const g of gross) {
    const delta = Math.max(0, g.raw - g.already);
    if (delta === 0) continue;
    const points = Math.min(delta, pool);
    if (points === 0) continue; // pool épuisé — pas de ligne à 0
    pool -= points;
    drafts.push({
      challenge_id: input.challengeId,
      user_id: input.userId,
      contribution_id: input.contributionId,
      rule_key: g.rule_key,
      points,
      meta: {
        agentScore: score,
        rawPoints: g.raw,
        ...(points < delta ? { clampedTo: points } : {}),
      },
    });
  }

  return drafts;
}
```

- [ ] **Step 5: Vérifier le passage**

Run: `npx vitest run packages/evaluator/code-reward.test.ts`
Expected: PASS (7 tests). Lancer aussi `npx vitest run packages/database-service` pour vérifier que l'extension de `rewardRuleKeySchema` ne casse rien.

- [ ] **Step 6: Commit**

```bash
git add packages/evaluator/code-reward.ts packages/evaluator/code-reward.test.ts packages/database-service/domain/entities.ts packages/database-service/domain/schemas_zod.ts
git commit -m "feat(rewards): computeCodeAward pure function with iterative delta"
```

---

### Task 3: Schéma DB, entités, mappers, repositories

Le cœur structurel : `tasks.user_id` + statut 3 états, `challenge_teams` = participation, `challenges.workspace_mode`, union des `reward_rules`, suppression de `task_assignees` et `task_workspaces`. Tout doit recompiler à la fin de la tâche — les routes qui consommaient l'ancien modèle (`assign`, `evaluate`, `complete`) sont **supprimées ici** pour que le build passe (leurs remplaçantes arrivent aux tâches 7–8).

**Files:**
- Modify: `packages/database-service/db/drizzle.ts` (tables `tasks` :334-350, `challenge_teams` :91-99, `challenges` :39-69 ; supprimer `task_assignees` :352-361, `task_workspaces` :363-377 et leurs relations :659-668, :700-709 ; retirer les deux tables + relations du schéma du client db :861-915 ; retirer `assignees: many(task_assignees)` de `tasksRelations`)
- Modify: `packages/database-service/domain/entities.ts` (Task :269-279, ChallengeTeam :35-38, Challenge :40-58 ; supprimer TaskAssignee :281-285 et TaskWorkspace :299-308)
- Modify: `packages/database-service/domain/schemas_zod.ts` (taskSchema :219-229, challengeTeamSchema :29-32, challengeSchema :34+ ; supprimer taskAssigneeSchema :231-235)
- Modify: `packages/database-service/db/mappers.ts` (toDomainTask/toDbTask :307-331, toDomainChallengeTeam :164-169 ; supprimer les mappers task_assignee :333-346 et task_workspace :348-370)
- Modify: `packages/database-service/repositories/task.repo.ts` (réécriture)
- Modify: `packages/database-service/repositories/challengeTeam.repo.ts` (participation)
- Delete: `packages/database-service/repositories/taskAssignee.repo.ts`, `packages/database-service/repositories/taskWorkspace.repo.ts` (vérifier les noms exacts via `ls packages/database-service/repositories/`)
- Modify: `packages/database-service/repositories/index.ts` (retirer les exports supprimés)
- Modify: `packages/services/challenge/ml-rewards.service.ts:121` (narrowing des rules)
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/ml-workspace/route.ts:145` (narrowing)
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/ml-rewards/route.ts:43-64` (narrowing)
- Delete: `apps/leaderboard-client/src/app/api/tasks/[id]/assign/route.ts`, `.../evaluate/route.ts`, `.../complete/route.ts`, `.../assignees/route.ts`
- Delete: `packages/services/task_evaluation/` (TaskEvaluationService + TaskContextService — plus aucun appelant une fois `/evaluate` supprimé ; vérifier par grep avant suppression)

**Interfaces:**
- Consumes: `codeRewardRulesSchema`/`CodeRewardRules` (Task 1).
- Produces (consommés par les tâches 5–8) :
  - `Task = { uuid; challenge_id; user_id?: string | null; parent_task_id?; title; description?; status: 'todo' | 'in_progress' | 'done'; created_at }` (`user_id` null = tâche template).
  - `ChallengeTeam = { challenge_id; user_id; workspace_provider?: 'github' | 'external'; workspace_ref?: string; workspace_url?: string; workspace_status?: 'pending' | 'ready' | 'failed' }`.
  - `Challenge.workspace_mode?: 'provided_repo' | 'own_repo'` et `Challenge.reward_rules?: MlRewardRules | CodeRewardRules | null`.
  - `TaskRepository`: `findPersonalTasks(challengeId, userId): Promise<Task[]>`, `findTemplateTasks(challengeId): Promise<Task[]>`, `findByUser(userId): Promise<Task[]>`, `updateStatus(uuid, status: Task['status']): Promise<Task>`, `createMany(entities: Omit<Task,'uuid'|'created_at'>[]): Promise<Task[]>`, plus `findAll/findById/findByChallenge/findSubTasks/create/update/delete` conservés.
  - `ChallengeTeamRepository`: `findByChallengeAndUser(challengeId, userId): Promise<ChallengeTeam | null>`, `updateWorkspace(challengeId, userId, fields: Partial<Pick<ChallengeTeam,'workspace_provider'|'workspace_ref'|'workspace_url'|'workspace_status'>>): Promise<ChallengeTeam | null>`, existants conservés.

- [ ] **Step 1: Schéma Drizzle**

Dans `packages/database-service/db/drizzle.ts` :

`challenges` — ajouter après `compute_enabled` :

```ts
  // Code challenges only — d'où vient le livrable évalué :
  // 'provided_repo' = repo GitHub du challenge, branche perso par contributeur
  // 'own_repo'      = chaque contributeur fournit l'URL de son propre repo
  workspace_mode: varchar("workspace_mode", { length: 20 }).default("provided_repo"),
```

`challenge_teams` — devient la participation :

```ts
// --- CHALLENGE_TEAMS ---
// Membership + participation d'un contributeur sur un challenge. Pour les
// challenges code, porte le workspace personnel : la branche provisionnée
// (mode provided_repo) ou l'URL du repo fourni (mode own_repo).
export const challenge_teams = pgTable("challenge_teams", {
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  workspace_provider: varchar("workspace_provider", { length: 32 }), // github | external
  workspace_ref: varchar("workspace_ref", { length: 200 }),          // ex: refs/heads/contrib/015-alice
  workspace_url: text("workspace_url"),
  workspace_status: varchar("workspace_status", { length: 20 }),     // pending | ready | failed
}, (table) => ({
  challengeIdIdx: index("idx_challenge_teams_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_challenge_teams_user_id").on(table.user_id),
  compositeIdx: index("idx_challenge_teams_composite").on(table.challenge_id, table.user_id),
}));
```

`tasks` — propriétaire + statut stocké, plus de `type` ni `repo_id` :

```ts
// --- TASKS ---
// user_id NULL = tâche template (définie par l'admin/manager, copiée dans le
// board de chaque contributeur au join). Non-null = tâche du board personnel.
// Le statut est entièrement stocké — plus rien n'est dérivé d'une assignation.
export const tasks = pgTable("tasks", {
  uuid: uuid("uuid").primaryKey().defaultRandom(),
  challenge_id: uuid("challenge_id").references(() => challenges.uuid, { onDelete: "cascade" }),
  user_id: uuid("user_id").references(() => users.uuid, { onDelete: "cascade" }),
  parent_task_id: uuid("parent_task_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("todo"), // todo | in_progress | done
  created_at: timestamp("created_at").defaultNow(),
}, (table) => ({
  challengeIdIdx: index("idx_tasks_challenge_id").on(table.challenge_id),
  userIdIdx: index("idx_tasks_user_id").on(table.user_id),
  parentTaskIdIdx: index("idx_tasks_parent_task_id").on(table.parent_task_id),
  challengeUserIdx: index("idx_tasks_challenge_user").on(table.challenge_id, table.user_id),
}));
```

Supprimer les blocs `task_assignees` et `task_workspaces`, `taskAssigneesRelations`, `taskWorkspacesRelations`, la ligne `assignees: many(task_assignees)` dans `tasksRelations` et la relation `repo` de `tasksRelations` (le champ n'existe plus). Retirer `task_assignees`, `task_workspaces`, `taskAssigneesRelations`, `taskWorkspacesRelations` du littéral `schema` passé à `drizzle(pool, { schema: {...} })`.

- [ ] **Step 2: Entités, zod, mappers**

`entities.ts` :

```ts
export interface ChallengeTeam {
  challenge_id: string;
  user_id: string;
  workspace_provider?: 'github' | 'external';
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: WorkspaceStatus; // 'pending' | 'ready' | 'failed' (type existant)
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  uuid: string;
  challenge_id: string;
  /** null/undefined = tâche template (admin), sinon propriétaire du board. */
  user_id?: string | null;
  parent_task_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  created_at: Date;
}

export type ChallengeWorkspaceMode = 'provided_repo' | 'own_repo';
```

Dans `Challenge` : ajouter `workspace_mode?: ChallengeWorkspaceMode;` et remplacer `reward_rules?: MlRewardRules | null;` par `reward_rules?: MlRewardRules | CodeRewardRules | null;` (importer `CodeRewardRules` depuis `./codeRewardRules.js`). Supprimer `TaskAssignee` et `TaskWorkspace` (garder `WorkspaceStatus`/`WorkspaceMeta`, encore utilisés par `ChallengeRepo`).

`schemas_zod.ts` :

```ts
export const challengeTeamSchema = z.object({
  challenge_id: z.string().uuid(),
  user_id: z.string().uuid(),
  workspace_provider: z.enum(['github', 'external']).optional(),
  workspace_ref: z.string().max(200).optional(),
  workspace_url: z.string().optional(),
  workspace_status: z.enum(['pending', 'ready', 'failed']).optional(),
});

export const taskSchema = z.object({
  uuid: z.string().uuid(),
  challenge_id: z.string().uuid(),
  user_id: z.string().uuid().nullish(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]),
  created_at: z.coerce.date(),
});
```

Dans `challengeSchema`, remplacer `reward_rules: mlRewardRulesSchema.nullish()` par `reward_rules: z.union([mlRewardRulesSchema, codeRewardRulesSchema]).nullish()` et ajouter `workspace_mode: z.enum(['provided_repo', 'own_repo']).nullish()` (importer `codeRewardRulesSchema`). Supprimer `taskAssigneeSchema`.

`mappers.ts` — adapter :

```ts
export function toDomainTask(row: DbTask): Task {
  return {
    uuid: row.uuid,
    challenge_id: row.challenge_id ?? "",
    user_id: row.user_id ?? null,
    parent_task_id: row.parent_task_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: (row.status as Task["status"]) ?? "todo",
    created_at: new Date(row.created_at ?? Date.now()),
  };
}

export function toDbTask(entity: Omit<Task, "uuid" | "created_at">): typeof tasks.$inferInsert {
  return {
    challenge_id: entity.challenge_id || null,
    user_id: entity.user_id ?? null,
    parent_task_id: entity.parent_task_id || null,
    title: entity.title,
    description: entity.description || null,
    status: entity.status,
  };
}

export function toDomainChallengeTeam(row: DbChallengeTeam): ChallengeTeam {
  return {
    challenge_id: row.challenge_id ?? "",
    user_id: row.user_id ?? "",
    workspace_provider: (row.workspace_provider as ChallengeTeam["workspace_provider"]) ?? undefined,
    workspace_ref: row.workspace_ref ?? undefined,
    workspace_url: row.workspace_url ?? undefined,
    workspace_status: (row.workspace_status as WorkspaceStatus) ?? undefined,
  };
}
```

Supprimer `toDomainTaskAssignee`, `toDbTaskAssignee`, `toDomainTaskWorkspace`, `toDbTaskWorkspace` et leurs types `Db*`. Le mapper `toDomainChallenge`/`toDbChallenge` (chercher dans le fichier) doit passer `workspace_mode` tel quel.

- [ ] **Step 3: `TaskRepository` réécrit**

```ts
// packages/database-service/repositories/task.repo.ts — contenu complet
import { db } from "../db/drizzle";
import { tasks } from "../db/drizzle";
import { eq, and, isNull } from "drizzle-orm";
import { toDomainTask, toDbTask } from "../db/mappers";
import type { Task } from "../domain/entities";
import { taskSchema } from "../domain/schemas_zod";

export class TaskRepository {
  async findAll(): Promise<Task[]> {
    const rows = await db.select().from(tasks);
    return rows.map(toDomainTask);
  }

  async findById(uuid: string): Promise<Task | null> {
    const [row] = await db.select().from(tasks).where(eq(tasks.uuid, uuid));
    return row ? toDomainTask(row) : null;
  }

  async findByChallenge(challengeId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.challenge_id, challengeId));
    return rows.map(toDomainTask);
  }

  /** Board personnel d'un contributeur sur un challenge. */
  async findPersonalTasks(challengeId: string, userId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks)
      .where(and(eq(tasks.challenge_id, challengeId), eq(tasks.user_id, userId)));
    return rows.map(toDomainTask);
  }

  /** Tâches template (user_id NULL) définies par l'admin/manager. */
  async findTemplateTasks(challengeId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks)
      .where(and(eq(tasks.challenge_id, challengeId), isNull(tasks.user_id)));
    return rows.map(toDomainTask);
  }

  async findByUser(userId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.user_id, userId));
    return rows.map(toDomainTask);
  }

  async findSubTasks(parentTaskId: string): Promise<Task[]> {
    const rows = await db.select().from(tasks).where(eq(tasks.parent_task_id, parentTaskId));
    return rows.map(toDomainTask);
  }

  async updateStatus(uuid: string, status: Task["status"]): Promise<Task> {
    const [updated] = await db.update(tasks)
      .set({ status })
      .where(eq(tasks.uuid, uuid))
      .returning();
    if (!updated) throw new Error("Task not found");
    return toDomainTask(updated);
  }

  async create(entity: Omit<Task, "uuid" | "created_at">): Promise<Task> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).parse(entity);
    const [inserted] = await db.insert(tasks).values(toDbTask(validated)).returning();
    return toDomainTask(inserted);
  }

  /** Copie du template au join — un insert pour tout le board initial. */
  async createMany(entities: Omit<Task, "uuid" | "created_at">[]): Promise<Task[]> {
    if (entities.length === 0) return [];
    const validated = entities.map(e => taskSchema.omit({ uuid: true, created_at: true }).parse(e));
    const inserted = await db.insert(tasks).values(validated.map(toDbTask)).returning();
    return inserted.map(toDomainTask);
  }

  async update(uuid: string, entity: Partial<Omit<Task, "uuid" | "created_at">>): Promise<Task> {
    const validated = taskSchema.omit({ uuid: true, created_at: true }).partial().parse(entity);
    const dbData: Record<string, unknown> = {};
    if (validated.title) dbData.title = validated.title;
    if (validated.description !== undefined) dbData.description = validated.description || null;
    if (validated.status) dbData.status = validated.status;
    if (validated.parent_task_id !== undefined) dbData.parent_task_id = validated.parent_task_id || null;
    const [updated] = await db.update(tasks).set(dbData).where(eq(tasks.uuid, uuid)).returning();
    return toDomainTask(updated);
  }

  async delete(uuid: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.uuid, uuid));
  }
}
```

(`findByChallengeWithAssignees`, `findAssignees`, `completeTask` disparaissent — la complétion du challenge est désormais pilotée par le pool, tâche 5.)

- [ ] **Step 4: `ChallengeTeamRepository` participation**

Ajouter à la classe existante (et adapter `create` pour passer les champs workspace optionnels) :

```ts
  async findByChallengeAndUser(challengeId: string, userId: string): Promise<ChallengeTeam | null> {
    const [row] = await db.select().from(challenge_teams)
      .where(and(eq(challenge_teams.challenge_id, challengeId), eq(challenge_teams.user_id, userId)));
    return row ? toDomainChallengeTeam(row) : null;
  }

  async updateWorkspace(
    challengeId: string,
    userId: string,
    fields: Partial<Pick<ChallengeTeam, 'workspace_provider' | 'workspace_ref' | 'workspace_url' | 'workspace_status'>>
  ): Promise<ChallengeTeam | null> {
    const [updated] = await db.update(challenge_teams)
      .set({
        ...(fields.workspace_provider !== undefined ? { workspace_provider: fields.workspace_provider } : {}),
        ...(fields.workspace_ref !== undefined ? { workspace_ref: fields.workspace_ref } : {}),
        ...(fields.workspace_url !== undefined ? { workspace_url: fields.workspace_url } : {}),
        ...(fields.workspace_status !== undefined ? { workspace_status: fields.workspace_status } : {}),
      })
      .where(and(eq(challenge_teams.challenge_id, challengeId), eq(challenge_teams.user_id, userId)))
      .returning();
    return updated ? toDomainChallengeTeam(updated) : null;
  }
```

Dans `create`, remplacer le `values` par :

```ts
    const [inserted] = await db.insert(challenge_teams).values({
      challenge_id: validated.challenge_id,
      user_id: validated.user_id,
      workspace_provider: validated.workspace_provider ?? null,
      workspace_ref: validated.workspace_ref ?? null,
      workspace_url: validated.workspace_url ?? null,
      workspace_status: validated.workspace_status ?? null,
    }).returning();
```

- [ ] **Step 5: Narrowing des `reward_rules` aux points d'usage ML**

Le champ est maintenant une union — trois consommateurs lisent `.model` directement et ne compilent plus :

1. `packages/services/challenge/ml-rewards.service.ts` (`award`, ligne ~121) :
```ts
    const rules = parseMlRewardRules(challenge.reward_rules);
```
(importer `parseMlRewardRules` depuis `../../database-service/domain/mlRewardRules.js` ; le reste de la méthode est inchangé — `rules` garde le type `MlRewardRules | null`).

2. `api/challenges/[id]/ml-workspace/route.ts` (gate blockThreshold, ligne ~145) :
```ts
      const challenge = await challengeRepo.findById(challengeId);
      const mlRules = parseMlRewardRules(challenge?.reward_rules);
      const threshold = mlRules?.model.metric.blockThreshold;
```

3. `api/challenges/[id]/ml-rewards/route.ts` : en tête du handler après le check `type !== 'ml'`, ajouter `const mlRules = parseMlRewardRules(challenge.reward_rules);` puis remplacer chaque `challenge.reward_rules` du corps par `mlRules` (le check `type !== 'ml'` est retiré à la tâche 13 — ici on ne touche que le typage).

Vérifier par `grep -rn "reward_rules\." packages apps | grep -v test` qu'aucun autre site ne déréférence l'union sans narrowing (le composant `CreateChallengeDrawer` et `RewardRulesDrawer` sont traités en tâche 12).

- [ ] **Step 6: Suppression des routes et services orphelins**

- Supprimer les dossiers `apps/leaderboard-client/src/app/api/tasks/[id]/assign/`, `evaluate/`, `complete/`, `assignees/` (et leurs `route.test.ts` s'ils existent).
- `grep -rn "TaskEvaluationService\|task_evaluation" apps packages --include=*.ts --include=*.tsx -l` — une fois `/evaluate` supprimée, il ne doit rester que le package lui-même : supprimer `packages/services/task_evaluation/` entier.
- `grep -rn "TaskAssigneeRepository\|TaskWorkspaceRepository\|task_assignees\|task_workspaces" apps packages --include=*.ts -l` — corriger chaque site restant (typiquement `repositories/index.ts`, la route `overview` — remplacer `taskRepo.findByChallengeWithAssignees(id)` par `taskRepo.findByChallenge(id)` en attendant la tâche 8 — et la route `tasks/[id]/details`, remplacée en tâche 7 : en attendant, y retirer workspaces/assignees pour compiler, même si la route est réécrite ensuite).
- La route `GET /api/contributors/me/tasks` fonctionne telle quelle (le nouveau `findByUser` la sert).

- [ ] **Step 7: Pousser le schéma et compiler**

Run: `npx drizzle-kit push --force`
Expected: colonnes ajoutées sur `tasks`/`challenge_teams`/`challenges`, colonnes `type`/`repo_id` supprimées de `tasks`, tables `task_assignees`/`task_workspaces` supprimées.

Run: `npx tsc --noEmit` (ou `npm run build` si c'est le check du repo — vérifier `package.json`)
Expected: 0 erreur. Corriger tout site oublié (le compilateur est la checklist).

Run: `npm test`
Expected: la suite passe (les tests des routes supprimées ont été supprimés avec elles).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(schema): personal task boards — tasks.user_id, participation workspace on challenge_teams, drop task_assignees/task_workspaces"
```

---

### Task 4: Provisioner — branche personnelle par contributeur

**Files:**
- Modify: `packages/provisioner/src/utils.ts` (ajouter `generateContributorBranchName`)
- Modify: `packages/provisioner/src/index.ts` (ajouter `provisionContributorWorkspace`)
- Test: `packages/provisioner/src/utils.test.ts` (créer ou compléter s'il existe)

**Interfaces:**
- Consumes: `ProvisionerRegistry`, `mapRepoTypeToWorkspaceType`, pattern de `provisionTaskWorkspace` (`index.ts:84-127`).
- Produces: `provisionContributorWorkspace(ctx: { challengeIndex: number; username: string; repoExternalId: string; repoType: string; challengeBranchRef?: string }): Promise<ProvisionResult>` et `generateContributorBranchName(challengeIndex: number, username: string): string` → `contrib/015-alice-dupont`. Consommés par la route join (Task 6).

- [ ] **Step 1: Test qui échoue**

```ts
// packages/provisioner/src/utils.test.ts (compléter le describe existant le cas échéant)
import { describe, it, expect } from "vitest";
import { generateContributorBranchName } from "./utils.js";

describe("generateContributorBranchName", () => {
  it("slugifies the username under a contrib/ prefix with the challenge index", () => {
    expect(generateContributorBranchName(15, "Alice Dupont")).toBe("contrib/015-alice-dupont");
  });
  it("strips characters not allowed in a git ref", () => {
    expect(generateContributorBranchName(7, "bob~^:l33t?")).toBe("contrib/007-bob-l33t");
  });
});
```

Run: `npx vitest run packages/provisioner/src/utils.test.ts` — FAIL (fonction absente).

- [ ] **Step 2: Implémenter**

Dans `utils.ts`, copier le style de `generateTaskBranchName` (lire la fonction existante et réutiliser son slugifier si elle en a un) :

```ts
/** Branche personnelle d'un contributeur: contrib/<index-3-digits>-<username-slug>. */
export function generateContributorBranchName(challengeIndex: number, username: string): string {
  const slug = username
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `contrib/${String(challengeIndex).padStart(3, "0")}-${slug}`;
}
```

Dans `index.ts`, après `provisionTaskWorkspace` :

```ts
/**
 * Provisionne le workspace personnel d'un contributeur sur un challenge code :
 * une branche `contrib/<index>-<username>` basée sur la branche du challenge
 * (ou main), protégée ensuite pour ce seul contributeur par l'appelant.
 */
export async function provisionContributorWorkspace(context: {
  challengeIndex: number;
  username: string;
  repoExternalId: string;
  repoType: string;
  challengeBranchRef?: string;
}): Promise<ProvisionResult> {
  initializeProviders();

  const workspaceType = mapRepoTypeToWorkspaceType(context.repoType);
  if (!ProvisionerRegistry.hasProvider(workspaceType)) {
    return {
      provider: 'none', workspaceType, ref: '', url: '',
      status: 'failed',
      error: `No provider available for workspace type: ${workspaceType}`,
    };
  }

  const provider = ProvisionerRegistry.getProvider(workspaceType);
  const baseRef = context.challengeBranchRef
    ? context.challengeBranchRef.replace('refs/heads/', '')
    : 'main';

  return provider.provision({
    workspaceType,
    parentRef: context.repoExternalId,
    name: generateContributorBranchName(context.challengeIndex, context.username),
    baseRef,
  });
}
```

(importer `generateContributorBranchName` dans la liste d'imports d'`utils.js` en tête de fichier).

- [ ] **Step 3: Vérifier**

Run: `npx vitest run packages/provisioner/src/utils.test.ts` — PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/provisioner/src/utils.ts packages/provisioner/src/utils.test.ts packages/provisioner/src/index.ts
git commit -m "feat(provisioner): per-contributor branch provisioning (contrib/<index>-<username>)"
```

---

### Task 5: `CodeRewardsService`

**Files:**
- Create: `packages/services/challenge/code-rewards.service.ts`
- Test: `packages/services/challenge/code-rewards.service.test.ts`

**Interfaces:**
- Consumes: `computeCodeAward` (Task 2), `parseCodeRewardRules` (Task 1), repos de la Task 3 (`TaskRepository.findPersonalTasks`, `ChallengeTeamRepository.findByChallengeAndUser`), `RewardEntryRepository.{findByUserAndChallenge,sumByChallenge,createManyAndSyncRewards}`, `ContributionRepository.{findByChallenge,create,update}`, `ChallengeRepository.{findById,update}`, `SnapshotService`, `OpenAIAgentEvaluator`, `EvaluationGridRegistry`, `ConnectorRegistry` (mêmes imports que `ml-rewards.service.ts`).
- Produces (consommé par les routes des tâches 7–8 et l'UI) :
  - `const PROJECT_CONTRIBUTION_TYPE = 'project'` (exporté).
  - `interface CodeEvaluationEvent { challengeId: string; userId: string }`.
  - `class CodeRewardsService`:
    - `canEvaluate(challengeId, userId): Promise<{ ok: boolean; reason?: 'not_code_challenge' | 'no_rules' | 'not_participant' | 'workspace_not_ready' | 'no_tasks' | 'tasks_not_done' | 'already_running' }>`
    - `scheduleEvaluation(event: CodeEvaluationEvent): void` (fire-and-forget)
    - `evaluate(event: CodeEvaluationEvent): Promise<void>`
  - `interface CodeRewardsDeps` (injectable, avec `runAgent: (input: { slug: string; branch?: string; contribution: Contribution; challenge: Challenge }) => Promise<{ score10: number; evaluation: unknown }>`).
  - Helper exporté `resolveWorkspaceTarget(participation: ChallengeTeam, codeRepoExternalId?: string): { slug: string; branch?: string } | null` — mode `github` : slug = repo du challenge, branch = `workspace_ref` sans `refs/heads/` ; mode `external` : parse `https://github.com/owner/repo[/tree/branch]` depuis `workspace_url`.

- [ ] **Step 1: Test qui échoue**

```ts
// packages/services/challenge/code-rewards.service.test.ts
import { describe, it, expect, vi } from "vitest";
import { CodeRewardsService, PROJECT_CONTRIBUTION_TYPE, resolveWorkspaceTarget } from "./code-rewards.service.js";
import type { Challenge, ChallengeTeam, Contribution, Task, RewardEntry } from "../../database-service/domain/entities.js";

const CH = "ch-1", ALICE = "alice";

function makeChallenge(over: Partial<Challenge> = {}): Challenge {
  return {
    uuid: CH, title: "Build the app", status: "active", type: "code",
    contribution_points_reward: 200, completion: 0, project_id: "p-1",
    workspace_mode: "provided_repo",
    reward_rules: { version: 1, delivery: { fixed: 50, cap: 150 } },
    ...over,
  };
}

function makeParticipation(over: Partial<ChallengeTeam> = {}): ChallengeTeam {
  return {
    challenge_id: CH, user_id: ALICE,
    workspace_provider: "github",
    workspace_ref: "refs/heads/contrib/001-alice",
    workspace_url: "https://github.com/org/repo/tree/contrib/001-alice",
    workspace_status: "ready",
    ...over,
  };
}

function makeTask(status: Task["status"]): Task {
  return { uuid: `t-${Math.random()}`, challenge_id: CH, user_id: ALICE, title: "x", status, created_at: new Date() };
}

function makeDeps(opts: {
  challenge?: Partial<Challenge> | null;
  participation?: Partial<ChallengeTeam> | null;
  tasks?: Task[];
  contributions?: Contribution[];
  existingEntries?: Partial<RewardEntry>[];
  distributed?: number;
  score10?: number;
  agentFails?: boolean;
} = {}) {
  const contributions: Contribution[] = [...(opts.contributions ?? [])];
  const created: Contribution[] = [];
  const updates: Array<{ uuid: string; patch: Record<string, unknown> }> = [];
  const written: unknown[][] = [];
  const challengeUpdates: Array<Record<string, unknown>> = [];

  const deps = {
    challengeRepo: {
      findById: vi.fn(async () => (opts.challenge === null ? null : makeChallenge(opts.challenge))),
      update: vi.fn(async (_id: string, patch: Record<string, unknown>) => { challengeUpdates.push(patch); return makeChallenge(); }),
    },
    challengeTeamRepo: {
      findByChallengeAndUser: vi.fn(async () =>
        opts.participation === null ? null : makeParticipation(opts.participation)),
    },
    taskRepo: { findPersonalTasks: vi.fn(async () => opts.tasks ?? [makeTask("done")]) },
    contributionRepo: {
      findByChallenge: vi.fn(async () => [...contributions, ...created]),
      create: vi.fn(async (c: Omit<Contribution, "uuid">) => {
        const row = { ...c, uuid: `contrib-${created.length + 1}` } as Contribution;
        created.push(row); return row;
      }),
      update: vi.fn(async (uuid: string, patch: Record<string, unknown>) => {
        updates.push({ uuid, patch });
        return { ...(contributions.find(c => c.uuid === uuid) ?? created.find(c => c.uuid === uuid)), ...patch } as Contribution;
      }),
    },
    rewardRepo: {
      findByUserAndChallenge: vi.fn(async () => (opts.existingEntries ?? []) as RewardEntry[]),
      sumByChallenge: vi.fn(async () => opts.distributed ?? 0),
      createManyAndSyncRewards: vi.fn(async (drafts: unknown[]) => { written.push(drafts); return drafts as RewardEntry[]; }),
    },
    runAgent: vi.fn(async () => {
      if (opts.agentFails) throw new Error("agent down");
      return { score10: opts.score10 ?? 8, evaluation: { globalScore: 7.2, scores: [] } };
    }),
  };
  return { deps, written, updates, created, challengeUpdates };
}

describe("canEvaluate", () => {
  it("refuses a non-participant", async () => {
    const { deps } = makeDeps({ participation: null });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "not_participant" });
  });

  it("refuses an empty board", async () => {
    const { deps } = makeDeps({ tasks: [] });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "no_tasks" });
  });

  it("refuses while a task is not done", async () => {
    const { deps } = makeDeps({ tasks: [makeTask("done"), makeTask("in_progress")] });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "tasks_not_done" });
  });

  it("refuses an own_repo participant without a repo URL", async () => {
    const { deps } = makeDeps({
      challenge: { workspace_mode: "own_repo" },
      participation: { workspace_provider: "external", workspace_ref: undefined, workspace_url: undefined, workspace_status: undefined },
    });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "workspace_not_ready" });
  });

  it("refuses while a run is already running", async () => {
    const { deps } = makeDeps({
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 0,
        user_id: ALICE, challenge_id: CH, evaluation_status: "running", submitted_at: new Date(),
      } as Contribution],
    });
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: false, reason: "already_running" });
  });

  it("accepts a complete board with a ready workspace", async () => {
    const { deps } = makeDeps();
    const svc = new CodeRewardsService(deps);
    expect(await svc.canEvaluate(CH, ALICE)).toEqual({ ok: true });
  });
});

describe("evaluate", () => {
  it("first run: creates the project contribution and pays fixed + quality", async () => {
    const { deps, written, updates } = makeDeps({ score10: 8 });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });

    expect(deps.contributionRepo.create).toHaveBeenCalledOnce();
    const drafts = written[0] as Array<{ rule_key: string; points: number }>;
    expect(drafts.map(d => [d.rule_key, d.points])).toEqual([
      ["code_fixed", 50],
      ["code_quality", 120],
    ]);
    // running → done
    const statuses = updates.map(u => u.patch.evaluation_status).filter(Boolean);
    expect(statuses).toContain("running");
    expect(statuses[statuses.length - 1]).toBe("done");
  });

  it("re-run pays only the positive delta read from the ledger", async () => {
    const { deps, written } = makeDeps({
      score10: 9,
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 170,
        user_id: ALICE, challenge_id: CH, evaluation_status: "done", submitted_at: new Date(),
      } as Contribution],
      existingEntries: [
        { rule_key: "code_fixed", points: 50 },
        { rule_key: "code_quality", points: 120 },
      ],
      distributed: 170,
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    const drafts = written[0] as Array<{ rule_key: string; points: number }>;
    expect(drafts).toEqual([expect.objectContaining({ rule_key: "code_quality", points: 15 })]);
  });

  it("worse score writes no ledger rows but still stores the evaluation", async () => {
    const { deps, written, updates } = makeDeps({
      score10: 5,
      contributions: [{
        uuid: "c-1", title: "Project delivery", type: PROJECT_CONTRIBUTION_TYPE, reward: 170,
        user_id: ALICE, challenge_id: CH, evaluation_status: "done", submitted_at: new Date(),
      } as Contribution],
      existingEntries: [
        { rule_key: "code_fixed", points: 50 },
        { rule_key: "code_quality", points: 120 },
      ],
      distributed: 170,
    });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    expect(written).toHaveLength(0); // createManyAndSyncRewards jamais appelé avec des drafts
    expect(updates.some(u => u.patch.evaluation === undefined ? false : true)).toBe(true);
    expect(updates[updates.length - 1].patch.evaluation_status).toBe("done");
  });

  it("updates challenge completion from the drained pool", async () => {
    const { deps, challengeUpdates } = makeDeps({ score10: 10, distributed: 0 });
    await new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE });
    // 50 + 150 versés sur un pool de 200 → completion 1
    expect(challengeUpdates[challengeUpdates.length - 1].completion).toBe(1);
  });

  it("agent failure marks the contribution failed and rethrows", async () => {
    const { deps, updates } = makeDeps({ agentFails: true });
    await expect(new CodeRewardsService(deps).evaluate({ challengeId: CH, userId: ALICE }))
      .rejects.toThrow("agent down");
    expect(updates[updates.length - 1].patch.evaluation_status).toBe("failed");
  });
});

describe("resolveWorkspaceTarget", () => {
  it("github mode: challenge repo slug + branch from the personal ref", () => {
    expect(resolveWorkspaceTarget(makeParticipation(), "org/repo"))
      .toEqual({ slug: "org/repo", branch: "contrib/001-alice" });
  });
  it("external mode: parses owner/repo and optional /tree/branch from the URL", () => {
    const p = makeParticipation({ workspace_provider: "external", workspace_url: "https://github.com/alice/app/tree/main", workspace_ref: undefined });
    expect(resolveWorkspaceTarget(p, undefined)).toEqual({ slug: "alice/app", branch: "main" });
    const p2 = makeParticipation({ workspace_provider: "external", workspace_url: "https://github.com/alice/app", workspace_ref: undefined });
    expect(resolveWorkspaceTarget(p2, undefined)).toEqual({ slug: "alice/app", branch: undefined });
  });
  it("returns null when nothing usable", () => {
    const p = makeParticipation({ workspace_provider: "external", workspace_url: "https://gitlab.com/x/y", workspace_ref: undefined });
    expect(resolveWorkspaceTarget(p, undefined)).toBeNull();
  });
});
```

Run: `npx vitest run packages/services/challenge/code-rewards.service.test.ts` — FAIL (module absent).

- [ ] **Step 2: Implémenter le service**

```ts
// packages/services/challenge/code-rewards.service.ts
import { OpenAIAgentEvaluator } from "../../evaluator/evaluator.js";
import { EvaluationGridRegistry } from "../../evaluator/grids/index.js";
import { computeCodeAward } from "../../evaluator/code-reward.js";
import type { EvaluateContext, SnapshotInfo } from "../../evaluator/types.js";
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  ContributionRepository,
  RewardEntryRepository,
  TaskRepository,
} from "../../database-service/repositories/index.js";
import type { Challenge, ChallengeTeam, Contribution } from "../../database-service/domain/entities.js";
import { parseCodeRewardRules } from "../../database-service/domain/codeRewardRules.js";
import { ConnectorRegistry } from "../../connectors/registry.js";
import { SnapshotService } from "./snapshot.service.js";
import { DatabaseGridProvider } from "../database-grid-provider.js";

/** Une contribution "projet global" par (challenge, user) — le pendant code de dataset/model/api_packaging. */
export const PROJECT_CONTRIBUTION_TYPE = "project";
const PROJECT_CONTRIBUTION_TITLE = "Project delivery";

export interface CodeEvaluationEvent {
  challengeId: string;
  userId: string;
}

export type CannotEvaluateReason =
  | "not_code_challenge"
  | "no_rules"
  | "not_participant"
  | "workspace_not_ready"
  | "no_tasks"
  | "tasks_not_done"
  | "already_running";

/**
 * Où lire le code à évaluer.
 * - provider 'github' (mode provided_repo) : le repo du challenge, sur la branche perso.
 * - provider 'external' (mode own_repo) : le repo GitHub public du contributeur.
 */
export function resolveWorkspaceTarget(
  participation: ChallengeTeam,
  codeRepoExternalId?: string
): { slug: string; branch?: string } | null {
  if (participation.workspace_provider === "github") {
    if (!codeRepoExternalId || !participation.workspace_ref) return null;
    return { slug: codeRepoExternalId, branch: participation.workspace_ref.replace("refs/heads/", "") };
  }
  if (participation.workspace_provider === "external" && participation.workspace_url) {
    const m = participation.workspace_url.match(
      /github\.com\/([^/?#]+)\/([^/?#]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:[?#]|$)/
    );
    if (!m) return null;
    return { slug: `${m[1]}/${m[2]}`, branch: m[3] ?? undefined };
  }
  return null;
}

export interface CodeRewardsDeps {
  challengeRepo: Pick<ChallengeRepository, "findById" | "update">;
  challengeTeamRepo: Pick<ChallengeTeamRepository, "findByChallengeAndUser">;
  taskRepo: Pick<TaskRepository, "findPersonalTasks">;
  contributionRepo: Pick<ContributionRepository, "findByChallenge" | "create" | "update">;
  rewardRepo: Pick<RewardEntryRepository, "findByUserAndChallenge" | "sumByChallenge" | "createManyAndSyncRewards">;
  /** Isole l'accès réseau (GitHub + OpenAI) — remplacé par un fake en test. */
  runAgent: (input: {
    slug: string;
    branch?: string;
    contribution: Contribution;
    challenge: Challenge;
  }) => Promise<{ score10: number; evaluation: unknown }>;
}

/**
 * CodeRewardsService
 * ------------------
 * Attribution live des points sur les challenges code à boards personnels.
 * Même philosophie que MlRewardsService : chaque run d'évaluation produit des
 * lignes de ledger immuables, clampées au pool restant. La spécificité est le
 * delta itératif — voir computeCodeAward.
 */
export class CodeRewardsService {
  private deps: CodeRewardsDeps;
  private snapshotService = new SnapshotService();
  private evaluator = new OpenAIAgentEvaluator();
  private challengeRepoRepo = new ChallengeRepoRepository();
  private static dbProviderInitialized = false;

  constructor(deps?: Partial<CodeRewardsDeps>) {
    if (!CodeRewardsService.dbProviderInitialized) {
      EvaluationGridRegistry.setDatabaseProvider(new DatabaseGridProvider());
      CodeRewardsService.dbProviderInitialized = true;
    }
    this.deps = {
      challengeRepo: new ChallengeRepository(),
      challengeTeamRepo: new ChallengeTeamRepository(),
      taskRepo: new TaskRepository(),
      contributionRepo: new ContributionRepository(),
      rewardRepo: new RewardEntryRepository(),
      runAgent: (input) => this.runAgentDefault(input),
      ...deps,
    };
  }

  /** Préconditions du bouton "Lancer l'évaluation" — partagées entre la route et l'UI (raison affichable). */
  async canEvaluate(challengeId: string, userId: string): Promise<{ ok: boolean; reason?: CannotEvaluateReason }> {
    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== "code") return { ok: false, reason: "not_code_challenge" };
    if (!parseCodeRewardRules(challenge.reward_rules)) return { ok: false, reason: "no_rules" };

    const participation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (!participation) return { ok: false, reason: "not_participant" };

    const workspaceReady =
      participation.workspace_provider === "external"
        ? !!participation.workspace_url
        : participation.workspace_status === "ready";
    if (!workspaceReady) return { ok: false, reason: "workspace_not_ready" };

    const tasks = await this.deps.taskRepo.findPersonalTasks(challengeId, userId);
    if (tasks.length === 0) return { ok: false, reason: "no_tasks" };
    if (tasks.some(t => t.status !== "done")) return { ok: false, reason: "tasks_not_done" };

    const contribution = await this.findContribution(challengeId, userId);
    if (contribution?.evaluation_status === "running") return { ok: false, reason: "already_running" };

    return { ok: true };
  }

  /** Fire-and-forget : l'appel agent dure des dizaines de secondes, le statut vit sur la contribution. */
  scheduleEvaluation(event: CodeEvaluationEvent): void {
    this.evaluate(event).catch((error) => {
      console.error(`[CodeRewardsService] Evaluation failed for ${event.userId} on ${event.challengeId}:`, error);
    });
  }

  async evaluate(event: CodeEvaluationEvent): Promise<void> {
    const { challengeId, userId } = event;

    const challenge = await this.deps.challengeRepo.findById(challengeId);
    if (!challenge || challenge.type !== "code") return;
    const rules = parseCodeRewardRules(challenge.reward_rules);
    if (!rules) {
      console.warn(`[CodeRewardsService] Challenge ${challengeId} has no code reward rules — skipping`);
      return;
    }

    const participation = await this.deps.challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (!participation) return;
    const target = await this.resolveTarget(challenge, participation);
    if (!target) {
      console.warn(`[CodeRewardsService] No resolvable workspace for ${userId} on ${challengeId}`);
      return;
    }

    // Upsert de la contribution projet, statut pending → running.
    let contribution = await this.findContribution(challengeId, userId);
    if (contribution) {
      contribution = await this.deps.contributionRepo.update(contribution.uuid, {
        artifact_url: participation.workspace_url,
        evaluation_status: "running",
        submitted_at: new Date(),
      });
    } else {
      contribution = await this.deps.contributionRepo.create({
        title: PROJECT_CONTRIBUTION_TITLE,
        type: PROJECT_CONTRIBUTION_TYPE,
        description: `Global delivery for "${challenge.title}"`,
        reward: 0,
        user_id: userId,
        challenge_id: challengeId,
        artifact_url: participation.workspace_url,
        evaluation_status: "running",
        submitted_at: new Date(),
      });
    }

    try {
      const { score10, evaluation } = await this.deps.runAgent({
        slug: target.slug,
        branch: target.branch,
        contribution,
        challenge,
      });

      await this.deps.contributionRepo.update(contribution.uuid, { evaluation });

      const [existingEntries, distributed] = await Promise.all([
        this.deps.rewardRepo.findByUserAndChallenge(userId, challengeId),
        this.deps.rewardRepo.sumByChallenge(challengeId, { excludeRuleKeys: ["slack_signal"] }),
      ]);
      const sumFor = (key: string) =>
        existingEntries.filter(e => e.rule_key === key).reduce((s, e) => s + e.points, 0);

      const drafts = computeCodeAward({
        rules,
        challengeId,
        userId,
        contributionId: contribution.uuid,
        score: score10,
        alreadyAwarded: { code_fixed: sumFor("code_fixed"), code_quality: sumFor("code_quality") },
        remainingPool: Math.max(0, challenge.contribution_points_reward - distributed),
      });

      if (drafts.length > 0) {
        await this.deps.rewardRepo.createManyAndSyncRewards(drafts);
      }
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: "done" });

      // Complétion = fraction du pool drainé, comme en ML.
      const newDistributed = await this.deps.rewardRepo.sumByChallenge(challengeId, { excludeRuleKeys: ["slack_signal"] });
      const completion = challenge.contribution_points_reward > 0
        ? Math.min(1, newDistributed / challenge.contribution_points_reward)
        : 0;
      await this.deps.challengeRepo.update(challenge.uuid, { completion });

      const net = drafts.reduce((s, d) => s + d.points, 0);
      console.log(`[CodeRewardsService] ${net} CP to ${userId} (score ${score10}/10, ${drafts.length} ledger rows)`);
    } catch (error) {
      await this.deps.contributionRepo.update(contribution.uuid, { evaluation_status: "failed" });
      throw error;
    }
  }

  private async findContribution(challengeId: string, userId: string): Promise<Contribution | undefined> {
    const all = await this.deps.contributionRepo.findByChallenge(challengeId);
    return all.find(c => c.user_id === userId && c.type === PROJECT_CONTRIBUTION_TYPE);
  }

  private async resolveTarget(challenge: Challenge, participation: ChallengeTeam) {
    if (participation.workspace_provider === "github") {
      const repos = await this.challengeRepoRepo.findByChallengeWithRepo(challenge.uuid);
      const codeRepo = repos.find(r => r.repo_type === "github" && r.repo_external_id);
      return resolveWorkspaceTarget(participation, codeRepo?.repo_external_id ?? undefined);
    }
    return resolveWorkspaceTarget(participation, undefined);
  }

  /** Snapshot agrégé (≤100 commits) sur la branche/le repo, grille `code`, note ramenée /10. */
  private async runAgentDefault({ slug, branch, contribution, challenge }: {
    slug: string; branch?: string; contribution: Contribution; challenge: Challenge;
  }): Promise<{ score10: number; evaluation: unknown }> {
    const connector = await ConnectorRegistry.createConnector(
      { uuid: "", title: slug, type: "github", external_repo_id: slug, project_id: "" },
      branch ? { branch } : undefined
    );
    if (!connector) throw new Error(`[CodeRewardsService] No GitHub connector for ${slug}`);

    await connector.connect();
    try {
      const items = await connector.fetchItems();
      const shas = items.slice(0, 100).map(i => i.id);
      if (shas.length === 0) throw new Error(`[CodeRewardsService] No commits found on ${slug}${branch ? `@${branch}` : ""}`);

      const aggregated = await this.snapshotService.buildAggregatedSnapshot(() => connector, shas);
      if (!aggregated) throw new Error(`[CodeRewardsService] Unable to build snapshot for ${slug}`);
      const prepared = await this.snapshotService.prepareSnapshot(aggregated);

      const grid = await EvaluationGridRegistry.getGridAsync("code");
      const evalContext: EvaluateContext = { snapshot: prepared as SnapshotInfo, grid };

      const evaluation = await this.evaluator.evaluate(!!contribution.evaluation, {
        title: contribution.title,
        type: "code",
        description: contribution.description,
        challenge_id: challenge.uuid,
        userId: contribution.user_id,
        commitShas: shas,
      }, evalContext);

      // globalScore est sur 0–9 (cf. ml-rewards.service.ts:302) — ramené /10.
      const score10 = Math.min(10, Math.max(0, (evaluation.globalScore / 9) * 10));
      return { score10, evaluation: { scores: evaluation.scores, globalScore: evaluation.globalScore } };
    } finally {
      await connector.disconnect?.();
    }
  }
}
```

Note d'implémentation : vérifier la signature exacte de `SnapshotService.buildAggregatedSnapshot(resolveConnector, shas)` (utilisée par `task-evaluation.service.ts:109` avant sa suppression — la retrouver dans `snapshot.service.ts`) et celle de `ConnectorRegistry.createConnector(repo, { branch })`. Ajuster le code ci-dessus si les signatures diffèrent, sans changer le contrat public du service.

- [ ] **Step 3: Vérifier**

Run: `npx vitest run packages/services/challenge/code-rewards.service.test.ts` — PASS (15 tests).

- [ ] **Step 4: Commit**

```bash
git add packages/services/challenge/code-rewards.service.ts packages/services/challenge/code-rewards.service.test.ts
git commit -m "feat(rewards): CodeRewardsService — global project evaluation with live ledger awards"
```

---

### Task 6: Création de challenge (workspace_mode) + route join (provision + template)

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/route.ts` (schéma + création de repos par mode)
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/join/route.ts` (réécriture)
- Test: `apps/leaderboard-client/src/app/api/challenges/[id]/join/route.test.ts`
- Test: `apps/leaderboard-client/src/app/api/challenges/route.test.ts` (compléter le fichier existant)

**Interfaces:**
- Consumes: `provisionContributorWorkspace` (Task 4), `TaskRepository.{findTemplateTasks,createMany}`, `ChallengeTeamRepository.{findByChallengeAndUser,create,updateWorkspace}`, `codeRewardRulesSchema` (Task 1).
- Produces: `POST /api/challenges` accepte `workspace_mode` et des `reward_rules` code ; `POST /api/challenges/[id]/join` renvoie `201 { participation, tasksCreated }` — consommé par l'UI (Task 11).

- [ ] **Step 1: `POST /api/challenges`**

Dans `createChallengeSchema` :
- remplacer `reward_rules: mlRewardRulesSchema.nullish()` par `reward_rules: z.union([mlRewardRulesSchema, codeRewardRulesSchema]).nullish()` (importer `codeRewardRulesSchema` depuis `.../domain/codeRewardRules`),
- ajouter `workspace_mode: z.enum(['provided_repo', 'own_repo']).optional()`.

Dans le corps du POST :
- passer au `challengeRepo.create` : `workspace_mode: validated.type === 'code' ? (validated.workspace_mode ?? 'provided_repo') : null`,
- adapter `repoDefinitions` : la branche `code` ne crée le repo GitHub **que** en mode `provided_repo` :

```ts
        : validated.type === 'validation'
          ? []
          : (validated.workspace_mode ?? 'provided_repo') === 'own_repo'
            ? []
            : [{ title: `${validated.title} — Code`, type: 'github', external_repo_id: githubSlug }];
```

- [ ] **Step 2: Réécrire `POST /api/challenges/[id]/join`**

```ts
// apps/leaderboard-client/src/app/api/challenges/[id]/join/route.ts — contenu complet
import { NextRequest, NextResponse } from 'next/server';
import {
  ChallengeRepository,
  ChallengeRepoRepository,
  ChallengeTeamRepository,
  TaskRepository,
  UserRepository,
} from '../../../../../../../../packages/database-service/repositories';
import {
  provisionContributorWorkspace,
  ProvisionerRegistry,
  mapRepoTypeToWorkspaceType,
} from '../../../../../../../../packages/provisioner/src/index.js';
import { verifyRequestToken } from '@/lib/auth';

const challengeRepo = new ChallengeRepository();
const challengeRepoRepo = new ChallengeRepoRepository();
const challengeTeamRepo = new ChallengeTeamRepository();
const taskRepo = new TaskRepository();
const userRepo = new UserRepository();

// POST /api/challenges/[id]/join — rejoindre un challenge.
// Pour un challenge code : copie le board template et, en mode provided_repo,
// provisionne la branche personnelle du contributeur (protégée pour lui).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized - Please login to join a challenge' }, { status: 401 });
    }
    const { id: challengeId } = await params;
    const userId = payload.userId;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const existing = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    if (existing) {
      return NextResponse.json({ error: 'You are already a member of this challenge' }, { status: 409 });
    }

    const isCode = challenge.type === 'code';
    const mode = challenge.workspace_mode ?? 'provided_repo';

    await challengeTeamRepo.create({
      challenge_id: challengeId,
      user_id: userId,
      ...(isCode
        ? mode === 'own_repo'
          ? { workspace_provider: 'external' as const }
          : { workspace_provider: 'github' as const, workspace_status: 'pending' as const }
        : {}),
    });

    // Copie du board template (parents d'abord pour remapper les sous-tâches).
    let tasksCreated = 0;
    if (isCode) {
      const template = await taskRepo.findTemplateTasks(challengeId);
      const parents = template.filter(t => !t.parent_task_id);
      const children = template.filter(t => t.parent_task_id);
      const idMap = new Map<string, string>();
      for (const t of parents) {
        const created = await taskRepo.create({
          challenge_id: challengeId, user_id: userId,
          title: t.title, description: t.description, status: 'todo',
        });
        idMap.set(t.uuid, created.uuid);
        tasksCreated++;
      }
      for (const t of children) {
        await taskRepo.create({
          challenge_id: challengeId, user_id: userId,
          parent_task_id: idMap.get(t.parent_task_id!) ?? undefined,
          title: t.title, description: t.description, status: 'todo',
        });
        tasksCreated++;
      }
    }

    // Provision de la branche perso (mode provided_repo uniquement).
    if (isCode && mode === 'provided_repo') {
      const repos = await challengeRepoRepo.findByChallengeWithRepo(challengeId);
      const codeRepo = repos.find(r => r.repo_type === 'github' && r.repo_external_id);
      if (!codeRepo) {
        await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_status: 'failed' });
      } else {
        const user = await userRepo.findById(userId);
        try {
          const result = await provisionContributorWorkspace({
            challengeIndex: challenge.index ?? 0,
            username: user?.github_username || user?.full_name || userId,
            repoExternalId: codeRepo.repo_external_id!,
            repoType: codeRepo.repo_type,
            challengeBranchRef: codeRepo.workspace_ref,
          });
          await challengeTeamRepo.updateWorkspace(challengeId, userId, {
            workspace_ref: result.ref,
            workspace_url: result.url,
            workspace_status: result.status,
          });
          if (result.status === 'ready' && result.ref && user?.github_username) {
            try {
              const provider = ProvisionerRegistry.getProvider(mapRepoTypeToWorkspaceType(codeRepo.repo_type));
              if (provider.protect) {
                await provider.protect(codeRepo.repo_external_id!, result.ref, [user.github_username]);
              }
            } catch (protectError) {
              console.warn('[join] Workspace protection failed:', protectError);
            }
          }
        } catch (provisionError) {
          console.error('[join] Provisioning failed:', provisionError);
          await challengeTeamRepo.updateWorkspace(challengeId, userId, { workspace_status: 'failed' });
        }
      }
    }

    const participation = await challengeTeamRepo.findByChallengeAndUser(challengeId, userId);
    return NextResponse.json({ participation, tasksCreated }, { status: 201 });
  } catch (error) {
    console.error('Error joining challenge:', error);
    return NextResponse.json({ error: 'Failed to join challenge' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Tests de la route join**

Créer `join/route.test.ts` sur le modèle de `tasks/[id]/route.test.ts` (mocks hoisted + `vi.mock` des repositories, de `@/lib/auth` — `verifyRequestToken` renvoie `{ userId: 'alice' }` — et de `.../provisioner/src/index.js` avec `provisionContributorWorkspace` mocké). Cas à couvrir :

1. 401 sans session (`verifyRequestToken` → null).
2. 409 si déjà membre (`findByChallengeAndUser` → participation).
3. Code + provided_repo : crée la team row, copie 2 tâches template parent + 1 sous-tâche (le `parent_task_id` de la copie pointe vers la **copie** du parent, pas l'original), provisionne, `updateWorkspace` avec le résultat.
4. Code + own_repo : `workspace_provider: 'external'`, aucun appel au provisioner.
5. Challenge ML : team row simple, ni copie ni provisioning.
6. Échec du provisioner → `updateWorkspace` avec `workspace_status: 'failed'`, la route répond quand même 201 (rejoindre a réussi ; la branche pourra être re-tentée plus tard).

Run: `npx vitest run "apps/leaderboard-client/src/app/api/challenges/[id]/join/route.test.ts"` — PASS.

- [ ] **Step 4: Test création**

Dans `apps/leaderboard-client/src/app/api/challenges/route.test.ts` (fichier existant — suivre ses mocks), ajouter :
1. `type: 'code', workspace_mode: 'own_repo'` → aucun repo créé, challenge stocké avec `workspace_mode: 'own_repo'`.
2. `type: 'code'` sans `workspace_mode` → repo GitHub créé (comportement historique), `workspace_mode: 'provided_repo'`.
3. `type: 'code'` avec `reward_rules: { version: 1, delivery: { fixed: 50, cap: 150 } }` → 201 (l'union zod accepte le variant code).

Run: `npx vitest run apps/leaderboard-client/src/app/api/challenges/route.test.ts` — PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(challenges): workspace_mode at creation; join provisions the personal branch and copies the template board"
```

---

### Task 7: Routes tasks (CRUD personnel + template)

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/tasks/route.ts` (GET scope + POST ownership)
- Modify: `apps/leaderboard-client/src/app/api/tasks/[id]/route.ts` (PATCH remplace PUT, guards)
- Modify: `apps/leaderboard-client/src/app/api/tasks/[id]/details/route.ts` (simplification)
- Test: `apps/leaderboard-client/src/app/api/tasks/route.test.ts` (créer), `apps/leaderboard-client/src/app/api/tasks/[id]/route.test.ts` (réécrire)

**Interfaces:**
- Consumes: `TaskRepository` (Task 3), helper `getSession` (pattern ml-workspace), `ChallengeTeamRepository.findByChallengeAndUser`, `ChallengeRepository.findById`, `repositories.project.findById` (check manager).
- Produces:
  - `GET /api/tasks?challenge_id=X&scope=mine|template|all` (défaut `all` = comportement de lecture publique conservé pour la vue manage ; `mine` exige une session).
  - `POST /api/tasks { challenge_id, title, description?, parent_task_id?, template?: boolean }` → tâche perso (membre requis) ou template (admin/manager requis).
  - `PATCH /api/tasks/[id] { title?, description?, status?, parent_task_id? }` — propriétaire uniquement (ou admin/manager pour une template).
  - `DELETE /api/tasks/[id]` — mêmes droits.
  - `GET /api/tasks/[id]/details` → `{ task, subTasks }`.

- [ ] **Step 1: Écrire les tests (rouges)**

`api/tasks/route.test.ts` (mocks : TaskRepository, ChallengeRepository, ChallengeTeamRepository, `repositories.project` via `@/lib/db`, et `jose.jwtVerify` mocké pour renvoyer `{ payload: { userId: 'alice', role: 'contributor' } }` — suivre la technique de mock du fichier `challenges/route.test.ts` existant pour l'auth) :

1. `GET ?challenge_id=X&scope=mine` sans session → 401.
2. `GET ?challenge_id=X&scope=mine` → ne renvoie que `findPersonalTasks(X, 'alice')`.
3. `GET ?challenge_id=X&scope=template` → `findTemplateTasks(X)`.
4. `POST` sans session → 401.
5. `POST` perso par un non-membre → 403 (`Join the challenge first`).
6. `POST` perso par un membre → 201, `create` appelé avec `user_id: 'alice'`, `status: 'todo'`.
7. `POST { template: true }` par un contributor non-manager → 403.
8. `POST { template: true }` par un admin → 201, `create` avec `user_id: null`.
9. `POST` sur un challenge `type: 'ml'` → 400 (guard conservé).

`api/tasks/[id]/route.test.ts` (réécrire — PUT devient PATCH) :

1. `PATCH` par le propriétaire (`task.user_id === 'alice'`) avec `{ status: 'done' }` → 200, `update` appelé.
2. `PATCH` par un autre user → 403.
3. `PATCH` d'une template (`user_id: null`) par un contributor → 403 ; par un admin → 200.
4. `PATCH { status: 'not-a-status' }` → 400.
5. `DELETE` par le propriétaire → 200 ; par un autre → 403.
6. `GET` → 200 (inchangé).

Run: `npx vitest run apps/leaderboard-client/src/app/api/tasks` — FAIL.

- [ ] **Step 2: Implémenter `api/tasks/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { TaskRepository, ChallengeRepository, ChallengeTeamRepository } from '../../../../../../packages/database-service/repositories';
import { repositories } from '@/lib/db';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const taskRepo = new TaskRepository();
const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch {
    return null;
  }
}

async function isChallengeManager(session: { userId: string; role: string }, challengeProjectId: string) {
  if (session.role === 'admin') return true;
  const project = await repositories.project.findById(challengeProjectId);
  return !!project && project.manager_id === session.userId;
}

const createTaskSchema = z.object({
  challenge_id: z.string().uuid(),
  parent_task_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  /** true = tâche template (admin/manager) ; sinon tâche du board perso. */
  template: z.boolean().optional(),
});

// GET /api/tasks?challenge_id=xxx&scope=mine|template|all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challenge_id');
    const scope = searchParams.get('scope') ?? 'all';
    if (!challengeId) {
      return NextResponse.json({ error: 'challenge_id is required' }, { status: 400 });
    }

    if (scope === 'mine') {
      const session = await getSession(request);
      if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      return NextResponse.json(await taskRepo.findPersonalTasks(challengeId, session.userId));
    }
    if (scope === 'template') {
      return NextResponse.json(await taskRepo.findTemplateTasks(challengeId));
    }
    return NextResponse.json(await taskRepo.findByChallenge(challengeId));
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks — créer une tâche perso (membre) ou template (admin/manager)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    const validated = createTaskSchema.parse(body);

    const challenge = await challengeRepo.findById(validated.challenge_id);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'code') {
      return NextResponse.json({ error: 'Only code challenges have tasks' }, { status: 400 });
    }

    if (validated.template) {
      if (!(await isChallengeManager(session, challenge.project_id))) {
        return NextResponse.json({ error: 'Only the challenge manager can edit the template' }, { status: 403 });
      }
      const task = await taskRepo.create({
        challenge_id: validated.challenge_id,
        user_id: null,
        parent_task_id: validated.parent_task_id,
        title: validated.title,
        description: validated.description,
        status: 'todo',
      });
      return NextResponse.json(task, { status: 201 });
    }

    const membership = await challengeTeamRepo.findByChallengeAndUser(validated.challenge_id, session.userId);
    if (!membership) {
      return NextResponse.json({ error: 'Join the challenge first' }, { status: 403 });
    }
    const task = await taskRepo.create({
      challenge_id: validated.challenge_id,
      user_id: session.userId,
      parent_task_id: validated.parent_task_id,
      title: validated.title,
      description: validated.description,
      status: 'todo',
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implémenter `api/tasks/[id]/route.ts`**

Remplacer PUT par PATCH ; GET inchangé ; guards partagés :

```ts
const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
});

async function canTouchTask(request: NextRequest, taskId: string):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const session = await getSession(request);
  if (!session) return { ok: false, status: 401, error: 'Authentication required' };
  const task = await taskRepo.findById(taskId);
  if (!task) return { ok: false, status: 404, error: 'Task not found' };

  if (task.user_id) {
    if (task.user_id !== session.userId && session.role !== 'admin') {
      return { ok: false, status: 403, error: 'Not your task' };
    }
    return { ok: true };
  }
  // Tâche template — réservée au manager/admin du challenge.
  const challenge = await challengeRepo.findById(task.challenge_id);
  if (!challenge) return { ok: false, status: 404, error: 'Challenge not found' };
  if (!(await isChallengeManager(session, challenge.project_id))) {
    return { ok: false, status: 403, error: 'Only the challenge manager can edit the template' };
  }
  return { ok: true };
}
```

`PATCH` : `canTouchTask` → zod → `taskRepo.update(id, validated)` → 200. `DELETE` : `canTouchTask` → `taskRepo.delete(id)` → `{ success: true }`. (`getSession` et `isChallengeManager` : copier les helpers de la route `api/tasks/route.ts` — deux petites copies locales, pattern du repo.)

- [ ] **Step 4: `api/tasks/[id]/details/route.ts`**

Réécrire pour renvoyer `{ task, subTasks }` uniquement (`taskRepo.findById` + `taskRepo.findSubTasks`), 404 si absente. Supprimer toute lecture d'assignees/workspaces/évaluations.

- [ ] **Step 5: Vérifier**

Run: `npx vitest run apps/leaderboard-client/src/app/api/tasks` — PASS.
Run: `npx tsc --noEmit` — 0 erreur (l'UI qui appelait PUT sera migrée aux tâches 10–14 ; si `MyTasks`/pages compilent encore contre PUT, les adapter est prévu là-bas — à ce stade seul le typage doit passer).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tasks): personal/template task CRUD with ownership guards; stored 3-state status"
```

---

### Task 8: Routes évaluation projet + workspace + overview

**Files:**
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/project-evaluation/route.ts`
- Create: `apps/leaderboard-client/src/app/api/challenges/[id]/workspace/route.ts`
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/overview/route.ts`
- Test: `.../project-evaluation/route.test.ts`, `.../workspace/route.test.ts`

**Interfaces:**
- Consumes: `CodeRewardsService.{canEvaluate,scheduleEvaluation}` (Task 5), `ChallengeTeamRepository.{findByChallengeAndUser,updateWorkspace,findByChallenge}`.
- Produces:
  - `POST /api/challenges/[id]/project-evaluation` → `202 { scheduled: true }` ou `409/400 { error, reason }`.
  - `PATCH /api/challenges/[id]/workspace { repo_url: string }` → `200 { participation }` (mode `own_repo` uniquement).
  - `GET /overview` renvoie en plus `participants: ChallengeTeam[]` (workspace inclus) — consommé par l'UI (tâches 11 et 13).

- [ ] **Step 1: Tests (rouges)**

`project-evaluation/route.test.ts` (mock du service via `vi.mock` du module `code-rewards.service` — attention, la route l'importe dynamiquement comme ml-workspace le fait pour MlRewardsService : mocker le chemin exact) :
1. 401 sans session.
2. `canEvaluate` → `{ ok: false, reason: 'tasks_not_done' }` → 400 avec `{ reason: 'tasks_not_done' }`, `scheduleEvaluation` jamais appelé.
3. `canEvaluate` → `{ ok: false, reason: 'already_running' }` → 409.
4. `canEvaluate` → `{ ok: true }` → 202, `scheduleEvaluation` appelé avec `{ challengeId, userId }`.

`workspace/route.test.ts` :
1. 401 sans session.
2. 400 si le challenge n'est pas `code`/`own_repo`.
3. 403 si non-membre.
4. 400 si `repo_url` n'est pas une URL `https://github.com/owner/repo[...]`.
5. 200 : `updateWorkspace` appelé avec `{ workspace_provider: 'external', workspace_url: <url trimmée>, workspace_status: 'ready' }`.

Run: `npx vitest run "apps/leaderboard-client/src/app/api/challenges/[id]/project-evaluation" "apps/leaderboard-client/src/app/api/challenges/[id]/workspace"` — FAIL.

- [ ] **Step 2: Implémenter `project-evaluation/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch { return null; }
}

// POST /api/challenges/[id]/project-evaluation
// Lance l'évaluation globale du board personnel du contributeur connecté.
// Fire-and-forget : le statut vit sur la contribution `project` (pollée par l'UI).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id: challengeId } = await params;

    const { CodeRewardsService } = await import(
      '../../../../../../../../packages/services/challenge/code-rewards.service'
    );
    const service = new CodeRewardsService();
    const check = await service.canEvaluate(challengeId, session.userId);
    if (!check.ok) {
      const status = check.reason === 'already_running' ? 409 : 400;
      return NextResponse.json({ error: 'Cannot start evaluation', reason: check.reason }, { status });
    }

    service.scheduleEvaluation({ challengeId, userId: session.userId });
    return NextResponse.json({ scheduled: true }, { status: 202 });
  } catch (error) {
    console.error('Error starting project evaluation:', error);
    return NextResponse.json({ error: 'Failed to start evaluation' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implémenter `workspace/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import {
  ChallengeRepository,
  ChallengeTeamRepository,
} from '../../../../../../../../packages/database-service/repositories';
import { z } from 'zod';

const challengeRepo = new ChallengeRepository();
const challengeTeamRepo = new ChallengeTeamRepository();

const bodySchema = z.object({
  repo_url: z.string().trim().regex(
    /^https:\/\/github\.com\/[^/?#]+\/[^/?#]+/,
    'repo_url must be a public GitHub repository URL'
  ),
});

async function getSession(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return { userId: payload.userId as string, role: payload.role as string };
  } catch { return null; }
}

// PATCH /api/challenges/[id]/workspace — mode own_repo : le contributeur
// déclare (ou change) l'URL du repo GitHub public qui porte son livrable.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id: challengeId } = await params;

    const challenge = await challengeRepo.findById(challengeId);
    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.type !== 'code' || (challenge.workspace_mode ?? 'provided_repo') !== 'own_repo') {
      return NextResponse.json({ error: 'This challenge does not accept contributor repos' }, { status: 400 });
    }

    const membership = await challengeTeamRepo.findByChallengeAndUser(challengeId, session.userId);
    if (!membership) return NextResponse.json({ error: 'Join the challenge first' }, { status: 403 });

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid repo_url' }, { status: 400 });
    }

    const participation = await challengeTeamRepo.updateWorkspace(challengeId, session.userId, {
      workspace_provider: 'external',
      workspace_url: parsed.data.repo_url,
      workspace_status: 'ready',
    });
    return NextResponse.json({ participation });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}
```

- [ ] **Step 4: `overview/route.ts`**

Ajouter `challengeTeamRepo.findByChallenge(id)` au `Promise.all` et `participants` à la réponse :

```ts
    const [team, tasks, meetings, repos, contributions, participants] = await Promise.all([
      challengeTeamRepo.findTeamMembers(id),
      taskRepo.findByChallenge(id),
      new SyncMeetingService().getMeetingsByChallengeId(id),
      challengeRepoRepo.findByChallengeWithRepo(id),
      contributionRepo.findByChallenge(id),
      challengeTeamRepo.findByChallenge(id),
    ]);

    return NextResponse.json({ challenge, team, tasks, meetings, repos, contributions, participants });
```

- [ ] **Step 5: Vérifier + commit**

Run: `npx vitest run "apps/leaderboard-client/src/app/api/challenges/[id]"` — PASS.

```bash
git add -A
git commit -m "feat(api): project evaluation trigger, own-repo workspace declaration, participants in overview"
```

---

### Task 9: Clôture simplifiée + suppression du moteur legacy

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/close/route.ts`
- Modify: `packages/services/challenge/challenge.service.ts` (retirer `computeChallengeRewards` + l'import/champ `rewardsService`)
- Delete: `packages/services/challenge/rewards.service.ts`, `packages/evaluator/reward.ts` (+ leurs tests s'ils existent)

**Interfaces:**
- Consumes: `ChallengeRepository.update`.
- Produces: `POST /api/challenges/[id]/close` → `200 { success: true, challenge }` — passe simplement le statut à `completed`. Plus aucun calcul de reward au close (les points code sont déjà au ledger).

- [ ] **Step 1: Vérifier les consommateurs**

Run: `grep -rn "computeRewards\|RewardsService\|computeChallengeRewards" apps packages --include=*.ts --include=*.tsx | grep -v ml-rewards | grep -v code-rewards`
Expected: uniquement `challenge.service.ts`, `rewards.service.ts`, `reward.ts`, la route close (et d'éventuels tests associés). Si un autre site apparaît, le traiter avant de supprimer.

- [ ] **Step 2: Réécrire la route close**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ChallengeRepository } from '../../../../../../../../packages/database-service/repositories';

const challengeRepo = new ChallengeRepository();

// POST /api/challenges/[id]/close — clôture le challenge.
// Les récompenses ne sont plus calculées ici : code, ML et validation
// versent toutes en live via le ledger reward_entries.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await challengeRepo.findById(id);
    if (!existing) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    const challenge = await challengeRepo.update(id, { status: 'completed' });
    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    console.error('Error closing challenge:', error);
    return NextResponse.json({ error: 'Failed to close challenge' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Supprimer le moteur relatif**

Supprimer `rewards.service.ts` et `packages/evaluator/reward.ts`, retirer `computeChallengeRewards`/`rewardsService` de `ChallengeService`, purger les imports morts (le grep du Step 1 sert de checklist).

- [ ] **Step 4: Vérifier + commit**

Run: `npx tsc --noEmit` puis `npm test` — verts.

```bash
git add -A
git commit -m "refactor(rewards): drop close-time proportional split — the ledger is the only reward path"
```

---

### Task 10: UI — board personnel (`ContributorTaskBoard` réécrit)

**Files:**
- Modify: `apps/leaderboard-client/src/components/contributor/ContributorTaskBoard.tsx` (réécriture complète)

**Interfaces:**
- Consumes: `PATCH /api/tasks/[id]` (statut), `POST /api/tasks` (création perso), `DELETE /api/tasks/[id]`.
- Produces: `ContributorTaskBoard({ challengeId, tasks, onReload }: { challengeId: string; tasks: BoardTask[]; onReload: () => Promise<void> | void })` avec `export interface BoardTask { uuid: string; title: string; description?: string; status: 'todo' | 'in_progress' | 'done'; parent_task_id?: string }`. Consommé par la page challenge (Task 11).

- [ ] **Step 1: Réécrire le composant**

Réutiliser la structure dnd-kit existante (colonnes `Column`, cartes `Card`, `DragOverlay`, détection mobile) mais :

- **Colonnes** = le statut stocké : `columnOf = (t) => t.status`. Toute paire de colonnes est un déplacement valide (todo ↔ in_progress ↔ done, dans les deux sens) — `onDragEnd` fait un `PATCH /api/tasks/${id}` avec `{ status: to }` en optimiste (state local `pending` conservé pour le spinner), puis `onReload()`.
- **Supprimer** : `contributions`, `currentUserId`, `isAdmin`, `runAssign`, `runEvaluate`, `runValidate`, `ActionMenu` (re-evaluate/validate), les états `assigning|evaluating|validating`, l'affichage de score et le badge `concurrent`, `trackOnboardingStep('assigned_task')` au drag.
- **Ajouter** : un bouton "+ New task" en tête de la colonne To do, ouvrant un mini-formulaire inline (input titre + textarea description optionnelle) qui `POST /api/tasks` avec `{ challenge_id: challengeId, title, description }` puis `onReload()`. Au premier POST réussi, appeler `trackOnboardingStep('assigned_task')` (l'étape d'onboarding "s'est mis au travail" correspond désormais à la création de sa première tâche).
- **Ajouter** sur chaque carte un menu (icône `MoreVertical`, pattern du `ActionMenu` existant) avec **Delete** (`DELETE /api/tasks/${id}` + confirm) — l'édition du titre/description passe par la page tâche (clic sur la carte, navigation conservée).
- Le hint sous le board devient : `Drag cards across columns to track your progress. Finish everything to unlock the evaluation.`
- Les sous-tâches restent hors board (`parents = tasks.filter(t => !t.parent_task_id)` conservé).

Squelette des mutations :

```tsx
const runStatusChange = async (taskId: string, status: ColKey) => {
  setPending(p => ({ ...p, [taskId]: status }));
  try {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Failed to move task'); return; }
    await onReload();
  } catch { alert('Network error'); }
  finally { setPending(p => { const n = { ...p }; delete n[taskId]; return n; }); }
};

const onDragEnd = (e: DragEndEvent) => {
  setActiveId(null);
  const { active, over } = e;
  if (!over) return;
  const task = parents.find(t => t.uuid === String(active.id));
  if (!task) return;
  const to = String(over.id) as ColKey;
  if (task.status !== to) runStatusChange(task.uuid, to);
};
```

- [ ] **Step 2: Compiler**

Run: `npx tsc --noEmit` — les appels du composant depuis `page.tsx` casseront (props changées) : mettre à jour l'appel dans `challenges/[id]/page.tsx` *a minima* pour compiler (le reste de la page est refait en Task 11).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): personal kanban — stored status drag&drop, inline task creation, owner delete"
```

---

### Task 11: UI — page challenge code (join, workspace, évaluation)

**Files:**
- Create: `apps/leaderboard-client/src/components/challenges/CodeChallengePanel.tsx`
- Modify: `apps/leaderboard-client/src/app/challenges/[id]/page.tsx` (TabTasks + hero card Tasks)

**Interfaces:**
- Consumes: `POST /api/challenges/[id]/join`, `PATCH /api/challenges/[id]/workspace`, `POST /api/challenges/[id]/project-evaluation`, payload `overview` (`tasks` avec `user_id`, `participants`, `contributions`), `ContributorTaskBoard` (Task 10), `PROJECT_CONTRIBUTION_TYPE` = `'project'` (dupliquer la constante côté client, pas d'import serveur).
- Produces: `CodeChallengePanel({ challengeId, challenge, myTasks, templateTasks, myParticipation, myProjectContribution, isMember, onReload })` — rendu par `TabTasks`.

- [ ] **Step 1: Créer `CodeChallengePanel.tsx`**

Un composant client qui assemble trois blocs au-dessus/autour du board :

```tsx
'use client';

import { useState } from 'react';
import { Loader2, GitBranch, Rocket, CheckCircle2, XCircle, ExternalLink, Users } from 'lucide-react';
import { ContributorTaskBoard, type BoardTask } from '@/components/contributor/ContributorTaskBoard';
import { trackOnboardingStep } from '@/lib/onboarding-track';

export interface CodeParticipation {
  user_id: string;
  workspace_provider?: 'github' | 'external';
  workspace_ref?: string;
  workspace_url?: string;
  workspace_status?: 'pending' | 'ready' | 'failed';
}

export interface ProjectContribution {
  uuid: string;
  evaluation?: { globalScore?: number } | null;
  reward: number;
  evaluation_status?: string;
}

export function CodeChallengePanel({
  challengeId, workspaceMode, myTasks, templateTasks, myParticipation, myProjectContribution, isMember, onReload,
}: {
  challengeId: string;
  workspaceMode: 'provided_repo' | 'own_repo';
  myTasks: BoardTask[];
  templateTasks: BoardTask[];
  myParticipation: CodeParticipation | null;
  myProjectContribution: ProjectContribution | null;
  isMember: boolean;
  onReload: () => Promise<void> | void;
}) {
  const [joining, setJoining] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [repoUrl, setRepoUrl] = useState(myParticipation?.workspace_url ?? '');
  const [error, setError] = useState('');

  const join = async () => {
    setJoining(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Failed to join'); return; }
      await onReload();
    } catch { setError('Network error'); }
    finally { setJoining(false); }
  };

  const saveRepoUrl = async () => {
    setError('');
    const res = await fetch(`/api/challenges/${challengeId}/workspace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_url: repoUrl }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Invalid repo URL'); return; }
    await onReload();
  };

  const launchEvaluation = async () => {
    setLaunching(true); setError('');
    try {
      const res = await fetch(`/api/challenges/${challengeId}/project-evaluation`, { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Cannot start evaluation'); return; }
      trackOnboardingStep('validated_task');
      await onReload();
    } catch { setError('Network error'); }
    finally { setLaunching(false); }
  };

  // ── Non-membre : teaser + bouton rejoindre ──
  if (!isMember) {
    return (
      <div className="space-y-4">
        {templateTasks.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Program</p>
            {templateTasks.filter(t => !t.parent_task_id).map(t => (
              <div key={t.uuid} className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-sm font-medium text-white">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-white/35">{t.description}</p>}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={join}
          disabled={joining}
          className="flex items-center gap-2 rounded-xl bg-brandCP/20 px-6 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/30 disabled:opacity-60"
        >
          {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Join the challenge
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  // ── Membre ──
  const parents = myTasks.filter(t => !t.parent_task_id);
  const allDone = parents.length > 0 && parents.every(t => t.status === 'done')
    && myTasks.every(t => t.status === 'done');
  const workspaceReady = myParticipation?.workspace_provider === 'external'
    ? !!myParticipation?.workspace_url
    : myParticipation?.workspace_status === 'ready';
  const evalStatus = myProjectContribution?.evaluation_status;
  const running = evalStatus === 'running' || evalStatus === 'pending';
  const score = myProjectContribution?.evaluation?.globalScore;

  const disabledReason = !workspaceReady
    ? (workspaceMode === 'own_repo' ? 'Add your repository URL first' : 'Your personal branch is not ready yet')
    : parents.length === 0 ? 'Create at least one task'
    : !allDone ? 'Finish every task on your board'
    : running ? 'Evaluation in progress…'
    : null;

  return (
    <div className="space-y-5">
      {/* Workspace */}
      <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        {workspaceMode === 'own_repo' ? (
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-4 w-4 text-white/30" />
            <input
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/you/your-repo (public)"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-brandCP/40 focus:outline-none"
            />
            <button onClick={saveRepoUrl} className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/[0.1]">
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-white/30" />
            {myParticipation?.workspace_status === 'ready' && myParticipation.workspace_url ? (
              <a href={myParticipation.workspace_url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-1 text-brandCP hover:underline">
                {myParticipation.workspace_ref?.replace('refs/heads/', '')} <ExternalLink className="h-3 w-3" />
              </a>
            ) : myParticipation?.workspace_status === 'failed' ? (
              <span className="flex items-center gap-1 text-red-400"><XCircle className="h-3.5 w-3.5" /> Branch provisioning failed</span>
            ) : (
              <span className="flex items-center gap-1 text-white/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Provisioning your branch…</span>
            )}
          </div>
        )}
      </div>

      {/* Board perso */}
      <ContributorTaskBoard challengeId={challengeId} tasks={myTasks} onReload={onReload} />

      {/* Évaluation globale */}
      <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={launchEvaluation}
            disabled={!!disabledReason || launching}
            className="flex items-center gap-2 rounded-xl bg-brandCP/20 px-5 py-2.5 text-sm font-semibold text-brandCP transition-all hover:bg-brandCP/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running || launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {running ? 'Evaluating…' : evalStatus === 'done' ? 'Re-evaluate my project' : 'Launch evaluation'}
          </button>
          {disabledReason && !running && <span className="text-xs text-white/30">{disabledReason}</span>}
        </div>

        {evalStatus === 'done' && typeof score === 'number' && (
          <p className="flex items-center gap-2 text-sm text-white/70">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            Score {(Math.min(10, (score / 9) * 10)).toFixed(1)}/10 · {myProjectContribution!.reward} CP earned
          </p>
        )}
        {evalStatus === 'failed' && (
          <p className="flex items-center gap-2 text-xs text-red-400">
            <XCircle className="h-3.5 w-3.5" /> Evaluation failed — check your repository and try again.
          </p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Brancher dans `page.tsx`**

Dans `ChallengeDetailPage` :
- typer `participants` dans le retour d'overview et extraire : `const participants = overviewQuery.data?.participants ?? [];` ; `const myParticipation = participants.find((p: any) => p.user_id === currentUserId) ?? null;` ; `const isMember = !!myParticipation;`
- séparer les tâches : `const myTasks = tasks.filter(t => t.user_id === currentUserId);` et `const templateTasks = tasks.filter(t => !t.user_id);` (adapter le map de `tasks` : plus d'`assignees`, garder `user_id` et `status`).
- `const myProjectContribution = contributions.find((c: any) => c.user_id === currentUserId && c.type === 'project') ?? null;`
- **Polling pendant un run** : sur `overviewQuery`, ajouter `refetchInterval: (query) => { const cs = query.state.data?.contributions ?? []; const mine = cs.find((c: any) => c.user_id === currentUserId && c.type === 'project'); return mine && ['pending', 'running'].includes(mine.evaluation_status) ? 3000 : false; }`.
- Remplacer le contenu de `TabTasks` par `CodeChallengePanel` (le header "Tasks x/y" utilise désormais `myTasks`) ; passer `workspaceMode: (challenge as any).workspace_mode ?? 'provided_repo'` (ajouter `workspace_mode?: string` à l'interface locale `Challenge`).
- Hero card "Tasks" (`:329-336`) : si membre → `value` = `% de myTasks done`, `meta` = `x of y tasks done · your board` ; si non-membre → `value` = `${team.length}` participants ; supprimer les références à `doneTasks/completion` globaux.

- [ ] **Step 3: Vérifier**

Run: `npx tsc --noEmit` puis `npm run build` — 0 erreur.
Vérification manuelle (si un dev server + DB seedée sont disponibles) : rejoindre un challenge code, créer/déplacer des tâches, voir le bouton d'évaluation se griser avec la bonne raison.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): code challenge page — join flow, workspace panel, personal board, global evaluation launcher"
```

---

### Task 12: UI — création (mode + règles code) et éditeur de template

**Files:**
- Create: `apps/leaderboard-client/src/components/admin/CodeRewardRulesEditor.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/CreateChallengeDrawer.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/ChallengeTasksEditor.tsx`
- Modify: `apps/leaderboard-client/src/components/challenges/RewardRulesDrawer.tsx`
- Modify: `apps/leaderboard-client/src/components/admin/TaskForm.tsx`, `TaskList.tsx`, `apps/leaderboard-client/src/components/contributor/MyTasks.tsx` (purge solo/concurrent)

**Interfaces:**
- Consumes: `CodeRewardRules`/`DEFAULT_CODE_REWARD_RULES` (Task 1), `POST /api/challenges` étendu (Task 6), `POST /api/tasks { template: true }` (Task 7).
- Produces: `CodeRewardRulesEditor({ value, pool, onChange }: { value: CodeRewardRules | null; pool: number; onChange: (r: CodeRewardRules) => void })`.

- [ ] **Step 1: `CodeRewardRulesEditor.tsx`**

Sur le modèle de `MlRewardRulesEditor` (FormSection/FormField/inputClass) :

```tsx
'use client';

import { FormField, FormSection, inputClass } from '@/components/ui/FormField';
import {
  DEFAULT_CODE_REWARD_RULES,
  type CodeRewardRules,
} from '../../../../../packages/database-service/domain/codeRewardRules';

interface Props {
  value: CodeRewardRules | null;
  pool: number;
  onChange: (rules: CodeRewardRules) => void;
}

export function CodeRewardRulesEditor({ value, pool, onChange }: Props) {
  const rules = value ?? DEFAULT_CODE_REWARD_RULES;
  const perContributorMax = rules.delivery.fixed + rules.delivery.cap;

  return (
    <FormSection title="Code Reward Rules">
      <p className="-mt-1 text-xs text-white/35">
        Each contributor delivers the whole project. A run pays the fixed part once,
        plus cap × AI score / 10 — re-runs only pay the positive delta.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Fixed part">
          <input
            type="number" min={0} className={inputClass}
            value={rules.delivery.fixed}
            onChange={e => onChange({ ...rules, delivery: { ...rules.delivery, fixed: parseInt(e.target.value) || 0 } })}
          />
        </FormField>
        <FormField label="Quality cap">
          <input
            type="number" min={0} className={inputClass}
            value={rules.delivery.cap}
            onChange={e => onChange({ ...rules, delivery: { ...rules.delivery, cap: parseInt(e.target.value) || 0 } })}
          />
        </FormField>
      </div>

      <p className="text-xs text-white/30">
        A perfect delivery earns {perContributorMax} CP. The {pool.toLocaleString()} CP pool funds about{' '}
        {perContributorMax > 0 ? Math.floor(pool / perContributorMax) : '∞'} full-score contributors — first come,
        first served, awards are clamped to what is left.
      </p>
    </FormSection>
  );
}
```

- [ ] **Step 2: `CreateChallengeDrawer.tsx`**

- State : `const [workspaceMode, setWorkspaceMode] = useState<'provided_repo' | 'own_repo'>('provided_repo');` et `const [codeRules, setCodeRules] = useState<CodeRewardRules>(DEFAULT_CODE_REWARD_RULES);` (imports Task 1). Reset dans `resetForm`, hydratation dans le `useEffect` d'ouverture (`challenge.reward_rules` : si `parseCodeRewardRules` non-null → `setCodeRules`, sinon `setRewardRules` ML via `parseMlRewardRules`; importer les deux parseurs).
- Type de `EditableChallenge.reward_rules` : `MlRewardRules | CodeRewardRules | null`.
- UI, pour `type === 'code'` :
  - sélecteur de mode (création uniquement — locked à l'édition avec `LockedValue`), deux boutons dans le style du sélecteur de type : `provided_repo` ("Shared repo — one personal branch per contributor") / `own_repo` ("Own repo — each contributor submits their repo URL") ;
  - `<CodeRewardRulesEditor value={codeRules} pool={cp} onChange={setCodeRules} />` ;
  - le champ "GitHub Repository" existant n'apparaît qu'en mode `provided_repo`.
- `handleSubmit` — dans `shared` : `reward_rules: type === 'ml' ? rewardRules : type === 'code' ? codeRules : null` ; dans le corps création : `workspace_mode: type === 'code' ? workspaceMode : undefined`, et `github_repo` seulement si `workspaceMode === 'provided_repo'`.

- [ ] **Step 3: `ChallengeTasksEditor.tsx` → éditeur de template**

- Fetch : `/api/tasks?challenge_id=${challengeId}&scope=template`.
- POST : `{ challenge_id, title, template: true }` — supprimer l'état `type` et le toggle Solo/Concurrent, ainsi que `forcedRepoId` et le fetch des repos (plus de repo par tâche).
- Libellé de section : `Template tasks` avec le sous-texte `Copied to each contributor's personal board when they join.` Retirer l'affichage du statut done (une template n'a pas de progression).

- [ ] **Step 4: `RewardRulesDrawer.tsx`**

Lire le composant. Il affiche les règles d'un challenge : ajouter la branche code — si `parseCodeRewardRules(challenge.reward_rules)` renvoie des règles, afficher deux lignes ("Fixed part — earned when your evaluated delivery lands", "Quality cap — × your AI score /10, delta on re-runs") avec les montants, dans le style des blocs ML existants ; garder le rendu ML si `parseMlRewardRules` matche.

- [ ] **Step 5: Purge `solo`/`concurrent` restants**

Run: `grep -rn "solo\|concurrent" apps/leaderboard-client/src --include=*.tsx --include=*.ts`
Corriger chaque site restant : `TaskForm.tsx`/`TaskList.tsx` (retirer le champ type ; si `TaskForm` sert la création admin générique, il envoie désormais `template: true`), `MyTasks.tsx` (retirer le badge type), types locaux `BoardTask`/`TaskWithAssignees`.

- [ ] **Step 6: Vérifier + commit**

Run: `npx tsc --noEmit` && `npm run build` — 0 erreur.

```bash
git add -A
git commit -m "feat(ui): code challenge creation (workspace mode + code reward rules) and template task editor"
```

---

### Task 13: UI manage — participants + pool ; route ml-rewards ouverte au code

**Files:**
- Modify: `apps/leaderboard-client/src/app/api/challenges/[id]/ml-rewards/route.ts` (accepter type `code`)
- Modify: `apps/leaderboard-client/src/components/challenges/ChallengeManageView.tsx` (TabParticipants pour code)

**Interfaces:**
- Consumes: payload overview `participants` (Task 8), `GET /api/challenges/[id]/ml-rewards` (métrique nulle pour code).
- Produces: onglet **Participants** dans la vue manage des challenges code.

- [ ] **Step 1: Ouvrir la route pool au code**

Dans `ml-rewards/route.ts`, remplacer le guard :

```ts
    if (challenge.type !== 'ml' && challenge.type !== 'code') {
      return NextResponse.json({ error: 'No reward pool for this challenge type' }, { status: 400 });
    }
```

et (déjà préparé en Task 3) le bloc `metric`/`bestValue` n'est calculé que si `parseMlRewardRules(challenge.reward_rules)` est non-null — pour un challenge code, `metric: null`, `bestValue: null`, `thresholdReached: false`, mais `pool/distributed/remaining/breakdown` sont remplis par le ledger. Renommer le commentaire d'en-tête ("Pool state + per-user breakdown for a challenge with live rewards (ML or code)").

- [ ] **Step 2: `TabParticipants` dans `ChallengeManageView`**

Lire la structure du fichier (tabs par type autour de `:867-928`). Ajouter pour les challenges code un onglet `Participants` avec un composant local :

```tsx
function TabParticipants({ team, tasks, participants, contributions }: {
  team: TeamMember[];
  tasks: Array<{ uuid: string; user_id?: string | null; status: string; parent_task_id?: string }>;
  participants: Array<{ user_id: string; workspace_status?: string; workspace_url?: string; workspace_provider?: string }>;
  contributions: Contribution[];
}) {
  const rows = team.map(member => {
    const mine = tasks.filter(t => t.user_id === member.id && !t.parent_task_id);
    const done = mine.filter(t => t.status === 'done').length;
    const participation = participants.find(p => p.user_id === member.id);
    const project = contributions.find(c => c.user_id === member.id && c.type === 'project');
    return { member, total: mine.length, done, participation, project };
  });

  return (
    <div className="space-y-1.5">
      {rows.map(({ member, total, done, participation, project }) => (
        <div key={member.id} className="flex items-center gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <InitialsAvatar name={member.fullName} size={28} avatarUrl={member.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{member.fullName}</p>
            <p className="text-xs text-white/30">
              {total === 0 ? 'No tasks yet' : `${done}/${total} tasks done`}
              {participation?.workspace_status ? ` · workspace ${participation.workspace_status}` : ''}
            </p>
          </div>
          {project?.evaluation_status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-brandCP" />}
          {project?.evaluation_status === 'done' && (
            <span className="rounded-full bg-brandCP/10 px-2.5 py-0.5 text-xs font-semibold text-brandCP">
              {project.reward} CP
            </span>
          )}
          {project?.evaluation_status === 'failed' && <span className="text-xs text-red-400">eval failed</span>}
        </div>
      ))}
      {rows.length === 0 && <p className="px-2 py-8 text-center text-xs text-white/25">No participants yet</p>}
    </div>
  );
}
```

Brancher : typer `participants` dans le fetch overview de la vue manage, et insérer l'onglet dans la liste des tabs **code** (entre Overview et Activity). Afficher aussi le pool (`pool/distributed/remaining` via la query `ml-rewards` déjà présente dans le fichier — l'activer pour `type === 'code'` en plus de `ml`) sous forme d'une ligne de stats en tête d'onglet. Adapter tout usage restant de `tasks` avec assignees dans ce fichier (grep `assignees` dans le fichier).

- [ ] **Step 3: Vérifier + commit**

Run: `npx tsc --noEmit` && `npm run build`.

```bash
git add -A
git commit -m "feat(manage): participants progress panel and reward pool for code challenges"
```

---

### Task 14: Page tâche simplifiée + MyTasks

**Files:**
- Modify: `apps/leaderboard-client/src/app/tasks/[id]/page.tsx`
- Modify: `apps/leaderboard-client/src/components/contributor/MyTasks.tsx`

**Interfaces:**
- Consumes: `GET /api/tasks/[id]/details` → `{ task, subTasks }` (Task 7), `PATCH /api/tasks/[id]`, `POST /api/tasks` (sous-tâches), `DELETE`.
- Produces: page de détail réduite : titre/description éditables par le propriétaire, sous-tâches cochables (statut todo/done via PATCH), bouton delete. Plus de workspaces, d'assignés, d'évaluation ni de bouton Complete.

- [ ] **Step 1: Réécrire la page tâche**

Lire le fichier (479 lignes) et le réduire : conserver le layout/squelette et la navigation retour ; sections restantes —

1. **En-tête** : titre + description, éditables inline (crayon → inputs → `PATCH /api/tasks/[id]`).
2. **Statut** : trois chips todo / in progress / done, clic → `PATCH { status }`.
3. **Sous-tâches** : liste des `subTasks` avec checkbox (`PATCH { status: 'done' | 'todo' }`), ajout inline (`POST /api/tasks { challenge_id: task.challenge_id, parent_task_id: task.uuid, title }`), suppression.
4. **Danger zone** : bouton Delete task (confirm) → `DELETE` → retour à la page challenge.

Supprimer tous les blocs workspaces/assignees/evaluate/complete et leurs fetches.

- [ ] **Step 2: `MyTasks.tsx`**

Vérifier le rendu (142 lignes) contre le nouveau modèle : la route `/api/contributors/me/tasks` renvoie désormais les tâches possédées (3 statuts). Retirer badge type et toute mention d'assignation ; afficher le statut réel (`todo`/`in progress`/`done`).

- [ ] **Step 3: Vérifier + commit**

Run: `npx tsc --noEmit` && `npm run build`.

```bash
git add -A
git commit -m "refactor(ui): task detail page as a personal task editor; MyTasks on owned tasks"
```

---

### Task 15: Seed démo, docs, vérification finale

**Files:**
- Modify: `db_data/seed-demo.ts`
- Modify: `docs/challenges-and-tasks.md`
- Modify: `docs/superpowers/specs/2026-08-28-code-challenge-personal-boards-design.md` (rien à changer sauf si l'implémentation a dévié — noter les écarts)

- [ ] **Step 1: Reseed démo**

Lire `db_data/seed-demo.ts` et suivre son style (repositories ou inserts drizzle directs — reprendre l'existant). Remplacer les blocs de démo des challenges code (tâches globales/assignations) par ce jeu de données :

| Élément | Valeurs |
|---|---|
| Challenge A | `type: 'code'`, `workspace_mode: 'provided_repo'`, pool 300 CP, `reward_rules: { version: 1, delivery: { fixed: 50, cap: 100 } }`, 3 tâches template ("Set up the project", "Implement the core feature", "Write the README") |
| Challenge A — participant 1 | board complet (3 tâches done copiées du template + 1 tâche perso "Polish the UI" done), participation `workspace_provider: 'github'`, `workspace_ref: 'refs/heads/contrib/0xx-<user>'`, `workspace_status: 'ready'`, contribution `type: 'project'` `evaluation_status: 'done'` avec `evaluation: { globalScore: 7.2, scores: [] }`, ledger : `code_fixed` 50 + `code_quality` 80 |
| Challenge A — participant 2 | board en cours (1 done, 1 in_progress, 1 todo), workspace ready, pas de contribution |
| Challenge B | `type: 'code'`, `workspace_mode: 'own_repo'`, pool 200 CP, `reward_rules: { version: 1, delivery: { fixed: 25, cap: 75 } }`, aucune tâche template |
| Challenge B — participant 1 | 2 tâches perso done, participation `workspace_provider: 'external'`, `workspace_url: 'https://github.com/demo/notebook-api'`, contribution `project` `running` (démo du polling) |

Utiliser `RewardEntryRepository.createManyAndSyncRewards` pour le ledger (le trigger synchronise `contributions.reward`). Mettre à jour `challenges.completion` du challenge A à `130/300`.

- [ ] **Step 2: Vérifier le seed**

Run: `npm run db:setup:demo`
Expected: sortie sans erreur. Contrôle : `npx drizzle-kit studio` ou une requête rapide — les tâches du challenge A existent en double exemplaire (template `user_id NULL` + copies possédées).

- [ ] **Step 3: Docs**

Réécrire `docs/challenges-and-tasks.md` : remplacer la description du kanban global (claim/solo/concurrent, statut dérivé, évaluation par tâche) par le nouveau modèle — boards personnels, template admin, workspace par participation (2 modes), évaluation globale déclenchée par le contributeur, récompense fixed + cap×note/10 avec delta au ledger, complétion = pool drainé. Mentionner les routes clés (`join`, `tasks?scope=`, `project-evaluation`, `workspace`) et pointer vers la spec.

- [ ] **Step 4: Vérification finale complète**

Run: `npm test` — toute la suite verte.
Run: `npm run build` — build Next.js propre.
Run: `grep -rn "task_assignees\|task_workspaces\|solo\|concurrent\|findByChallengeWithAssignees\|completeTask\|computeChallengeRewards" apps packages --include=*.ts --include=*.tsx | grep -v node_modules` — aucune occurrence résiduelle (hors docs/historique).

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat(demo): seed personal-board code challenges; docs for the new code workflow"
```

---

## Self-Review (exécutée à l'écriture du plan)

- **Couverture spec** : §3 modèle de données → Tasks 1–3 ; §4.1 join → Task 6 ; §4.2 board → Tasks 7, 10 ; §4.3 évaluation → Tasks 5, 8 ; §4.4 itération → Tasks 2, 5 ; §4.5 completion/close → Tasks 5, 9 ; §5 rewards → Tasks 1, 2, 5 ; §6 UI → Tasks 10–14 ; §7 tests → intégrés par tâche ; §8 hors scope respecté (pas de repos privés, pas de board des autres, pas de lineage).
- **Cohérence de types** : `Task.status` 3 états partout ; `ChallengeTeam` workspace partagé entre join (T6), service (T5), routes (T8), UI (T11, T13) ; `reward_rules` union narrowée aux 3 sites ML (T3) et aux 2 éditeurs UI (T12).
- **Ordre** : chaque tâche compile et teste vert isolément ; la T3 supprime les routes mortes pour garder le build vert avant leurs remplaçantes (T7–T8).
