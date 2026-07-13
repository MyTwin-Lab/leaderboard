# Seed Data Redesign — db_data from Scratch

**Date:** 2026-07-13
**Branch:** challenge-010-ML_integration

## Goal

Replace all existing `db_data/*.json` files and extend `seed.ts` to produce realistic 2-month activity (May–July 2026) across 3 projects, 8 users, 7 challenges (code & ML), tasks, and evaluated contributions.

---

## Users (8, all new)

| # | Name | Role | GitHub | Bio |
|---|------|------|--------|-----|
| 1 | Sophie Martin | admin | sophie-mtn | Fullstack & AI Engineer |
| 2 | Lucas Nguyen | contributor | lucasnguyen-dev | Backend Engineer, manager NeuroCraft |
| 3 | Emma Rousseau | contributor | emma-rss | ML Engineer, manager BioSignal AI |
| 4 | Théo Bernard | contributor | theo-brd | Software Engineer, manager CodeAtlas |
| 5 | Inès Faure | contributor | ines-faure | Data Scientist & ML Engineer |
| 6 | Rayan Diallo | contributor | rayan-diallo | Backend Engineer |
| 7 | Clara Chen | contributor | clara-chen | Data Scientist |
| 8 | Maxime Lefebvre | contributor | maxime-lbv | Fullstack Developer |

Sophie is the only admin. Lucas, Emma, Théo are contributors who also serve as project managers.

---

## Projects (3)

| # | Title | Description | Manager |
|---|-------|-------------|---------|
| 1 | NeuroCraft | AI-powered adaptive learning platform | Lucas Nguyen |
| 2 | BioSignal AI | Pathology detection on physiological signals | Emma Rousseau |
| 3 | CodeAtlas | Code dependency graph and visualization tool | Théo Bernard |

---

## Challenges (7)

Timeline window: 2026-05-13 → 2026-07-13

| # | Index | Title | Project | Type | Status | Dates | Reward (CP) |
|---|-------|-------|---------|------|--------|-------|-------------|
| 1 | 9 | Foundation & Auth | NeuroCraft | code | completed | May 13 → Jun 03 | 8 000 |
| 2 | 10 | Learning Engine v1 | NeuroCraft | ml | active | Jun 10 → Jul 25 | 12 000 |
| 3 | 11 | Signal Classification PoC | BioSignal AI | ml | completed | May 15 → Jun 20 | 10 000 |
| 4 | 12 | Anomaly Detection Model | BioSignal AI | ml | active | Jun 22 → Aug 05 | 14 000 |
| 5 | 13 | Real-time Inference API | BioSignal AI | code | draft | — | 6 000 |
| 6 | 14 | AST Parser Engine | CodeAtlas | code | completed | May 20 → Jun 15 | 9 000 |
| 7 | 15 | Graph Visualization | CodeAtlas | code | active | Jun 18 → Jul 30 | 11 000 |

---

## Tasks

Each challenge gets 3–5 tasks (mix solo/concurrent, todo/done).
Completed challenges: all tasks done.
Active challenges: ~60% done, ~40% todo.
Draft challenge: all tasks todo.

Tasks are linked to contributions where applicable.

---

## Contributions & Evaluations

- ~4–6 contributions per user, spread every 2–5 days across the 2-month window
- Type matches challenge type (`code` or `ml`)
- Completed challenges: contributions have `evaluation` JSON (CriterionScore[] + globalScore)
- Active/draft challenges: no evaluation yet (null)
- Reward computed from globalScore × challenge reward pool weight

### Evaluation structure (code contributions)

```json
{
  "scores": [
    { "criterion": "Complexité du code", "score": 75, "weight": 0.25, "comment": "..." },
    { "criterion": "Duplication de code", "score": 80, "weight": 0.10, "comment": "..." },
    ...
  ],
  "globalScore": 78
}
```

### Evaluation structure (ml contributions)

Same structure but with ML-specific criteria:
- Qualité des données, Feature engineering, Architecture du modèle, Performance, Documentation

---

## Files to Create/Update

| File | Action |
|------|--------|
| `db_data/users.json` | Rewrite (8 users) |
| `db_data/projects.json` | Rewrite (3 projects with manager refs) |
| `db_data/challenges.json` | Rewrite (7 challenges) |
| `db_data/tasks.json` | Create (tasks + assignees) |
| `db_data/contributions.json` | Rewrite (~45 contributions with evaluations) |
| `db_data/seed.ts` | Extend to handle tasks, task_assignees, manager_id, evaluation field |

---

## Seed.ts Extensions

1. Set `manager_id` on projects after user IDs are resolved
2. Insert tasks from `tasks.json`, resolve `challenge_id` FK
3. Insert task_assignees from `tasks.json` (embedded `assignees` array), resolve `task_id` + `user_id` FKs
4. Insert contributions with `evaluation`, `tags`, `task_id` fields
5. All inserts remain additive (deduplicated)
6. `--force` reset extended to clear tasks, task_assignees tables
