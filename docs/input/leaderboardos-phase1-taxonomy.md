# LeaderboardOS — Phase 1: The Three-Category Separation

**Separation taxonomy for the current MyTwin Leaderboard codebase**

Draft — September 2026 — companion to specification 0.2 and conformance suite 0.2

---

## Why this document

The current platform has organically converged on the invariants of the LeaderboardOS specification: rewards are paid live into an append-only ledger, closing a challenge computes nothing, validation claims are one gesture in one transaction. Phase 1 makes that convergence official. It separates the existing codebase into the three natures LeaderboardOS distinguishes — the **core** every program consumes, the **content** that installs onto it, and the **product modules** that ship beside it — without rewriting behavior. It is a re-drawing of boundaries, not a rebuild: when the engine arrives (phase 2), the core is already its substrate, and every hardcoded flow is already sitting in the territory the engine will take over, labeled with the template that will replace it.

## The three categories

| Category | Nature | Lifecycle | Contains |
|---|---|---|---|
| **Core** | Code shipped with the engine | Evolves by core versions (`requires: {core: N}`) | Identity, ledger, evaluation agent, shell UI, capability layer, connector/provider *interfaces* |
| **Installed content** | Data — today, code standing in for data | Versioned, immutable once published, **installs cold** | Challenge flows (→ templates), connector implementations (→ manifests), evaluation grids (already data) |
| **Product modules** | Application features of the MyTwin distribution | Toggleable, outside the engine | Sync meetings, onboarding, admin digest |

Three natures, three lifecycles. Evaluation grids prove the middle category already works: versioned rows in the database, referenced by id, editable without touching code. The rest of the content column follows the path the grids opened.

## The sorting tests

1. **Does every program consume it, and no program redefine it?** → Core.
2. **Does it vary per challenge type?** → Installed content: a hardcoded flow today, a template tomorrow.
3. **Does the engine read it for its own mechanics?** → Hardcoded table in core. Otherwise it belongs in generic resource storage (phase 2).
4. **The client-zero test.** MyTwin's own connectors and flows must take the same path a customer's would. If the GitHub connector cannot live as installed content behind the core interface, no customer connector can — the boundary is validated by us depending on it.

## Inventory — Core

**Identity & access.** Google OAuth + JWT (`google-auth`, `lib/auth.ts`, `refresh_tokens`, `proxy.ts`), session routes, roles — with `medical_pro` reclassified: the core carries a generic qualification registry; the specific value becomes a template parameter (`params.reviewer_role`). Project managers (`projects.manager_id`, `managerAuth.ts`). `routeVisibility` and the `lib/public` allowlists.

**Structure.** `projects`, `repos`, `challenge_teams` as the participations table (the `workspace_*` columns leave with the workspace resource in phase 3 — untouched in phase 1), `challenge_documents` including the brief convention, `app_settings`, themes.

**Economy.** `reward_entries` + the sync trigger + `db-resync-rewards` — the ledger of spec §3.5, verbatim. Leaderboard, medals, contributor profiles.

**Evaluation capability.** The `evaluator` package (agent, normalization), `DatabaseGridProvider` + grid services, `evaluation_runs` / `evaluation_run_contributions` and their admin UI. The grid *data* is installed content; the machinery that stores, versions and runs grids is core.

**Capability layer.** SSRF guard + endpoint proxy (the `http_proxy` capability), `SnapshotService` (the future `bundle` generic shape), the cron mechanism (`vercel.json` + `CRON_SECRET` + the `/api/cron/*` entry points — per-flow cron *bodies* are content), `webhook.service.ts` (orphaned today; kept and labeled as the future webhook trigger), the connector **interfaces + registry + orchestrator**, the provisioner **skeleton + provider interface**, the Scaleway client (native capability — see rulings), `config/` with encrypted credentials.

**Shell.** Root layout, navbar, home, signin, about, the `ui/` design system, the full `/admin` section, observability (`otel`), seeds, tests, deployment scripts.

## Inventory — Installed content

**Challenge flows** — each stays functionally intact in phase 1, grouped into content territory and labeled with its target:

| Current implementation | Target template |
|---|---|
| Code flow: `code-rewards.service`, `computeCodeAward`, board-done gate, workspace provisioning | `graded-submission` (instantiation 1) |
| ML flow: `ml-rewards.service`, `ml-reward.ts`, `artifactUrl` + `lineage` (reuse), lead bonus | `graded-submission` (instantiation 2) — reuse = `match_or_create` by normalized key + cross-participation reward |
| Validation flow: `reference-case.service`, `validation-challenge.service`, the four `validation_*` tables | `endpoint-validation` (suite §2) |
| Journey validation (upcoming update) | `journey-validation` (suite §11) |
| Slack signals: `slack-signals.service`, `slack-signal-agent`, cron, `challenge_signals` + `challenge_slack_configs` | Social-signals flow — cron trigger + cursor (`last_ts`), `unique_per` dedup on (user, signal, message), fixed out-of-pool rewards |
| GPU compute: `compute-request.service`, both crons | An ML-template lane — Collect request → human Assess → effector create-or-get → 24h claim TTL → reveal-token as a visibility grant |

The per-type columns of `challenges` (`workspace_mode`, `compute_enabled`, `source_challenge_id`, `cp_per_validation`, `required_validations`) and `reward_rules` are template parameters in waiting; the `challenges` table becomes the instance snapshot; `contributions` becomes a resource. All of this is phase-3 work — phase 1 only labels it.

**Connectors & workspace providers.** The GitHub connector, the Kaggle connector, and the `github-branch` workspace provider **move out of the core packages**, behind the unchanged DI interfaces. They become *manifests-in-code*: the exact path a customer's AI-generated connector will take, proven by our own dependencies. Conversion to actual manifest data waits for the 0.3 manifest format — phase 1 moves code, phase 0.3 transforms it.

**Evaluation grids.** Already versioned data referenced by id. No work needed; named here because they are the reference model the other content follows.

## Inventory — Product modules

**Sync meetings** — `google-workspace` services, `sync-meeting-agent`, the three meeting tables, the meeting pages. The Google connector stays internal to this module; it is not a platform connector. **Onboarding** — module in phase 1; its quests observe internal platform events, which no engine trigger covers yet. It remains the natural flow-demonstrator later (it is literally suite §10). **Admin digest** — specified separately; module. Module toggles stay in `app_settings`: the core provides the toggle mechanism, modules provide the features.

## Boundary rulings

- **Personal kanban: core.** Transverse, personal, never scored. The code flow's "board done" precondition becomes a core read capability exposed to gates (like `group.members`), so the flow reads core state instead of core logic embedding flow logic. Template tasks: core, as instance configuration of the board.
- **Scaleway: native core capability in phase 1.** Token encryption and polling loops need the effector shapes of 0.3 to mature before being absorbed; the compute *flow* is content, the Scaleway *client* is core.
- **Slack follows its consumer.** Today's Slack client (history, user lookup) serves only the signals flow → content. No outbound notification capability exists in the current code; none is created in phase 1.
- **Repo activity view:** shell feature reading through connectors; stays core-shell, rides typed renderers later.

## What phase 1 does — and does not do

**Does:** redraw boundaries. Move connector and provider implementations out of core packages behind the existing interfaces; group the hardcoded flows into one content territory, each labeled with its target template; name the capability layer (mapping below); keep every behavior identical.

**Does not:** build the engine (phase 2); convert connectors to manifest data (0.3); migrate any flow to a template (phase 3); change any route, any schema, or any observable behavior. **Zero schema migration in phase 1** — tables are inventory-labeled in this document, not moved.

## Target layout (indicative)

```
packages/                      # ——— CORE ———
  config/                      # unchanged
  database-service/            # unchanged (schema stays put)
  evaluator/                   # agent + grid runtime
  capabilities/                # ssrf/proxy, snapshot, cron helpers, webhook
  connectors/                  # interfaces + registry + orchestrator ONLY
  provisioner/                 # skeleton + provider interface ONLY
  scaleway/                    # native capability (phase-1 exception)
content/                       # ——— INSTALLED CONTENT ———
  connectors/github/  connectors/kaggle/
  workspace-providers/github-branch/
  flows/code/  flows/ml/  flows/validation/  flows/slack-signals/  flows/compute/
  grids/                       # seed definitions (DB stays the runtime source)
modules/                       # ——— PRODUCT MODULES ———
  sync-meeting/  onboarding/
apps/leaderboard-client/       # shell + routes, re-importing from the new homes
```

Indicative only: the deliverable is the boundary — which import crosses which line — not these exact paths. Moving the contents of `services/challenge` into their categories matters more than renaming every package.

## Capability mapping (spec §3.6 → current code)

| Capability | Today | Category |
|---|---|---|
| `http_proxy` | SSRF guard + endpoint proxy | Core |
| `bundle` (0.3 shape) | `SnapshotService` | Core |
| `github_workspace` | provisioner `github-branch` provider | Content, behind core interface |
| `github_fetch` | GitHub connector | Content |
| `kaggle_metadata` | Kaggle connector | Content |
| Evaluation agent | `evaluator` + `DatabaseGridProvider` | Core (grid data = content) |
| Ledger write | `RewardEntryRepository.createManyAndSyncRewards` | Core |
| Cron trigger | `vercel.json` + `CRON_SECRET` + `/api/cron/*` | Core mechanism; flow bodies = content |
| Webhook trigger | `webhook.service.ts` (orphaned) | Core, labeled future |
| `spawn_challenge`, notifications | do not exist yet | Core, later |

## Sequencing and done criteria

Order, as decided: **(1)** ship the journey-validation update first, *spec-shaped* — suite §11 as the implementation plan: its tables are the template's resources, claim-and-verdict commits as one transaction, step order reads prior reports, existing per-type columns are reused, no new per-type column unless unavoidable. **(2)** Phase 1 on a settled tree. **(3)** Phase 2: the generic engine beside the core. **(4)** Phase 3: strangler migration, flow by flow.

Phase 1 is done when: every package and directory belongs to exactly one category, visible in the tree; the core builds and runs with no content and no modules enabled (`prod:min` already proves most of this); no core file imports a connector or provider implementation directly — registry only; each hardcoded flow sits in content, labeled with its target template; and behavior is bit-for-bit unchanged — same routes, same schema, tests green.
