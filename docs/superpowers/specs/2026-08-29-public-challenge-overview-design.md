# Public challenge overview — design

**Date:** 2026-08-29
**Status:** approved, pending implementation plan

## Problem

`/challenges` lists challenges to anyone, but clicking one redirects to sign-in.
A visitor cannot see what a challenge is or what has been achieved on it before
committing to an account. The page is the product's main showcase and it is
closed to everyone who has not already joined.

Goal: an anonymous visitor opening a challenge sees the challenge and a
read-only overview of the work done on it, with contributors named. Acting on
the challenge — joining, submitting, evaluating — still requires an account.

## Current state

`/challenges/[id]/page.tsx` is a client component. It reads
`/api/challenges/[id]/overview`, an endpoint that already aggregates challenge,
team, tasks, meetings, repos, contributions and participants, and is already
shared with `ChallengeManageView` under the same react-query key.

Two gates in `proxy.ts` close the page today:

- `protectedPages` contains the prefix `/challenges/`
- `protectedApiRoutes` contains the prefix `/api/challenges`

So both the page and its data are gated. The overview payload also carries
`workspace_url`, `workspace_ref` and `workspace_status` per participant, which
must never reach an anonymous caller.

There is a precedent to follow rather than invent against. The challenges list
already serves anonymous visitors: `fetchProjectsWithChallenges`
(`lib/server/publicPages.ts:34`) takes `userId?: string | null` and hides
`draft` and `archived` challenges from anyone who is not an admin or a manager
of the project. The detail page is the missing half of a pattern the list page
already applies, and the status rule proposed below matches the one already in
force there.

`ChallengeManageView` already contains the view we want. `TabParticipants`
(`ChallengeManageView.tsx:351-389`) renders, per contributor, `{done}/{total}
tasks done` plus the CP awarded. It is purely presentational: its four props
(`team`, `tasks`, `participants`, `contributions`) all come from the shared
overview endpoint, and its body holds no query, no mutation, no role check and
no router. It is reusable by extraction alone.

`TabActivity` exists twice with diverging signatures — the rich version in
`ChallengeManageView.tsx:393` (`contributions, team, repoActivity, isML`) and a
poorer one in `challenges/[id]/page.tsx:517` (`repoActivity` only). Choosing
which becomes public forces the question, so they converge as part of this work.

## Decisions

1. The hero stays as it is. The public overview is a block below it.
2. Contributors are named publicly: name, avatar, GitHub handle, CP earned.
3. Read-only components are extracted and shared, not duplicated and not
   reached by putting `ChallengeManageView` in a read-only mode.
4. One aggregation endpoint, with an allowlist mapper for anonymous callers.
5. `draft` and `archived` challenges stay protected — the same rule the
   challenges list and the home page's trending block already apply. One status
   rule across the product, so nothing to remember and nothing to drift.

## Design

### Auth boundary

Prefix matching cannot express "the challenge detail page but not its manage
sub-page", because `/challenges/` covers both. Two regex allowlists are
evaluated in `proxy.ts` before the protected lists:

```ts
const publicPages = [/^\/challenges\/[^/]+\/?$/];
const publicApiRoutes = [
  /^\/api\/challenges\/[^/]+\/overview$/,
  /^\/api\/challenges\/[^/]+\/repo-activity$/,
  /^\/api\/challenges\/[^/]+\/ml-rewards$/,
];
```

`/challenges/<id>/manage` carries an extra segment and does not match, so the
admin view stays protected. Exactly three API routes open; the twenty-odd other
sub-routes under `/api/challenges/[id]/` — `join`, `close`, `sync`,
`validation-*`, `compute-*`, `workspace`, `project-evaluation` — remain covered
by the existing prefix.

`/api/contributors/me` stays protected and answers 401 to anonymous callers.
That 401 is how the page detects anonymity.

### Unpublished challenges

`publicPages` and `publicApiRoutes` cannot express a status check — status lives
in the database, not the URL. The check therefore happens in the route: when
there is no session and the challenge's status is `draft` or `archived`, the
overview endpoint answers 404, and the page renders its existing "Challenge not
found" state. 404 rather than 401, so an anonymous visitor cannot use the
response to learn that a challenge exists at that id.

The check is not specific to `overview`: all three opened routes apply it, or an
unpublished challenge's activity and metrics would stay readable through the two
other doors. It belongs in one shared guard, called by each of the three, and it
holds the same status list as `fetchProjectsWithChallenges` — if the two ever
disagree, a challenge is listed but unreachable, or reachable but unlisted.

### `repo-activity` and `ml-rewards`

`ml-rewards` needs a mapper too. It returns `breakdown: [{ userId, points }]` —
CP per person — and `rules`, the reward configuration itself
(`ml-rewards/route.ts:70-81`). The page reads none of that: `mlRewardsQuery`
types its result as `{ metric, bestValue }` (`challenges/[id]/page.tsx:176-179`)
and the hero shows the best metric only. Anonymous callers therefore get those
two fields and nothing else.

`repo-activity` needs the same allowlist scrutiny as `overview`. Reading
`packages/connectors/interfaces.ts:22-75` settles what it emits: `GitHubEvent`
carries `type`, `id`, `title`, `author`, `date`, `url` and a **typed**
`metadata` of `sha`, `additions`, `deletions`, `prNumber`, `state`,
`reviewState`, `branchName`.

Two things must not go out. `metadata.branchName` exposes the
`contrib/<index>-<username>` branches the provisioner creates per contributor,
and the `branch_created` event type exists only to announce a branch — both are
dropped, the field and the whole event type. And when a connector fails, the
route currently returns `{ error: err.message }`; a connector's error text can
name internal hosts or tokens, so it becomes a fixed `{ error: 'unavailable' }`.

Kaggle activity — `datasetMeta` and `modelVersions` — describes public Kaggle
artifacts and passes through unchanged.

### `toPublicOverview()`

The overview route reads the session with `verifyRequestToken(request)`, which
already exists in `lib/auth.ts:105` — no new helper is needed. With a session,
the payload is unchanged. Without one, it passes through a pure allowlist
mapper:

| Key | Public fields |
|---|---|
| `challenge` | `uuid`, `title`, `description`, `status`, `type`, `start_date`, `end_date`, `contribution_points_reward`, `project_id`, `workspace_mode` |
| `team` | `uuid`, `full_name`, `avatar_url`, `github_username` |
| `tasks` | `uuid`, `user_id`, `status`, `parent_task_id` |
| `participants` | `user_id` |
| `contributions` | `uuid`, `user_id`, `type`, `reward`, `submitted_at`, `evaluation_status` |
| `meetings` | omitted entirely |
| `repos` | omitted entirely |

The mapper builds its output field by field. A field added to the underlying
repositories later is not public unless someone writes it into the mapper — the
property that a denylist would not give.

Task titles are excluded: personal boards carry contributors' own wording, which
is not showcase material. `{done}/{total}` needs only `status` and `user_id`.

Meetings and repos are dropped: meeting links are joinable URLs, and repo rows
carry workspace metadata.

### Extracted components

`components/challenges/shared/ParticipantsProgress.tsx` — `TabParticipants`
moved as is, plus a `showWorkspaceStatus` prop (false in public). The prop is
belt and braces: the mapper already withholds the field, and the component stops
depending on that being true.

`components/challenges/shared/ChallengeActivity.tsx` — the two `TabActivity`
implementations converge on the rich signature. The public page gains
per-contributor attribution it did not have.

Both are imported by `ChallengeManageView` and by `challenges/[id]/page.tsx`, so
neither becomes dead code and there is no third copy.

### The page, anonymous

`fetchJson` throws on any non-2xx, so `meQuery` failing 401 would otherwise
retry three times and hold `loading` true — the page would sit on its skeleton.
Two changes: `retry: false` on `meQuery`, and `meQuery.isError` treated as
"anonymous" rather than as a failure.

With no session:

- the hero renders unchanged
- `CodeChallengePanel`, `MLChallengeFlow` and `ValidationChallengeFlow` are
  replaced by `ParticipantsProgress` and `ChallengeActivity`
- a call to action points at `/signin?from=/challenges/<id>`
- `trackOnboardingStep('clicked_challenge')` is skipped — it posts to a
  protected route

An authenticated visitor sees exactly what they see today. This design adds a
state; it changes none of the existing ones.

## Testing

`toPublicOverview()` and the `proxy.ts` allowlists are pure or near-pure, and
carry the security properties. That is where the effort goes:

- no `workspace_url`, `workspace_ref` or `workspace_status` survives the mapper,
  asserted on a fixture that contains all three
- no task title survives
- `meetings` and `repos` are absent
- the mapped shape still satisfies what `ParticipantsProgress` reads
- a `draft` challenge with no session yields 404, on all three opened routes
- an `archived` challenge with no session yields 404, on all three
- an `active` and a `completed` challenge with no session both render
- a session reaches `draft` and `archived` normally — the guard is anonymous-only
- a session yields the full payload, unmapped
- `toPublicRepoActivity()` emits no branch ref matching `contrib/<n>-<user>`
- `toPublicMlRewards()` emits neither `breakdown` nor `rules`
- `/challenges/abc` public, `/challenges/abc/manage` protected
- `/api/challenges/abc/overview` public, `/api/challenges/abc/join` protected,
  `/api/challenges/abc/validation-runs` protected

The extracted components cannot be tested here: the app's vitest environment is
`node`, with no jsdom and no testing-library, and adding them is out of scope.
Their guarantee is that extraction moves code without changing logic.

## Accepted consequences

Contributor names, avatars, GitHub handles and per-challenge CP become readable
by anyone on the internet, for every `active` or `completed` challenge. This was
decided deliberately: the team is already named in the hero, and hiding it lower
on the same page would be incoherent.

## Out of scope

Rankings (`TabRankings`), a public documents drawer, and public meeting
listings. Each is a separate decision about what the product publishes.
