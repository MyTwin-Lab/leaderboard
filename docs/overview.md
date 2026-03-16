# Overview

MyTwin Leaderboard is an internal platform for **MyTwin Lab** that tracks contributor work, evaluates it with AI, and distributes rewards — powering a competitive, community leaderboard.

## What it does

1. **Tracks contributions** — every meaningful unit of work (code, docs, datasets, models) is recorded as a contribution linked to a contributor and a challenge.
2. **Evaluates quality with AI** — an OpenAI-powered pipeline scores contributions using structured grids (different grids for code, docs, models, datasets).
3. **Distributes Contribution Points (CP)** — rewards are calculated from evaluation scores and the challenge reward pool, then attributed to contributors.
4. **Shows the leaderboard** — the UI renders rankings, challenge progress, and individual contributor profiles.
5. **Manages sync meetings** — meetings are created directly from the app in Google Workspace, then AI analyzes the recorded content to extract summaries, decisions, and contribution signals.
6. **Onboards new contributors** — a guided mission flow helps new contributors take their first steps (pick a task, evaluate it, validate it).

## Core concepts

| Concept | Description |
|---------|-------------|
| **Project** | A top-level initiative. Contains repositories and challenges. |
| **Challenge** | A time-bounded sprint with a reward pool. Work happens inside challenges. |
| **Task** | A concrete piece of work inside a challenge. Tasks are the primary unit of work. |
| **Contribution** | A recorded unit of output (code commit, doc, dataset, model) attributed to a contributor. |
| **Evaluation** | An AI-generated quality assessment of a contribution — produces a score (0–100) and justification. |
| **CP (Contribution Points)** | Reward currency distributed to contributors based on evaluation scores. |
| **Sync Meeting** | A team meeting created from the app in Google Workspace, later analyzed by AI. |
| **Onboarding** | A mission sequence for new contributors to get started with the platform. |

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Frontend & API routes** | Next.js 16 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Database** | PostgreSQL 14+, Drizzle ORM |
| **Authentication** | JWT (jose library), HTTP-only cookies, bcryptjs |
| **AI / Evaluation** | OpenAI API (Agents) |
| **Google integrations** | Google Workspace (Calendar, Meet), Google Drive (OAuth2) |
| **GitHub integration** | Octokit (commits, repos, branch provisioning) |
| **Observability** | OpenTelemetry → Grafana Cloud |
| **Testing** | Vitest, Testing Library |
| **Deployment** | PM2, Next.js production build |

## What this repo is not

- It is **not** a standalone REST API server — the backend logic runs inside Next.js Route Handlers.
- The `challenges/` directory at the root is **not** application code — it contains team roadmap, brief, and spec files for internal planning updates.
