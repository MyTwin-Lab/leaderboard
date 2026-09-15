# Project structure

## Full directory tree

```
leaderboard/
│
├── apps/
│   └── leaderboard-client/           # Next.js 16 app — UI + all API routes
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Root layout (also injects the active theme)
│       │   │   ├── providers.tsx      # React Query provider
│       │   │   ├── page.tsx           # Curated homepage (hero + top contributors + trending challenges)
│       │   │   ├── globals.css        # Tailwind 4 entry + overrideable theme tokens
│       │   │   ├── leaderboard/       # Full leaderboard
│       │   │   ├── about/             # MyTwin Lab landing (institutions + contributors)
│       │   │   ├── terms-of-use/  privacy-policy/   # legal pages, markdown in content/legal/
│       │   │   ├── robots.ts  sitemap.ts  opengraph-image.tsx   # see seo.md
│       │   │   ├── signin/            # Sign-in page
│       │   │   ├── admin/             # Admin section (protected, admin role only)
│       │   │   │   ├── challenges/  contributions/  evaluation-grids/
│       │   │   │   ├── evaluation-runs/  meetings/  projects/  repos/  users/
│       │   │   ├── challenges/        # Challenge listing + detail page
│       │   │   │   └── [id]/manage/   # Project-manager view (mirrors the admin challenge view)
│       │   │   ├── contributors/      # Contributor profiles + /me (settings, integrations, modules)
│       │   │   ├── sandbox/           # Sandbox module pages (404 when disabled)
│       │   │   ├── sync-meetings/     # Meetings module pages (404 when disabled)
│       │   │   ├── tasks/             # Task detail page
│       │   │   └── api/               # Next.js Route Handlers — see api.md
│       │   │       ├── admin/              # theme, digests, sandboxes, sandbox-rewards
│       │   │       ├── auth/               # refresh, logout, check-session
│       │   │       ├── google-auth/        # OAuth authorize + callback (login)
│       │   │       ├── challenges/         # challenges; [id]/flow/[...action] and
│       │   │       │                       # [id]/ext/[key]/[...action] for flow and extension actions
│       │   │       ├── contributions/  contributors/  tasks/  users/  notifications/
│       │   │       ├── projects/  repos/  leaderboard/  onboarding/  qualifications/
│       │   │       ├── evaluation-grids/  evaluation-runs/  sandboxes/  sync-meetings/
│       │   │       ├── integrations/       # generic connections: [key]/{connection,status,
│       │   │       │                       # authorize,callback,extras/[action]}
│       │   │       ├── github-oauth/       # legacy alias of the GitHub OAuth callback
│       │   │       ├── modules/            # module list + [key] settings and toggle
│       │   │       ├── events/ui/          # browser-only UI events → outbox
│       │   │       ├── cron/tick/          # the single scheduled entry point (the five
│       │   │       │                       # older cron routes are thin wrappers, to be removed)
│       │   │       ├── docs/               # Scalar API reference (dev only)
│       │   │       └── openapi.json/       # OpenAPI spec (dev only)
│       │   ├── components/
│       │   │   ├── admin/             # admin drawers, editors, lists
│       │   │   ├── challenges/        # brief, detail and manage views, drawers
│       │   │   ├── contributor/       # profile, task board, integration cards, modules panel
│       │   │   ├── home/              # homepage sections
│       │   │   ├── layout/            # navbar, footer, module nav links, session guard
│       │   │   ├── leaderboard/       # podium, table, filters
│       │   │   ├── onboarding/        # onboarding drawer + quests
│       │   │   ├── public/            # challenge cards, filters, project explorer
│       │   │   ├── sandbox/           # proposal listing, detail, forms
│       │   │   └── ui/                # design-system primitives (Button, Markdown, Toast…)
│       │   ├── distribution/          # composition root — the only shell code that may import
│       │   │   │                      # content/ and modules/
│       │   │   ├── mytwin.platform.ts # flows, extensions, kits, modules installed
│       │   │   ├── mytwin.server.ts   # connectors, integrations, bundle sources, providers, grids
│       │   │   ├── mytwin.client.tsx  mytwin.forms.tsx  mytwin.activity.tsx  mytwin.integrations.tsx
│       │   │   ├── mytwin.modules.tsx mytwin.proxy.ts
│       │   │   └── client/  forms/  activity/  modules/   # per flow, connector and module
│       │   ├── lib/
│       │   │   ├── auth.ts            # JWT helpers (sign, verify, cookies)
│       │   │   ├── db.ts              # repository instances
│       │   │   ├── flowSlots.ts  flowFormSlots.ts  moduleSlots.ts   # client slot contracts
│       │   │   ├── challengeActions.ts  # flowActionUrl / extensionActionUrl
│       │   │   ├── moduleProxy.ts  uiEvents.ts  flowConfig.ts  integrations.ts
│       │   │   ├── challengeBrief.ts  # brief filename convention + gate logic
│       │   │   ├── useJoinChallenge.ts  joinGate.ts
│       │   │   ├── leaderboard.ts  contributor.ts  medals.ts  taskProgress.ts
│       │   │   ├── themes.ts  color-utils.ts  formatters.ts  utils.ts  url.ts
│       │   │   ├── signin.ts  routeVisibility.ts  fetchJson.ts  types.ts  validation.ts  otel.ts
│       │   │   ├── public/            # payload allowlists for anonymous visitors
│       │   │   └── server/            # server-only (managerAuth, cronAuth, modules, onboarding,
│       │   │                          #  home, leaderboard, publicPages, integrations)
│       │   ├── proxy.ts               # route protection (JWT check, Edge runtime)
│       │   └── instrumentation.ts     # installs the distribution + observability init
│       ├── vitest.config.ts           # the real test runner config (alias-aware)
│       ├── package.json
│       └── next.config.ts
│
├── packages/                          # CORE — imports nothing outside the core
│   ├── registry/                      # PlatformRegistry + architecture, empty-distribution
│   │                                  # and example-flow tests
│   ├── capabilities/                  # evaluation + bundle, challenge-actions + challenge-hooks,
│   │                                  # board, groups, qualifications, pool, economy, rewards,
│   │                                  # cron, events, modules, crypto, credentials,
│   │                                  # identity/ (Google login), http-proxy/ (SSRF guard,
│   │                                  # endpoint proxy), testing/
│   ├── config/                        # env validation (Zod) + credential getters
│   │   ├── index.ts
│   │   └── githubToken.ts  kaggleCredentials.ts  slackCredentials.ts
│   │       openaiCredentials.ts  scalewayCredentials.ts
│   │
│   ├── database-service/              # PostgreSQL schema + repositories
│   │   ├── db/
│   │   │   ├── drizzle.ts             # schema definition (source of truth)
│   │   │   └── mappers.ts             # DB rows ↔ domain entities
│   │   ├── domain/                    # entities, Zod schemas, reward rule shapes,
│   │   │                              # legacy column fallbacks
│   │   └── repositories/              # one file per table/domain area
│   │
│   ├── evaluator/                     # AI evaluation agent
│   │   ├── evaluator.ts               # OpenAIAgentEvaluator class
│   │   ├── grids/                     # grid registry (grids come from the database)
│   │   └── openai/                    # client + evaluate agent
│   │
│   ├── connectors/                    # connector + integration interfaces and registries,
│   │                                  # opaque activity
│   ├── provisioner/src/               # provider interface + registry
│   │
│   ├── services/                      # not yet sorted: challenge/, compute/, digest/,
│   │                                  # google-workspace/ (calendar, meet), sandbox/, slack/,
│   │                                  # sync-meeting/, grid service + DB grid provider
│   ├── sync-meeting-agent/            # not yet sorted: AI analysis of sync meetings
│   └── slack-signal-agent/            # not yet sorted: AI detection of Slack signals
│
├── content/                           # INSTALLED CONTENT — see writing-a-flow.md
│   ├── flows/                         # code  ml  endpoint-validation  journey-validation
│   ├── kits/validation/               # shared by the validation flows
│   ├── extensions/                    # slack-signals  compute (+ scaleway/)
│   ├── connectors/                    # github  kaggle  slack
│   ├── integrations/openai/
│   ├── bundle-sources/                # github-snapshot  kaggle-artifact
│   ├── workspace-providers/           # github-branch
│   └── grids/                         # code  dataset  model (seeds)
│
├── modules/                           # PRODUCT MODULES — meetings  onboarding  digest  sandbox
│
├── db_data/                           # seed data
│   ├── seed.ts  seed-demo.ts  seed-sandbox.ts
│   ├── seed-validation-mammo.ts  seed-validation-mykine.ts
│   └── projects.json  users.json  challenges.json  contributions.json
│
├── drizzle/                           # generated SQL migrations
├── challenges/                        # team roadmap / brief / spec files (not code)
├── scripts/
│   ├── db-apply-schema.ts             # idempotent schema apply (deploy postdeploy)
│   ├── db-resync-rewards.ts           # rebuild reward/completion caches
│   ├── db-seed-grids.ts               # insert missing evaluation grids (deploy postdeploy)
│   ├── db-upgrade-flow-configs.ts     # bring flow_config up to the flows' versions (postdeploy)
│   ├── db-preview-slugs.ts
│   ├── prod.sh
│   └── macos/  windows/               # init + launch helpers
├── docs/                              # this documentation
├── Procfile  scalingo.json  ecosystem.config.cjs  vercel.json
├── drizzle.config.ts                  # Drizzle ORM config
├── package.json                       # root scripts + workspace definition
└── tsconfig.json
```

## Where to look for…

| What | Where |
|------|-------|
| Page UI | `apps/leaderboard-client/src/app/**/*.tsx` |
| API endpoints | `apps/leaderboard-client/src/app/api/**/route.ts` |
| What is installed (flows, extensions, modules, connectors) | `apps/leaderboard-client/src/distribution/` |
| A challenge flow (config, rules, actions, hooks) | `content/flows/<key>/index.ts` (see [`writing-a-flow.md`](./writing-a-flow.md)) |
| Flow action dispatch and access | `packages/capabilities/challenge-actions.ts` |
| Import boundaries | `packages/registry/architecture.test.ts` |
| Scheduled jobs | `packages/capabilities/cron.ts` + `/api/cron/tick` |
| Platform events and quests | `packages/capabilities/events.ts` + `modules/onboarding/` |
| Route protection | `apps/leaderboard-client/src/proxy.ts` |
| What anonymous visitors may see | `apps/leaderboard-client/src/lib/public/` |
| Auth helpers | `apps/leaderboard-client/src/lib/auth.ts` |
| Project-manager authorization | `apps/leaderboard-client/src/lib/server/managerAuth.ts` |
| DB schema | `packages/database-service/db/drizzle.ts` |
| Production schema application | `scripts/db-apply-schema.ts` (see [`database.md`](./database.md#migrations)) |
| DB repositories | `packages/database-service/repositories/` |
| Seed data | `db_data/seed.ts` + `db_data/*.json` |
| AI evaluation (code challenges) | `packages/capabilities/evaluation.ts` + `packages/evaluator/` + `content/flows/code/` + `packages/services/challenge/code-rewards.service.ts` |
| ML challenge rewards | `content/flows/ml/reward.ts` + `packages/services/challenge/ml-rewards.service.ts` (see [`ml-rewards.md`](./ml-rewards.md)) |
| Validation challenges | `content/flows/endpoint-validation/` + `content/flows/journey-validation/` + `content/kits/validation/` + `packages/services/challenge/` (see [`validation-challenges.md`](./validation-challenges.md)) |
| GPU compute | `content/extensions/compute/` + `packages/services/compute/` (see [`compute-power.md`](./compute-power.md)) |
| Google login | `packages/capabilities/identity/google-auth.ts` |
| Meetings | `modules/meetings/` + `packages/services/google-workspace/` + `packages/services/sync-meeting/` + `packages/sync-meeting-agent/` |
| Slack signals | `content/extensions/slack-signals/` + `packages/services/slack/` + `packages/slack-signal-agent/` |
| Activity digest | `modules/digest/` + `packages/services/digest/` (see [`digest.md`](./digest.md)) |
| Sandbox (contributor proposals) | `modules/sandbox/` + `packages/services/sandbox/` + `content/flows/*/proposable.ts` + `apps/leaderboard-client/src/app/sandbox/` (see [`sandbox.md`](./sandbox.md)) |
| Integrations (connections) | `packages/connectors/integrations.ts` + `content/connectors/*/integration.ts` + `packages/capabilities/credentials.ts` |
| Module toggles and settings | `packages/capabilities/modules.ts` (`module_settings`, see [`admin-settings.md`](./admin-settings.md)) |
| Theme | `packages/database-service/repositories/appSettings.repo.ts` |
| Env config | `packages/config/` |
| Root npm scripts | `package.json` (root) |
