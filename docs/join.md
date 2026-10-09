# Join the Lab

> `/join`: an email (and, optionally, who you are) into the MyTwin CRM as a member of the Lab, then a welcome page with three first steps that remember being done. No account: the login wall only comes when someone takes part in a challenge.

**Requires:** `MYTWIN_BACKEND_GRAPHQL_URL` (the MyTwinOS GraphQL endpoint) and `JWT_SECRET` (already set: it signs the member cookie). No database on the Lab side.

## The flow

1. **Two calls lead here**, both labelled *Join the Lab*: the home's *Join our community* section (`HomeCommunity.tsx`) and the closing strip of `/vision` (`VisionVitrine.tsx`). A third comes from outside: the *Join the MyTwin Lab* button of the MyTwin Health waiting-list email (MyTwinOS migration `20261009120200_waitlist_email_links_to_lab_join`; it led to the WhatsApp group before).
2. **`/join`** asks for an email and, optionally, a role: *Patient or caregiver*, *Clinician*, *Researcher*, *Developer*, *Other*. The button turns active as soon as there is an email; nothing ticked is sent as `other`. A consent line sits under the button. **Join the Lab** calls the server action `joinLab` (`app/join/actions.ts`), which:
   - validates the email again, and re-reads the role against the closed list;
   - calls `crmSubmitLabJoin` on MyTwinOS (source and kind `lab_join`, the role, `JOIN_CONSENT_VERSION`, the `utm_*`), which answers with `isFirstOfKind`;
   - sets the **member cookie** — and the form opens `/join/welcome`, or `/join/welcome?back=1` for an email already on the list.
3. MyTwinOS turns the role into a contact type (`researcher` → `expert`, `developer` → `contributor`, `other` → `unknown`) and sends `lab_join_confirmation`, in English, to a first-time member only. See `MyTwinOS/docs/api/crm.md`, *Rejoindre le Lab*.
4. **`/join/welcome`** welcomes the member: the mission, a note that the welcome email is on its way (with the spam-folder advice), then **three first steps**:

   | Step | Action | Ticked when |
   |---|---|---|
   | Share your health story | → `/join/share` | the story reaches the CRM |
   | Join the conversation | → the WhatsApp community, new tab | the link is clicked (`markWhatsappJoined`) |
   | Build the twin | → `/challenges` | never: it opens a page, it is not done |

   A ticked step keeps its button, outlined (*Share another story*, *Open the community*). Below, *Everyone has a place in the Lab*: examples of what members do, by audience — text, not calls.
5. **`/join/share`** takes the story and its consent checkbox. `shareAnecdote` sends it with `crmSubmitStory` (source `lab_join`, the email read from the cookie), ticks the step and redirects to `/join/welcome?shared=1`.

## The member cookie

`lab_member` (`lib/server/labMember.ts`): an HS256 JWT signed with the session secret — like `sb_anon` —, audience `lab-member`, one year, `httpOnly`. It carries the **email** and the **steps done**.

- **The email never travels in a URL.** It is what ties the story to the member's CRM record; in a query string it would sit in the history, the server logs and the `Referer` header. That is the flaw of the MyTwin Health waiting list, not repeated here.
- **Signed**, because a plain cookie would let anyone file a story under any registered email.
- **No cookie, a bad signature or an expired token**: `/join/welcome` and `/join/share` redirect to `/join`.
- Joining again with the **same email** keeps the steps; another email starts from scratch.
- `/join` shows *Go to your welcome page* to a known member, without redirecting: they may want to register another address.

## Where things live

- `apps/leaderboard-client/src/lib/join.ts` — the paths, the roles (`LAB_ROLES`, `parseLabRole`), the steps, the WhatsApp URL, the two consent versions, the `utm_*`. Pure; tested in `join.test.ts`.
- `apps/leaderboard-client/src/lib/server/labMember.ts` — reading and writing the member cookie.
- `apps/leaderboard-client/src/lib/server/crm.ts` — `submitLabJoin()` and `submitStory()`, next to `submitBookingRequest()`. Tested in `crm.test.ts`.
- `apps/leaderboard-client/src/app/join/` — the three pages, and `actions.ts` (`joinLab`, `shareAnecdote`, `markWhatsappJoined`, tested in `actions.test.ts`).
- `apps/leaderboard-client/src/components/join/` — `JoinForm`, `ShareForm`, `WhatsappLink` (client) and `join-vitrine.css`. `/join` and `/join/share` reuse the grid and card of `/book` (`booking-vitrine.css`).
- On the backend: `MyTwinOS/docs/api/crm.md` (*Rejoindre le Lab*), the funnel `onLabJoin` and the email `lab_join_confirmation` (`docs/api/crm-side-effects.md`, `docs/api/emails.md`). The admin labels (*Lab · Community*, *Unknown*, *Joined the MyTwin Lab*) live in `mytwin-health-landing` (`lib/admin-status.ts`, `features/admin-contacts/data/`).

## Decisions

- **Being a member is a source, not a type.** A contact has one type but accumulates sources: the admin filter `source = lab_join` lists every member, clinicians and startups included. A `lab_member` type would have overwritten a clinician's type.
- **`unknown`, not `patient`, is the weak type.** Introduced with this page: a member who answers *Other* is not a patient. `website`, `lab_general` and `lab_twin_creation` moved to `unknown` too, and the existing records they explain were backfilled. Types now have a rank (`unknown` < `patient` < professional types): a record only moves up.
- **The role is asked on `/join`, not on the welcome page.** One submission, one write. Asking it afterwards would need a second public write able to change an existing record.
- **The CRM never blocks joining.** No answer from the CRM: the visitor is welcomed anyway, as a new member. A story sent later then fails (the CRM has no record for the email) and the page says so.
- **The story stays on the Lab.** The `/welcome` page of mytwin.care is a waiting-list confirmation (its copy says so, in French or English) and needs the email in its URL. Same consent text as there, word for word, so the same `ANECDOTE_CONSENT_VERSION`.
- **Steps are shown, not locked.** *Explore the challenges* never waits for the story: a developer with no story to tell must not be stopped.
- **The WhatsApp step is ticked on click.** The Lab cannot know whether the person really joined the group, and does not try to.
- **A honeypot, not a captcha**, on both forms, as on `/book`. Filled: nothing reaches the CRM, no cookie, same answer.
- **`noindex, follow`, out of the sitemap**, all three pages ([`seo.md`](./seo.md)).

## Gotchas

- **Two consent versions to keep in step.** `JOIN_CONSENT_VERSION` changes with the text under the `/join` button. `ANECDOTE_CONSENT_VERSION` must equal `HEALTH_ANECDOTE_CONSENT_VERSION` of `mytwin-health-landing` only as long as the two texts are identical.
- **Rotating `JWT_SECRET` forgets every member**: they land on `/join` again, and joining with their email gives them back the page (without the ticked steps).
- **A role is declared in four places**: `LAB_ROLES` and `ROLE_OPTIONS` (the Lab), and in MyTwinOS `CRM_LAB_ROLES`, the `CrmLabRole` SDL enum, `TYPE_BY_LAB_ROLE`.
- The welcome email links to `/join/share`: opened on another device, it leads to `/join` first.

## TODO

- [x] **Privacy policy**: § 4.6 *Joining the Lab community* (consent, until unsubscribed, record deleted 3 years after the last contact), § 4.7 *Your health story* (explicit consent, never published), the exception in § 3, Resend in § 8, the `lab_member` cookie in § 9 (2026-10-09).
- [ ] **Unsubscribe.** The consent line and the policy promise it from each newsletter: the link comes with the newsletter tooling, before the first newsletter is sent. The welcome email has none.
- [ ] **The anecdote consent text says the story is « processed anonymously »**, but it is stored attached to the contact (so it can be deleted on request). The policy says what is true (read by the team only, never published, de-identified if quoted); the checkbox text, shared with mytwin.care, could say the same — a new `ANECDOTE_CONSENT_VERSION` on both sites.

Related: [`booking.md`](./booking.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
