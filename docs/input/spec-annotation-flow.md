# Data Annotation Flow — Specification

**The fifth flow, the first `resources` capability, and the dress rehearsal for the interpreter**

Draft — September 2026. Companion to `writing-a-flow.md`, the LeaderboardOS conformance suite §6 (`data-annotation`), and the phase-1 taxonomy.

---

## Why this exists

MyTwin's ML challenges consume labeled medical data, and labeling is exactly the kind of structured, evaluated, rewarded work the platform exists to coordinate — yet it has no flow. This spec adds **annotation campaigns**: an admin imports a batch of unlabeled items (mammography images in the founding case), contributors label them under k-redundancy, hidden gold cases maintain a per-annotator accuracy that weights pay and gates sensitive work, agreement resolves each item, and sampled audits claw back pay on labels that disagreed with the consensus.

The flow is deliberately three things at once. **A real product feature** — labeled datasets feed the ML challenges. **The first true test of the 020 separation** — the four existing flows were reorganized *into* the structure; this one is the first *added through* it, following `writing-a-flow.md` to the letter, with zero core modification beyond one new capability. **The dress rehearsal for the interpreter** — it is implemented *spec-shaped* against conformance template §6, so that when the interpreter lands, reinstalling data-annotation as a template is a mechanical transcription and this hand-written flow becomes its own regression test.

One rule from `writing-a-flow.md` shapes the whole design: *"if the flow seems to need a migration, the need belongs in a capability first."* Annotation needs generic claimable work units — which the core does not have (validation's claims are flow-specific tables). So the hard part of this spec is not the flow; it is the **`resources` core capability**: generic resource instances and claims, with modes, TTL and transactional invariants. That capability is, verbatim, the riskiest half of the interpreter's J2 milestone — built here with a real consumer instead of a hypothetical one.

## 0. Arbitrated trade-offs

These win on contradiction with anything below.

1. **The claim tables are core, the item semantics are content.** `resource_instances` / `resource_claims` are a core capability with their own (one-time) schema addition. The flow declares only strings (`resource_type: "item" | "gold"`) and payload shapes — it installs cold, per the 020 rule.
2. **Item payloads are URLs, not bytes.** v1 items carry `{image_url}` pointing at already-hosted files. Validation's `bytea` storage is a noted limitation, not a pattern to repeat. Signed storage is a later chapter.
3. **Labels live on the claim, not in a third table.** One claim = one unit of work = one label: `resource_claims.result` (jsonb) + `consumed_at`. The conformance template's "Assess emits to the aggregate" becomes "consuming a claim triggers the consensus check" — the mapping table in §6 records the correspondence.
4. **Counters are live sums, never cached.** `gold_seen`, `gold_correct` and accuracy are `SUM`s over the user's consumed gold claims — the sandbox precedent ("no cached total; deleting a row is the clawback") applied again. No counters table.
5. **TTL is lazy, not a timer.** An expired claim (`expires_at < now`, not consumed, not released) simply stops counting toward `k` and stops blocking `unique_per`. No cron frees anything; a cleanup job can come later if row volume ever warrants it.
6. **Golds are indistinguishable, by symmetry.** Same draw, same screen, same pay as ordinary items; `expected` never leaves the server; whether a claim was a gold is never serialized to its annotator. This is the platform's opacity principle (blind counts, hidden reference outputs) applied a third time.
7. **`k` is odd and labels are discrete in v1** — mirroring `required_validations`. Majority is then guaranteed unless all k answers differ; that case closes the item as `contested`, resolved by an admin action.
8. **No groups, no board** (`uses: {board: false, groups: false}`). Annotation is individual piecework; the group multiplier has no meaning per-item.
9. **Structure is `flow_config`, policy is `reward_rules`.** Fixed at creation: `k`, `ttl_hours`, `label_schema`, `sensitive_clearance`. Editable during the campaign: `per_unit_cp`, `gold_rate`, `audit_rate`.

## 1. The `resources` capability (core)

`packages/capabilities/resources.ts`, over two new tables in `database-service`. This is the one schema addition, carried by `db-apply-schema.ts` like any core change.

### Tables

```
resource_instances
  uuid PK · challenge_id FK NOT NULL · resource_type varchar(64) NOT NULL
  payload jsonb NOT NULL          -- validated by the flow at write time
  class varchar(32)               -- optional coarse bucket (standard | sensitive)
  state varchar(16) NOT NULL DEFAULT 'open'    -- open | closed
  verdict varchar(64)             -- e.g. labeled | contested
  resolution jsonb                -- e.g. { consensus, audited_at }
  created_by uuid FK users        -- nullable (admin imports)
  created_at · closed_at
  INDEX (challenge_id, resource_type, state, class)

resource_claims
  uuid PK · resource_id FK CASCADE NOT NULL
  challenge_id FK NOT NULL        -- denormalized for per-user queries
  user_id uuid FK users NOT NULL
  result jsonb                    -- the work product (a label), set at consumption
  claimed_at NOT NULL · expires_at · consumed_at · released_at
  PARTIAL UNIQUE (resource_id, user_id) WHERE released_at IS NULL
```

A claim is **active** (neither consumed, released, nor past `expires_at`), **consumed** (work delivered — permanent), or **lapsed** (released or expired). `k`-accounting counts active + consumed. The partial unique index is the `unique_per(resource, user)` invariant: one live claim per person per resource, forever if consumed — which is exactly "a gold is never re-served to the same annotator", and races safely (the loser's insert violates the index, same posture as `validation_case_claims`).

### API surface

```ts
resources(db).createMany(challengeId, type, payloads[], opts?)   // batch import
resources(db).draw(challengeId, userId, {
  type, k, ttlHours, class?,            // k-bounded selection with TTL
})  → { claimId, resourceId, payload } | null
resources(db).consume(claimId, userId, result)                    // deliver the work
resources(db).release(claimId, userId)                            // explicit abandon
resources(db).close(resourceId, verdict, resolution?)             // transition
resources(db).consumedClaims(resourceId)                          // for consensus
resources(db).userStats(challengeId, userId, type)                // live sums over claims
resources(db).counts(challengeId)                                 // admin progress
```

**`draw` is the transactional heart.** One transaction: select a candidate row `FOR UPDATE SKIP LOCKED` among open resources of the type (and class) that the caller has no live claim on, count its active+consumed claims, insert the claim if `< k`, else skip to the next candidate. `SKIP LOCKED` makes concurrent draws distribute instead of colliding; the count-inside-the-lock makes `k` a hard bound; `exclusive` is the degenerate `k = 1`. No reservation step exists outside this transaction, so no abandoned intermediate state can exist — the claim-and-gesture-in-one-transaction posture, generalized.

The capability knows nothing of golds, accuracy or pay: it stores, claims, counts. Everything semantic stays in the flow.

## 2. The flow

`content/flows/data-annotation/` — descriptor, definition, actions, one job. Installed by `mytwin.platform.ts`; slots in `mytwin.client.tsx` and `mytwin.forms.tsx`.

### Configuration

```ts
// flow_config (fixed at creation, version 1)
{
  k: int odd ≥ 1 (default 3),
  ttl_hours: int (default 48),
  label_schema: { kind: 'single_choice', options: [{ key, label }] (2–12) },
  sensitive_clearance: { min_seen: int (default 5), min_accuracy: 0..1 (default 0.8) },
}
// reward_rules (editable during the campaign)
{ per_unit_cp: int, gold_rate: 0..1 (default 0.1), audit_rate: 0..1 (default 0.1) }
```

`ruleKeys`: `annotation` (consumes pool), `annotation_clawback` (consumes pool — a negative row hands its CP back to the remainder). `contributionTypes`: `annotation` — one aggregating chip per annotator per challenge, the `discussion`/`validation` pattern, not a list entry.

### Actions

| Action | Access | What it does |
|---|---|---|
| `POST flow/batches` | admin, manager | CSV import. `kind=items`: rows `{image_url, class?}` → `createMany('item')`. `kind=golds`: rows `{image_url, expected}` → `createMany('gold')` with `expected` inside `payload` (server-only). |
| `POST flow/draw` | member | The single pull gesture. Server decides gold vs item: with probability `gold_rate`, if an unseen gold exists, draw from `gold`, else from `item` — filtered to `class='standard'` unless the caller clears `sensitive_clearance` (live accuracy). Returns `{ claim_id, image_url, options }` — never the type. |
| `POST flow/claims/:id/label` | member | `{ value }` (a schema option key). `consume(claim, {value})`, then branch server-side: **gold** → compare to `expected` (accuracy moves; nothing else differs). **item** → if consumed claims reach `k`, resolve: majority → `close('labeled', {consensus})`; all-different → `close('contested')`. Either way, pay one ledger row `annotation`: `per_unit_cp × current_accuracy` (1.0 while `gold_seen = 0`), clamped to the pool — identical for golds. |
| `POST flow/claims/:id/release` | member | Explicit abandon; TTL covers the silent one. |
| `GET flow/progress` | member | Own stats: items labeled, CP earned, accuracy (shown as a quality score — never *which* draws were golds). |
| `GET flow/overview` | admin, manager | Campaign progress, per-annotator accuracy, contested list, pool state. |
| `POST flow/items/:id/resolve` | admin, manager | Settle a `contested` item by hand. |
| `GET flow/export` | admin, manager | CSV of labeled items: `image_url, consensus, k, contested?`. The campaign's product. |

Job `annotation.audit` (weekly, cron tick): sample `audit_rate` of items closed since the last pass and not yet audited; for each consumed claim disagreeing with the consensus, write one `annotation_clawback` row of `−(what that claim's label row paid)`; stamp `resolution.audited_at` in the same transaction — the stamp is the idempotence, the sandbox-promotion pattern.

### Screens

Contributor tab: one card — the image, the option buttons from `label_schema`, a skip (release), a session counter, the quality score. Manager tab: import panel (two dropzones, items and golds), progress, the accuracy table, contested queue, export. Hero stat: `labeled / total items`. Form section: label-schema builder (option list), `k`, TTL, clearance, and the three reward fields. Anonymous view: the brief only.

## 3. Spec-shape: template §6 ↔ this implementation

The table that makes interpreter-J3 a transcription. Left, the conformance template; right, where it lives here.

| Template §6 construct | Hand-written counterpart |
|---|---|
| `resources: item / gold` + schemas | `resource_type` strings + payload shapes validated by the flow |
| `claim {mode: k_bounded, k, ttl}` | `draw()` transaction (`FOR UPDATE SKIP LOCKED`, count < k, `expires_at`) |
| `claim {mode: unique_per [gold, participation]}` | the partial unique index on `(resource_id, user_id)` |
| Collect `draw` / engine gold interleaving at `gold_rate` | `POST flow/draw`, server-side coin flip |
| Claim eligibility `where` (sensitive clearance on counters) | class filter gated on live accuracy inside `draw` |
| Routing gate `draw.is_gold`, branches converge | server-side `if` inside the label action |
| Assess `check` writing counters | live sums over consumed gold claims — no stored counters |
| Assess `submit` emitting to aggregate `agreement` | consensus check on the k-th consumption |
| Aggregate resolve → transition `labeled` | `close(item, 'labeled', {consensus})` |
| Reward `pay` (converged, accuracy-weighted, identical for golds) | the single ledger write in the label action |
| Audit lane (cron, sampled) + clawback | job `annotation.audit` + `annotation_clawback` rows |

Assumed divergences, to be carried back into the suite when the template is reconciled (the journey-validation precedent): no runtime aggregate object (the resolve is inline at k-th consumption); counters are derived, not stored; `contested` as an explicit verdict for the all-different case, absent from the template.

## 4. Out of v1

Bounding boxes / contouring (a UI chapter of its own — the label schema stays declarative so it can grow a `kind` later); Kaggle-sourced item import (rides the existing bundle-source when needed); signed object storage for raw medical files; multi-stage review pipelines (a second flow, or the localization template's shape); per-annotator throttling; automatic gold recycling from unanimous items.

## 5. Milestones

**M1 — the capability.** Tables in `drizzle.ts` + `db-apply-schema.ts`, `resources.ts`, and the tests that matter: concurrent draws on one item never exceed `k`; an expired claim frees its slot and its `unique_per` hold except when consumed; the same user never redraws the same resource. `packages` test project, hoisted-mock pattern.

**M2 — the flow, headless.** Definition, config schema, actions, consensus, pay, clawback job — all tested through `actionContext`, no UI. Includes the architecture test passing untouched: the proof of the 020 promise.

**M3 — screens.** The four slots, the import/export round-trip, a seed (`db_data/seed-annotation.ts`) with a demo campaign.

**M4 — a real campaign.** Golds authored by `medical_pro` holders, a first batch labeled, the export feeding an ML challenge. The acceptance test of the whole bet.
