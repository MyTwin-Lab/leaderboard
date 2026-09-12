# Join flow and group invitations — design

**Date:** 2026-09-11
**Status:** proposed, awaiting review
**Touches:** `docs/challenge-groups.md` (reverses two decisions recorded there), `proxy.ts`, a new `notifications` table.

---

## Summary

Joining a challenge becomes **one button and one modal**. The modal opens on a
contributor search; whoever you pick lands in a removable list; the single
button at the bottom reads `Join` while the list is empty and `Join as a group`
as soon as it is not.

Picking someone sends them an **in-app notification** carrying the group's
invite link. There is no acceptance mechanic — the notification is a link
carrier, not a pending invitation.

Three things change, in descending order of cost:

| Piece | Nature |
|---|---|
| `notifications` table, routes and profile tab | new subsystem |
| Contributor search route + selection list | new, small |
| `Join` replaces `Docs` in the header; the two brief buttons become one | rewiring existing UI |

---

## Why change it

Today a contributor forms a group by clicking **Join as a group**, which
creates the group immediately, then copying a link out of a modal and sending
it through some other channel. Three frictions:

1. **The choice is made before you know who is available.** You commit to
   `group` mode without having seen a single name.
2. **The link leaves the platform.** Slack, email, a DM — the platform loses
   sight of the invitation entirely.
3. **The decision is irreversible and the warning is easy to miss.** Solo → group
   is structurally refused (the board is copied and the branch provisioned), and
   the only thing standing between a contributor and that dead end is a line of
   grey text under the buttons.

### The ordering problem this design solves

`group_id` **is** the invite token, and it only exists after
`POST /join {mode:'group'}` has run. An earlier version of this design put the
link on a first modal screen, which meant creating the group — copying a board,
provisioning a branch — just to show someone a link they might not use.

Building the list client-side and creating the group on the **single final
click** removes that entirely. Nothing is written until the contributor commits.

---

## The modal

One screen. Opens from the header `Join` button and from the brief.

```
┌──────────────────────────────────────────────┐
│  Join this challenge                      ✕  │
│                                              │
│  🔍  Search contributors…                    │
│      ┌────────────────────────────────────┐  │
│      │ ◉ Camille Daverio                  │  │
│      │ ◉ Christyl Hodonou   already joined│  │
│      └────────────────────────────────────┘  │
│                                              │
│  [ Patricia Novi ✕ ]  [ Samir Touinssi ✕ ]   │
│                                              │
│  You and 2 others · you share one board,     │
│  one branch and one contribution.            │
│  You cannot switch between solo and group    │
│  afterwards.                                 │
│                                              │
│              [  Join as a group  ]           │
└──────────────────────────────────────────────┘
```

**Selection is capped at 2.** `GROUP_MAX_SIZE` is 3 and the caller occupies one
seat, so the search stops offering additions once two chips are present. The cap
is a client-side affordance, not a guarantee — see *Over-invitation* below.

**Chips are removable**, which is the point of preparing a list rather than
committing per click.

**The irreversibility warning moves into the modal.** It currently lives in
`ChallengeBrief.tsx`; leaving it behind would put the warning on a screen the
contributor no longer needs to read.

### Search result states

A result is rendered in one of three states, reusing the vocabulary the
invite endpoint already speaks (`already_member`, `already_solo`):

| State | Rendering |
|---|---|
| selectable | normal, click adds a chip |
| already on this challenge | shown, disabled, `already joined` |
| already selected | shown, disabled, `added` |

Showing blocked contributors rather than filtering them out answers the question
the contributor actually has — *where is Christyl?* — instead of leaving them to
wonder whether the search is broken.

---

## What the button does

```
list empty            → POST /join {}                  solo, as today
list has 1–2 people   → POST /join {mode:'group'}      returns group_id = token
                      → POST .../group/invite  ×N      one notification each
                      → modal switches to confirmation, showing the link
```

The confirmation screen is the existing `GroupInviteModal` content: the link and
a copy button. It stays useful — someone not yet on the platform cannot receive
a notification, and the link is the only way to reach them.

**Notification failures are not fatal.** The join has already committed; a
failed invite is reported in the confirmation screen (`2 of 3 invitations sent`)
rather than rolled back. This follows the treatment already given to template
tasks and the brief in `CreateChallengeDrawer`.

### A group of one is not a solo participation

Worth stating because it changes how safe the button feels.
`groupContextFrom` already handles a `group_id` that gathers a single row, and
its comment says what it is: *a group nobody has joined yet*. The multiplier is
`1 + 0.4 × (1 − 1)` = **1**, and `resolveWorkspaceOwner` returns the caller.

So a contributor who invites two people and is joined by none has lost nothing —
they work exactly as a solo would, and **they keep the door open**, which a solo
participation never does. Inviting is strictly safer than going solo. The modal
should not imply otherwise.

---

## Contributor search

**New route:** `GET /api/contributors/search?q=<term>&challenge=<id>`

Returns at most 10 rows of exactly three fields:

```json
[{ "uuid": "…", "full_name": "…", "avatar_url": "…" }]
```

Plus, per row, a `blocked_reason` of `already_member` or `null`, resolved from
`challenge_teams` for the challenge passed in.

### Why not `GET /api/users`

Because it returns `userRepo.findAll()` — whole rows, **`email` and
`google_user_id` included**. Wiring a picker to it would hand every signed-in
contributor everyone's email address.

The repo already has the correct instinct one layer over, in
`lib/public/sandbox.ts`: a sandbox author is reduced to the three fields a card
shows, *never* their email or GitHub handle. This route follows that precedent —
it is built field by field, so a column added to `users` later stays private by
default.

`GET /api/users` is left alone. Narrowing it is a separate change with its own
callers to check.

---

## Notifications

The new subsystem, deliberately minimal.

### Table

```sql
CREATE TABLE notifications (
  uuid       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  type       varchar(40) NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at    timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_unread
  ON notifications (user_id) WHERE read_at IS NULL;
```

`type` is a string rather than an enum so a second kind of notification does not
need a migration. The first and only type is `group_invite`, whose payload is:

```json
{ "challengeId": "…", "challengeTitle": "…", "groupToken": "…", "fromUserId": "…", "fromName": "…" }
```

**The payload is denormalised on purpose.** A notification is a record of what
was true when it was sent; re-joining it against a challenge that has since been
renamed, or an inviter who has since been deleted, would rewrite history and add
a join to a list read on every profile view.

### Idempotence

A unique partial index keeps a double click from stacking rows:

```sql
CREATE UNIQUE INDEX idx_notifications_group_invite_once
  ON notifications (user_id, (payload->>'groupToken'))
  WHERE type = 'group_invite';
```

The invite route writes with `ON CONFLICT DO NOTHING` and reports the row as
sent either way — from the sender's point of view, the person has been invited.

### Routes

| Route | Who | What |
|---|---|---|
| `POST /api/challenges/:id/group/invite` | a member of that group | writes one `group_invite` row |
| `GET /api/notifications` | the owner | `{ notifications: [...], unread: n }`, newest first, capped at 50 |
| `PATCH /api/notifications/:id` | the owner | `{ read: true }` |
| `PATCH /api/notifications` | the owner | mark all read |

The cap is a plain `LIMIT`, no pagination: a contributor who has accumulated
more than fifty invitations has a different problem, and a *load more* button
would be the only consumer of an offset nobody has asked for.

**The authorisation rule that matters.** It is now the *server* that hands out a
group token, where before a human copied it out of a modal. `POST /group/invite`
must therefore verify that the caller's `challenge_teams` row carries the
`group_id` they are inviting into. Without that check, any signed-in user could
broadcast any group's token and the invisibility of groups — *a group is
reachable only through its link* — would be gone.

The recipient is not checked beyond existing: inviting someone who has already
joined is a wasted notification, not a vulnerability, and the barrier screen
they land on already says so.

### UI

A **Notifications tab** on `/contributors/me`. The page already builds its tabs
with `tabs.push(...)` and resolves `?tab=` through `initialTab`, so
`/contributors/me?tab=notifications` deep-links with no new plumbing.

The tab shows one row per notification: who invited you, to which challenge,
when, and a link. Clicking it marks the row read and navigates to
`/challenges/:id?group=<token>` — the **existing** invite flow, with its existing
guards.

**Nothing has to be written for expiry.** A stale invite lands on the barrier
screen `GET /api/challenges/:id/group/:token` already produces, with its four
reasons (`challenge_closed`, `already_member`, `already_solo`, `group_full`).
The notification does not need to know the group filled up; the page it points
at already does.

An unread count is exposed for a future badge. **No badge ships in this change** —
the navbar is out of scope.

---

## Header: `Join` replaces `Docs`

The header currently renders `Docs` and `Reward rules` unconditionally
(`page.tsx:414-430`). `Docs` is replaced by `Join` when:

```ts
!isMember && BRIEF_GATED_TYPES.includes(type) && challengeOpen
```

where `challengeOpen` is `status !== 'completed' && status !== 'archived'` — the
same pair `POST /join` already refuses on, so the button is never offered for an
action the server would reject.

This is `shouldShowBrief` minus two things: its dependency on the brief's
existence, because a challenge with no brief still needs a join path, and its
exclusion of anonymous visitors, for the reason below. The condition belongs next
to `shouldShowBrief` in `lib/challengeBrief.ts` so the two cannot drift apart.

**An anonymous visitor sees the `Join` button too, and it does not open the
modal.** It links to `/signin?from=/challenges/:id`, the route the existing
*Continue with Google* block already uses. The challenge page is public, so a
visitor who can read the whole page should be told how to take part — and
routing them to sign-in rather than to a join attempt is what closes the parked
bug below, by construction rather than by error handling.

Outside that condition — validation challenge, or a member, or a closed
challenge — `Docs` stays exactly as it is.

The brief's two buttons collapse into **one** `Join` opening the same modal.
One decision point, described in one place.

---

## Proxy

Two entries, both required, both easy to forget:

1. **`POST /api/challenges/:id/group/invite`** is under `/api/challenges/:path*`,
   so it is in the matcher, and the admin-only write guard will reject a
   contributor. It needs an exception beside `isChallengeJoinRoute`:
   ```ts
   const isGroupInviteRoute = pathname.endsWith('/group/invite');
   ```

2. **`/api/notifications/:path*` is not in the matcher at all.** It must be
   added, along with a self-service write exception for the `PATCH`. Adding it
   to the matcher — rather than authenticating in the handler like
   `/api/sandboxes/**` does — is deliberate: routes outside the matcher get **no
   silent token refresh**, and a notifications panel read on a long-open profile
   page is exactly where an expiring session bites.

---

## What this reverses

`docs/challenge-groups.md` records two decisions this design overturns. Both are
overturned knowingly, and the document must be updated in the same change rather
than left contradicting the code.

**"There is no invitation record, no pending state, no notification: the link is
the invitation."**
Half of this survives. There is now a notification record, but still **no
pending state and no acceptance**: the notification carries a link, and the link
remains the invitation. Every barrier stays where it was, in
`GET /group/:token` and in `POST /join`. What changes is delivery, not
semantics.

**"A contributor picker to build the group — assumes you know who signed up, and
the list can get long."**
The objection was sound and is answered by shape, not by dismissal: the picker
is a *search*, not a list, so length does not matter; and blocked contributors
are shown with their reason rather than hidden, so it does not assume you know
who signed up.

**"A public list of open groups — would require an acceptance mechanic."**
Still rejected, and still true. Nothing here lists groups: you can invite a
person you name, and you can be invited. You cannot browse.

---

## Over-invitation

There is no pending state, so nothing reserves a seat. Two invitees can both
click and fill the group; a third would hit `group_full` at
`POST /join`, which already returns 409.

The existing size cap is already soft — `docs/challenge-groups.md` says so: two
simultaneous joins can overshoot by one, and closing that would need a
serialisable transaction for a three-person scenario. This design does not make
it worse, and does not fix it either.

Capping selection at 2 keeps the common case honest: a contributor cannot invite
six people and watch three win a race.

---

## Migration and deploy

- `drizzle/0021_notifications.sql`, following `0020_sandbox.sql`.
- The same statements added to `scripts/db-apply-schema.ts`, in `IF NOT EXISTS`
  form. `drizzle-kit push` cannot run at deploy time on this project — it hits an
  interactive column-conflict prompt with no TTY, which is why that script
  exists.
- Nothing to backfill. No existing row acquires a notification.

---

## Testing

Vitest, following the patterns already in the repo.

**Pure, unit-tested:**
- selection eligibility and `blocked_reason` resolution for a search result set
- the button's label and mode as a function of list length (0 → solo, 1–2 → group)
- the notification payload builder

**Route tests** (`documents/route.test.ts` is the shape to copy):
- `POST /group/invite` refuses a caller who is not in the target group — **the
  security test of this change**
- `POST /group/invite` twice for one recipient writes one row
- `GET /api/notifications` returns only the caller's rows
- `PATCH /api/notifications/:id` refuses a row the caller does not own

**Not covered by tests:** the modal's visual states, and the deep link from a
notification through to the barrier screen. Both are manual.

---

## Out of scope

- A navbar badge or bell. The tab is the surface; the unread count is exposed
  for later.
- Email or Slack delivery of an invitation.
- Notifications for anything other than group invites.
- Persistent cross-challenge groups — already rejected in the original design
  and unaffected here.
- Narrowing `GET /api/users`, which has its own callers.

---

## Open question, parked

**`Network error` when clicking Join while signed out.** Reported during this
design conversation, to be handled in the implementation plan since the flow is
being rewritten anyway.

What is established so far:

- The server is correct. `POST /join` with no cookie returns
  `401 {"error":"Authentication required"}` — a clean JSON refusal, not a
  network failure. `useJoinChallenge` would surface that as
  *Authentication required*, not *Network error*.
- The challenge page **is** public (200 anonymous), via an allowlist in
  `proxy.ts` that takes precedence over the `/challenges/` prefix guard.
- In the current code an anonymous visitor should see no Join button at all:
  `isAnonymous` renders a *Continue with Google* block instead, and
  `CodeChallengePanel`, which carries the teaser Join, is not rendered for them.

The leading hypothesis is therefore **an expired token rather than a signed-out
visitor**: `isAnonymous` is derived from `meQuery.isError`, which can flip
between render and click. Not yet confirmed — it needs the reporter's repro
conditions, specifically whether the page had been open a long time.

Whatever the cause, **this design closes the bug by construction**: see
*Header* above. Every join path an unauthenticated visitor can reach links to
`/signin?from=/challenges/:id`, so no code path exists from which they can fire
a join request at all. The investigation is still worth finishing — a
`Network error` where a 401 was returned means something is swallowing a
response somewhere, and that is worth knowing whether or not this change hides
it.

---

## Key files

```
apps/leaderboard-client/src/lib/challengeBrief.ts          gate condition, shared with the header
apps/leaderboard-client/src/lib/useJoinChallenge.ts        join modes
apps/leaderboard-client/src/components/challenges/         JoinModal (new), GroupInviteModal, ChallengeBrief
apps/leaderboard-client/src/app/challenges/[id]/page.tsx   header button, modal wiring
apps/leaderboard-client/src/app/api/contributors/search/   new
apps/leaderboard-client/src/app/api/challenges/[id]/group/invite/   new
apps/leaderboard-client/src/app/api/notifications/         new
apps/leaderboard-client/src/proxy.ts                       matcher + two write exceptions
packages/database-service/repositories/notification.repo.ts        new
packages/services/challenge/groupPolicy.ts                 GROUP_MAX_SIZE, unchanged
drizzle/0021_notifications.sql + scripts/db-apply-schema.ts
docs/challenge-groups.md                                   must be updated, not left contradicting
```
