# Seed Data Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all db_data JSON files and extend seed.ts to produce 2 months of realistic activity across 3 projects, 8 users, 7 challenges (code & ML), tasks, and evaluated contributions.

**Architecture:** All data lives in JSON files under `db_data/`. The `seed.ts` script reads and inserts them additively. New files `tasks.json` introduced for tasks + assignees. `seed.ts` extended to handle manager_id, tasks, task_assignees, and evaluation/tags/task_id on contributions.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL

## Global Constraints

- Users: 8 total, 1 admin (Sophie Martin), 3 contributor-managers, 4 contributors
- Projects: 3 (NeuroCraft code, BioSignal AI ml, CodeAtlas code)
- Challenges: 7 (index 9–15), mix completed/active/draft, types code & ml
- Timeline: 2026-05-13 to 2026-07-13
- Scores: 0–100 scale on CriterionScore.score; globalScore = weighted average
- Rewards on contributions: proportional to globalScore across challenge pool

---

### Task 1: Write db_data/users.json

**Files:**
- Rewrite: `db_data/users.json`

- [ ] Write 8 users (Sophie admin, Lucas/Emma/Théo contributors+managers, Inès/Rayan/Clara/Maxime contributors)
- [ ] Commit: `data: rewrite users.json with 8 fictional users`

---

### Task 2: Write db_data/projects.json

**Files:**
- Rewrite: `db_data/projects.json`

- [ ] Write 3 projects with `manager_user_id` field (refs user uuid numeric)
- [ ] Commit: `data: rewrite projects.json with 3 projects and manager refs`

---

### Task 3: Write db_data/challenges.json

**Files:**
- Rewrite: `db_data/challenges.json`

- [ ] Write 7 challenges (index 9–15), statuses: completed/active/draft, types: code/ml
- [ ] Commit: `data: rewrite challenges.json with 7 challenges`

---

### Task 4: Write db_data/tasks.json

**Files:**
- Create: `db_data/tasks.json`

- [ ] Write ~26 tasks across all 7 challenges with embedded `assignees` array
- [ ] Commit: `data: create tasks.json with tasks and assignee refs`

---

### Task 5: Write db_data/contributions.json

**Files:**
- Rewrite: `db_data/contributions.json`

- [ ] Write ~40 contributions, each with type, tags, optional task_id
- [ ] Add `evaluation` JSON (CriterionScore[] + globalScore) for contributions on completed challenges
- [ ] Compute rewards proportional to globalScore within each challenge pool
- [ ] Commit: `data: rewrite contributions.json with evaluations and task links`

---

### Task 6: Extend db_data/seed.ts

**Files:**
- Modify: `db_data/seed.ts`

- [ ] Add tasks.json loading and insertion with challenge_id resolution
- [ ] Add task_assignees insertion from embedded `assignees` array
- [ ] Set manager_id on projects after userIdMap is populated
- [ ] Pass evaluation, tags, task_id fields when inserting contributions
- [ ] Extend --force reset to clear tasks, task_assignees before other tables
- [ ] Commit: `feat: extend seed.ts to handle tasks, manager_id, and contribution evaluations`
